class TreeView {
  constructor(container, options = {}) {
    this.container = container;
    this.characters = [];
    this.characterMap = new Map();
    this.relationships = [];
    this.currentFamily = '贾家';
    this.onCharacterClick = null;
    this.searchQuery = '';
    this.expandedNodes = new Set();
    this.familyTrees = new Map();
    this._searchTimer = null;
    this._eventsBound = false;
    this.onTagClick = null;
    this.onFacetChange = null;
    this.relatedCharacterIds = new Set();

    this.familyColors = {
      '贾家': '#C0392B',
      '史家': '#2980B9',
      '王家': '#27AE60',
      '薛家': '#8E44AD',
      '林家': '#16A085',
      '其他': '#E67E22'
    };

    this.generationLabels = {
      0: '始祖',
      1: '第一代',
      2: '第二代',
      3: '第三代',
      4: '第四代',
      5: '第五代'
    };
  }

  setData(characters, relationships) {
    this.characters = characters || [];
    this.relationships = relationships || [];
    this.characterMap = new Map();
    this.familyTrees = new Map();
    this.characters.forEach((character) => this.characterMap.set(character.id, character));
  }

  setFacetContext(facetState = {}) {
    this.relatedCharacterIds = new Set(facetState.selectedCharacterIds || []);
    if (facetState.selectedFamily) this.currentFamily = facetState.selectedFamily;
  }

  render(family) {
    if (family) this.currentFamily = family;
    
    const existingToolbar = this.container.querySelector('.tree-shell');
    if (existingToolbar) {
      this._updateTreeContent();
      return;
    }
    
    this.container.innerHTML = '';

    const familyChars = this._getFamilyCharacters(this.currentFamily);
    if (!familyChars.length) {
      this.container.innerHTML = '<div class="tree-empty">该家族暂无人物数据</div>';
      return;
    }

    const isServant = (character) => {
      const identity = (character.identity || '').toLowerCase();
      const servantKeywords = ['丫鬟', '丫环', '仆人', '仆妇', '小厮', '管家', '嬷嬷', '陪房', '通房', '粗使', '戏子', '奴'];
      return servantKeywords.some((keyword) => identity.includes(keyword));
    };

    const familyMembersOnly = familyChars.filter((c) => !isServant(c));
    const servantCount = familyChars.length - familyMembersOnly.length;

    const treeData = this._getFamilyTree(this.currentFamily, familyChars);
    const visibleSections = this._getVisibleSections(treeData.sections);
    const matchedCount = this._countVisibleNodes(visibleSections);

    const controls = document.createElement('section');
    controls.className = 'tree-shell';
    controls.innerHTML = `
      <div class="tree-toolbar card-surface">
        <div class="tree-toolbar-top">
          <div class="tree-family-tabs">
            ${['贾家', '史家', '王家', '薛家', '林家', '其他'].map((name) => `
              <button class="tree-family-tab ${name === this.currentFamily ? 'active' : ''}" data-family="${name}">
                <span class="tree-tab-dot" style="background:${this.familyColors[name] || '#999'}"></span>
                ${name}
              </button>
            `).join('')}
          </div>
          <div class="tree-toolbar-actions">
            <button class="tree-action-btn" data-action="expand-all">全部展开</button>
            <button class="tree-action-btn" data-action="collapse-all">全部收起</button>
          </div>
        </div>

        <div class="tree-toolbar-bottom">
          <div class="tree-search-box">
            <span class="tree-search-icon">🔍</span>
            <input
              class="tree-search-input"
              type="text"
              placeholder="搜索家族成员、别名、身份、配偶…"
              value="${this._escapeHtml(this.searchQuery)}"
            >
          </div>

          <div class="tree-summary-strip">
            <div class="tree-summary-card accent">
              <span class="tree-summary-label">当前家族</span>
              <strong>${this.currentFamily}</strong>
              <span>${familyMembersOnly.length} 位家族成员${servantCount ? ` + ${servantCount} 位仆从` : ''}</span>
            </div>
            <div class="tree-summary-card">
              <span class="tree-summary-label">谱系分支</span>
              <strong>${treeData.sections.length}</strong>
              <span>${this.searchQuery.trim() ? `匹配 ${matchedCount} 位` : '支持展开收起浏览'}</span>
            </div>
            <div class="tree-summary-card">
              <span class="tree-summary-label">家族层级</span>
              <strong>${treeData.maxGenerationLabel}</strong>
              <span>${treeData.mainlineCount} 位主线人物</span>
            </div>
          </div>
        </div>
      </div>

      <div class="tree-hint-row">
        <span class="tree-hint-pill">点击姓名查看人物卡片</span>
        <span class="tree-hint-pill">点击箭头展开后代分支</span>
        <span class="tree-hint-pill">配偶会以内联标签显示</span>
      </div>

      <div class="tree-outline" id="tree-outline-content">
        ${visibleSections.length
          ? visibleSections.map((section) => this._renderSection(section)).join('')
          : '<div class="tree-empty">没有匹配的家族成员，请尝试更换关键词</div>'}
      </div>
    `;

    this.container.appendChild(controls);
    if (!this._eventsBound) this._bindEvents();
  }

