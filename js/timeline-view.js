/**
 * TimelineView — 章回时间线视图
 * 以横轴为章回（1-120）、纵轴为人物，展示各人物的出场章回分布。
 */
class TimelineView {
  constructor(container) {
    this.container = container;
    this.characters = [];
    this.characterMap = new Map();
    this.relationships = [];
    this.selectedFamily = 'all';
    this.importanceThreshold = 3;
    this.hoveredCharId = null;
    this._eventsBound = false;
    this._activeTooltip = null;
    this.onCharacterClick = null;
    this.relatedCharacterIds = new Set();

    this.familyColors = {
      '贾家': '#C0392B',
      '史家': '#2980B9',
      '王家': '#27AE60',
      '薛家': '#8E44AD',
      '林家': '#16A085',
      '其他': '#E67E22'
    };

    this.families = ['贾家', '史家', '王家', '薛家', '林家', '其他'];
  }

  setData(characters, relationships) {
    this.characters = characters || [];
    this.relationships = relationships || [];
    this.characterMap = new Map();
    this.characters.forEach(c => this.characterMap.set(c.id, c));
  }

  setFacetContext(facetState = {}) {
    this.relatedCharacterIds = new Set(facetState.selectedCharacterIds || []);
    this._syncHighlights();
  }

  render() {
    this.container.innerHTML = '';
    this._renderShell();
    this._renderChart();
    this._bindEvents(); // always re-bind with cleanup
  }

  // ── Filter helpers ─────────────────────────────────────────────────────────

