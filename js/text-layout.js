(function initTextLayoutService() {
  function buildCanvasFont(style) {
    const parts = [];
    if (style.fontStyle && style.fontStyle !== 'normal') parts.push(style.fontStyle);
    if (style.fontVariantCaps && style.fontVariantCaps !== 'normal') parts.push(style.fontVariantCaps);
    if (style.fontWeight && style.fontWeight !== '400' && style.fontWeight !== 'normal') parts.push(style.fontWeight);
    parts.push(style.fontSize || '16px');
    parts.push(style.fontFamily || 'sans-serif');
    return parts.join(' ');
  }

  class TextLayoutService {
    constructor() {
      this.module = null;
      this.ready = this._loadModule();
      this._preparedCache = new Map();
      this._singleLineCache = new Map();
      this._segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
        ? new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })
        : null;
    }

    async _loadModule() {
      try {
        this.module = await import('../vendor/pretext/layout.js');
      } catch (error) {
        console.warn('Pretext 加载失败，文本布局将退回基础模式。', error);
        this.module = null;
      }
      return this.module;
    }

    isReady() {
      return Boolean(this.module);
    }

    whenReady() {
      return this.ready;
    }

    invalidateCaches() {
      this._preparedCache.clear();
      this._singleLineCache.clear();
      this.module?.clearCache?.();
    }

    getElementMetrics(element) {
      if (!element) return null;
      const style = window.getComputedStyle(element);
      const lineHeight = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) * 1.6) || 24;
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingRight = parseFloat(style.paddingRight) || 0;
      const maxWidth = Math.max(0, Math.floor(element.clientWidth - paddingLeft - paddingRight));

      return {
        font: buildCanvasFont(style),
        lineHeight,
        maxWidth,
        style
      };
    }

    measureText(text, config = {}) {
      const value = String(text || '');
      if (!this.isReady() || !value || !config.font || !config.maxWidth || !config.lineHeight) {
        return null;
      }

      const prepared = this._prepare(value, config, false);
      const result = this.module.layout(prepared, config.maxWidth, config.lineHeight);
      return {
        text: value,
        truncated: false,
        lineCount: result.lineCount,
        height: result.height
      };
    }

    fitTextToLines(text, config = {}) {
      const value = String(text || '').replace(/\s+/g, ' ').trim();
      const maxLines = Number(config.maxLines || 0);
      if (!value) {
        return { text: '', truncated: false, lineCount: 0, height: 0 };
      }

      if (!this.isReady() || !config.font || !config.maxWidth || !config.lineHeight || !maxLines) {
        return this._fallbackClamp(value, config);
      }

      const prepared = this._prepare(value, config, true);
      const lines = [];
      let cursor = { segmentIndex: 0, graphemeIndex: 0 };

      for (let index = 0; index < maxLines; index += 1) {
        const range = this.module.layoutNextLineRange(prepared, cursor, config.maxWidth);
        if (!range) {
          const textValue = lines.map((line) => this.module.materializeLineRange(prepared, line).text).join('');
          return {
            text: textValue || value,
            truncated: false,
            lineCount: lines.length,
            height: lines.length * config.lineHeight
          };
        }
        lines.push(range);
        cursor = range.end;
      }

      const overflow = this.module.layoutNextLineRange(prepared, cursor, config.maxWidth);
      if (!overflow) {
        return {
          text: lines.map((line) => this.module.materializeLineRange(prepared, line).text).join(''),
          truncated: false,
          lineCount: lines.length,
          height: lines.length * config.lineHeight
        };
      }

      const materializedLines = lines.map((line) => this.module.materializeLineRange(prepared, line).text);
      const prefix = materializedLines.slice(0, -1).join('');
      const tail = materializedLines[materializedLines.length - 1] || '';
      const ellipsis = config.ellipsis || '…';
      const fittedTail = this._fitSingleLine(tail, {
        font: config.font,
        maxWidth: config.maxWidth,
        lineHeight: config.lineHeight,
        ellipsis,
        whiteSpace: config.whiteSpace,
        wordBreak: config.wordBreak
      });

      return {
        text: `${prefix}${fittedTail.text}`,
        truncated: true,
        lineCount: maxLines,
        height: maxLines * config.lineHeight,
        fullLineCount: this.module.measureLineStats(prepared, config.maxWidth).lineCount
      };
    }

    applyClampToElement(element, options = {}) {
      if (!element) return null;
      const metrics = this.getElementMetrics(element);
      if (!metrics || !metrics.maxWidth) return null;

      const fullText = element.dataset.fullText || element.textContent || '';
      element.dataset.fullText = fullText;

      const result = this.fitTextToLines(fullText, {
        font: metrics.font,
        maxWidth: metrics.maxWidth,
        lineHeight: metrics.lineHeight,
        maxLines: options.maxLines,
        whiteSpace: options.whiteSpace || 'normal',
        wordBreak: options.wordBreak || 'keep-all',
        ellipsis: options.ellipsis || '…'
      });

      if (!result) return null;

      element.style.setProperty('--text-block-size', `${result.height}px`);
      element.title = result.truncated ? fullText : '';
      return result;
    }

    applyMeasuredHeight(element, options = {}) {
      if (!element) return null;
      const metrics = this.getElementMetrics(element);
      if (!metrics || !metrics.maxWidth) return null;

      const fullText = element.dataset.fullText || element.textContent || '';
      element.dataset.fullText = fullText;

      const result = this.measureText(fullText, {
        font: metrics.font,
        maxWidth: metrics.maxWidth,
        lineHeight: metrics.lineHeight,
        whiteSpace: options.whiteSpace || 'normal',
        wordBreak: options.wordBreak || 'keep-all'
      });

      if (!result) return null;
      element.style.setProperty('--text-block-size', `${result.height}px`);
      return result;
    }

    _prepare(text, config, withSegments) {
      const cacheKey = [
        withSegments ? 'segments' : 'plain',
        config.font,
        config.whiteSpace || 'normal',
        config.wordBreak || 'keep-all',
        text
      ].join('::');

      if (!this._preparedCache.has(cacheKey)) {
        const method = withSegments ? 'prepareWithSegments' : 'prepare';
        this._preparedCache.set(
          cacheKey,
          this.module[method](text, config.font, {
            whiteSpace: config.whiteSpace || 'normal',
            wordBreak: config.wordBreak || 'keep-all'
          })
        );
      }

      return this._preparedCache.get(cacheKey);
    }

    _fitSingleLine(text, config) {
      const trimmed = String(text || '').replace(/\s+$/g, '');
      const ellipsis = config.ellipsis || '…';
      const graphemes = this._segmentText(trimmed);
      let low = 0;
      let high = graphemes.length;
      let best = ellipsis;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidate = `${graphemes.slice(0, mid).join('').replace(/\s+$/g, '')}${ellipsis}`;
        if (this._fitsSingleLine(candidate, config)) {
          best = candidate;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      return { text: best };
    }

    _fitsSingleLine(text, config) {
      const cacheKey = [config.font, config.maxWidth, config.lineHeight, text].join('::');
      if (!this._singleLineCache.has(cacheKey)) {
        const prepared = this._prepare(text, config, false);
        const result = this.module.layout(prepared, config.maxWidth, config.lineHeight);
        this._singleLineCache.set(cacheKey, result.lineCount <= 1);
      }
      return this._singleLineCache.get(cacheKey);
    }

    _segmentText(text) {
      if (!this._segmenter) return Array.from(text || '');
      return Array.from(this._segmenter.segment(text || ''), (part) => part.segment);
    }

    _fallbackClamp(text, config) {
      const maxLines = Number(config.maxLines || 0) || 4;
      const approxCharsPerLine = Math.max(12, Math.floor((config.maxWidth || 320) / ((parseFloat(config.lineHeight) || 24) * 0.55)));
      const limit = approxCharsPerLine * maxLines;
      const truncated = text.length > limit;
      const output = truncated ? `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…` : text;
      const lineCount = Math.min(maxLines, Math.max(1, Math.ceil(output.length / approxCharsPerLine)));
      return {
        text: output,
        truncated,
        lineCount,
        height: lineCount * (config.lineHeight || 24)
      };
    }
  }

  window.textLayoutService = new TextLayoutService();
})();