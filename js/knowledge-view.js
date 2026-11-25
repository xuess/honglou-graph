class KnowledgeView {
  constructor(container) {
    this.container = container;
    this.knowledge = [];
    this.characters = [];
    this.characterMap = new Map();
    this.onCharacterClick = null;

    this.activeCategory = 'all';
    this.activeSubcategory = 'all';
    this.searchQuery = '';
    this.chapterFilter = 'all';
    this.sortBy = 'relevance';
    this.expandedIds = new Set();
    this.displayCount = 40;
    this._searchTimer = null;
    this._deferredRenderTimer = null;
    this._deferredRenderToken = 0;
    this._eventsBound = false;
    this._eventController = null;
    this.onTagClick = null;
    this.relatedCharacterIds = new Set();
    this.characterKnowledgeMap = new Map();
    this.tagIndex = new Map();
    this.fuse = null;
    this._lastFilterSignature = '';
    this._lastFilteredItems = [];
    this._visibleItems = [];
    this._activeJumpTargetId = null;
    this._jumpHighlightTimer = null;
    this._pendingJumpFrame = null;
    this._pendingJumpTimer = null;
    this._textLayoutFrame = null;
    this._textLayoutToken = 0;
    this._layoutResizeObserver = null;
    this._keyboardNavIndex = -1;
    this._keyboardNavColumnCount = 1;

    this.categoryConfig = {
      '判词': { icon: '📜', color: '#8B2500' },
      '曲词': { icon: '🎵', color: '#8E44AD' },
      '诗词': { icon: '✒️', color: '#4A6B8A' },
      '对联': { icon: '🏮', color: '#C0392B' },
      '典故': { icon: '📖', color: '#16A085' },
      '名场面': { icon: '🎭', color: '#C49A2A' },
      '回目知识点': { icon: '📚', color: '#4A7C59' },
      '回目知识': { icon: '📚', color: '#4A7C59' },
      '灯谜': { icon: '🏮', color: '#B35C1E' },
      '建筑': { icon: '🏯', color: '#6C4A9A' },
      '园林空间': { icon: '🌿', color: '#237A57' },
      '器物服饰': { icon: '🎐', color: '#8C6A1A' },
      '饮食养生': { icon: '🍵', color: '#9A4A3A' },
      '礼俗制度': { icon: '🪭', color: '#356A9A' },
      '药方': { icon: '💊', color: '#5D6D7E' },
      '生僻字': { icon: '🔤', color: '#5D4E6D' },
      '生僻字词': { icon: '🔤', color: '#5D4E6D' },
      '人物出场': { icon: '👗', color: '#D4709A' },
      '场景': { icon: '🏞️', color: '#4A7C59' },
      '主题研究': { icon: '🔍', color: '#7B4F8A' },
      '人物专题': { icon: '👤', color: '#C0605A' }
    };
  }

  _isLowPerformanceMode() {
    return document.body.classList.contains('performance-low');
  }

  _getBaseDisplayCount() {
    // 默认折叠卡片后 20/12 条已经够浏览，先让“加载更多”和后续分类保持可达。
    return this._isLowPerformanceMode() ? 12 : 20;
  }

  _getLoadStep() {
    return this._isLowPerformanceMode() ? 12 : 20;
  }

  _getDeferredChunkSize() {
    return this._isLowPerformanceMode() ? 6 : 12;
  }

  _clearDeferredRender() {
    this._deferredRenderToken += 1;
    if (this._deferredRenderTimer) {
      window.clearTimeout(this._deferredRenderTimer);
      this._deferredRenderTimer = null;
    }
  }

  _clearTextLayoutWork() {
    this._textLayoutToken += 1;
    if (this._textLayoutFrame) {
      window.cancelAnimationFrame(this._textLayoutFrame);
      this._textLayoutFrame = null;
    }
  }

  _getPreviewLineLimit(item) {
    if (this._isLowPerformanceMode()) return 3;
    if (['诗词', '曲词', '判词'].includes(item?.category)) return 5;
    return 4;
  }

  _scheduleDeferredCards(contentEl, remainingItems = [], filteredItems = [], token) {
    if (!contentEl || !remainingItems.length) {
      this._renderLoadMoreButton(contentEl, filteredItems, this._visibleItems.length);
      return;
    }

    const activeToken = token ?? this._deferredRenderToken;
    const step = () => {
      if (activeToken !== this._deferredRenderToken || !contentEl.isConnected) return;

      const chunkSize = this._getDeferredChunkSize();
      const chunk = remainingItems.splice(0, chunkSize);
      if (chunk.length) {
        contentEl.insertAdjacentHTML('beforeend', chunk.map((item) => this._renderKnowledgeCard(item)).join(''));
        this._scheduleTextLayoutPass();
      }

      if (remainingItems.length) {
        this._deferredRenderTimer = window.setTimeout(step, 32);
        return;
      }

      this._deferredRenderTimer = null;
      this._renderLoadMoreButton(contentEl, filteredItems, this._visibleItems.length);
      this._syncKnowledgeHighlights();
      this._scheduleTextLayoutPass();
    };

    this._deferredRenderTimer = window.setTimeout(step, 32);
  }

  _renderLoadMoreButton(contentEl, filteredItems, visibleCount) {
    if (!contentEl) return;
    const existingButton = contentEl.querySelector('[data-action="load-more"]');
    if (existingButton) existingButton.remove();

    if (filteredItems.length > visibleCount) {
      contentEl.insertAdjacentHTML('beforeend', `<button class="knowledge-load-more" data-action="load-more">加载更多（已显示 ${visibleCount} / ${filteredItems.length} 条）</button>`);
    }
  }

  setData(knowledge, characters) {
    this.knowledge = knowledge || [];
    this.characters = characters || [];
    this.characterMap = new Map();
    this.characters.forEach((character) => this.characterMap.set(character.id, character));
    this._buildIndexes();
    this._buildFuseIndex();
    this._awaitFuseModule();
  }

  /**
   * fuse.js 现在是本地 ESM，由 index.html 的模块脚本异步加载到 window.Fuse。
   * 如果 setData 时它还没就绪，等加载完成后补建索引并刷新当前结果。
   */
  _awaitFuseModule() {
    if (this.fuse || typeof Fuse !== 'undefined') return;
    const started = Date.now();
    const retry = () => {
      if (typeof Fuse !== 'undefined') {
        this._buildFuseIndex();
        this._invalidateFilterCache();
        this._updateContent();
        return;
      }
      if (Date.now() - started > 5000) return;
      window.setTimeout(retry, 50);
    };
    window.setTimeout(retry, 50);
  }

  setFacetContext(facetState = {}) {
    this.relatedCharacterIds = new Set(facetState.selectedCharacterIds || []);
  }

  render() {
    const existingLayout = this.container.querySelector('.knowledge-shell');
    if (existingLayout) {
      this._updateContent();
      return;
    }
    
    this._clearDeferredRender();
    this.container.innerHTML = '';
    const filteredItems = this._getFilteredItems();
    const overview = this._getOverviewStats();
    const categories = this._getCategories();
    const subcategories = this._getSubcategories();
    const chapterOptions = this._getChapterOptions();
    const hotTags = this._getHotTags(filteredItems);
    this.displayCount = this._getBaseDisplayCount();
    this._ensureJumpTargetRendered(filteredItems);
    const initialDisplayCount = this.displayCount;

    this.container.innerHTML = `
      <section class="knowledge-shell">
        <div class="knowledge-hero card-surface">
          <div class="knowledge-hero-copy">
            <span class="knowledge-hero-eyebrow">红楼梦百科索引</span>
            <h2 class="knowledge-hero-title">不是摘要，而是可检索、可浏览、可追溯的知识库</h2>
            <p class="knowledge-hero-desc">覆盖判词、诗词、曲文、对联、灯谜、建筑园林、礼俗制度、器物饮食与回目知识点，支持按类别、章节、关键词多维检索。</p>
          </div>
          <div class="knowledge-hero-stats">
            <div class="knowledge-stat-card">
              <span>总条目</span>
              <strong>${overview.total}</strong>
            </div>
            <div class="knowledge-stat-card">
              <span>知识类别</span>
              <strong>${overview.categories}</strong>
            </div>
            <div class="knowledge-stat-card">
              <span>关联人物</span>
              <strong>${overview.characters}</strong>
            </div>
            <div class="knowledge-stat-card">
              <span>覆盖回目</span>
              <strong>${overview.chapters}</strong>
            </div>
          </div>
        </div>

        <div class="knowledge-layout">
          <aside class="knowledge-sidebar card-surface">
            <div class="knowledge-sidebar-section">
              <div class="knowledge-sidebar-title">搜索知识</div>
              <div class="knowledge-search-box">
                <span class="knowledge-search-icon">🔍</span>
                <input id="knowledge-search-input" name="knowledge-search" class="knowledge-search-input" type="text" placeholder="搜索诗词、灯谜、建筑、人物、场景…" value="${this._escapeHtml(this.searchQuery)}">
              </div>
            </div>

            <div class="knowledge-sidebar-section">
              <div class="knowledge-sidebar-title">主类别</div>
              <div class="knowledge-tabs knowledge-tabs-block">
                <button class="knowledge-tab ${this.activeCategory === 'all' ? 'active' : ''}" data-cat="all">
                  全部 <span class="knowledge-tab-count">${this.knowledge.length}</span>
                </button>
                ${categories.map((category) => `
                  <button class="knowledge-tab ${this.activeCategory === category.name ? 'active' : ''}" data-cat="${category.name}">
                    ${(this.categoryConfig[category.name] || {}).icon || '📄'} ${category.name}
                    <span class="knowledge-tab-count">${category.count}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <button type="button" class="knowledge-more-toggle" data-action="toggle-more-filters" aria-expanded="false" aria-controls="knowledge-secondary-filters">
              <span class="knowledge-more-label">更多筛选</span>
              <span class="knowledge-more-icon" aria-hidden="true">▾</span>
            </button>

            <div class="knowledge-secondary-filters" id="knowledge-secondary-filters">
              <div class="knowledge-sidebar-section">
                <div class="knowledge-sidebar-title">细分主题</div>
                <div class="knowledge-chip-group" data-subcategory-group>
                  <button class="knowledge-chip ${this.activeSubcategory === 'all' ? 'active' : ''}" data-subcategory="all">全部主题</button>
                  ${subcategories.map((subcategory) => `
                    <button class="knowledge-chip ${this.activeSubcategory === subcategory ? 'active' : ''}" data-subcategory="${subcategory}">${subcategory}</button>
                  `).join('')}
                </div>
              </div>

              <div class="knowledge-sidebar-section">
                <div class="knowledge-sidebar-title">章节范围</div>
                <select id="knowledge-chapter-filter" name="knowledge-chapter-filter" class="knowledge-select" data-filter="chapter" aria-label="章节范围">
                  <option value="all">全部回目</option>
                  ${chapterOptions.map((chapter) => `
                    <option value="${chapter}" ${String(this.chapterFilter) === String(chapter) ? 'selected' : ''}>第${chapter}回</option>
                  `).join('')}
                </select>
              </div>

              <div class="knowledge-sidebar-section">
                <div class="knowledge-sidebar-title">排序方式</div>
                <select id="knowledge-sort-filter" name="knowledge-sort-filter" class="knowledge-select" data-filter="sort" aria-label="排序方式">
                  <option value="relevance" ${this.sortBy === 'relevance' ? 'selected' : ''}>按相关度</option>
                  <option value="chapter" ${this.sortBy === 'chapter' ? 'selected' : ''}>按回目</option>
                  <option value="category" ${this.sortBy === 'category' ? 'selected' : ''}>按类别</option>
                  <option value="title" ${this.sortBy === 'title' ? 'selected' : ''}>按标题</option>
                </select>
              </div>

              <div class="knowledge-sidebar-section">
                <div class="knowledge-sidebar-title">语音引擎</div>
                <select id="knowledge-voice-filter" name="knowledge-voice-filter" class="knowledge-select" data-filter="voice" aria-label="语音引擎">
                  <option value="mimo_白桦" selected>白桦（男声·沉稳）</option>
                  <option value="mimo_苏打">苏打（男声·清朗）</option>
                  <option value="mimo_茉莉">茉莉（女声·知性）</option>
                </select>
                <div id="knowledge-voice-status" class="knowledge-voice-status" style="font-size:11px;color:var(--color-ink-light);margin-top:4px;">音频清单加载中…</div>
              </div>

              <div class="knowledge-sidebar-section">
                <div class="knowledge-sidebar-title">高频标签</div>
                <div class="knowledge-chip-group">
                  ${hotTags.map((tag) => `<button class="knowledge-chip" data-tag="${tag.name}">${tag.name}<span>${tag.count}</span></button>`).join('') || '<span class="knowledge-muted">暂无高频标签</span>'}
                </div>
              </div>
            </div>
          </aside>

          <div class="panel-resize-handle" data-resize-target="knowledge-sidebar" aria-hidden="true"></div>

          <div class="knowledge-main">
            <div class="knowledge-results-head card-surface">
              <div>
                <div class="knowledge-results-title">知识条目</div>
                <div class="knowledge-results-subtitle">${this._buildResultsSubtitle(Math.min(initialDisplayCount, filteredItems.length), filteredItems.length)}</div>
                <div class="knowledge-active-filters" data-active-filters hidden></div>
              </div>
              <div class="knowledge-results-actions">
                <button class="knowledge-load-more-top" data-action="load-more" ${filteredItems.length > initialDisplayCount ? '' : 'hidden'}>加载更多</button>
                <button class="knowledge-expand-btn" data-action="toggle-all-cards">展开全部</button>
                <button class="knowledge-clear-btn" data-action="clear-filters">清空筛选</button>
              </div>
            </div>

            <div class="knowledge-grid" id="knowledge-items-content">
              ${filteredItems.length ? filteredItems.slice(0, initialDisplayCount).map((item) => this._renderKnowledgeCard(item)).join('') : '<div class="knowledge-empty">没有匹配的知识条目，请尝试更换关键词或筛选项。</div>'}
              ${filteredItems.length > initialDisplayCount ? `<button class="knowledge-load-more" data-action="load-more">加载更多（已显示 ${initialDisplayCount} / ${filteredItems.length} 条）</button>` : ''}
            </div>
          </div>
        </div>
      </section>
    `;

    this.displayCount = initialDisplayCount;
    this._visibleItems = filteredItems.slice(0, this.displayCount);

    if (!this._eventsBound) this._bindEvents();
    this._initResizeHandle();
    this._observeLayoutResize();
    this._scheduleTextLayoutPass();
    this._bindLazyVoiceEngines();
    this._syncActiveFilters();
    this._syncResultsActions(filteredItems);
  }

  /**
   * 音频清单 317 KB，只有真正要播放语音时才需要。
   * 先绑定一次交互（鼠标进入 / 聚焦 / 改选项），避免每个进入知识库的用户都白下载。
   */
  _bindLazyVoiceEngines() {
    const selectEl = this.container.querySelector('#knowledge-voice-filter');
    if (!selectEl || selectEl.dataset.lazyVoiceBound === '1') return;
    selectEl.dataset.lazyVoiceBound = '1';
    const trigger = () => {
      selectEl.removeEventListener('pointerenter', trigger);
      selectEl.removeEventListener('focus', trigger);
      this._loadVoiceEngines();
    };
    selectEl.addEventListener('pointerenter', trigger);
    selectEl.addEventListener('focus', trigger);
  }

  _updateContent(options = {}) {
    const { scrollToTop = true } = options;
    const contentEl = this.container.querySelector('#knowledge-items-content');
    const subtitleEl = this.container.querySelector('.knowledge-results-subtitle');

    if (!contentEl) return;

    // 本地 fuse 模块可能晚于首个 render 就绪，这时补建索引再算相关度。
    if (!this.fuse && typeof Fuse !== 'undefined') this._buildFuseIndex();
    this._clearDeferredRender();
    this._clearKeyboardNavState();

    this.displayCount = this._getBaseDisplayCount();
    const filteredItems = this._getFilteredItems();
    this._ensureJumpTargetRendered(filteredItems);
    const visibleItems = filteredItems.slice(0, this.displayCount);
    this._visibleItems = visibleItems;

    this._syncFilterControls();
    this._renderVisibleItems(contentEl, filteredItems, visibleItems, { append: false });
    
    if (subtitleEl) {
      subtitleEl.innerHTML = this._buildResultsSubtitle(Math.min(this.displayCount, filteredItems.length), filteredItems.length);
    }
    this._syncResultsActions(filteredItems);
    this._syncSubcategoryChips();
    this._syncActiveFilters();
    this._updateCategoryActiveState();
    this._syncKnowledgeHighlights();
    if (scrollToTop) this._scrollToTop();
    this._observeLayoutResize();
    this._scheduleTextLayoutPass(true);
  }

  _syncFilterControls() {
    const searchInput = this.container.querySelector('.knowledge-search-input');
    if (searchInput && searchInput.value !== this.searchQuery) searchInput.value = this.searchQuery;
    const chapterSelect = this.container.querySelector('[data-filter="chapter"]');
    if (chapterSelect) chapterSelect.value = this.chapterFilter;
    const sortSelect = this.container.querySelector('[data-filter="sort"]');
    if (sortSelect) sortSelect.value = this.sortBy;
  }

  _getMoreFilterLabel() {
    const count = [
      this.activeSubcategory !== 'all',
      String(this.chapterFilter) !== 'all',
      this.sortBy !== 'relevance'
    ].filter(Boolean).length;
    return count ? `更多筛选 · ${count} 项` : '更多筛选';
  }

  _syncActiveFilters() {
    const container = this.container.querySelector('[data-active-filters]');
    if (!container) return;
    const sortLabels = { relevance: '按相关度', chapter: '按回目', category: '按类别', title: '按标题' };
    const chips = [];
    if (this.activeCategory !== 'all') chips.push({ key: 'category', label: `类别：${this.activeCategory}` });
    if (this.activeSubcategory !== 'all') chips.push({ key: 'subcategory', label: `主题：${this.activeSubcategory}` });
    if (String(this.chapterFilter) !== 'all') chips.push({ key: 'chapter', label: `第${this.chapterFilter}回` });
    if (this.sortBy !== 'relevance') chips.push({ key: 'sort', label: sortLabels[this.sortBy] || this.sortBy });

    container.hidden = chips.length === 0;
    container.innerHTML = chips.map((chip) => `
      <button class="knowledge-active-filter" data-filter-key="${chip.key}" title="移除这个筛选">
        ${this._escapeHtml(chip.label)} <span aria-hidden="true">×</span>
      </button>
    `).join('');

    const morePanel = this.container.querySelector('#knowledge-secondary-filters');
    const moreLabel = this.container.querySelector('.knowledge-more-label');
    if (moreLabel && !morePanel?.classList.contains('is-open')) {
      moreLabel.textContent = this._getMoreFilterLabel();
    }
  }

  _syncResultsActions(filteredItems = this._getFilteredItems()) {
    const loadMoreButton = this.container.querySelector('.knowledge-load-more-top');
    if (loadMoreButton) {
      const remaining = Math.max(0, filteredItems.length - this.displayCount);
      loadMoreButton.hidden = remaining === 0;
      loadMoreButton.textContent = remaining ? `加载更多（还剩 ${remaining} 条）` : '加载更多';
    }
    this._syncExpandAllLabel();
  }

  _syncExpandAllLabel() {
    const button = this.container.querySelector('[data-action="toggle-all-cards"]');
    if (!button) return;
    const cards = [...this.container.querySelectorAll('#knowledge-items-content .knowledge-card[data-id]')];
    const allExpanded = cards.length > 0 && cards.every((card) => this.expandedIds.has(card.dataset.id));
    button.textContent = allExpanded ? '收起全部' : '展开全部';
  }

  _setCardExpandedState(card, expanded) {
    if (!card) return;
    const id = card.dataset.id;
    if (!id) return;
    if (expanded) this.expandedIds.add(id);
    else this.expandedIds.delete(id);
    card.classList.toggle('expanded', expanded);
    const header = card.querySelector('.knowledge-card-header');
    if (header) {
      header.setAttribute('aria-expanded', String(expanded));
      header.title = expanded ? '点击收起' : '点击展开';
    }
    const toggle = card.querySelector('.knowledge-card-toggle');
    if (toggle) toggle.textContent = expanded ? '▾' : '▸';
  }

  _toggleAllCards() {
    const contentEl = this.container.querySelector('#knowledge-items-content');
    if (!contentEl) return;
    const cards = [...contentEl.querySelectorAll('.knowledge-card[data-id]')];
    if (!cards.length) return;
    const shouldExpand = cards.some((card) => !this.expandedIds.has(card.dataset.id));
    cards.forEach((card) => this._setCardExpandedState(card, shouldExpand));
    this._syncExpandAllLabel();
    this._applyMasonryLayout(contentEl);
    this._scheduleTextLayoutPass();
  }

  // 分类变化后细分主题也要跟着换，否则会留下上一分类的子类并筛出 0 条。
  _syncSubcategoryChips() {
    const group = this.container.querySelector('[data-subcategory-group]');
    if (!group) return;
    const subcategories = this._getSubcategories();
    if (this.activeSubcategory !== 'all' && !subcategories.includes(this.activeSubcategory)) {
      this.activeSubcategory = 'all';
    }
    group.innerHTML = ['all', ...subcategories].map((subcategory) => {
      const label = subcategory === 'all' ? '全部主题' : this._escapeHtml(subcategory);
      const active = this.activeSubcategory === subcategory ? 'active' : '';
      return `<button class="knowledge-chip ${active}" data-subcategory="${this._escapeHtml(subcategory)}" aria-pressed="${this.activeSubcategory === subcategory}">${label}</button>`;
    }).join('');
  }

  _focusFilterAfterRender(selector) {
    window.requestAnimationFrame(() => {
      this.container.querySelector(selector)?.focus({ preventScroll: true });
    });
  }

  _updateCategoryActiveState() {
    this.container.querySelectorAll('[data-cat]').forEach((button) => {
      button.classList.toggle('active', button.dataset.cat === this.activeCategory);
    });
    
    this.container.querySelectorAll('[data-subcategory]').forEach((button) => {
      button.classList.toggle('active', button.dataset.subcategory === this.activeSubcategory);
    });
  }

  _getOverviewStats() {
    const relatedCharacters = new Set();
    const chapters = new Set();
    const categories = new Set();

    this.knowledge.forEach((item) => {
      categories.add(item.category || '其他');
      if (item.chapter) chapters.add(item.chapter);
      (item.relatedCharacters || []).forEach((id) => relatedCharacters.add(id));
    });

    return {
      total: this.knowledge.length,
      categories: categories.size,
      characters: relatedCharacters.size,
      chapters: chapters.size
    };
  }

  _initResizeHandle() {
    if (typeof HLMUtils !== 'undefined' && HLMUtils.initPanelResize) {
      HLMUtils.initPanelResize(this.container, {
        handleSelector: '.panel-resize-handle',
        sidebarSelector: '.knowledge-sidebar',
        cssVarName: '--knowledge-sidebar-width',
        defaultWidth: 280,
        minWidth: 220,
        maxWidth: 480,
        storageKey: 'hlm-knowledge-sidebar-width'
      });
    }
  }

  _getCategories() {
    const counts = {};
    this.knowledge.forEach((item) => {
      const category = item.category || '其他';
      counts[category] = (counts[category] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'));
  }

  _getSubcategories() {
    const source = this.activeCategory === 'all'
      ? this.knowledge
      : this.knowledge.filter((item) => item.category === this.activeCategory);

    return [...new Set(source.map((item) => item.subcategory).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }

  _getChapterOptions() {
    return [...new Set(this.knowledge.map((item) => item.chapter).filter(Boolean))]
      .sort((a, b) => a - b);
  }

  _getHotTags(items) {
    const counts = {};
    items.forEach((item) => {
      (item.tags || []).forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });

    const limit = this._isLowPerformanceMode() ? 12 : 16;

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'))
      .slice(0, limit);
  }

  _getFilteredItems() {
    const signature = JSON.stringify({
      query: this.searchQuery.trim(),
      category: this.activeCategory,
      subcategory: this.activeSubcategory,
      chapter: this.chapterFilter,
      sort: this.sortBy
    });
    if (signature === this._lastFilterSignature && this._lastFilteredItems.length) {
      return this._lastFilteredItems;
    }

    let source = this.knowledge;
    const fuseScoreById = new Map();
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.trim().toLowerCase();
      const indexed = new Set();

      if (this.fuse) {
        const fuseResults = this.fuse.search(this.searchQuery.trim(), { limit: 600 });
        fuseResults.forEach((result) => {
          if (!result?.item?.id) return;
          indexed.add(result.item);
          fuseScoreById.set(result.item.id, Number.isFinite(result.score) ? result.score : 1);
        });
      }

      this.tagIndex.forEach((matchedItems, key) => {
        if (key.includes(query)) matchedItems.forEach((item) => indexed.add(item));
      });
      this.characterKnowledgeMap.forEach((matchedItems, characterId) => {
        const name = (this.characterMap.get(characterId)?.name || '').toLowerCase();
        if (name.includes(query)) matchedItems.forEach((item) => indexed.add(item));
      });
      if (indexed.size) source = [...indexed];
    }

    let items = source.map((item) => ({ ...item, _score: this._getRelevanceScore(item, fuseScoreById) }));

    if (this.activeCategory !== 'all') {
      items = items.filter((item) => item.category === this.activeCategory);
    }

    if (this.activeSubcategory !== 'all') {
      items = items.filter((item) => item.subcategory === this.activeSubcategory);
    }

    if (this.chapterFilter !== 'all') {
      items = items.filter((item) => String(item.chapter || '') === String(this.chapterFilter));
    }

    if (this.searchQuery.trim()) {
      items = items.filter((item) => item._score > 0);
    }

    switch (this.sortBy) {
      case 'chapter':
        items.sort((a, b) => (a.chapter || 999) - (b.chapter || 999) || b._score - a._score);
        break;
      case 'category':
        items.sort((a, b) => (a.category || '').localeCompare(b.category || '', 'zh-Hans-CN') || (a.chapter || 999) - (b.chapter || 999));
        break;
      case 'title':
        items.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh-Hans-CN'));
        break;
      default:
        items.sort((a, b) => b._score - a._score || (a.chapter || 999) - (b.chapter || 999));
        break;
    }

    this._lastFilterSignature = signature;
    this._lastFilteredItems = items;
    return items;
  }

  _getRelevanceScore(item, fuseScoreById = new Map()) {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) return 1;

    const relatedCharacterNames = (item.relatedCharacters || [])
      .map((id) => this.characterMap.get(id)?.name || '')
      .filter(Boolean);

    const fields = {
      title: item.title || '',
      category: item.category || '',
      subcategory: item.subcategory || '',
      content: item.content || '',
      analysis: item.analysis || '',
      tags: (item.tags || []).join(' '),
      events: (item.relatedEvents || []).join(' '),
      characters: relatedCharacterNames.join(' '),
      places: (item.relatedPlaces || []).join(' ')
    };

    let score = 0;
    const fuseScore = item?.id ? fuseScoreById.get(item.id) : null;
    if (Number.isFinite(fuseScore)) {
      // Fuse score越小越相关，映射到一个正向分数加权。
      score += Math.max(0, (1 - Math.min(fuseScore, 1)) * 10) + 2;
    }

    Object.entries(fields).forEach(([fieldName, fieldValue]) => {
      const normalized = String(fieldValue).toLowerCase();
      if (!normalized) return;
      if (normalized.includes(query)) {
        if (fieldName === 'title') score += 8;
        else if (fieldName === 'tags' || fieldName === 'category' || fieldName === 'subcategory') score += 5;
        else if (fieldName === 'characters' || fieldName === 'places') score += 4;
        else score += 2;
      }
    });

    return score;
  }

  _renderKnowledgeCard(item) {
    const categoryConfig = this.categoryConfig[item.category] || { icon: '📄', color: '#999' };
    const relatedCharacters = (item.relatedCharacters || [])
      .map((id) => this.characterMap.get(id))
      .filter(Boolean);
    // 默认折叠成摘要，先让用户快速扫过条目；点击标题展开，展开状态记在 expandedIds 里，
    // 重新筛选/渲染后仍然保持。
    const expanded = this.expandedIds.has(item.id);
    const relatedCharacterLimit = this._isLowPerformanceMode() ? 3 : 4;
    const displayContent = item.content || '';
    const sourceNote = item.sourceNote || '';
    const sourceClass = sourceNote === '后四十回续书' ? 'is-continuation' : 'is-whole';

    return `
      <article class="knowledge-card ${expanded ? 'expanded' : ''}" data-id="${item.id}">
        <div class="knowledge-card-header" role="button" tabindex="0" aria-expanded="${expanded ? 'true' : 'false'}" title="${expanded ? '点击收起' : '点击展开'}">
          <span class="knowledge-card-icon" aria-hidden="true" style="background:${categoryConfig.color}15;color:${categoryConfig.color}">${categoryConfig.icon}</span>
          <div class="knowledge-card-title-group">
            <div class="knowledge-card-title">${this._highlightText(item.title || '')}</div>
            <div class="knowledge-card-meta">
              <span class="knowledge-card-category" style="color:${HLMUtils.darkenForText(categoryConfig.color)}">${item.category || '其他'}</span>
              ${item.subcategory ? `<span class="knowledge-card-subcategory">${item.subcategory}</span>` : ''}
              ${item.chapter ? `<span class="knowledge-card-chapter">第${item.chapter}回</span>` : ''}
              ${sourceNote ? `<span class="knowledge-card-source ${sourceClass}">${this._escapeHtml(sourceNote)}</span>` : ''}
            </div>
          </div>
          <span class="knowledge-card-toggle" aria-hidden="true">${expanded ? '▾' : '▸'}</span>
        </div>

        <div class="knowledge-card-content">${this._highlightText(displayContent || '')}</div>

        ${item.versionNote ? `<div class="knowledge-card-version">${this._highlightText(item.versionNote)}</div>` : ''}

        ${(item.titleVariants || []).length ? `<div class="knowledge-card-version knowledge-card-variants">${item.titleVariants.map((variant) => `<div class="knowledge-variant-row"><strong>${this._escapeHtml(variant.edition)}</strong><span>${this._escapeHtml(variant.title)}</span></div>`).join('')}</div>` : ''}

        ${item.analysis ? `<div class="knowledge-card-analysis ${expanded ? 'visible' : ''}">${this._highlightText(item.analysis)}</div>` : ''}
        ${item.notes ? `<div class="knowledge-card-analysis note-box ${expanded ? 'visible' : ''}">${this._highlightText(item.notes)}</div>` : ''}

        ${(item.relatedPlaces || []).length ? `
          <div class="knowledge-info-row">
            <span class="knowledge-info-label">相关空间</span>
            <div class="knowledge-card-tags">
              ${item.relatedPlaces.map((place) => `<span class="knowledge-tag place">${this._highlightText(place)}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${relatedCharacters.length ? `
          <div class="knowledge-info-row">
            <span class="knowledge-info-label">相关人物</span>
            <div class="knowledge-card-chars">
              ${relatedCharacters.slice(0, relatedCharacterLimit).map((character) => `<button class="knowledge-char-pill" data-char-id="${character.id}">${character.name}</button>`).join('')}
            </div>
          </div>
        ` : ''}

        ${(item.tags || []).length ? `
          <div class="knowledge-info-row">
            <span class="knowledge-info-label">关键词</span>
            <div class="knowledge-card-tags">
              ${item.tags.map((tag) => `<button class="knowledge-tag" data-tag="${tag}">${this._highlightText(tag)}</button>`).join('')}
            </div>
          </div>
        ` : ''}

        <div class="knowledge-card-footer">
          <div class="knowledge-card-related-events">${(item.relatedEvents || []).slice(0, 3).map((event) => `<span>${this._highlightText(event)}</span>`).join('')}</div>
          ${this._canSpeak(displayContent) ? `<button class="knowledge-speak-btn" data-speak-id="${this._escapeHtmlAttr(item.id)}" data-speak-text="${this._escapeHtmlAttr(displayContent)}" title="朗读此内容">🔊 朗读</button>` : ''}
        </div>
      </article>
    `;
  }

  /**
   * 切换单张卡片的展开状态，返回切换后是否展开。
   * expandedIds 存的是「被显式展开」的 id，因为默认是折叠摘要。
   */
  _toggleCardExpanded(cardId) {
    if (this.expandedIds.has(cardId)) {
      this.expandedIds.delete(cardId);
      return false;
    }
    this.expandedIds.add(cardId);
    return true;
  }

  _canSpeak(text) {
    return (typeof window.edgeTTS !== 'undefined' || typeof speechSynthesis !== 'undefined') && text && text.trim().length > 0;
  }

  _bindEvents() {
    // 视图容器在切走时只清空 innerHTML，容器本身不会销毁；若重复绑定，
    // 一次点击会执行两次展开/收起，表现为“第一次点击没反应”。每次渲染先
    // 中止上一批监听，保证容器上始终只有一组委托事件。
    this._eventController?.abort();
    this._eventController = new AbortController();
    const { signal } = this._eventController;
    this._eventsBound = true;
    const searchInput = this.container.querySelector('.knowledge-search-input');
    if (searchInput) {
      let searchIsComposing = false;
      
      const handleSearch = (event) => {
        if (searchIsComposing) return;
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => {
          this.searchQuery = event.target.value;
          this._invalidateFilterCache();
          this._clearKnowledgeJumpState();
          // 手机上滚动发生在整页：输入时不要把搜索框滚出视口。
          const isMobile = window.matchMedia?.('(max-width: 560px)').matches;
          this._updateContent({ scrollToTop: !isMobile });
        }, 180);
      };

      searchInput.addEventListener('compositionstart', () => {
        searchIsComposing = true;
      }, { signal });

      searchInput.addEventListener('compositionend', (event) => {
        searchIsComposing = false;
        handleSearch(event);
      }, { signal });

      searchInput.addEventListener('input', handleSearch, { signal });
    }

    this.container.addEventListener('click', (event) => {
      // 用户主动操作后，上一轮“定位到某条知识”的临时目标就失效了。
      this._clearKnowledgeJumpState();

      const activeFilter = event.target.closest('[data-filter-key]');
      if (activeFilter) {
        const key = activeFilter.dataset.filterKey;
        if (key === 'category') {
          this.activeCategory = 'all';
          this.activeSubcategory = 'all';
        } else if (key === 'subcategory') {
          this.activeSubcategory = 'all';
        } else if (key === 'chapter') {
          this.chapterFilter = 'all';
        } else if (key === 'sort') {
          this.sortBy = 'relevance';
        }
        this._invalidateFilterCache();
        this._updateContent();
        this._scrollToTop();
        return;
      }

      // 卡片标题栏负责展开/收起：折叠时保留标题、人物与关键词，
      // 便于在长列表里一屏扫过更多条目。
      const cardHeader = event.target.closest('.knowledge-card-header');
      if (cardHeader) {
        const card = cardHeader.closest('.knowledge-card');
        const cardId = card?.dataset.id;
        if (cardId) {
          const nowExpanded = this._toggleCardExpanded(cardId);
          this._setCardExpandedState(card, nowExpanded);
          this._syncExpandAllLabel();
          this._scheduleTextLayoutPass();
          // 瀑布流卡片是绝对定位的；折叠/展开后必须重排后续卡片，否则会留下大块空洞。
          const contentEl = this.container.querySelector('#knowledge-items-content');
          if (contentEl) {
            window.requestAnimationFrame(() => {
              if (contentEl.isConnected) this._applyMasonryLayout(contentEl);
            });
          }
        }
        return;
      }

      const categoryButton = event.target.closest('[data-cat]');
      if (categoryButton) {
        this.activeCategory = categoryButton.dataset.cat;
        this.activeSubcategory = 'all';
        this._invalidateFilterCache();
        this._updateContent();
        this._scrollToTop();
        return;
      }

      const subcategoryButton = event.target.closest('[data-subcategory]');
      if (subcategoryButton) {
        const subcategory = subcategoryButton.dataset.subcategory;
        this.activeSubcategory = subcategory;
        this._invalidateFilterCache();
        this._updateContent();
        this._scrollToTop();
        this._focusFilterAfterRender(`[data-subcategory="${subcategory}"]`);
        return;
      }

      const tagButton = event.target.closest('[data-tag]');
      if (tagButton) {
        const tagValue = tagButton.dataset.tag || '';
        if (!tagValue) return;
        this.searchQuery = tagValue;
        // 侧栏热门标签是全局统计（数字即全局条目数），点进后保留类别/回目
        // 筛选会出现「点了 73 条却显示 0 条」的矛盾，因此一并清空。
        if (tagButton.classList.contains('knowledge-chip')) {
          this.activeCategory = 'all';
          this.activeSubcategory = 'all';
          this.chapterFilter = 'all';
          this._syncFilterControls();
        }
        this._invalidateFilterCache();
        const input = this.container.querySelector('.knowledge-search-input');
        if (input) input.value = tagValue;
        this._updateContent();
        this._scrollToTop();
        if (this.onTagClick) this.onTagClick({ type: 'tag', value: tagValue, view: 'knowledge' });
        this._emitFacetChange();
        return;
      }

      const charButton = event.target.closest('[data-char-id]');
      if (charButton) {
        event.stopPropagation();
        const charId = charButton.dataset.charId;
        if (this.onCharacterClick) this.onCharacterClick(charId);
        return;
      }

      const speakButton = event.target.closest('[data-speak-text]');
      if (speakButton) {
        event.stopPropagation();
        // 立即在点击事件的首个同步宏任务中激活音频通路（破除移动端/iOS拦截）
        if (window.edgeTTS && typeof window.edgeTTS.warmUp === 'function') {
          window.edgeTTS.warmUp();
        }
        this._speakText(speakButton.dataset.speakText, speakButton, speakButton.dataset.speakId);
        return;
      }

      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;
      if (actionButton.dataset.action === 'load-more') {
        this._loadMore();
        return;
      }
      if (actionButton.dataset.action === 'toggle-all-cards') {
        this._toggleAllCards();
        return;
      }
      if (actionButton.dataset.action === 'toggle-more-filters') {
        const panel = this.container.querySelector('#knowledge-secondary-filters');
        const open = panel ? panel.classList.toggle('is-open') : false;
        actionButton.setAttribute('aria-expanded', String(open));
        const label = actionButton.querySelector('.knowledge-more-label');
        if (label) label.textContent = open ? '收起筛选' : this._getMoreFilterLabel();
        return;
      }
      if (actionButton.dataset.action === 'clear-filters') {
        this.activeCategory = 'all';
        this.activeSubcategory = 'all';
        this.chapterFilter = 'all';
        this.sortBy = 'relevance';
        this.searchQuery = '';
        this._invalidateFilterCache();
        const input = this.container.querySelector('.knowledge-search-input');
        if (input) input.value = '';
        this._syncFilterControls();
        this._updateContent({ scrollToTop: false });
        this._scrollToTop();
      }
    }, { signal });

    this.container.addEventListener('change', (event) => {
      const select = event.target.closest('.knowledge-select');
      if (!select) return;
      this._clearKnowledgeJumpState();
      if (select.dataset.filter === 'chapter') this.chapterFilter = select.value;
      if (select.dataset.filter === 'sort') this.sortBy = select.value;
      if (select.dataset.filter === 'voice') {
        this._setVoiceEngine(select.value);
        return;
      }
      this._invalidateFilterCache();
      this._updateContent();
      this._scrollToTop();
    }, { signal });

    this.container.addEventListener('keydown', (event) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      if (target.closest('.knowledge-search-input')) return;
      // 标题栏是 role=button，键盘需能展开/收起；Arrow 导航只处理其余位置。
      if (target.classList.contains('knowledge-card-header')
          && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        target.click();
        return;
      }
      // 只接管条目网格内部的浏览键。筛选按钮、下拉框、标签和卡片内按钮
      // 必须保留原生键盘行为，否则 Enter/方向键会被这里的“卡片导航”吞掉。
      if (!target.closest('#knowledge-items-content')) return;
      if (target.closest('button, a, input, select, textarea, [contenteditable="true"]')) return;
      this._handleKeyboardNavigation(event);
    }, { signal });
  }

  _handleKeyboardNavigation(event) {
    const contentEl = this.container.querySelector('#knowledge-items-content');
    if (!contentEl) return;

    const cards = Array.from(contentEl.querySelectorAll('.knowledge-card[data-id]'));
    if (!cards.length) return;

    // 从当前聚焦的卡片出发，而不是永远从 -1 开始，否则第一次 ArrowDown 会跳过第一张。
    const focusedCard = event.target.closest('.knowledge-card[data-id]');
    const focusedIndex = focusedCard ? cards.indexOf(focusedCard) : -1;
    if (focusedIndex >= 0) this._keyboardNavIndex = focusedIndex;

    const minCardWidth = 380;
    const gap = 14;
    const containerWidth = contentEl.clientWidth;
    this._keyboardNavColumnCount = Math.max(1, Math.floor((containerWidth + gap) / (minCardWidth + gap)));

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this._keyboardNavIndex = this._keyboardNavIndex < 0
          ? 0
          : Math.min(this._keyboardNavIndex + this._keyboardNavColumnCount, cards.length - 1);
        this._scrollToKeyboardNavCard(cards);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this._keyboardNavIndex = this._keyboardNavIndex < 0
          ? 0
          : Math.max(this._keyboardNavIndex - this._keyboardNavColumnCount, 0);
        this._scrollToKeyboardNavCard(cards);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this._keyboardNavIndex = this._keyboardNavIndex < 0
          ? 0
          : Math.min(this._keyboardNavIndex + 1, cards.length - 1);
        this._scrollToKeyboardNavCard(cards);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this._keyboardNavIndex = this._keyboardNavIndex < 0
          ? 0
          : Math.max(this._keyboardNavIndex - 1, 0);
        this._scrollToKeyboardNavCard(cards);
        break;
      case 'Enter':
        event.preventDefault();
        if (this._keyboardNavIndex >= 0 && this._keyboardNavIndex < cards.length) {
          const card = cards[this._keyboardNavIndex];
          const firstCharPill = card.querySelector('.knowledge-char-pill');
          if (firstCharPill) {
            firstCharPill.click();
          } else {
            card.click();
          }
        }
        break;
      case 'Escape':
        this._keyboardNavIndex = -1;
        this._clearKeyboardNavHighlight(cards);
        break;
    }
  }

  _scrollToKeyboardNavCard(cards) {
    const cards2 = Array.from(this.container.querySelectorAll('#knowledge-items-content .knowledge-card[data-id]'));
    cards2.forEach((card, i) => card.classList.toggle('keyboard-nav', i === this._keyboardNavIndex));
    const card = cards[this._keyboardNavIndex];
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      // 让焦点跟着高亮走，Enter 才会作用于当前高亮卡片，而不是原来的卡。
      card.querySelector('.knowledge-card-header')?.focus({ preventScroll: true });
    }
  }

  _clearKeyboardNavHighlight(cards) {
    cards.forEach(card => card.classList.remove('keyboard-nav'));
  }

  _clearKeyboardNavState() {
    this._keyboardNavIndex = -1;
    const cards = this.container.querySelectorAll('.knowledge-card.keyboard-nav');
    cards.forEach(card => card.classList.remove('keyboard-nav'));
  }

  _loadMore() {
    const contentEl = this.container.querySelector('#knowledge-items-content');
    const subtitleEl = this.container.querySelector('.knowledge-results-subtitle');
    if (!contentEl) return;

    this._clearDeferredRender();

    const previousCount = this.displayCount;
    this.displayCount += this._getLoadStep();
    const filteredItems = this._getFilteredItems();
    const visibleItems = filteredItems.slice(0, this.displayCount);
    const newItems = visibleItems.slice(previousCount);
    this._visibleItems = visibleItems;

    this._renderVisibleItems(contentEl, filteredItems, visibleItems, { append: true, newItems });

    if (subtitleEl) {
      subtitleEl.innerHTML = this._buildResultsSubtitle(Math.min(this.displayCount, filteredItems.length), filteredItems.length);
    }
    this._syncResultsActions(filteredItems);

    this._syncKnowledgeHighlights();
  }

  _buildResultsSubtitle(visibleCount, totalCount) {
    const parts = [`当前显示 ${visibleCount} / ${totalCount} 条`];
    
    if (this.relatedCharacterIds.size) {
      // 显示关联人物的名称
      const names = [...this.relatedCharacterIds]
        .slice(0, 3)
        .map(id => this.characterMap.get(id)?.name)
        .filter(Boolean);
      
      if (names.length > 0) {
        const highlightedNames = names.map(name => `<span class="knowledge-highlight-name">${this._escapeHtml(name)}</span>`).join('、');
        parts.push(`关联人物：${highlightedNames}${this.relatedCharacterIds.size > 3 ? '等' : ''}`);
      }
    }
    
    parts.push('支持人物跳转、长文展开与多维检索');
    
    return parts.join(' · ');
  }

  _scrollToTop() {
    const main = this.container.querySelector('.knowledge-main');
    if (!main) return;
    if (main.scrollHeight > main.clientHeight + 1) {
      main.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    // 手机端条目区不单独滚动，跳到结果列表顶部
    HLMUtils.scrollElementIntoViewTop(main);
  }


  // 从搜索建议/其他视图直接打开某条知识时，目标可能排在第一页之外；
  // 只扩大渲染范围，不改变用户当前的类别/章回/排序。
  _ensureJumpTargetRendered(filteredItems) {
    const targetId = this._activeJumpTargetId;
    if (!targetId) return;
    const index = filteredItems.findIndex((item) => item.id === targetId);
    if (index >= this.displayCount) this.displayCount = index + 1;
  }

  navigateToFirstMatch() {
    const firstMatch = this._getFilteredItems()[0];
    if (!firstMatch?.id) {
      this._clearKnowledgeJumpState();
      return;
    }

    this._activeJumpTargetId = firstMatch.id;
    this._scheduleKnowledgeJump(firstMatch.id);
  }

  _scheduleKnowledgeJump(id, attempt = 0) {
    if (!id) return;
    if (this._pendingJumpFrame) {
      window.cancelAnimationFrame(this._pendingJumpFrame);
      this._pendingJumpFrame = null;
    }
    if (this._pendingJumpTimer) {
      window.clearTimeout(this._pendingJumpTimer);
      this._pendingJumpTimer = null;
    }

    const runJump = () => {
      this._pendingJumpFrame = window.requestAnimationFrame(() => {
        this._pendingJumpFrame = window.requestAnimationFrame(() => {
          this._pendingJumpFrame = null;
          const focused = this._focusKnowledgeCard(id);
          if (!focused && attempt < 12) {
            this._pendingJumpTimer = window.setTimeout(() => {
              this._pendingJumpTimer = null;
              this._scheduleKnowledgeJump(id, attempt + 1);
            }, 80);
          }
        });
      });
    };

    runJump();
  }

  _focusKnowledgeCard(id) {
    const card = this.container.querySelector(`.knowledge-card[data-id="${id}"]`);
    if (!card) return false;

    this._clearKnowledgeJumpState({ preserveTarget: true });
    // 跳转目标自动展开，确保用户看到的是正文而不是一张折叠摘要。
    this._setCardExpandedState(card, true);
    this._syncExpandAllLabel();
    this._scheduleTextLayoutPass();

    // 知识卡可能比视口还高，居中会把标题顶出可视区；对齐顶部才能先看到标题。
    card.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest'
    });

    card.classList.remove('jump-highlight');
    void card.offsetWidth;
    card.classList.add('jump-highlight');

    // 定位成功后清掉目标，避免后续任意筛选/搜索又被旧目标拽回去。
    this._activeJumpTargetId = null;

    this._jumpHighlightTimer = window.setTimeout(() => {
      if (card.isConnected) card.classList.remove('jump-highlight');
      this._jumpHighlightTimer = null;
    }, 3000);

    return true;
  }

  _clearKnowledgeJumpState({ preserveTarget = false } = {}) {
    if (this._pendingJumpFrame) {
      window.cancelAnimationFrame(this._pendingJumpFrame);
      this._pendingJumpFrame = null;
    }
    if (this._pendingJumpTimer) {
      window.clearTimeout(this._pendingJumpTimer);
      this._pendingJumpTimer = null;
    }
    if (this._jumpHighlightTimer) {
      window.clearTimeout(this._jumpHighlightTimer);
      this._jumpHighlightTimer = null;
    }
    this.container.querySelectorAll('.knowledge-card.jump-highlight').forEach((card) => {
      card.classList.remove('jump-highlight');
    });
    if (!preserveTarget) this._activeJumpTargetId = null;
  }

  _highlightText(text) {
    const value = String(text || '');
    const query = this.searchQuery.trim();
    if (!query) return this._escapeHtml(value).replace(/\n/g, '<br>');

    const escapedValue = this._escapeHtml(value).replace(/\n/g, '<br>');
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escapedValue.replace(new RegExp(escapedQuery, 'gi'), (match) => `<mark>${match}</mark>`);
  }

  _escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  _escapeHtmlAttr(str) {
    return this._escapeHtml(str).replace(/"/g, '&quot;');
  }

  getCharacterKnowledge(characterId) {
    return this.characterKnowledgeMap.get(characterId) || [];
  }

  _emitFacetChange() {
    return;
  }

  async _speakText(text, button, speakId) {
    // 再次点击同一个按钮代表停止播放
    if (this._currentSpeakButton === button) {
      this._currentSpeakButton = null;
      if (window.__audioPreloadCache) {
        window.__audioPreloadCache.stop();
      }
      if (window.edgeTTS) {
        window.edgeTTS.stop();
      }
      button.classList.remove('speaking');
      return;
    }

    // 暂停先前任何可能在播放的语音
    if (window.__audioPreloadCache) {
      window.__audioPreloadCache.stop();
    }
    if (window.edgeTTS) {
      window.edgeTTS.stop();
    }

    // 安全限制文本最长长度，防截断出错
    const maxTextLength = 400;
    const speakText = text.length > maxTextLength ? text.substring(0, maxTextLength) + '...' : text;

    this._currentSpeakButton = button;
    button.classList.add('speaking');

    // 优先尝试预生成音频（毫秒级响应）
    if (speakId && window.__audioPreloadCache) {
      try {
        // 传完整文案做指纹校验；回退 TTS 仍用截断后的 speakText。
        await window.__audioPreloadCache.play(speakId, text);
        // 播放成功，正常结束
        if (this._currentSpeakButton === button) {
          this._currentSpeakButton = null;
          button.classList.remove('speaking');
        }
        return;
      } catch (e) {
        // cache_miss 或 audio_load_error → 继续走到 edgeTTS 回退
        if (e.message !== 'cache_miss' && e.message !== 'audio_load_error' && e.message !== 'stale_text') {
          console.warn('[KnowledgeView] AudioPreloadCache error:', e.message);
        }
      }
    }

    // 回退：使用 edgeTTS（原有三级降级链）
    try {
      if (window.edgeTTS) {
        await window.edgeTTS.speak(speakText);
      }
    } catch (e) {
      console.warn('[KnowledgeView] TTS final fallback failed:', e);
    } finally {
      if (this._currentSpeakButton === button) {
        this._currentSpeakButton = null;
        button.classList.remove('speaking');
      }
    }
  }

  /**
   * 切换语音引擎
   */
  _setVoiceEngine(engine) {
    if (window.__audioPreloadCache) {
      window.__audioPreloadCache.setEngine(engine);
    }
    const statusEl = this.container.querySelector('#knowledge-voice-status');
    if (statusEl) {
      const label = this._getEngineLabel(engine);
      statusEl.textContent = `当前：${label}`;
    }
    this._loadVoiceEngines();
  }

  /**
   * 获取引擎显示名
   */
  _getEngineLabel(engine) {
    const map = {
      'mimo_白桦': '白桦（男声·沉稳）',
      'mimo_苏打': '苏打（男声·清朗）',
      'mimo_茉莉': '茉莉（女声·知性）',
      'mimo_冰糖': '冰糖（女声·甜美）',
      'mimo_default': '默认（MiMo）'
    };
    return map[engine] || engine;
  }

  /**
   * 异步加载 manifest 并填充语音下拉框
   */
  async _loadVoiceEngines() {
    const selectEl = this.container.querySelector('#knowledge-voice-filter');
    const statusEl = this.container.querySelector('#knowledge-voice-status');
    if (!selectEl || !window.__audioPreloadCache) return;

    try {
      await window.__audioPreloadCache._ensureManifest();
      const engines = window.__audioPreloadCache.getAvailableEngines();

      // 收集已有的 option value
      const existing = new Set([...selectEl.options].map(o => o.value));

      // 补充 manifest 中发现但下拉框中缺失的引擎
      for (const engine of engines) {
        if (existing.has(engine.id)) continue;
        const opt = document.createElement('option');
        opt.value = engine.id;
        opt.textContent = engine.label;
        selectEl.appendChild(opt);
      }

      // 确保当前引擎被选中
      const current = window.__audioPreloadCache.engine;
      for (const opt of selectEl.options) {
        opt.selected = opt.value === current;
      }

      if (statusEl) {
        const total = Object.keys(window.__audioPreloadCache._manifest || {}).length;
        statusEl.textContent = `已加载 ${total} 条音频`;
      }
    } catch (e) {
      if (statusEl) {
        statusEl.textContent = '音频未加载，使用在线 TTS';
        statusEl.style.color = '#C0392B';
      }
    }
  }

  _buildIndexes() {
    this.characterKnowledgeMap = new Map();
    this.tagIndex = new Map();
    this.knowledge.forEach((item) => {
      (item.relatedCharacters || []).forEach((id) => {
        if (!this.characterKnowledgeMap.has(id)) this.characterKnowledgeMap.set(id, []);
        this.characterKnowledgeMap.get(id).push(item);
      });
      (item.tags || []).forEach((tag) => {
        const key = String(tag).toLowerCase();
        if (!this.tagIndex.has(key)) this.tagIndex.set(key, []);
        this.tagIndex.get(key).push(item);
      });
    });
  }

  _buildFuseIndex() {
    if (typeof Fuse === 'undefined' || !Array.isArray(this.knowledge) || !this.knowledge.length) {
      this.fuse = null;
      return;
    }

    this.fuse = new Fuse(this.knowledge, {
      includeScore: true,
      threshold: 0.38,
      minMatchCharLength: 2,
      ignoreLocation: true,
      keys: [
        { name: 'title', weight: 0.34 },
        { name: 'tags', weight: 0.2 },
        { name: 'category', weight: 0.12 },
        { name: 'subcategory', weight: 0.08 },
        { name: 'content', weight: 0.15 },
        { name: 'analysis', weight: 0.08 },
        { name: 'relatedEvents', weight: 0.02 },
        { name: 'relatedPlaces', weight: 0.01 },
      ],
    });
  }

  _syncKnowledgeHighlights() {
    this.container.querySelectorAll('.knowledge-char-pill').forEach((button) => {
      button.classList.toggle('is-related', this.relatedCharacterIds.has(button.dataset.charId));
    });
  }

  // 人物高亮变化不需要重建整张知识卡列表，否则会把用户正在读的位置拉回顶部。
  syncFacetHighlights() {
    if (!this.container.querySelector('#knowledge-items-content')) return;
    this._syncKnowledgeHighlights();
    const subtitleEl = this.container.querySelector('.knowledge-results-subtitle');
    if (!subtitleEl) return;
    const total = this._getFilteredItems().length;
    subtitleEl.innerHTML = this._buildResultsSubtitle(Math.min(this.displayCount, total), total);
  }

  _invalidateFilterCache() {
    this._lastFilterSignature = '';
    this._lastFilteredItems = [];
    this._visibleItems = [];
  }

  _renderVisibleItems(contentEl, filteredItems, visibleItems, { append = false, newItems = [] } = {}) {
    this._clearDeferredRender();
    this._clearTextLayoutWork();

    if (!filteredItems.length) {
      contentEl.innerHTML = '<div class="knowledge-empty">没有匹配的知识条目，请尝试更换关键词或筛选项。</div>';
      this._clearMasonryLayout(contentEl);
      return;
    }

    if (!append) {
      const immediateCount = this._isLowPerformanceMode() ? Math.min(visibleItems.length, 12) : visibleItems.length;
      const immediateItems = visibleItems.slice(0, immediateCount);
      const remainingItems = visibleItems.slice(immediateCount);
      const token = this._deferredRenderToken;
      contentEl.innerHTML = immediateItems.map((item) => this._renderKnowledgeCard(item)).join('');
      this._renderLoadMoreButton(contentEl, filteredItems, immediateItems.length);
      if (remainingItems.length) {
        this._scheduleDeferredCards(contentEl, remainingItems, filteredItems, token);
      }
      if (this._activeJumpTargetId) this._scheduleKnowledgeJump(this._activeJumpTargetId);
      this._scheduleTextLayoutPass();
      return;
    }

    const loadMoreButton = contentEl.querySelector('[data-action="load-more"]');
    if (loadMoreButton) loadMoreButton.remove();
    if (newItems.length) {
      const token = this._deferredRenderToken;
      const immediateCount = this._isLowPerformanceMode() ? Math.min(newItems.length, 8) : newItems.length;
      const immediateItems = newItems.slice(0, immediateCount);
      const remainingItems = newItems.slice(immediateCount);
      if (immediateItems.length) {
        contentEl.insertAdjacentHTML('beforeend', immediateItems.map((item) => this._renderKnowledgeCard(item)).join(''));
      }
      this._renderLoadMoreButton(contentEl, filteredItems, visibleItems.length);
      if (remainingItems.length) {
        this._scheduleDeferredCards(contentEl, remainingItems, filteredItems, token);
      }
    }
    this._renderLoadMoreButton(contentEl, filteredItems, visibleItems.length);
    if (this._activeJumpTargetId) this._scheduleKnowledgeJump(this._activeJumpTargetId);
    this._scheduleTextLayoutPass();
  }

  _updateSingleCard(id) {
    const contentEl = this.container.querySelector('#knowledge-items-content');
    if (!contentEl) return;
    const item = this._visibleItems.find((entry) => entry.id === id);
    if (!item) {
      this._updateContent();
      return;
    }
    const current = contentEl.querySelector(`.knowledge-card[data-id="${id}"]`);
    if (!current) {
      this._updateContent();
      return;
    }
    current.outerHTML = this._renderKnowledgeCard(item);
    this._syncKnowledgeHighlights();
    this._scheduleTextLayoutPass(true);
  }

  _observeLayoutResize() {
    if (this._layoutResizeObserver || typeof ResizeObserver === 'undefined') return;

    const contentEl = this.container.querySelector('#knowledge-items-content');
    if (!contentEl) return;

    this._layoutResizeObserver = new ResizeObserver(() => {
      this._scheduleTextLayoutPass(true);
    });
    this._layoutResizeObserver.observe(contentEl);
  }

  _scheduleTextLayoutPass() {
    const service = window.textLayoutService;
    const contentEl = this.container.querySelector('#knowledge-items-content');
    if (!service || !contentEl) return;

    this._clearTextLayoutWork();
    const activeToken = this._textLayoutToken;
    this._textLayoutFrame = window.requestAnimationFrame(() => {
      service.whenReady().then(() => {
        if (activeToken !== this._textLayoutToken || !contentEl.isConnected) return;
        this._textLayoutFrame = null;
        this._applyKnowledgeTextLayout(service);
        this._applyMasonryLayout(contentEl);
      });
    });
  }

  _applyKnowledgeTextLayout(service) {
    if (!service?.isReady()) return;

    this.container.querySelectorAll('.knowledge-card[data-id]').forEach((card) => {
      const item = this._visibleItems.find((entry) => entry.id === card.dataset.id);
      const contentEl = card.querySelector('.knowledge-card-content');
      if (!item || !contentEl) return;

      contentEl.dataset.fullText = item.content || '';
      contentEl.innerHTML = this._highlightText(item.content || '');
      contentEl.style.minHeight = '0px';
      service.applyMeasuredHeight(contentEl, { wordBreak: 'keep-all' });
    });
  }

  _applyMasonryLayout(contentEl) {
    if (!contentEl) return;

    const cards = Array.from(contentEl.querySelectorAll('.knowledge-card'));
    const loadMoreButton = contentEl.querySelector('.knowledge-load-more');
    if (!cards.length) {
      this._clearMasonryLayout(contentEl);
      return;
    }

    const gap = 14;
    const containerWidth = contentEl.clientWidth;
    const minCardWidth = 380;
    const columns = Math.max(1, Math.floor((containerWidth + gap) / (minCardWidth + gap)));
    const shouldUseMasonry = !this._isLowPerformanceMode()
      && columns > 1
      && window.innerWidth >= 1180;

    if (!shouldUseMasonry) {
      this._clearMasonryLayout(contentEl);
      return;
    }

    const itemWidth = (containerWidth - gap * (columns - 1)) / columns;
    const columnHeights = new Array(columns).fill(0);

    contentEl.classList.add('is-masonry');
    contentEl.style.setProperty('--knowledge-masonry-item-width', `${itemWidth}px`);

    cards.forEach((card) => {
      card.style.position = 'absolute';
      card.style.width = `${itemWidth}px`;
      const targetColumn = columnHeights.indexOf(Math.min(...columnHeights));
      const top = columnHeights[targetColumn];
      const left = targetColumn * (itemWidth + gap);
      card.style.top = `${top}px`;
      card.style.left = `${left}px`;
      columnHeights[targetColumn] = top + card.getBoundingClientRect().height + gap;
    });

    let gridHeight = Math.max(...columnHeights, 0);
    if (loadMoreButton) {
      loadMoreButton.style.position = 'absolute';
      loadMoreButton.style.left = '0px';
      loadMoreButton.style.top = `${gridHeight}px`;
      loadMoreButton.style.width = '100%';
      gridHeight += loadMoreButton.getBoundingClientRect().height;
    }

    contentEl.style.height = `${gridHeight}px`;
  }

  _clearMasonryLayout(contentEl) {
    if (!contentEl) return;
    contentEl.classList.remove('is-masonry');
    contentEl.style.removeProperty('height');
    contentEl.style.removeProperty('--knowledge-masonry-item-width');

    Array.from(contentEl.children).forEach((child) => {
      child.style.removeProperty('position');
      child.style.removeProperty('top');
      child.style.removeProperty('left');
      child.style.removeProperty('width');
    });
  }

  destroy() {
    this._clearDeferredRender();
    this._clearTextLayoutWork();
    this._clearKnowledgeJumpState();
    clearTimeout(this._searchTimer);
    if (this._layoutResizeObserver) {
      this._layoutResizeObserver.disconnect();
      this._layoutResizeObserver = null;
    }
    this._eventsBound = false;
    this._eventController?.abort();
    this._eventController = null;
    this._invalidateFilterCache();
    this.container.innerHTML = '';
  }

}
