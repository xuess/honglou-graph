/**
 * AudioPreloadCache - 预生成音频本地缓存播放器（多引擎版）
 *
 * 架构：
 *   manifest.json 中每个知识条目支持多个引擎的音频文件：
 *   {
 *     "item_id": {
 *       "file": "...",               // Edge TTS 默认音频
 *       "engine:mimo_冰糖": {         // MiMo 冰糖语音
 *         "file": "...",
 *         ...
 *       },
 *       "engine:mimo_茉莉": { ... }   // MiMo 茉莉语音
 *     }
 *   }
 *
 * 策略：
 * 1. 首次播放时 fetch audio-manifest.json（惰性加载，不阻塞页面渲染）
 * 2. 命中引擎指定的音频 → HTMLAudioElement 直接播放（毫秒级延迟）
 * 3. 缓存未命中或加载失败 → 回退到 window.edgeTTS（原有三级降级链）
 * 4. 已播放过的条目缓存 Audio 元素引用（避免重复创建）
 */

class AudioPreloadCache {
  constructor() {
    this._manifest = null;
    this._manifestLoading = false;
    this._manifestLoadFailed = false;
    this._audioCache = new Map();   // `${engine}:${id}` → HTMLAudioElement
    this._currentEngine = 'mimo_白桦';  // 默认引擎
    this._currentId = null;
    this._currentAudio = null;
    this._manifestUrl = 'audio/audio-manifest.json';
    this._onEngineChange = null;   // 外部注册的回调
  }

  // ─── 引擎管理 ──────────────────────────────────────────────────────────────

  /**
   * 设置当前引擎
   * @param {string} engine - 引擎标识：'edge_tts' | 'mimo_冰糖' | 'mimo_茉莉' | ...
   */
  setEngine(engine) {
    if (this._currentEngine === engine) return;
    this.stop();
    this._currentEngine = engine;
    if (this._onEngineChange) this._onEngineChange(engine);
  }

  get engine() {
    return this._currentEngine;
  }

  /**
   * 获取 manifest 中所有可用的引擎列表
   * @returns {Array<{id: string, label: string, provider: string}>}
   */
  getAvailableEngines() {
    if (!this._manifest) return [];

    // 从 manifest 条目中扫描所有引擎
    const engineSet = new Set();
    const entries = Object.values(this._manifest).slice(0, 20);
    for (const entry of entries) {
      for (const key of Object.keys(entry)) {
        if (key.startsWith('engine:')) engineSet.add(key);
      }
    }

    // 用 engines 元数据补充 label，否则自动生成
    const meta = this._manifestMeta?.engines || {};
    const engines = [];
    for (const key of [...engineSet].sort()) {
      const id = key.replace('engine:', '');  // 'mimo_白桦' 而非 'engine:mimo_白桦'
      const info = meta[id];
      if (info) {
        engines.push({ id, label: `${info.voice}（${info.provider || 'mimo'}）`, provider: info.provider || 'mimo' });
      } else {
        const voice = id.replace('mimo_', '');
        engines.push({ id, label: `${voice}（mimo）`, provider: 'mimo' });
      }
    }
    return engines;
  }

  // ─── 播放控制 ──────────────────────────────────────────────────────────────

  /**
   * 检查指定 id 在当前引擎下是否有预生成音频
   */
  has(id) {
    if (!this._manifest) return false;
    const entry = this._manifest[id];
    if (!entry) return false;
    const engineEntry = this._resolveEngineEntry(entry, this._currentEngine);
    return engineEntry && engineEntry.file && engineEntry.status !== 'failed';
  }

