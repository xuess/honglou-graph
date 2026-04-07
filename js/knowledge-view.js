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
    this.onTagClick = null;
    this.relatedCharacterIds = new Set();
    this.characterKnowledgeMap = new Map();
    this.tagIndex = new Map();
    this._lastFilterSignature = '';
    this._lastFilteredItems = [];
    this._visibleItems = [];
    this._activeJumpTargetId = null;
    this._jumpHighlightTimer = null;
    this._pendingJumpFrame = null;
    this._pendingJumpTimer = null;

    this.categoryConfig = {
      '判词': { icon: '📜', color: '#8B2500' },
      '曲词': { icon: '🎵', color: '#8E44AD' },
      '诗词': { icon: '✒️', color: '#2980B9' },
      '对联': { icon: '🏮', color: '#C0392B' },
      '典故': { icon: '📖', color: '#16A085' },
      '名场面': { icon: '🎭', color: '#E67E22' },
      '回目知识点': { icon: '📚', color: '#27AE60' },
      '回目知识': { icon: '📚', color: '#27AE60' },
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
    return this._isLowPerformanceMode() ? 24 : 40;
  }

  _getLoadStep() {
    return this._isLowPerformanceMode() ? 24 : 40;
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
      }

      if (remainingItems.length) {
        this._deferredRenderTimer = window.setTimeout(step, 32);
        return;
      }

      this._deferredRenderTimer = null;
      this._renderLoadMoreButton(contentEl, filteredItems, this._visibleItems.length);
      this._syncKnowledgeHighlights();
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
    const initialDisplayCount = this._getBaseDisplayCount();

    this.container.innerHTML = `
      <section class="knowledge-shell">
        <div class="knowledge-hero card-surface">
          <div class="knowledge-hero-copy">
            <span class="knowledge-hero-eyebrow">红楼梦百科索引</span>
            <h2 class="knowledge-hero-title">不是摘要，而是可检索、可浏览、可扩充的知识库</h2>
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
                <input class="knowledge-search-input" type="text" placeholder="搜索诗词、灯谜、建筑、人物、场景…" value="${this._escapeHtml(this.searchQuery)}">
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

            <div class="knowledge-sidebar-section">
              <div class="knowledge-sidebar-title">细分主题</div>
              <div class="knowledge-chip-group">
                <button class="knowledge-chip ${this.activeSubcategory === 'all' ? 'active' : ''}" data-subcategory="all">全部主题</button>
                ${subcategories.map((subcategory) => `
                  <button class="knowledge-chip ${this.activeSubcategory === subcategory ? 'active' : ''}" data-subcategory="${subcategory}">${subcategory}</button>
                `).join('')}
              </div>
            </div>

            <div class="knowledge-sidebar-section">
              <div class="knowledge-sidebar-title">章节范围</div>
              <select class="knowledge-select" data-filter="chapter">
                <option value="all">全部回目</option>
                ${chapterOptions.map((chapter) => `
                  <option value="${chapter}" ${String(this.chapterFilter) === String(chapter) ? 'selected' : ''}>第${chapter}回</option>
                `).join('')}
              </select>
            </div>

            <div class="knowledge-sidebar-section">
              <div class="knowledge-sidebar-title">排序方式</div>
              <select class="knowledge-select" data-filter="sort">
                <option value="relevance" ${this.sortBy === 'relevance' ? 'selected' : ''}>按相关度</option>
                <option value="chapter" ${this.sortBy === 'chapter' ? 'selected' : ''}>按回目</option>
                <option value="category" ${this.sortBy === 'category' ? 'selected' : ''}>按类别</option>
                <option value="title" ${this.sortBy === 'title' ? 'selected' : ''}>按标题</option>
              </select>
            </div>

            <div class="knowledge-sidebar-section">
              <div class="knowledge-sidebar-title">高频标签</div>
              <div class="knowledge-chip-group">
                ${hotTags.map((tag) => `<button class="knowledge-chip" data-tag="${tag.name}">${tag.name}<span>${tag.count}</span></button>`).join('') || '<span class="knowledge-muted">暂无高频标签</span>'}
              </div>
            </div>
          </aside>

          <div class="knowledge-main">
            <div class="knowledge-results-head card-surface">
              <div>
                <div class="knowledge-results-title">知识条目</div>
                <div class="knowledge-results-subtitle">${this._buildResultsSubtitle(filteredItems.length, filteredItems.length)}</div>
              </div>
              <button class="knowledge-clear-btn" data-action="clear-filters">清空筛选</button>
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
  }

  _updateContent() {
    const contentEl = this.container.querySelector('#knowledge-items-content');
    const subtitleEl = this.container.querySelector('.knowledge-results-subtitle');
    
    if (!contentEl) return;

    this._clearDeferredRender();

    this.displayCount = this._getBaseDisplayCount();
    const filteredItems = this._getFilteredItems();
    const visibleItems = filteredItems.slice(0, this.displayCount);
    this._visibleItems = visibleItems;
    
    this._renderVisibleItems(contentEl, filteredItems, visibleItems, { append: false });
    
    if (subtitleEl) {
      subtitleEl.textContent = this._buildResultsSubtitle(Math.min(this.displayCount, filteredItems.length), filteredItems.length);
    }

    this._updateCategoryActiveState();
    this._syncKnowledgeHighlights();
    this._scrollToTop();
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
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.trim().toLowerCase();
      const indexed = new Set();
      this.tagIndex.forEach((matchedItems, key) => {
        if (key.includes(query)) matchedItems.forEach((item) => indexed.add(item));
      });
      this.characterKnowledgeMap.forEach((matchedItems, characterId) => {
        const name = (this.characterMap.get(characterId)?.name || '').toLowerCase();
        if (name.includes(query)) matchedItems.forEach((item) => indexed.add(item));
      });
      if (indexed.size) source = [...indexed];
    }

    let items = source.map((item) => ({ ...item, _score: this._getRelevanceScore(item) }));

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

  _getRelevanceScore(item) {
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
    const expanded = this.expandedIds.has(item.id);
    const previewLength = this._isLowPerformanceMode() ? 88 : 120;
    const relatedCharacterLimit = this._isLowPerformanceMode() ? 3 : 4;
    const shouldClamp = (item.content || '').length > previewLength;
    const displayContent = !expanded && shouldClamp ? `${item.content.slice(0, previewLength)}…` : item.content;

    return `
      <article class="knowledge-card ${expanded ? 'expanded' : ''}" data-id="${item.id}">
        <div class="knowledge-card-header">
          <span class="knowledge-card-icon" style="background:${categoryConfig.color}15;color:${categoryConfig.color}">${categoryConfig.icon}</span>
          <div class="knowledge-card-title-group">
            <div class="knowledge-card-title">${this._highlightText(item.title || '')}</div>
            <div class="knowledge-card-meta">
              <span class="knowledge-card-category" style="color:${categoryConfig.color}">${item.category || '其他'}</span>
              ${item.subcategory ? `<span class="knowledge-card-subcategory">${item.subcategory}</span>` : ''}
              ${item.chapter ? `<span class="knowledge-card-chapter">第${item.chapter}回</span>` : ''}
            </div>
          </div>
        </div>

        <div class="knowledge-card-content">${this._highlightText(displayContent || '')}</div>

        ${item.versionNote ? `<div class="knowledge-card-version">${this._highlightText(item.versionNote)}</div>` : ''}

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
          ${(item.analysis || item.notes || shouldClamp) ? `<button class="knowledge-card-expand" data-expand-id="${item.id}">${expanded ? '收起全文' : '展开全文'}</button>` : ''}
        </div>
      </article>
    `;
  }

  _bindEvents() {
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
          this._updateContent();
        }, 180);
      };

      searchInput.addEventListener('compositionstart', () => {
        searchIsComposing = true;
      });

      searchInput.addEventListener('compositionend', (event) => {
        searchIsComposing = false;
        handleSearch(event);
      });

      searchInput.addEventListener('input', handleSearch);
    }

    this.container.addEventListener('click', (event) => {
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
        this.activeSubcategory = subcategoryButton.dataset.subcategory;
        this._invalidateFilterCache();
        this._updateContent();
        this._scrollToTop();
        return;
      }

      const tagButton = event.target.closest('[data-tag]');
      if (tagButton) {
        const tagValue = tagButton.dataset.tag || '';
        this.searchQuery = tagValue;
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

      const expandButton = event.target.closest('[data-expand-id]');
      if (expandButton) {
        const id = expandButton.dataset.expandId;
        if (!id) return;
        if (this.expandedIds.has(id)) this.expandedIds.delete(id);
        else this.expandedIds.add(id);
        this._updateSingleCard(id);
        return;
      }

      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;
      if (actionButton.dataset.action === 'load-more') {
        this._loadMore();
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
        this._updateContent();
        this._scrollToTop();
      }
    });

    this.container.addEventListener('change', (event) => {
      const select = event.target.closest('.knowledge-select');
      if (!select) return;
      if (select.dataset.filter === 'chapter') this.chapterFilter = select.value;
      if (select.dataset.filter === 'sort') this.sortBy = select.value;
      this._invalidateFilterCache();
      this._updateContent();
      this._scrollToTop();
    });
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
      subtitleEl.textContent = this._buildResultsSubtitle(Math.min(this.displayCount, filteredItems.length), filteredItems.length);
    }

    this._syncKnowledgeHighlights();
  }

  _buildResultsSubtitle(visibleCount, totalCount) {
    const parts = [`当前显示 ${visibleCount} / ${totalCount} 条`, '支持人物跳转、长文展开与多维检索'];
    if (this.relatedCharacterIds.size) {
      parts.push(`已高亮 ${this.relatedCharacterIds.size} 位关联人物，不影响当前筛选`);
    }
    return parts.join(' · ');
  }

  _scrollToTop() {
    const shell = this.container.querySelector('.knowledge-shell');
    if (shell) {
      shell.scrollIntoView({ block: 'start', behavior: 'instant' });
      return;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
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

    card.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });

    card.classList.remove('jump-highlight');
    void card.offsetWidth;
    card.classList.add('jump-highlight');

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
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  getCharacterKnowledge(characterId) {
    return this.characterKnowledgeMap.get(characterId) || [];
  }

  _emitFacetChange() {
    return;
  }

  destroy() {
    this._clearDeferredRender();
    this._clearKnowledgeJumpState();
    clearTimeout(this._searchTimer);
    this._eventsBound = false;
    this._invalidateFilterCache();
    this.container.innerHTML = '';
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

  _syncKnowledgeHighlights() {
    this.container.querySelectorAll('.knowledge-char-pill').forEach((button) => {
      button.classList.toggle('is-related', this.relatedCharacterIds.has(button.dataset.charId));
    });
  }

  _invalidateFilterCache() {
    this._lastFilterSignature = '';
    this._lastFilteredItems = [];
  }

  _invalidateFilterCache() {
    this._lastFilterSignature = '';
    this._lastFilteredItems = [];
    this._visibleItems = [];
  }

  _renderVisibleItems(contentEl, filteredItems, visibleItems, { append = false, newItems = [] } = {}) {
    this._clearDeferredRender();

    if (!filteredItems.length) {
      contentEl.innerHTML = '<div class="knowledge-empty">没有匹配的知识条目，请尝试更换关键词或筛选项。</div>';
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
  }

}
