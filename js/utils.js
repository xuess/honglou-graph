/**
 * utils.js - Shared utility functions
 * All functions are available globally after script load.
 */

const HLMUtils = {
  /**
   * Escape HTML special characters to prevent XSS
   * @param {string} text - The text to escape
   * @returns {string} Escaped text safe for innerHTML
   */
  escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /**
   * Escape text for use in HTML attributes
   * @param {string} text - The text to escape
   * @returns {string} Escaped text safe for attributes
   */
  escapeHtmlAttr(text) {
    return HLMUtils.escapeHtml(text).replace(/"/g, '&quot;');
  },

  /**
   * 复位视图滚动位置。
   * 桌面端各区各自滚动；手机端非图谱视图改由 .main-container 整页滚动，
   * 因此切换条目/筛选后需同时复位该容器。两处一起处理，空操作无副作用。
   */
  scrollViewToTop() {
    const viewport = document.querySelector('.main-container');
    if (viewport) viewport.scrollTo({ top: 0, behavior: 'instant' });
  },

  /**
   * 把元素顶端对齐到当前视图滚动层的可视区顶部（仅整页滚动时生效）。
   * @param {Element} el
   * @param {number} gap - 与视口顶部留白
   * @returns {boolean} 是否发生了整页滚动
   */
  scrollElementIntoViewTop(el, gap = 8) {
    if (!el) return false;
    const viewport = document.querySelector('.main-container');
    if (!viewport || viewport.scrollHeight <= viewport.clientHeight + 1) return false;
    const viewportTop = viewport.getBoundingClientRect().top;
    // 页头/上下文条固定覆盖在滚动区上方，对齐时要让开这段高度
    let inset = 0;
    for (const fixed of document.querySelectorAll('.header, .global-context-bar')) {
      const rect = fixed.getBoundingClientRect();
      if (rect.height > 0 && rect.bottom > inset && rect.top <= viewportTop + 1) {
        inset = rect.bottom - viewportTop;
      }
    }
    const target = el.getBoundingClientRect().top - viewportTop + viewport.scrollTop - inset - gap;
    viewport.scrollTo({ top: Math.max(0, target), behavior: 'instant' });
    return true;
  },

  /**
   * Debounce a function call
   * @param {Function} fn - The function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Bind search input with debounce and IME composition support
   * @param {HTMLInputElement} input - The input element
   * @param {Function} callback - Called with the search value
   * @param {number} delay - Debounce delay in ms (default 180)
   * @returns {Function} Cleanup function to remove listeners
   */
  bindSearchWithDebounce(input, callback, delay = 180) {
    if (!input) return () => {};
    
    let isComposing = false;
    let timer;
    
    const handleInput = () => {
      if (isComposing) return;
      clearTimeout(timer);
      timer = setTimeout(() => callback(input.value), delay);
    };
    
    const onCompositionStart = () => { isComposing = true; };
    const onCompositionEnd = () => {
      isComposing = false;
      handleInput();
    };
    
    input.addEventListener('compositionstart', onCompositionStart);
    input.addEventListener('compositionend', onCompositionEnd);
    input.addEventListener('input', handleInput);
    
    return () => {
      clearTimeout(timer);
      input.removeEventListener('compositionstart', onCompositionStart);
      input.removeEventListener('compositionend', onCompositionEnd);
      input.removeEventListener('input', handleInput);
    };
  },

  /**
   * Family color mapping used across views
   */
  familyColors: {
    '贾家': '#C0392B',
    '史家': '#2980B9',
    '王家': '#27AE60',
    '薛家': '#8E44AD',
    '林家': '#16A085',
    '其他': '#E67E22'
  },

  /**
   * Get family group for a character (falls back to '其他')
   */
  getFamilyGroup(character) {
    return HLMUtils.familyColors[character.family] ? character.family : '其他';
  },

  /**
   * Get the color for a character's family
   */
  getNodeColor(character) {
    return HLMUtils.familyColors[HLMUtils.getFamilyGroup(character)] || HLMUtils.familyColors['其他'];
  },

  /**
   * Relation type color mapping
   */
  relationColors: {
    blood: '#4A90D9',
    marriage: '#E74C3C',
    master_servant: '#95A5A6',
    romance: '#E91E8C',
    social: '#F39C12',
    rivalry: '#8E44AD'
  },

  /**
   * Relation type label mapping
   */
  relationLabels: {
    blood: '血缘',
    marriage: '婚姻',
    master_servant: '主仆',
    romance: '情感',
    social: '社交',
    rivalry: '敌对'
  },

  /**
   * Check if device is in low performance mode
   */
  isLowPerformance() {
    return document.body.classList.contains('performance-low');
  },

  /**
   * Check if a character is a servant based on identity
   */
  isServant(character) {
    const identity = (character.identity || '').toLowerCase();
    const servantKeywords = ['丫鬟', '丫环', '仆人', '仆妇', '小厮', '管家', '嬷嬷', '陪房', '通房', '粗使', '戏子', '奴'];
    return servantKeywords.some((keyword) => identity.includes(keyword));
  },

  /**
   * 类别色是装饰色，直接用作小字号文字时对比度常低于 4.5:1。
   * 按固定比例向墨色 #2C1810 靠拢，既保留色相区分，又保证浅底可读。
   * @param {string} hex - #RRGGBB 颜色
   * @param {number} ratio - 向墨色混合的比例，0.4 可让现有类别色全部达到 4.5:1
   * @returns {string} 加深后的 #RRGGBB
   */
  darkenForText(hex, ratio = 0.4) {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!match) return hex;
    const value = parseInt(match[1], 16);
    const ink = [0x2c, 0x18, 0x10];
    const channels = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
      .map((channel, index) => Math.round(channel * (1 - ratio) + ink[index] * ratio));
    return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  },

  /**
   * Initialize panel resize handle for left-right layouts
   * @param {HTMLElement} container - The container element with the layout
   * @param {Object} options - Configuration options
   * @param {string} options.handleSelector - CSS selector for resize handle
   * @param {string} options.sidebarSelector - CSS selector for sidebar
   * @param {string} options.cssVarName - CSS variable name for sidebar width
   * @param {number} options.defaultWidth - Default sidebar width
   * @param {number} options.minWidth - Minimum sidebar width (default 220)
   * @param {number} options.maxWidth - Maximum sidebar width (default 480)
   * @param {string} options.storageKey - localStorage key for saving width
   */
  initPanelResize(container, options = {}) {
    const {
      handleSelector = '.panel-resize-handle',
      sidebarSelector,
      cssVarName,
      defaultWidth = 280,
      minWidth = 220,
      maxWidth = 480,
      storageKey
    } = options;

    const handle = container.querySelector(handleSelector);
    if (!handle) return;

    // Restore saved width
    const savedWidth = storageKey ? Number(localStorage.getItem(storageKey)) : 0;
    const initialWidth = Number.isFinite(savedWidth) && savedWidth > 0 ? savedWidth : defaultWidth;
    document.documentElement.style.setProperty(cssVarName, `${initialWidth}px`);

    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    const applyWidth = (width) => {
      const clampedWidth = Math.min(maxWidth, Math.max(minWidth, Math.round(width)));
      document.documentElement.style.setProperty(cssVarName, `${clampedWidth}px`);
      return clampedWidth;
    };

    const onPointerMove = (event) => {
      if (!isDragging) return;
      const nextWidth = startWidth + (event.clientX - startX);
      applyWidth(nextWidth);
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      document.body.classList.remove('panel-resizing');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      if (storageKey) {
        const currentWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue(cssVarName), 10) || defaultWidth;
        localStorage.setItem(storageKey, String(currentWidth));
      }
      window.dispatchEvent(new Event('resize'));
    };

    handle.addEventListener('pointerdown', (event) => {
      isDragging = true;
      startX = event.clientX;
      startWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue(cssVarName), 10) || defaultWidth;
      document.body.classList.add('panel-resizing');

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      event.preventDefault();
    });

    handle.addEventListener('keydown', (event) => {
      const currentWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue(cssVarName), 10) || defaultWidth;
      const step = event.shiftKey ? 40 : 10;
      let newWidth = currentWidth;
      if (event.key === 'ArrowLeft') newWidth = currentWidth - step;
      else if (event.key === 'ArrowRight') newWidth = currentWidth + step;
      else return;
      event.preventDefault();
      applyWidth(newWidth);
      if (storageKey) {
        localStorage.setItem(storageKey, String(newWidth));
      }
      window.dispatchEvent(new Event('resize'));
    });
  }
};
