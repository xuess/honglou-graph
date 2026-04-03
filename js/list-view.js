class ListView {
  constructor(container, options = {}) {
    this.container = container;
    this.characters = [];
    this.characterMap = new Map();
    this.relationships = [];
    this.onCharacterClick = null;
    this.onKnowledgeClick = null;

    this.viewMode = 'card'; // 'card' | 'compact'
    this.sortBy = 'importance'; // 'importance' | 'family' | 'name' | 'generation'
    this.filterFamily = 'all';
    this.filterGender = 'all';
    this.searchQuery = '';
    this._searchTimer = null;
    this._controlsBound = false;
    this._listClickBound = false;
    this.visibleCount = 48;
    this.onTagClick = null;
    this.relatedCharacterIds = new Set();
    this.relationCountMap = new Map();
    this._filterCacheKey = '';
    this._filteredCharacters = [];

    this.familyColors = {
      '贾家': '#C0392B',
      '史家': '#2980B9',
      '王家': '#27AE60',
      '薛家': '#8E44AD',
      '林家': '#16A085',
      '其他': '#E67E22'
    };
  }

  setData(characters, relationships) {
    this.characters = characters;
    this.relationships = relationships;
    this.characterMap = new Map();
    characters.forEach(c => this.characterMap.set(c.id, c));
    this.relationCountMap = new Map();
    relationships.forEach((r) => {
      const s = typeof r.source === 'string' ? r.source : r.source.id;
      const t = typeof r.target === 'string' ? r.target : r.target.id;
      this.relationCountMap.set(s, (this.relationCountMap.get(s) || 0) + 1);
      this.relationCountMap.set(t, (this.relationCountMap.get(t) || 0) + 1);
    });
  }

  setFacetContext(facetState = {}) {
    const ids = facetState.selectedCharacterIds || [];
    this.relatedCharacterIds = new Set(ids);
    if (facetState.selectedFamily) this.filterFamily = facetState.selectedFamily;
  }

  render() {
    this.container.innerHTML = '';

    // Controls bar
    const controls = document.createElement('div');
    controls.className = 'list-controls';
    controls.innerHTML = `
      <div class="list-controls-left">
        <div class="list-search-box">
          <span class="list-search-icon">🔍</span>
          <input class="list-search-input" type="text" placeholder="筛选人物…" value="${this._escapeHtml(this.searchQuery)}">
        </div>
        <select class="list-filter-select" data-filter="family">
          <option value="all">全部家族</option>
          <option value="贾家" ${this.filterFamily === '贾家' ? 'selected' : ''}>贾家</option>
          <option value="史家" ${this.filterFamily === '史家' ? 'selected' : ''}>史家</option>
          <option value="王家" ${this.filterFamily === '王家' ? 'selected' : ''}>王家</option>
          <option value="薛家" ${this.filterFamily === '薛家' ? 'selected' : ''}>薛家</option>
          <option value="林家" ${this.filterFamily === '林家' ? 'selected' : ''}>林家</option>
          <option value="其他" ${this.filterFamily === '其他' ? 'selected' : ''}>其他</option>
        </select>
        <select class="list-filter-select" data-filter="gender">
          <option value="all">全部性别</option>
          <option value="男" ${this.filterGender === '男' ? 'selected' : ''}>男</option>
          <option value="女" ${this.filterGender === '女' ? 'selected' : ''}>女</option>
        </select>
      </div>
      <div class="list-controls-right">
        <select class="list-sort-select">
          <option value="importance" ${this.sortBy === 'importance' ? 'selected' : ''}>按重要度</option>
          <option value="family" ${this.sortBy === 'family' ? 'selected' : ''}>按家族</option>
          <option value="name" ${this.sortBy === 'name' ? 'selected' : ''}>按姓名</option>
          <option value="generation" ${this.sortBy === 'generation' ? 'selected' : ''}>按辈分</option>
        </select>
        <div class="list-view-toggle">
          <button class="list-view-btn ${this.viewMode === 'card' ? 'active' : ''}" data-mode="card" title="卡片视图">▦</button>
          <button class="list-view-btn ${this.viewMode === 'compact' ? 'active' : ''}" data-mode="compact" title="紧凑视图">☰</button>
        </div>
      </div>
    `;
    this.container.appendChild(controls);

    if (!this._controlsBound) this._bindControls();

    // List container
    const listEl = document.createElement('div');
    listEl.className = 'list-content';
    listEl.id = 'list-view-content';
    this.container.appendChild(listEl);

    this._renderList();
  }

  _bindControls() {
    this._controlsBound = true;
    const controls = this.container.querySelector('.list-controls');
    if (!controls) return;

    let searchIsComposing = false;
    const searchInput = controls.querySelector('.list-search-input');
    if (searchInput) {
      const handleSearch = (e) => {
        if (searchIsComposing) return;
        window.clearTimeout(this._searchTimer);
        this._searchTimer = window.setTimeout(() => {
          this.searchQuery = e.target.value;
          this._invalidateFilterCache();
          this._renderList();
          this._scrollToTop();
        }, 160);
      };
      searchInput.addEventListener('compositionstart', () => {
        searchIsComposing = true;
      });
      searchInput.addEventListener('compositionend', (e) => {
        searchIsComposing = false;
        handleSearch(e);
      });
      searchInput.addEventListener('input', handleSearch);
    }

    controls.addEventListener('change', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches('.list-filter-select')) {
        if (target.dataset.filter === 'family') this.filterFamily = target.value;
        if (target.dataset.filter === 'gender') this.filterGender = target.value;
        this._invalidateFilterCache();
        this.visibleCount = 48;
        this._renderList();
        this._scrollToTop();
      }
      if (target.matches('.list-sort-select')) {
        this.sortBy = target.value;
        this._invalidateFilterCache();
        this._renderList();
        this._scrollToTop();
      }
    });

    controls.addEventListener('click', (e) => {
      const btn = e.target.closest('.list-view-btn');
      if (!btn) return;
      this.viewMode = btn.dataset.mode;
      controls.querySelectorAll('.list-view-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === this.viewMode));
      this._renderList();
    });
  }

  _scrollToTop() {
    const listEl = this.container.querySelector('.list-content');
    if (listEl) listEl.scrollTo({ top: 0, behavior: 'instant' });
  }

  _getFilteredCharacters() {
    const cacheKey = JSON.stringify({
      family: this.filterFamily,
      gender: this.filterGender,
      query: this.searchQuery.trim(),
      sortBy: this.sortBy
    });
    if (cacheKey === this._filterCacheKey && this._filteredCharacters.length) {
      return this._filteredCharacters;
    }

    let chars = [...this.characters];

    // Filter by family
    if (this.filterFamily !== 'all') {
      chars = chars.filter(c => {
        const group = this.familyColors[c.family] ? c.family : '其他';
        return group === this.filterFamily;
      });
    }

    // Filter by gender
    if (this.filterGender !== 'all') {
      chars = chars.filter(c => c.gender === this.filterGender);
    }

    // Filter by search
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      chars = chars.filter(c => {
        const haystack = [
          c.name, ...(c.alias || []), c.identity || '', c.family || '',
          c.description || '', ...(c.keyEvents || [])
        ].join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }

    // Sort
    switch (this.sortBy) {
      case 'importance':
        chars.sort((a, b) => (b.importance || 0) - (a.importance || 0) || a.name.localeCompare(b.name, 'zh-Hans-CN'));
        break;
      case 'family':
        chars.sort((a, b) => a.family.localeCompare(b.family, 'zh-Hans-CN') || (b.importance || 0) - (a.importance || 0));
        break;
      case 'name':
        chars.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
        break;
      case 'generation':
        chars.sort((a, b) => (a.generation || 99) - (b.generation || 99) || (b.importance || 0) - (a.importance || 0));
        break;
    }

    this._filterCacheKey = cacheKey;
    this._filteredCharacters = chars;
    return chars;
  }

  _renderList() {
    const listEl = this.container.querySelector('#list-view-content');
    if (!listEl) return;

    const chars = this._getFilteredCharacters();
    const visibleChars = chars.slice(0, this.visibleCount);

    if (!chars.length) {
      listEl.innerHTML = '<div class="list-empty">没有匹配的人物</div>';
      return;
    }

    // Stats bar
    const statsHtml = `<div class="list-stats">共 ${chars.length} 位人物${chars.length > visibleChars.length ? ` · 已显示 ${visibleChars.length}` : ''}</div>`;

    if (this.viewMode === 'card') {
      listEl.innerHTML = statsHtml + `<div class="list-card-grid">${visibleChars.map(c => this._renderCardItem(c)).join('')}</div>${chars.length > visibleChars.length ? `<button class="list-load-more" data-action="load-more">加载更多（${visibleChars.length}/${chars.length}）</button>` : ''}`;
    } else {
      listEl.innerHTML = statsHtml + `<div class="list-compact-table">${visibleChars.map(c => this._renderCompactItem(c)).join('')}</div>${chars.length > visibleChars.length ? `<button class="list-load-more" data-action="load-more">加载更多（${visibleChars.length}/${chars.length}）</button>` : ''}`;
    }

    if (!this._listClickBound) {
      this._listClickBound = true;
      listEl.addEventListener('click', (e) => {
        const knowledgeEl = e.target.closest('[data-knowledge-id]');
        if (knowledgeEl) {
          e.stopPropagation();
          e.preventDefault();
          const char = this.characterMap.get(knowledgeEl.dataset.knowledgeId);
          if (char && this.onKnowledgeClick) this.onKnowledgeClick(char);
          return;
        }
        const charEl = e.target.closest('[data-char-id]');
        if (charEl) {
          const char = this.characterMap.get(charEl.dataset.charId);
          if (char && this.onCharacterClick) this.onCharacterClick(char);
          return;
        }
        const actionEl = e.target.closest('[data-action="load-more"]');
        if (actionEl) {
          this.visibleCount += 48;
          this._renderList();
        }
      });
    }
  }

  _renderCardItem(c) {
    const familyGroup = this.familyColors[c.family] ? c.family : '其他';
    const color = this.familyColors[familyGroup];
    const relCount = this.relationCountMap.get(c.id) || 0;
    const isRelated = this.relatedCharacterIds.has(c.id);

    return `
      <div class="list-card-item ${isRelated ? 'is-related' : ''}" data-char-id="${c.id}">
        <div class="list-card-avatar" style="background:${color}">${c.name.substring(0, 1)}</div>
        <div class="list-card-body">
          <div class="list-card-name">${c.name}${c.pinyin ? `<span class="list-card-pinyin">${c.pinyin}</span>` : ''}</div>
          <div class="list-card-identity">${c.identity || ''}</div>
          <div class="list-card-meta">
            <button class="list-card-tag" data-tag-type="family" data-tag-value="${familyGroup}" style="color:${color};border-color:${color}40">${familyGroup}</button>
            <span class="list-card-tag ${c.gender === '女' ? 'female' : 'male'}">${c.gender}</span>
            <span class="list-card-tag soft">★${c.importance || 1}</span>
            <span class="list-card-tag soft">${relCount}条关系</span>
            <button class="list-card-tag knowledge" data-knowledge-id="${c.id}">相关知识</button>
          </div>
          ${c.outcome ? `<div class="list-card-outcome">结局：${c.outcome}</div>` : ''}
        </div>
      </div>
    `;
  }

  _renderCompactItem(c) {
    const familyGroup = this.familyColors[c.family] ? c.family : '其他';
    const color = this.familyColors[familyGroup];

    return `
      <div class="list-compact-row" data-char-id="${c.id}">
        <span class="list-compact-avatar" style="background:${color}">${c.name.substring(0, 1)}</span>
        <span class="list-compact-name">${c.name}</span>
        <span class="list-compact-family" style="color:${color}">${familyGroup}</span>
        <span class="list-compact-identity">${c.identity || ''}</span>
        <span class="list-compact-importance">★${c.importance || 1}</span>
        <span class="list-compact-gender ${c.gender === '女' ? 'female' : 'male'}">${c.gender}</span>
        <button class="list-card-tag knowledge" data-knowledge-id="${c.id}">知识</button>
      </div>
    `;
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  destroy() {
    window.clearTimeout(this._searchTimer);
    this._controlsBound = false;
    this._listClickBound = false;
    this._invalidateFilterCache();
    this.container.innerHTML = '';
  }

  _invalidateFilterCache() {
    this._filterCacheKey = '';
    this._filteredCharacters = [];
  }

}
