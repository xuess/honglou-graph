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

  setData(knowledge, characters) {
    this.knowledge = knowledge || [];
    this.characters = characters || [];
    this.characterMap = new Map();
    this.characters.forEach((character) => this.characterMap.set(character.id, character));
  }

  render() {
    const existingLayout = this.container.querySelector('.knowledge-shell');
    if (existingLayout) {
      this._updateContent();
      return;
    }
    
    this.container.innerHTML = '';
    const filteredItems = this._getFilteredItems();
    const overview = this._getOverviewStats();
    const categories = this._getCategories();
    const subcategories = this._getSubcategories();
    const chapterOptions = this._getChapterOptions();
    const hotTags = this._getHotTags(filteredItems);

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
                <div class="knowledge-results-subtitle">当前显示 ${filteredItems.length} 条，支持人物跳转、长文展开与多维检索</div>
              </div>
              <button class="knowledge-clear-btn" data-action="clear-filters">清空筛选</button>
            </div>

            <div class="knowledge-grid" id="knowledge-items-content">
              ${filteredItems.length ? filteredItems.slice(0, this.displayCount).map((item) => this._renderKnowledgeCard(item)).join('') : '<div class="knowledge-empty">没有匹配的知识条目，请尝试更换关键词或筛选项。</div>'}
              ${filteredItems.length > this.displayCount ? `<button class="knowledge-load-more" data-action="load-more">加载更多（已显示 ${this.displayCount} / ${filteredItems.length} 条）</button>` : ''}
            </div>
          </div>
        </div>
      </section>
    `;

    this._bindEvents();
  }

  _updateContent() {
    const contentEl = this.container.querySelector('#knowledge-items-content');
    const subtitleEl = this.container.querySelector('.knowledge-results-subtitle');
    
    if (!contentEl) return;

    this.displayCount = 40;
    const filteredItems = this._getFilteredItems();
    const visibleItems = filteredItems.slice(0, this.displayCount);
    
    contentEl.innerHTML = filteredItems.length 
      ? visibleItems.map((item) => this._renderKnowledgeCard(item)).join('') +
        (filteredItems.length > this.displayCount ? `<button class="knowledge-load-more" data-action="load-more">加载更多（已显示 ${this.displayCount} / ${filteredItems.length} 条）</button>` : '')
      : '<div class="knowledge-empty">没有匹配的知识条目，请尝试更换关键词或筛选项。</div>';
    
    if (subtitleEl) {
      subtitleEl.textContent = `当前显示 ${Math.min(this.displayCount, filteredItems.length)} / ${filteredItems.length} 条，支持人物跳转、长文展开与多维检索`;
    }

    this._updateCategoryActiveState();
    this._bindCardEvents();
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

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'))
      .slice(0, 16);
  }

  _getFilteredItems() {
    let items = this.knowledge.map((item) => ({ ...item, _score: this._getRelevanceScore(item) }));

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
    const shouldClamp = (item.content || '').length > 120;
    const displayContent = !expanded && shouldClamp ? `${item.content.slice(0, 120)}…` : item.content;

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
              ${relatedCharacters.map((character) => `<button class="knowledge-char-pill" data-char-id="${character.id}">${character.name}</button>`).join('')}
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
    const searchInput = this.container.querySelector('.knowledge-search-input');
    if (searchInput) {
      let searchIsComposing = false;
      let searchTimer = null;
      
      const handleSearch = (event) => {
        if (searchIsComposing) return;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          this.searchQuery = event.target.value;
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

    this.container.querySelectorAll('[data-cat]').forEach((button) => {
      button.addEventListener('click', () => {
        this.activeCategory = button.dataset.cat;
        this.activeSubcategory = 'all';
        this._updateContent();
        this._scrollToTop();
      });
    });

    this.container.querySelectorAll('[data-subcategory]').forEach((button) => {
      button.addEventListener('click', () => {
        this.activeSubcategory = button.dataset.subcategory;
        this._updateContent();
        this._scrollToTop();
      });
    });

    this.container.querySelectorAll('[data-tag]').forEach((button) => {
      button.addEventListener('click', () => {
        this.searchQuery = button.dataset.tag || '';
        const searchInput = this.container.querySelector('.knowledge-search-input');
        if (searchInput) searchInput.value = this.searchQuery;
        this._updateContent();
        this._scrollToTop();
      });
    });

    this.container.querySelectorAll('.knowledge-select').forEach((select) => {
      select.addEventListener('change', () => {
        if (select.dataset.filter === 'chapter') this.chapterFilter = select.value;
        if (select.dataset.filter === 'sort') this.sortBy = select.value;
        this._updateContent();
        this._scrollToTop();
      });
    });

    this.container.querySelectorAll('[data-action="clear-filters"]').forEach((button) => {
      button.addEventListener('click', () => {
        this.activeCategory = 'all';
        this.activeSubcategory = 'all';
        this.chapterFilter = 'all';
        this.sortBy = 'relevance';
        this.searchQuery = '';
        const searchInput = this.container.querySelector('.knowledge-search-input');
        if (searchInput) searchInput.value = '';
        this._updateContent();
        this._scrollToTop();
      });
    });

    this._bindCardEvents();
  }

  _bindCardEvents() {
    this.container.querySelectorAll('[data-char-id]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const character = this.characterMap.get(button.dataset.charId);
        if (character && this.onCharacterClick) this.onCharacterClick(character);
      });
    });

    this.container.querySelectorAll('[data-expand-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.expandId;
        if (!id) return;
        if (this.expandedIds.has(id)) this.expandedIds.delete(id);
        else this.expandedIds.add(id);
        this._updateContent();
      });
    });

    this.container.querySelectorAll('[data-action="load-more"]').forEach((button) => {
      button.addEventListener('click', () => {
        this._loadMore();
      });
    });
  }

  _loadMore() {
    const contentEl = this.container.querySelector('#knowledge-items-content');
    const subtitleEl = this.container.querySelector('.knowledge-results-subtitle');
    if (!contentEl) return;

    this.displayCount += 40;
    const filteredItems = this._getFilteredItems();
    const visibleItems = filteredItems.slice(0, this.displayCount);

    contentEl.innerHTML = visibleItems.map((item) => this._renderKnowledgeCard(item)).join('') +
      (filteredItems.length > this.displayCount ? `<button class="knowledge-load-more" data-action="load-more">加载更多（已显示 ${this.displayCount} / ${filteredItems.length} 条）</button>` : '');

    if (subtitleEl) {
      subtitleEl.textContent = `当前显示 ${Math.min(this.displayCount, filteredItems.length)} / ${filteredItems.length} 条，支持人物跳转、长文展开与多维检索`;
    }

    this._bindCardEvents();
  }

  _scrollToTop() {
    const main = this.container.querySelector('.knowledge-main');
    if (main) main.scrollTo({ top: 0, behavior: 'instant' });
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
    return this.knowledge.filter((item) => (item.relatedCharacters || []).includes(characterId));
  }

  destroy() {
    this.container.innerHTML = '';
  }
}