  _updateTreeContent() {
    const treeOutline = this.container.querySelector('#tree-outline-content');
    if (!treeOutline) return;

    const familyChars = this._getFamilyCharacters(this.currentFamily);
    const isServant = (character) => {
      const identity = (character.identity || '').toLowerCase();
      const servantKeywords = ['丫鬟', '丫环', '仆人', '仆妇', '小厮', '管家', '嬷嬷', '陪房', '通房', '粗使', '戏子', '奴'];
      return servantKeywords.some((keyword) => identity.includes(keyword));
    };

    const familyMembersOnly = familyChars.filter((c) => !isServant(c));
    const servantCount = familyChars.length - familyMembersOnly.length;

    const treeData = this._getFamilyTree(this.currentFamily, familyChars);
    const visibleSections = this._getVisibleSections(treeData.sections);
    const matchedCount = this._countVisibleNodes(visibleSections);

    treeOutline.innerHTML = visibleSections.length
      ? visibleSections.map((section) => this._renderSection(section)).join('')
      : '<div class="tree-empty">没有匹配的家族成员，请尝试更换关键词</div>';

    // Update family tab active states
    this.container.querySelectorAll('.tree-family-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.family === this.currentFamily);
    });

    // Update summary strip
    const summaryCards = this.container.querySelectorAll('.tree-summary-card');
    if (summaryCards[0]) {
      const strong = summaryCards[0].querySelector('strong');
      const span = summaryCards[0].querySelector('span:last-child');
      if (strong) strong.textContent = this.currentFamily;
      if (span) span.textContent = `${familyMembersOnly.length} 位家族成员${servantCount ? ` + ${servantCount} 位仆从` : ''}`;
    }
    if (summaryCards[1]) {
      const strong = summaryCards[1].querySelector('strong');
      const span = summaryCards[1].querySelector('span:last-child');
      if (strong) strong.textContent = String(treeData.sections.length);
      if (span) span.textContent = this.searchQuery.trim() ? `匹配 ${matchedCount} 位` : '支持展开收起浏览';
    }
    if (summaryCards[2]) {
      const strong = summaryCards[2].querySelector('strong');
      const span = summaryCards[2].querySelector('span:last-child');
      if (strong) strong.textContent = treeData.maxGenerationLabel;
      if (span) span.textContent = `${treeData.mainlineCount} 位主线人物`;
    }

