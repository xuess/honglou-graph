/**
 * Edge TTS - 浏览器端高质量中文语音合成
 * 使用微软Edge浏览器的TTS服务（通过Cloudflare Worker代理）
 */
class EdgeTTS {
  static VOICES = {
    xiaoxiao: 'zh-CN-XiaoxiaoNeural',    // 女声 - 温暖亲切
    xiaoyi: 'zh-CN-XiaoyiNeural',        // 女声 - 活泼可爱
    yunxi: 'zh-CN-YunxiNeural',          // 男声 - 阳光少年
    yunyang: 'zh-CN-YunyangNeural',      // 男声 - 专业播报
    xiaochen: 'zh-CN-XiaochenNeural',    // 女声 - 温柔知性
    xiaohan: 'zh-CN-XiaohanNeural',      // 女声 - 端庄大气
    xiaomeng: 'zh-CN-XiaomengNeural',    // 女声 - 甜美可爱
    xiaomo: 'zh-CN-XiaomoNeural',        // 女声 - 沉稳内敛
    xiaorui: 'zh-CN-XiaoruiNeural',      // 女声 - 温和亲切
    xiaoshuang: 'zh-CN-XiaoshuangNeural', // 女声 - 稚嫩童声
    xiaoxuan: 'zh-CN-XiaoxuanNeural',    // 女声 - 知性优雅
    xiaoyan: 'zh-CN-XiaoyanNeural',      // 女声 - 温柔甜美
    xiaozhen: 'zh-CN-XiaozhenNeural',    // 女声 - 端庄大方
    yunjian: 'zh-CN-YunjianNeural',      // 男声 - 浑厚有力
    yunze: 'zh-CN-YunzeNeural',          // 男声 - 成熟稳重
  };

  static DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';
  
  // Cloudflare Worker 代理地址
  static API_BASE = 'https://edge-tts-api.xueshan.workers.dev';

  constructor() {
    this._audioContext = null;
    this._currentSource = null; // 微软 Edge TTS (Web Audio API 节点)
    this._currentAudio = null;  // 有道 API (HTMLAudioElement)
    this._isPlaying = false;
    this._abortController = null;
    this._playUnlocked = false; // 是否已成功执行暖身
  }

  /**
   * 朗读暖身方法
   * 必须在 click 响应函数中的第一阶段同步运行！
   * 这将通过一次短小的空白发声，绕开 iOS/部分移动浏览器对异步代码播放语音的拦截。
   */
  warmUp() {
    // 1. 暖身本地 Web Speech 接口
    if (typeof speechSynthesis !== 'undefined') {
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0; // 静音
        speechSynthesis.speak(u);
        speechSynthesis.cancel(); // 立即取消释放
      } catch (e) {
        console.warn('[EdgeTTS] Web Speech warm-up failed:', e);
      }
    }