  /**
   * 播放预生成音频（若存在）
   * @param {string} id - knowledge 条目 id
   * @param {string} text - 原始文本（用于回退 TTS）
   * @returns {Promise<void>} - 播放完成时 resolve；缓存未命中 reject 触发回退
   */
  async play(id, text) {
    await this._ensureManifest();

    if (!this.has(id)) {
      throw new Error('cache_miss');
    }

    const audio = this._getAudio(id, this._currentEngine);
    if (!audio) {
      throw new Error('cache_miss');
    }

    this._stopCurrent();
    this._currentId = id;
    this._currentAudio = audio;

    return new Promise((resolve, reject) => {
      const onEnded = () => {
        cleanup();
        this._currentId = null;
        this._currentAudio = null;
        resolve();
      };

      const onError = () => {
        cleanup();
        this._currentId = null;
        this._currentAudio = null;
        this._audioCache.delete(`${this._currentEngine}:${id}`);
        // 标记该引擎条目失败，下次直接走回退
        const entry = this._manifest[id];
        const engineEntry = this._resolveEngineEntry(entry, this._currentEngine);
        if (engineEntry) engineEntry.status = 'failed';
        reject(new Error('audio_load_error'));
      };

      const cleanup = () => {
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
      };

      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);

      try {
        audio.play().catch((err) => {
          cleanup();
          this._currentId = null;
          this._currentAudio = null;
          reject(err);
        });
      } catch (err) {
        cleanup();
        this._currentId = null;
        this._currentAudio = null;
        reject(err);
      }
    });
  }

  /**
   * 停止当前播放
   */
  stop() {
    if (this._currentAudio) {
      try {
        this._currentAudio.pause();
        this._currentAudio.currentTime = 0;
      } catch (e) { /* ignore */ }
    }
    this._currentId = null;
    this._currentAudio = null;
  }

  get isPlaying() {
    return this._currentAudio !== null && !this._currentAudio.paused;
  }

  get currentId() {
    return this._currentId;
  }

  // ─── private ────────────────────────────────────────────────────────────────

  /**
   * 解析引擎特定的 manifest 条目
   * @param {Object} entry - 单个知识条目的 manifest 对象
   * @param {string} engine - 引擎标识
   * @returns {Object|null}
   */
  _resolveEngineEntry(entry, engine) {
    if (!entry) return null;
    // 查找引擎特定条目
    const engineEntry = entry[engine] || entry[`engine:${engine}`];
    if (engineEntry && engineEntry.file && engineEntry.status !== 'failed') return engineEntry;
    return null;
  }

  async _ensureManifest() {
    if (this._manifest || this._manifestLoadFailed) return;
    if (this._manifestLoading) {
      await this._manifestLoading;
      return;
    }
    this._manifestLoading = this._fetchManifest();
    try {
      await this._manifestLoading;
    } catch (e) {
      this._manifestLoadFailed = true;
      this._manifestLoading = null;
      console.warn('[AudioPreloadCache] manifest 加载失败:', e.message);
    }
  }

  async _fetchManifest() {
    try {
      const resp = await fetch(this._manifestUrl, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this._manifest = data.manifest || {};
      this._manifestMeta = data;  // 保留顶层元数据
      const engines = this.getAvailableEngines();
      console.info(`[AudioPreloadCache] 已加载 ${Object.keys(this._manifest).length} 条音频，可用引擎: ${engines.map(e => e.label).join(', ')}`);
    } catch (e) {
      this._manifest = {};
      this._manifestLoadFailed = true;
      throw e;
    }
  }

  /**
   * 获取或创建指定 id + engine 的 HTMLAudioElement
   */
  _getAudio(id, engine) {
    const cacheKey = `${engine}:${id}`;
    if (this._audioCache.has(cacheKey)) {
      const audio = this._audioCache.get(cacheKey);
      if (audio.ended || audio.paused) {
        audio.currentTime = 0;
      }
      return audio;
    }

    const entry = this._manifest && this._manifest[id];
    if (!entry) return null;

    const engineEntry = this._resolveEngineEntry(entry, engine);
    if (!engineEntry || !engineEntry.file) return null;

    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = engineEntry.file;
    this._audioCache.set(cacheKey, audio);
    return audio;
  }

  _stopCurrent() {
    if (this._currentAudio) {
      try {
        this._currentAudio.pause();
        this._currentAudio.currentTime = 0;
      } catch (e) { /* ignore */ }
    }
  }
}

// 全局单例
window.__audioPreloadCache = new AudioPreloadCache();