  _getFilteredChars() {
    return this.characters
      .filter(c => c.importance >= this.importanceThreshold)
      .filter(c => this.selectedFamily === 'all' || c.family === this.selectedFamily)
      .filter(c => (c.chapters || []).length > 0)
      .sort((a, b) => (b.importance - a.importance) || a.name.localeCompare(b.name, 'zh'));
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _renderShell() {
    const familyBtns = ['all', ...this.families].map(f => {
      const isAll = f === 'all';
      const label = isAll ? '全部' : f;
      const color = isAll ? '' : this.familyColors[f] || '#999';
      const active = this.selectedFamily === f ? 'active' : '';
      const dotStyle = color ? `--tl-dot:${color}` : '';
      return `<button class="tl-family-btn ${active}" data-family="${f}" style="${dotStyle}">${label}</button>`;
    }).join('');

    const levelBtns = [
      { level: 4, label: '核心' },
      { level: 3, label: '主要' },
      { level: 2, label: '全部' }
    ].map(({ level, label }) =>
      `<button class="tl-level-btn ${this.importanceThreshold === level ? 'active' : ''}" data-level="${level}">${label}</button>`
    ).join('');

    this.container.innerHTML = `
      <div class="timeline-shell">
        <div class="tl-toolbar card-surface">
          <div class="tl-toolbar-group">
            <span class="tl-toolbar-label">家族</span>
            <div class="tl-family-tabs">${familyBtns}</div>
          </div>
          <div class="tl-toolbar-group">
            <span class="tl-toolbar-label">层级</span>
            <div class="tl-level-tabs">${levelBtns}</div>
          </div>
          <div class="tl-toolbar-tip">点击人物名查看详情 · 点击圆点查看章回</div>
        </div>
        <div class="tl-content-wrap">
          <div class="tl-chart-container" id="tl-chart-container"></div>
        </div>
      </div>
    `;
  }

  _renderChart() {
    const container = this.container.querySelector('#tl-chart-container');
    if (!container) return;

    const chars = this._getFilteredChars();
    if (!chars.length) {
      container.innerHTML = '<div class="tl-empty">暂无符合条件的人物章回数据</div>';
      return;
    }

    const TOTAL = 120;
    const LABEL_W = 110;
    const CELL_W = 12;
    const totalW = LABEL_W + TOTAL * CELL_W;

    // Chapter axis row
    let axisHtml = `<div class="tl-row tl-axis-row" style="width:${totalW}px">`;
    axisHtml += `<div class="tl-label tl-axis-label">人物 / 章回</div>`;
    axisHtml += '<div class="tl-track">';
    for (let i = 1; i <= TOTAL; i++) {
      const showLabel = (i === 1 || i % 10 === 0);
      axisHtml += `<div class="tl-cell tl-axis-cell">${showLabel ? i : ''}</div>`;
    }
    axisHtml += '</div></div>';

    // Character rows
    const rowsHtml = chars.map(char => {
      const chapSet = new Set((char.chapters || []).map(c => c.chapter));
      const chapMap = new Map((char.chapters || []).map(c => [c.chapter, c]));
      const color = this.familyColors[char.family] || this.familyColors['其他'];
      const isRelated = this.relatedCharacterIds.has(char.id);
      const importanceStar = '★'.repeat(char.importance || 1);

      let dots = '';
      for (let i = 1; i <= TOTAL; i++) {
        if (chapSet.has(i)) {
          const info = chapMap.get(i);
          const escapedTitle = (info?.title || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
          const escapedSummary = (info?.summary || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
          dots += `<div class="tl-cell"><button type="button" class="tl-dot" style="--dot-color:${color}" data-char="${char.id}" data-chapter="${i}" data-title="${escapedTitle}" data-summary="${escapedSummary}" aria-label="${char.name} 第${i}回"></button></div>`;
        } else {
          dots += `<div class="tl-cell"><span class="tl-dot-empty" aria-hidden="true"></span></div>`;
        }
      }

      return `
        <div class="tl-row ${isRelated ? 'tl-row-related' : ''}" data-char-id="${char.id}" style="width:${totalW}px">
          <div class="tl-label tl-char-label" data-char-id="${char.id}">
            <span class="tl-char-dot" style="background:${color}"></span>
            <span class="tl-char-name" title="${char.name}（${importanceStar}）">${char.name}</span>
          </div>
          <div class="tl-track">${dots}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="tl-chart" id="tl-chart">
        ${axisHtml}
        <div class="tl-rows">${rowsHtml}</div>
      </div>
    `;
  }

  _syncHighlights() {
    if (!this.container) return;
    this.container.querySelectorAll('.tl-row[data-char-id]').forEach(row => {
      const charId = row.dataset.charId;
      const isRelated = this.relatedCharacterIds.has(charId);
      row.classList.toggle('tl-row-related', isRelated);
    });
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  _bindEvents() {
    // Remove any previously bound listeners to prevent duplicates
    if (this._clickHandler) this.container.removeEventListener('click', this._clickHandler);
    if (this._mouseoverHandler) this.container.removeEventListener('mouseover', this._mouseoverHandler);
    if (this._mouseleaveHandler) this.container.removeEventListener('mouseleave', this._mouseleaveHandler);

    this._clickHandler = e => this._handleClick(e);
    this._mouseoverHandler = e => this._handleMouseover(e);
    this._mouseleaveHandler = e => {
      if (!e.relatedTarget || !this.container.contains(e.relatedTarget)) {
        this._hideTooltip();
      }
    };

    this.container.addEventListener('click', this._clickHandler);
    this.container.addEventListener('mouseover', this._mouseoverHandler);
    this.container.addEventListener('mouseleave', this._mouseleaveHandler);
  }

  _handleClick(e) {
    // Family filter
    const familyBtn = e.target.closest('.tl-family-btn');
    if (familyBtn) {
      this.selectedFamily = familyBtn.dataset.family;
      this.container.querySelectorAll('.tl-family-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.family === this.selectedFamily)
      );
      this._rerenderChart();
      return;
    }

    // Level filter
    const levelBtn = e.target.closest('.tl-level-btn');
    if (levelBtn) {
      this.importanceThreshold = parseInt(levelBtn.dataset.level);
      this.container.querySelectorAll('.tl-level-btn').forEach(b =>
        b.classList.toggle('active', parseInt(b.dataset.level) === this.importanceThreshold)
      );
      this._rerenderChart();
      return;
    }

    // Character name label → open character
    const charLabel = e.target.closest('.tl-char-label');
    if (charLabel?.dataset.charId) {
      const char = this.characterMap.get(charLabel.dataset.charId);
      if (char && this.onCharacterClick) this.onCharacterClick(char);
      return;
    }

    // Dot click → show tooltip
    const dot = e.target.closest('.tl-dot');
    if (dot) {
      this._showDotTooltip(dot, true);
    }
  }

  _handleMouseover(e) {
    const dot = e.target.closest('.tl-dot');
    if (dot) {
      this._showDotTooltip(dot, false);
    }
  }

  _showDotTooltip(dot, sticky) {
    const charId = dot.dataset.char;
    const chapter = parseInt(dot.dataset.chapter);
    const char = this.characterMap.get(charId);
    if (!char) return;

    const title = dot.dataset.title || '';
    const summary = dot.dataset.summary || '';
    const color = this.familyColors[char.family] || this.familyColors['其他'];

    this._hideTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'tl-tooltip';
    tooltip.innerHTML = `
      <div class="tl-tooltip-header">
        <span class="tl-tooltip-dot" style="background:${color}"></span>
        <strong class="tl-tooltip-name">${char.name}</strong>
        <span class="tl-tooltip-ch">第${chapter}回</span>
      </div>
      ${title ? `<div class="tl-tooltip-title">${title}</div>` : ''}
      ${summary ? `<div class="tl-tooltip-summary">${summary.slice(0, 80)}${summary.length > 80 ? '…' : ''}</div>` : ''}
      ${sticky ? '<div class="tl-tooltip-hint">点击人物名查看详细信息</div>' : ''}
    `;

    // Position near dot (viewport-clamped, can flip to top)
    const dotRect = dot.getBoundingClientRect();
    const margin = 10;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const maxWidth = Math.max(180, Math.min(220, viewportW - margin * 2));
    const maxHeight = Math.max(120, viewportH - margin * 2);
    tooltip.style.maxWidth = `${maxWidth}px`;
    tooltip.style.maxHeight = `${maxHeight}px`;
    tooltip.style.overflowY = 'auto';
    tooltip.style.boxSizing = 'border-box';
    tooltip.style.position = 'fixed';
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';
    tooltip.style.visibility = 'hidden';
    document.body.appendChild(tooltip);

    const tipRect = tooltip.getBoundingClientRect();

    let left = dotRect.left;
    if (left + tipRect.width > viewportW - margin) left = viewportW - tipRect.width - margin;
    if (left < margin) left = margin;
    left = Math.min(left, Math.max(margin, viewportW - tipRect.width - margin));

    let top = dotRect.bottom + 8;
    if (top + tipRect.height > viewportH - margin) {
      top = dotRect.top - tipRect.height - 8;
    }
    if (top < margin) top = margin;
    top = Math.min(top, Math.max(margin, viewportH - tipRect.height - margin));

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.visibility = 'visible';

    this._activeTooltip = tooltip;

    if (!sticky) {
      // Auto-hide on mouseleave from the dot
      const hide = () => {
        this._hideTooltip();
        dot.removeEventListener('mouseleave', hide);
      };
      dot.addEventListener('mouseleave', hide);
    } else {
      // Sticky: dismiss on next click
      const dismiss = (evt) => {
        if (!tooltip.contains(evt.target)) {
          this._hideTooltip();
          document.removeEventListener('click', dismiss, true);
        }
      };
      setTimeout(() => document.addEventListener('click', dismiss, true), 10);
    }
  }

  _hideTooltip() {
    if (this._activeTooltip) {
      this._activeTooltip.remove();
      this._activeTooltip = null;
    }
  }

  _rerenderChart() {
    const container = this.container.querySelector('#tl-chart-container');
    if (container) {
      this._hideTooltip();
      this._renderChart();
    }
  }
}