    // 2. 暖身 HTMLAudioElement：播放 1微秒的空白 base64 音频
    if (!this._playUnlocked) {
      try {
        const emptyAudio = new Audio();
        emptyAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        emptyAudio.volume = 0;
        emptyAudio.play().then(() => {
          this._playUnlocked = true;
        }).catch(() => {
          // 静默忽略拦截
        });
      } catch (e) {
        // ignore
      }
    }
  }

  /**
   * 朗读文本 - 带有智能三级降级链路
   * @param {string} text - 要朗读的文本
   * @param {Object} options - 配置选项
   * @param {string} options.voice - 语音名称
   * @param {string} options.rate - 语速 (如 '+10%', '-10%')
   * @param {string} options.pitch - 音调 (如 '+0Hz', '-10Hz')
   * @returns {Promise<void>}
   */
  async speak(text, options = {}) {
    const {
      voice = EdgeTTS.DEFAULT_VOICE,
      rate = '+10%',
      pitch = '+0Hz'
    } = options;

    // 1. 清理当前所有正在运行或排队的朗读音轨
    this.stop();

    this._isPlaying = true;
    this._abortController = new AbortController();

    // 尝试执行多通道降级
    try {
      // 尝试第一级：微软高保真 Edge TTS（支持 1.8秒超时）
      await this._speakViaEdgeTTS(text, voice, rate, pitch);
    } catch (e) {
      // 如果属于用户中断操作（由于重新点击关闭，或切换人物）导致的 Abort，直接停止并放行
      if (e.name === 'AbortError' || (this._abortController && this._abortController.signal.aborted)) {
        return;
      }
      
      console.warn('[EdgeTTS] Primary Edge TTS failed, trying Level 2 (Youdao API)... Reason:', e.message);

      try {
        // 尝试第二级：网易有道词典免身份认证 TTS (MP3 加载，毫秒响应，最适合国内)
        await this._speakViaYoudaoTTS(text);
      } catch (e2) {
        if (this._abortController && this._abortController.signal.aborted) return;
        
        console.warn('[EdgeTTS] Secondary Youdao TTS failed, trying Level 3 (Browser Speech)... Reason:', e2);

        try {
          // 尝试第三级：原生浏览器 Web Speech 保底
          await this._speakViaBrowserTTS(text);
        } catch (e3) {
          console.error('[EdgeTTS] All TTS fallbacks failed:', e3);
          throw e3;
        }
      }
    } finally {
      this._isPlaying = false;
      this._abortController = null;
    }
  }

  /**
   * 停止当前所有播放
   */
  stop() {
    this._isPlaying = false;

    // A. 终止网络请求
    if (this._abortController) {
      try {
        this._abortController.abort();
      } catch (e) { /* ignore */ }
      this._abortController = null;
    }

    // B. 销毁有道 API 使用的 HTMLAudioElement
    if (this._currentAudio) {
      try {
        this._currentAudio.pause();
        this._currentAudio.src = '';
        this._currentAudio.load(); // 迫使其释放网络流
      } catch (e) { /* ignore */ }
      this._currentAudio = null;
    }

    // C. 结束微软 Edge TTS 使用的 Web Audio API 节点
    if (this._currentSource) {
      try {
        this._currentSource.stop();
      } catch (e) { /* ignore */ }
      this._currentSource = null;
    }

    // D. 彻底清空或重置系统级的 speechSynthesis 队列
    if (typeof speechSynthesis !== 'undefined') {
      try {
        speechSynthesis.cancel();
      } catch (e) { /* ignore */ }
    }
  }

  /**
   * 检查是否正在播放
   */
  get isPlaying() {
    return this._isPlaying;
  }

  /**
   * 【内部方法】一重保障：微软 Edge Neural TTS（设置 1.8秒超时）
   */
  async _speakViaEdgeTTS(text, voice, rate, pitch) {
    const ssml = this._buildSSML(text, voice, rate, pitch);
    let timer = null;

    try {
      const fetchPromise = this._fetchAudio(ssml, voice, rate, pitch);
      // 设计一个 1800 毫秒的硬超时哨兵，超时则快速扔向二级有道接口，不卡死界面
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Edge TTS API request timeout (1.8s)'));
        }, 1800);
      });

      const audioData = await Promise.race([fetchPromise, timeoutPromise]);
      if (timer) clearTimeout(timer);

      // 若在获取阶段用户已按 stop，放弃播放
      if (!this._isPlaying || (this._abortController && this._abortController.signal.aborted)) {
        return;
      }

      await this._playWebAudio(audioData);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * 【内部方法】二重保障：网易有道通用 TTS
   * 利用有道免鉴权词典接口直接提取 MP3
   */
  _speakViaYoudaoTTS(text) {
    return new Promise((resolve, reject) => {
      if (!this._isPlaying || (this._abortController && this._abortController.signal.aborted)) {
        resolve();
        return;
      }

      // 有道接口单次文本最长 200字，在此安全截取
      const safeText = text.substring(0, 200);
      const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(safeText)}&le=zh`;
      
      const audio = new Audio(url);
      this._currentAudio = audio;

      // 绑定播放事件
      audio.onended = () => {
        this._currentAudio = null;
        resolve();
      };

      audio.onerror = (e) => {
        this._currentAudio = null;
        reject(new Error('Youdao audio load failed'));
      };

      // 允许在播放结束或中断时释放它
      this._abortController?.signal?.addEventListener('abort', () => {
        try { audio.pause(); } catch (e) { /* ignore */ }
        this._currentAudio = null;
        resolve();
      });

      audio.play().catch((err) => {
        this._currentAudio = null;
        reject(err);
      });
    });
  }

  /**
   * 【内部方法】三重保障：本地 Web Speech API (speechSynthesis)
   */
  _speakViaBrowserTTS(text) {
    return new Promise((resolve, reject) => {
      if (typeof speechSynthesis === 'undefined') {
        reject(new Error('SpeechSynthesis not supported on this device'));
        return;
      }

      if (!this._isPlaying || (this._abortController && this._abortController.signal.aborted)) {
        resolve();
        return;
      }

      // 微信等浏览器偶尔在未清空时锁死 speechSynthesis，这里再次做取消
      try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }

      // HTML5 标准语音合成配置
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.9;
      utterance.pitch = 1;

      // 寻找最适合本地演说的中文字库
      const voices = speechSynthesis.getVoices();
      const chineseVoice = voices.find(v => v.lang.startsWith('zh') || v.lang.includes('CN') || v.name.includes('Chinese'));
      if (chineseVoice) {
        utterance.voice = chineseVoice;
      }

      utterance.onend = () => {
        resolve();
      };

      utterance.onerror = (event) => {
        // 部分浏览器中止属于正常现象，静默放行
        if (event.error === 'interrupted' || event.error === 'canceled') {
          resolve();
        } else {
          reject(new Error(`SpeechSynthesis error: ${event.error}`));
        }
      };

      // 注入取消订阅
      this._abortController?.signal?.addEventListener('abort', () => {
        try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
        resolve();
      });

      speechSynthesis.speak(utterance);

      // 部分浏览器偶尔由于 SpeechSynthesisUtterance.onend 不触发导致挂起
      // 设立一个自解绑安全定时器，让超长播放也有出口
      const fallbackEndTimer = setTimeout(() => {
        resolve();
      }, 15000); // 15秒通常足够正常文本读毕

      const originalOnEnd = utterance.onend;
      utterance.onend = () => {
        clearTimeout(fallbackEndTimer);
        originalOnEnd();
      };
    });
  }

  async _fetchAudio(ssml, voice, rate, pitch) {
    const url = `${EdgeTTS.API_BASE}/api/tts`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ssml: ssml,
        voice: voice,
        rate: rate,
        pitch: pitch,
      }),
      signal: this._abortController?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Edge TTS API error: ${response.status} - ${errorText}`);
    }

    const data = await response.arrayBuffer();
    return data;
  }

  _buildSSML(text, voice, rate, pitch) {
    const escapedText = this._escapeXml(text);
    return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'><voice name='${voice}'><prosody rate='${rate}' pitch='${pitch}'>${escapedText}</prosody></voice></speak>`;
  }

  async _playWebAudio(audioData) {
    if (!this._audioContext) {
      this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // 如果AudioContext被暂停，恢复它
    if (this._audioContext.state === 'suspended') {
      await this._audioContext.resume();
    }

    const audioBuffer = await this._audioContext.decodeAudioData(audioData);
    const source = this._audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this._audioContext.destination);

    this._currentSource = source;

    return new Promise((resolve, reject) => {
      source.onended = () => {
        this._currentSource = null;
        resolve();
      };

      source.onerror = (e) => {
        this._currentSource = null;
        reject(e);
      };

      source.start(0);
    });
  }

  _escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// 全局单例
window.edgeTTS = new EdgeTTS();