    this._syncTreeHighlights();
  }

  _getFamilyCharacters(family) {
    return this.characters.filter((character) => {
      const group = this.familyColors[character.family] ? character.family : '其他';
      return group === family;
    });
  }

  _getFamilyTree(family, familyChars) {
    const cacheKey = `${family}:${familyChars.length}:${this.searchQuery.trim().toLowerCase()}`;
    if (this.familyTrees.has(cacheKey)) return this.familyTrees.get(cacheKey);

    const familySet = new Set(familyChars.map((character) => character.id));
    const selectedParentMap = new Map();
    const childrenByParent = new Map();

    const ensureChildrenList = (parentId) => {
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      return childrenByParent.get(parentId);
    };

    const isServant = (character) => {
      const identity = (character.identity || '').toLowerCase();
      const servantKeywords = ['丫鬟', '丫环', '仆人', '仆妇', '小厮', '管家', '嬷嬷', '陪房', '通房', '粗使', '戏子', '奴'];
      return servantKeywords.some((keyword) => identity.includes(keyword));
    };

    const hasSpouseInFamily = (character) => {
      const spouseIds = character.spouseIds || [];
      return spouseIds.some((spouseId) => familySet.has(spouseId));
    };

    familyChars.forEach((character) => {
      const inFamilyParents = (character.parentIds || [])
        .map((parentId) => this.characterMap.get(parentId))
        .filter(Boolean)
        .filter((parent) => familySet.has(parent.id));

      if (inFamilyParents.length) {
        inFamilyParents.sort((a, b) => {
          if ((a.generation || 0) !== (b.generation || 0)) return (a.generation || 0) - (b.generation || 0);
          if (a.gender !== b.gender) return a.gender === '男' ? -1 : 1;
          return (b.importance || 0) - (a.importance || 0);
        });
        selectedParentMap.set(character.id, inFamilyParents[0].id);
      }
    });

    familyChars.forEach((character) => {
      const childIds = (character.childrenIds || []).filter((childId) => familySet.has(childId));
      childIds.forEach((childId) => {
        if (!selectedParentMap.has(childId)) selectedParentMap.set(childId, character.id);
      });
    });

    selectedParentMap.forEach((parentId, childId) => {
      ensureChildrenList(parentId).push(childId);
    });

    const roots = familyChars
      .filter((character) => !selectedParentMap.has(character.id))
      .filter((character) => !isServant(character))
      .filter((character) => !hasSpouseInFamily(character))
      .sort((a, b) => this._sortCharacters(a, b));

    const buildBranch = (character, path = new Set()) => {
      if (!character || path.has(character.id)) return null;
      const nextPath = new Set(path);
      nextPath.add(character.id);

      const childBranches = (childrenByParent.get(character.id) || [])
        .map((childId) => this.characterMap.get(childId))
        .filter(Boolean)
        .filter((child) => !isServant(child))
        .sort((a, b) => this._sortCharacters(a, b))
        .map((child) => buildBranch(child, nextPath))
        .filter(Boolean);

      return {
        id: character.id,
        character,
        spouses: this._getFamilySpouses(character, familySet),
        children: childBranches,
        matched: this._branchMatchesSearch(character, childBranches),
        descendantCount: this._countDescendants(childBranches)
      };
    };

    const sections = roots.map((root) => buildBranch(root)).filter(Boolean);
    const generations = familyChars
      .filter((character) => !isServant(character))
      .map((character) => character.generation || 0);
    const treeData = {
      sections,
      maxGenerationLabel: this.generationLabels[Math.max(...generations, 0)] || '第一代',
      mainlineCount: familyChars.filter((character) => character.isMainline && !isServant(character)).length
    };

    this.familyTrees.set(cacheKey, treeData);
    return treeData;
  }

  _sortCharacters(a, b) {
    if ((a.generation || 0) !== (b.generation || 0)) return (a.generation || 0) - (b.generation || 0);
    if ((b.importance || 0) !== (a.importance || 0)) return (b.importance || 0) - (a.importance || 0);
    return a.name.localeCompare(b.name, 'zh-Hans-CN');
  }

  _getFamilySpouses(character, familySet) {
    return (character.spouseIds || [])
      .map((spouseId) => this.characterMap.get(spouseId))
      .filter(Boolean)
      .filter((spouse) => familySet.has(spouse.id) || spouse.family !== character.family);
  }

  _countDescendants(children) {
    return children.reduce((total, child) => total + 1 + this._countDescendants(child.children || []), 0);
  }

  _branchMatchesSearch(character, childBranches) {
    if (!this.searchQuery.trim()) return true;
    if (this._matchesCharacter(character)) return true;
    return childBranches.some((child) => child.matched);
  }

  _matchesCharacter(character) {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) return true;

    const spouseNames = (character.spouseIds || [])
      .map((id) => this.characterMap.get(id)?.name || '')
      .filter(Boolean);

    const haystack = [
      character.name,
      ...(character.alias || []),
      character.identity || '',
      character.description || '',
      ...(character.keyEvents || []),
      ...spouseNames,
      character.family || ''
    ].join(' ').toLowerCase();

    return haystack.includes(query);
  }

  _getVisibleSections(sections) {
    if (!this.searchQuery.trim()) return sections;
    return sections.filter((section) => section.matched);
  }

  _countVisibleNodes(sections) {
    const countBranch = (branch) => {
      if (!branch || !branch.matched) return 0;
      return 1 + (branch.children || []).reduce((sum, child) => sum + countBranch(child), 0);
    };
    return sections.reduce((sum, section) => sum + countBranch(section), 0);
  }

  _renderSection(section) {
    const character = section.character;
    return `
      <section class="tree-section">
        <header class="tree-section-header">
          <div>
            <div class="tree-section-title">${this._highlightText(character.name)}</div>
            <div class="tree-section-meta">
              <span>${this.generationLabels[character.generation || 0] || `第${character.generation || 0}代`}</span>
              <span>${character.identity || '家族成员'}</span>
              <span>${section.descendantCount} 位后辈分支</span>
            </div>
          </div>
          <button class="tree-section-jump" data-char-id="${character.id}">查看人物</button>
        </header>
        <div class="tree-section-body">
          ${this._renderBranch(section, 0)}
        </div>
      </section>
    `;
  }

  _renderBranch(branch, level) {
    if (!branch || !branch.matched) return '';
    const { character, spouses, children } = branch;
    const hasChildren = children && children.some((child) => child.matched);
    const expanded = this.searchQuery.trim() ? true : (this.expandedNodes.has(character.id) || level < 1);
    const familyColor = this.familyColors[this.currentFamily] || '#999';

    return `
      <div class="tree-item level-${Math.min(level, 5)} ${expanded ? 'expanded' : ''}" data-tree-id="${character.id}">
        <div class="tree-item-row">
          <button
            class="tree-item-toggle ${hasChildren ? '' : 'is-leaf'}"
            data-toggle-id="${character.id}"
            ${hasChildren ? '' : 'disabled'}
            aria-label="${expanded ? '收起分支' : '展开分支'}"
          >${hasChildren ? (expanded ? '▾' : '▸') : '·'}</button>

          <button class="tree-person-card" data-char-id="${character.id}">
            <span class="tree-person-avatar" style="background:${familyColor}">${character.name.slice(0, 1)}</span>
            <span class="tree-person-main">
              <span class="tree-person-name-row">
                <span class="tree-person-name">${this._highlightText(character.name)}</span>
                <span class="tree-person-badge ${character.gender === '女' ? 'female' : 'male'}">${character.gender || '未知'}</span>
                ${character.isMainline ? '<span class="tree-person-badge mainline">主线</span>' : ''}
              </span>
              <span class="tree-person-identity">${this._highlightText(character.identity || '家族成员')}</span>
              <span class="tree-person-meta">
                <span>${this.generationLabels[character.generation || 0] || `第${character.generation || 0}代`}</span>
                <span>重要度 ${character.importance || 1}</span>
                ${character.alias && character.alias.length ? `<span>别名 ${this._highlightText(character.alias.slice(0, 2).join('、'))}</span>` : ''}
              </span>
            </span>
          </button>
        </div>

        ${spouses.length ? `
          <div class="tree-spouse-row">
            ${spouses.map((spouse) => `
              <button class="tree-spouse-pill" data-char-id="${spouse.id}">
                配偶 · ${this._highlightText(spouse.name)}
              </button>
            `).join('')}
          </div>
        ` : ''}

         ${hasChildren ? `
           <div class="tree-item-children ${expanded ? 'visible' : ''}" data-node-id="${character.id}">
             ${children.map((child) => this._renderBranch(child, level + 1)).join('')}
           </div>
         ` : ''}
      </div>
    `;
  }

  _bindEvents() {
    this._eventsBound = true;
    const searchInput = this.container.querySelector('.tree-search-input');
    if (searchInput) {
      let searchIsComposing = false;
      
      const handleSearch = (event) => {
        if (searchIsComposing) return;
        window.clearTimeout(this._searchTimer);
        this._searchTimer = window.setTimeout(() => {
          this.searchQuery = event.target.value;
          this._updateTreeContent();
          this._emitFacetChange();
        }, 160);
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
      const familyTab = event.target.closest('.tree-family-tab');
      if (familyTab) {
        this.searchQuery = '';
        this.render(familyTab.dataset.family);
        this._scrollToTop();
        this._emitFacetChange();
        return;
      }

      const actionButton = event.target.closest('[data-action]');
      if (actionButton) {
        if (actionButton.dataset.action === 'expand-all') {
          this._visitTreeNodes((node) => this.expandedNodes.add(node.id));
          this._updateTreeContent();
        }
        if (actionButton.dataset.action === 'collapse-all') {
          this.expandedNodes.clear();
          this._updateTreeContent();
        }
        return;
      }

      const toggleBtn = event.target.closest('[data-toggle-id]');
      if (toggleBtn) {
        const nodeId = toggleBtn.dataset.toggleId;
        if (!nodeId || toggleBtn.disabled) return;
        if (this.expandedNodes.has(nodeId)) {
          this.expandedNodes.delete(nodeId);
          toggleBtn.classList.remove('expanded');
          toggleBtn.ariaLabel = '展开分支';
          toggleBtn.innerHTML = '▸';
        } else {
          this.expandedNodes.add(nodeId);
          toggleBtn.classList.add('expanded');
          toggleBtn.ariaLabel = '收起分支';
          toggleBtn.innerHTML = '▾';
        }
        const childrenContainer = this.container.querySelector(`[data-node-id="${nodeId}"]`);
        if (childrenContainer) childrenContainer.classList.toggle('visible');
        return;
      }

      const charBtn = event.target.closest('[data-char-id]');
      if (charBtn) {
        const character = this.characterMap.get(charBtn.dataset.charId);
        if (character && this.onCharacterClick) this.onCharacterClick(character);
      }
    });
  }

  _visitTreeNodes(callback) {
    const treeData = this._getFamilyTree(this.currentFamily, this._getFamilyCharacters(this.currentFamily));
    const visit = (branch) => {
      callback(branch.character);
      (branch.children || []).forEach(visit);
    };
    treeData.sections.forEach(visit);
  }

  _highlightText(text) {
    const value = String(text || '');
    const query = this.searchQuery.trim();
    if (!query) return this._escapeHtml(value);

    const escapedValue = this._escapeHtml(value);
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escapedValue.replace(new RegExp(escapedQuery, 'gi'), (match) => `<mark>${match}</mark>`);
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  highlightCharacter(characterId) {
    this.container.querySelectorAll('.tree-person-card').forEach((card) => {
      card.classList.toggle('highlighted', card.dataset.charId === characterId);
    });
  }

  _syncTreeHighlights() {
    this.container.querySelectorAll('.tree-person-card').forEach((card) => {
      card.classList.toggle('highlighted', this.relatedCharacterIds.has(card.dataset.charId));
    });
  }

  _scrollToTop() {
    const outline = this.container.querySelector('.tree-outline');
    if (outline) outline.scrollTo({ top: 0, behavior: 'instant' });
  }

  destroy() {
    window.clearTimeout(this._searchTimer);
    this._eventsBound = false;
    this.container.innerHTML = '';
  }

  _emitFacetChange() {
    if (!this.onFacetChange) return;
    this.onFacetChange({
      view: 'tree',
      selectedFamily: this.currentFamily,
      query: this.searchQuery.trim() || ''
    });
  }
}
