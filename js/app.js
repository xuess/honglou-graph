class HongLouMengApp {
  constructor() {
    this.graph = null;
    this.treeView = null;
    this.listView = null;
    this.knowledgeView = null;
    this.characters = [];
    this.relationships = [];
    this.knowledge = [];
    this.characterMap = new Map();
    this.currentCharacterId = null;
    this.currentTopic = null;
    this.currentStage = null;
    this.currentRelationshipPair = null;
    this.currentFamily = null;
    this.currentView = { type: 'overview' };
    this.activeView = 'graph';
    this.viewHistory = [];
    this.isFullscreen = false;
    this.isMobileSearchOpen = false;
    this.els = {};
    this.viewInitialized = { graph: true, tree: false, list: false, knowledge: false };
    this.viewEverRendered = { tree: false, list: false, knowledge: false };
    this.destroyInactiveViews = false;
    this.facetState = {
      selectedCharacterIds: [],
      selectedTags: [],
      selectedFamily: null,
      selectedChapter: null,
      selectedCategory: null,
      selectedRelationTypes: [],
      query: '',
      breadcrumb: [{ label: '默认概览', type: 'overview' }],
      sourceView: 'graph'
    };

    this.featuredCharacterIds = ['jia_baoyu', 'lin_daiyu', 'xue_baochai', 'wang_xifeng', 'jia_mu', 'shi_xiangyun'];

    this.topics = [
      {
        id: 'baodai',
        title: '宝黛关系',
        description: '从知己、情感与家族压力三条线理解宝玉与黛玉。',
        characterIds: ['jia_baoyu', 'lin_daiyu', 'jia_mu', 'xue_baochai', 'zijuan'],
        focusId: 'lin_daiyu',
        tags: ['木石前盟', '情感主线', '阅读高频']
      },
      {
        id: 'baochaichai',
        title: '宝黛钗三角脉络',
        description: '快速梳理宝玉、黛玉、宝钗之间的情感与家族安排。',
        characterIds: ['jia_baoyu', 'lin_daiyu', 'xue_baochai', 'jia_mu', 'wang_furen'],
        focusId: 'jia_baoyu',
        tags: ['金玉良缘', '宝黛钗', '主线人物']
      },
      {
        id: 'daguanyuan',
        title: '大观园少女群像',
        description: '从园中少女与丫鬟群体切入，理解大观园的关系网络。',
        characterIds: ['lin_daiyu', 'xue_baochai', 'shi_xiangyun', 'jia_tanchun', 'jia_xichun', 'xiren', 'qingwen'],
        focusId: 'shi_xiangyun',
        tags: ['群像', '大观园', '女性人物']
      },
      {
        id: 'fengjie',
        title: '王熙凤的权力网络',
        description: '看凤姐如何连接贾府内外，处理家务、婚姻与权力关系。',
        characterIds: ['wang_xifeng', 'jia_lian', 'jia_mu', 'wang_furen', 'pinger', 'you_erjie'],
        focusId: 'wang_xifeng',
        tags: ['管家', '权力', '凤姐']
      }
    ];

    this.stages = [
      {
        id: 'early',
        title: '前二十回 · 入府与认人期',
        description: '适合刚开始读时，先认识贾母、宝玉、黛玉、王熙凤等主线人物。',
        range: '第 1 回 - 第 20 回',
        focusId: 'lin_daiyu',
        characterIds: ['lin_daiyu', 'jia_baoyu', 'jia_mu', 'wang_xifeng', 'wang_furen', 'jia_zheng', 'xue_baochai'],
        questions: ['黛玉为什么进贾府？', '宝玉最先围绕哪些人展开？']
      },
      {
        id: 'garden',
        title: '大观园繁华期',
        description: '这一阶段适合从园中群像与宝黛钗主线进入，理解少女群像与情感关系。',
        range: '第 21 回 - 第 56 回',
        focusId: 'jia_baoyu',
        characterIds: ['jia_baoyu', 'lin_daiyu', 'xue_baochai', 'shi_xiangyun', 'jia_tanchun', 'qingwen', 'xiren', 'zijuan'],
        questions: ['谁构成了大观园核心人物群？', '宝黛钗关系为什么愈发复杂？']
      },
      {
        id: 'decline',
        title: '抄检与衰败期',
        description: '从抄检大观园、晴雯之死到凤姐失势，关系重心逐渐转向家族危机。',
        range: '第 57 回 - 第 80 回',
        focusId: 'wang_xifeng',
        characterIds: ['wang_xifeng', 'jia_baoyu', 'lin_daiyu', 'qingwen', 'xiren', 'pinger', 'jia_mu'],
        questions: ['谁开始承受贾府衰败的代价？', '主仆关系与权力关系如何变化？']
      },
      {
        id: 'late',
        title: '后期结局线',
        description: '适合回看人物命运收束：宝玉出家、黛玉焚稿、凤姐力诎、贾府崩塌。',
        range: '第 81 回 - 第 120 回',
        focusId: 'jia_baoyu',
        characterIds: ['jia_baoyu', 'xue_baochai', 'lin_daiyu', 'wang_xifeng', 'jia_mu', 'you_erjie'],
        questions: ['结局里谁的命运最具象征性？', '家族关系如何最终崩裂？']
      }
    ];

    this.aliasMap = new Map([
      ['宝玉', 'jia_baoyu'], ['宝二爷', 'jia_baoyu'], ['宝哥哥', 'jia_baoyu'],
      ['黛玉', 'lin_daiyu'], ['林妹妹', 'lin_daiyu'], ['颦儿', 'lin_daiyu'],
      ['宝钗', 'xue_baochai'], ['宝姐姐', 'xue_baochai'],
      ['凤姐', 'wang_xifeng'], ['凤姐姐', 'wang_xifeng'],
      ['老太太', 'jia_mu'], ['老祖宗', 'jia_mu'],
      ['二奶奶', 'wang_xifeng'], ['袭人', 'xiren'], ['晴雯', 'qingwen'], ['紫鹃', 'zijuan'], ['平儿', 'pinger']
    ]);

    this._init();
  }

  async _init() {
    this._initFontAndThemeControls();
    this._cacheDom();
    this._initSidebarResize();
    this._bindEvents();

    try {
      await this._loadData();
      this._initGraph();
      this._initViews();
      this._buildSidebar();
      this._renderComparisonTools();
      this._renderStageList();
      this._showOverview();

      const initialView = (location.hash || '').replace('#', '') || 'graph';
      if (['graph', 'tree', 'list', 'knowledge'].includes(initialView)) {
        this._switchView(initialView);
      }

      this._hideLoading();
    } catch (err) {
      console.error('初始化失败:', err);
      this._showError('数据加载失败，请刷新页面重试。');
    }
  }

  _cacheDom() {
    this.els = {
      body: document.body,
      loading: document.getElementById('loading-overlay'),
      graphContainer: document.getElementById('graph-container'),
      treeContainer: document.getElementById('tree-container'),
      listContainer: document.getElementById('list-container'),
      knowledgeContainer: document.getElementById('knowledge-container'),
      searchInput: document.getElementById('search-input'),
      searchResults: document.getElementById('search-results'),
      graphSearchInput: document.getElementById('graph-search-input'),
      graphSearchResults: document.getElementById('graph-search-results'),
      sidebarSearchResults: document.getElementById('sidebar-search-results'),
      sidebarToggle: document.getElementById('sidebar-toggle'),
      sidebar: document.getElementById('sidebar'),
      sidebarResizeHandle: document.getElementById('sidebar-resize-handle'),
      sidebarBackdrop: document.getElementById('sidebar-backdrop'),
      familyFilters: document.getElementById('family-filters'),
      relationFilters: document.getElementById('relation-filters'),
      graphFilterSummary: document.getElementById('graph-filter-summary'),
      statsSection: document.getElementById('stats-section'),
      moreTools: document.querySelector('.sidebar-more-tools'),
      cardOverlay: document.getElementById('character-card-overlay'),
      cardContent: document.getElementById('card-content'),
      modeIndicator: document.getElementById('mode-indicator'),
      modeName: document.getElementById('mode-name'),
      btnFullView: document.getElementById('btn-full-view'),
      btnHeaderFullscreen: document.getElementById('btn-header-fullscreen'),
      btnZoomIn: document.getElementById('btn-zoom-in'),
      btnZoomOut: document.getElementById('btn-zoom-out'),
      btnReset: document.getElementById('btn-reset'),
      btnToggleLabels: document.getElementById('btn-toggle-labels'),
      btnExitFocus: document.getElementById('btn-exit-focus'),
      btnGraphFullscreen: document.getElementById('btn-graph-fullscreen'),
      btnExitFullscreen: document.getElementById('btn-exit-fullscreen'),
      graphFloatingBar: document.getElementById('graph-floating-bar'),
      fullscreenViewLabel: document.getElementById('fullscreen-view-label'),
      globalContextBar: document.getElementById('global-context-bar'),
      contextBreadcrumbs: document.getElementById('context-breadcrumbs'),
      contextFacets: document.getElementById('context-facets'),
      btnClearContext: document.getElementById('btn-clear-context'),
      featuredCharacters: document.getElementById('featured-characters'),
      topicList: document.getElementById('topic-list'),
      familyBrowser: document.getElementById('family-browser'),
      stageList: document.getElementById('stage-list'),
      compareLeft: document.getElementById('compare-left'),
      compareRight: document.getElementById('compare-right'),
      btnRunCompare: document.getElementById('btn-run-compare'),
      btnCompareCurrent: document.getElementById('btn-compare-current'),
      detailDrawer: document.getElementById('detail-drawer'),
      drawerContent: document.getElementById('drawer-content'),
      drawerClose: document.getElementById('drawer-close'),
      btnBack: document.getElementById('btn-back'),
      btnMobileSearch: document.getElementById('btn-mobile-search'),
      mobileSearchOverlay: document.getElementById('mobile-search-overlay'),
      mobileSearchInput: document.getElementById('mobile-search-input'),
      mobileSearchResults: document.getElementById('mobile-search-results'),
      mobileSearchClose: document.getElementById('mobile-search-close'),
      viewNav: document.getElementById('view-nav'),
      viewPanels: document.querySelectorAll('.view-panel'),
      viewGraph: document.getElementById('view-graph'),
      viewTree: document.getElementById('view-tree'),
      viewList: document.getElementById('view-list'),
      viewKnowledge: document.getElementById('view-knowledge')
    };
  }

  _safeHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content;
  }

  _setHtml(element, html) {
    if (!element) return;
    element.replaceChildren(this._safeHtml(html));
  }

  _bindEvents() {
    this._bindSidebarResize();

    let searchTimer;
    const handleSearch = (value, resultsEl) => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => this._onSearch(value, resultsEl), 180);
    };

    if (this.els.graphSearchInput) {
      this.els.graphSearchInput.addEventListener('input', (e) => handleSearch(e.target.value, this.els.graphSearchResults));
      this.els.graphSearchInput.addEventListener('focus', () => {
        if (this.els.graphSearchInput.value.trim()) this.els.graphSearchResults?.classList.add('active');
      });
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.graph-search-box') && !e.target.closest('.search-box')) {
        this.els.graphSearchResults?.classList.remove('active');
        this.els.searchResults?.classList.remove('active');
        if (this.els.mobileSearchResults) this.els.mobileSearchResults.classList.remove('active');
      }
    });

    this.els.sidebarToggle.addEventListener('click', () => this._toggleSidebar());
    this.els.sidebarBackdrop.addEventListener('click', () => this._toggleSidebar(false));
    this.els.drawerClose.addEventListener('click', () => this._closeDrawer());
    this.els.cardOverlay.addEventListener('click', (e) => {
      if (e.target !== this.els.cardOverlay) return;
      this._closeCard();
    });

    // Mobile search
    if (this.els.btnMobileSearch) {
      this.els.btnMobileSearch.addEventListener('click', () => this._openMobileSearch());
    }
    if (this.els.mobileSearchClose) {
      this.els.mobileSearchClose.addEventListener('click', () => this._closeMobileSearch());
    }
    if (this.els.mobileSearchInput) {
      this.els.mobileSearchInput.addEventListener('input', (e) => handleSearch(e.target.value, this.els.mobileSearchResults));
      this.els.mobileSearchInput.addEventListener('focus', () => {
        if (this.els.mobileSearchInput.value.trim()) this.els.mobileSearchResults.classList.add('active');
      });
    }

    // Back button
    if (this.els.btnBack) {
      this.els.btnBack.addEventListener('click', () => this._goBack());
    }

    if (this.els.btnClearContext) {
      this.els.btnClearContext.addEventListener('click', () => this._clearFacetContext());
    }

    this.els.btnFullView.addEventListener('click', () => this._showFullGraph());
    this.els.btnZoomIn.addEventListener('click', () => this.graph.zoomIn());
    this.els.btnZoomOut.addEventListener('click', () => this.graph.zoomOut());
    this.els.btnReset.addEventListener('click', () => this.graph.resetView());
    this.els.btnToggleLabels.addEventListener('click', () => {
      const visible = this.graph.toggleLabels();
      this.els.btnToggleLabels.classList.toggle('active', visible);
    });
    this.els.btnExitFocus.addEventListener('click', () => this._exitFocusMode());
    if (this.els.btnHeaderFullscreen) {
      this.els.btnHeaderFullscreen.addEventListener('click', () => this._toggleFullscreen());
    }
    this.els.btnGraphFullscreen.addEventListener('click', () => this._toggleFullscreen(true));
    this.els.btnExitFullscreen.addEventListener('click', () => this._toggleFullscreen(false));

    this.els.btnRunCompare.addEventListener('click', () => {
      const compareState = this._getCompareState();
      if (!compareState.canCompare) return;
      this._openRelationshipView(compareState.leftValue, compareState.rightValue);
    });

    this.els.compareLeft.addEventListener('change', () => this._handleCompareInputChange('left'));
    this.els.compareRight.addEventListener('change', () => this._handleCompareInputChange('right'));

    this.els.btnCompareCurrent.addEventListener('click', () => {
      if (!this.currentCharacterId) return;
      this.els.compareLeft.value = this.currentCharacterId;
      if (this.els.compareRight.value === this.currentCharacterId) this.els.compareRight.value = '';
      this._updateActionStates();
      this.els.compareRight.focus();
      this._openSidebarTools();
    });

    this.els.detailDrawer.addEventListener('click', (e) => {
      const characterButton = e.target.closest('[data-character-id]');
      const openCardButton = e.target.closest('[data-open-card-id]');
      const topicButton = e.target.closest('[data-topic-id]');
      const stageButton = e.target.closest('[data-stage-id]');
      const familyButton = e.target.closest('[data-family-name]');
      const compareButton = e.target.closest('[data-compare-character-id]');
      const tagButton = e.target.closest('[data-tag-type]');

      if (characterButton) this._openCharacter(characterButton.dataset.characterId, { focusNeighbors: true });
      if (openCardButton) {
        const character = this.characterMap.get(openCardButton.dataset.openCardId);
        if (character) this._showCard(character);
      }
      if (topicButton) this._openTopic(topicButton.dataset.topicId);
      if (stageButton) this._openStage(stageButton.dataset.stageId);
      if (familyButton) this._openFamily(familyButton.dataset.familyName);
      if (compareButton) this._prepareCompareFromCurrent(compareButton.dataset.compareCharacterId);
      if (tagButton) this._handleFacetTagSelection({ type: tagButton.dataset.tagType, value: tagButton.dataset.tagValue, view: 'drawer' });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isMobileSearchOpen) {
          this._closeMobileSearch();
          return;
        }
        if (this.els.cardOverlay.classList.contains('active')) {
          this._closeCard();
          return;
        }
        if (this.isFullscreen) {
          this._toggleFullscreen(false);
          return;
        }
        if (this.graph && this.graph.focusMode) {
          this._exitFocusMode();
          return;
        }
        this._closeDrawer();
      }

      if (e.key === '/' && !e.target.closest('input') && !e.target.closest('select') && !e.target.closest('textarea')) {
        e.preventDefault();
        (this.els.graphSearchInput || this.els.searchInput)?.focus();
      }
    });

    if (this.els.viewNav) {
      this.els.viewNav.addEventListener('click', (e) => {
        const tab = e.target.closest('.view-nav-tab');
        if (tab && tab.dataset.view) {
          this._forceCloseOverlays();
          this._switchView(tab.dataset.view);
        }
      });
    }

    // Handle URL hash changes (browser navigation, direct links)
    window.addEventListener('hashchange', () => {
      const viewName = (location.hash || '').replace('#', '') || 'graph';
      if (['graph', 'tree', 'list', 'knowledge'].includes(viewName)) {
        this._switchView(viewName);
      }
    });
  }

  async _loadData() {
    const [charRes, relRes, knowledgeRes] = await Promise.all([
      fetch('data/characters.json'),
      fetch('data/relationships.json'),
      fetch('data/knowledge.json')
    ]);

    if (!charRes.ok || !relRes.ok) throw new Error('无法加载数据文件');

    this.characters = await charRes.json();
    this.relationships = await relRes.json();
    this.knowledge = knowledgeRes.ok ? await knowledgeRes.json() : [];
    this.characters.forEach((character) => {
      this.characterMap.set(character.id, character);
      this.aliasMap.set(character.name, character.id);
      (character.alias || []).forEach((alias) => this.aliasMap.set(alias, character.id));
    });
  }

  _initGraph() {
    this.graph = new RelationshipGraph(this.els.graphContainer, {
      linkDistance: 108,
      chargeStrength: -220,
      collisionPadding: 12,
      labelVisibilityMode: 'smart'
    });

    this.graph.onNodeClick = (character) => this._handleNodeClick(character);
    this.graph.onNodeDblClick = (character) => this._enterFocusMode(character);
    this.graph.onBackgroundClick = () => this._handleGraphBackgroundClick();
    this.graph.setData(this.characters, this.relationships);
  }

  _initViews() {
    if (this.els.treeContainer) {
      this.treeView = new TreeView(this.els.treeContainer);
      this.treeView.setData(this.characters, this.relationships);
      this.treeView.onCharacterClick = (character) => this._openCharacter(character.id, { focusNeighbors: true });
      this._subscribeViewToFacetStore('tree');
    }

    if (this.els.listContainer) {
      this.listView = new ListView(this.els.listContainer);
      this.listView.setData(this.characters, this.relationships);
      this.listView.onCharacterClick = (character) => this._openCharacter(character.id, { focusNeighbors: true });
      this.listView.onKnowledgeClick = (character) => this._openCharacterKnowledge(character);
      this._subscribeViewToFacetStore('list');
    }

    if (this.els.knowledgeContainer) {
      this.knowledgeView = new KnowledgeView(this.els.knowledgeContainer);
      this.knowledgeView.setData(this.knowledge, this.characters);
      this.knowledgeView.onCharacterClick = (characterId) => this._openCharacter(characterId, { focusNeighbors: true });
      this.knowledgeView.onTagClick = (payload) => this._handleFacetTagSelection(payload);
      this._subscribeViewToFacetStore('knowledge');
    }
  }

  _subscribeViewToFacetStore(viewName) {
    if (!facetStore) return;
    
    facetStore.subscribe(viewName, (state, changedKeys) => {
      const view = {
        tree: this.treeView,
        list: this.listView,
        knowledge: this.knowledgeView,
        graph: this.graph
      }[viewName];
      
      if (!view || !view.setFacetContext) return;
      
      view.setFacetContext({
        selectedCharacterIds: state.selectedCharacterIds
      });
      
      if (viewName === 'tree' && this.viewInitialized.tree) {
        view._syncTreeHighlights?.();
      }
      if (viewName === 'list' && this.viewInitialized.list) {
        view._invalidateFilterCache?.();
        view._renderList?.();
      }
      if (viewName === 'knowledge' && this.viewInitialized.knowledge) {
        view._invalidateFilterCache?.();
        view._updateContent?.();
      }
      if (viewName === 'graph') {
        view.applyFacetSelection?.(state.selectedCharacterIds);
      }
    }, ['selectedCharacterIds']);
  }

  _switchView(viewName) {
    if (this.activeView === viewName) return;

    this._closeCard();
    this._closeDrawer();
    if (this.isFullscreen && viewName !== 'graph') {
      this._toggleFullscreen(false);
    }

    const previousView = this.activeView;

    this.activeView = viewName;

    this.els.viewPanels.forEach(panel => {
      panel.classList.remove('active');
    });

    const viewMap = {
      graph: this.els.viewGraph,
      tree: this.els.viewTree,
      list: this.els.viewList,
      knowledge: this.els.viewKnowledge
    };

    if (viewMap[viewName]) {
      viewMap[viewName].classList.add('active');
    }

    this.els.viewNav?.querySelectorAll('.view-nav-tab').forEach(tab => {
      const isActive = tab.dataset.view === viewName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // 更新body上的视图类名，用于CSS布局
    this.els.body.classList.remove('view-graph', 'view-tree', 'view-list', 'view-knowledge');
    this.els.body.classList.add(`view-${viewName}`);

    // Sidebar只在图谱视图显示，其他视图有自己的控制栏
    const sidebarEl = this.els.sidebar;
    if (sidebarEl) {
      sidebarEl.classList.toggle('hidden', viewName !== 'graph');
    }
    const sidebarBackdrop = this.els.sidebarBackdrop;
    if (sidebarBackdrop) {
      sidebarBackdrop.classList.toggle('hidden', viewName !== 'graph');
    }

    if (!this.viewInitialized[viewName]) {
      if (viewName === 'tree' && this.treeView) {
        this.treeView.render();
        this.viewInitialized.tree = true;
        this.viewEverRendered.tree = true;
      } else if (viewName === 'list' && this.listView) {
        this.listView.render();
        this.viewInitialized.list = true;
        this.viewEverRendered.list = true;
      } else if (viewName === 'knowledge' && this.knowledgeView) {
        this.knowledgeView.render();
        this.viewInitialized.knowledge = true;
        this.viewEverRendered.knowledge = true;
      }
    }

    this._teardownInactiveViews(viewName, previousView);
    this._applyFacetStateToViews();

    location.hash = viewName;
  }

  _forceCloseOverlays() {
    if (this.els.cardOverlay) this.els.cardOverlay.classList.remove('active');
    if (this.els.cardContent) this.els.cardContent.innerHTML = '';
    if (this.els.detailDrawer) {
      this.els.detailDrawer.classList.remove('active');
      this.els.detailDrawer.classList.add('desktop-hidden');
    }
  }

  _teardownInactiveViews(activeViewName, previousViewName) {
    return;
  }

  _buildSidebar() {
    const stats = this.graph.getStats();
    this._buildFamilyFilters(stats);
    this._buildRelationFilters(stats);
    this._updateGraphFilterSummary();
    this._buildStats(stats);
    this._renderFeaturedCharacters();
    this._renderTopics();
    this._renderFamilyBrowser(stats);
    this._renderSidebarSearchResults([], '搜索人物、关系、专题或阶段，结果会同时出现在这里。');
  }

  _renderComparisonTools() {
    const options = this.characters
      .filter((character) => character.importance >= 3)
      .sort((a, b) => (b.importance - a.importance) || a.name.localeCompare(b.name, 'zh-Hans-CN'))
      .map((character) => `<option value="${character.id}">${character.name}</option>`)
      .join('');

    this._setHtml(this.els.compareLeft, `<option value="">选择人物 A</option>${options}`);
    this._setHtml(this.els.compareRight, `<option value="">选择人物 B</option>${options}`);
    this.els.compareLeft.value = 'jia_baoyu';
    this.els.compareRight.value = 'lin_daiyu';
    this._updateActionStates();
  }

  _renderStageList() {
    this._setHtml(this.els.stageList, this.stages.map((stage) => `
      <button class="topic-card" data-stage-id="${stage.id}">
        <span class="topic-title">${stage.title}</span>
        <span class="topic-desc">${stage.description}</span>
        <span class="topic-tags">${stage.range}</span>
      </button>
    `).join(''));

    this.els.stageList.querySelectorAll('[data-stage-id]').forEach((btn) => {
      btn.addEventListener('click', () => this._openStage(btn.dataset.stageId));
    });
  }

  _buildFamilyFilters(stats) {
    const families = this._getFamilyFilterDefinitions();

    this._setHtml(this.els.familyFilters, families.map((family) => `
      <button type="button" class="family-filter-item active" data-family="${family.key}" aria-pressed="true" aria-label="切换家族筛选：${family.label}">
        <div class="custom-checkbox checked"></div>
        <div class="family-color-dot" style="background:${family.color}"></div>
        <span class="family-filter-label">${family.label}</span>
        <span class="family-filter-count">${stats.familyCounts[family.key] || 0}</span>
      </button>
    `).join(''));

    this.els.familyFilters.querySelectorAll('.family-filter-item').forEach((item) => {
      item.addEventListener('click', () => {
        const family = item.dataset.family;
        this.graph.toggleFamily(family);
        this._syncGraphFilterUi();
        this._refreshViewAfterFilterChange();
      });
    });

    this._syncGraphFilterUi();
  }

  _buildRelationFilters(stats) {
    const relations = this._getRelationFilterDefinitions();

    this._setHtml(this.els.relationFilters, relations.map((relation) => `
      <button type="button" class="relation-filter-item active" data-type="${relation.key}" aria-pressed="true" aria-label="切换关系类型筛选：${relation.label}">
        <div class="custom-checkbox checked"></div>
        <div class="relation-line-icon" style="background:${relation.color}"></div>
        <span class="relation-filter-label">${relation.label}</span>
        <span class="relation-filter-count">${stats.relationCounts[relation.key] || 0}</span>
      </button>
    `).join(''));

    this.els.relationFilters.querySelectorAll('.relation-filter-item').forEach((item) => {
      item.addEventListener('click', () => {
        const type = item.dataset.type;
        this.graph.toggleRelationType(type);
        this._syncGraphFilterUi();
        this._refreshViewAfterFilterChange();
      });
    });

    this._syncGraphFilterUi();
  }

  _getFamilyFilterDefinitions() {
    return [
      { key: '贾家', label: '贾家', color: '#C0392B' },
      { key: '史家', label: '史家', color: '#2980B9' },
      { key: '王家', label: '王家', color: '#27AE60' },
      { key: '薛家', label: '薛家', color: '#8E44AD' },
      { key: '林家', label: '林家', color: '#16A085' },
      { key: '其他', label: '其他人物', color: '#E67E22' }
    ];
  }

  _getRelationFilterDefinitions() {
    return [
      { key: 'blood', label: '血缘关系', color: '#4A90D9' },
      { key: 'marriage', label: '婚姻关系', color: '#E74C3C' },
      { key: 'master_servant', label: '主仆关系', color: '#95A5A6' },
      { key: 'romance', label: '情感关系', color: '#E91E8C' },
      { key: 'social', label: '社交关系', color: '#F39C12' },
      { key: 'rivalry', label: '敌对关系', color: '#8E44AD' }
    ];
  }

  _syncGraphFilterUi() {
    if (!this.graph) return;

    this.els.familyFilters?.querySelectorAll('.family-filter-item').forEach((item) => {
      const isActive = this.graph.activeFamilies.has(item.dataset.family);
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      item.querySelector('.custom-checkbox')?.classList.toggle('checked', isActive);
    });

    this.els.relationFilters?.querySelectorAll('.relation-filter-item').forEach((item) => {
      const isActive = this.graph.activeRelationTypes.has(item.dataset.type);
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      item.querySelector('.custom-checkbox')?.classList.toggle('checked', isActive);
    });

    this._updateGraphFilterSummary();
  }

  _updateGraphFilterSummary() {
    if (!this.graph || !this.els.graphFilterSummary) return;

    const allFamilies = this._getFamilyFilterDefinitions();
    const allRelations = this._getRelationFilterDefinitions();
    const activeFamilyCount = allFamilies.filter((family) => this.graph.activeFamilies.has(family.key)).length;
    const activeRelationCount = allRelations.filter((relation) => this.graph.activeRelationTypes.has(relation.key)).length;
    const hasCustomFilters = activeFamilyCount !== allFamilies.length || activeRelationCount !== allRelations.length;
    const familySummary = activeFamilyCount === allFamilies.length ? '家族：全部可见' : `家族：${activeFamilyCount}/${allFamilies.length}`;
    const relationSummary = activeRelationCount === allRelations.length ? '关系：全部可见' : `关系：${activeRelationCount}/${allRelations.length}`;

    this._setHtml(this.els.graphFilterSummary, `
      <div class="filter-summary-card${hasCustomFilters ? ' is-filtered' : ''}">
        <div class="filter-summary-main">
          <div class="filter-summary-title">当前图谱筛选</div>
          <div class="filter-summary-text">${familySummary} · ${relationSummary}</div>
          <div class="filter-summary-note">筛选只改变图谱显示，不会自动弹出人物卡片。</div>
        </div>
        ${hasCustomFilters ? '<button type="button" id="btn-reset-graph-filters" class="secondary-action filter-summary-reset">恢复全部</button>' : '<span class="filter-summary-state">当前是完整视图</span>'}
      </div>
    `);

    this.els.graphFilterSummary.querySelector('#btn-reset-graph-filters')?.addEventListener('click', () => {
      this.graph.resetAllFilters();
      this._syncGraphFilterUi();
      this._refreshViewAfterFilterChange();
    });
  }

  _buildStats(stats) {
    this._setHtml(this.els.statsSection, `
      <div class="stat-item"><span>人物总数</span><span class="stat-value">${stats.totalCharacters}</span></div>
      <div class="stat-item"><span>关系总数</span><span class="stat-value">${stats.totalRelationships}</span></div>
      <div class="stat-item"><span>核心人物</span><span class="stat-value">${this.characters.filter((character) => character.importance >= 4).length}</span></div>
      <div class="stat-item"><span>阅读阶段</span><span class="stat-value">${this.stages.length}</span></div>
    `);
  }

  _renderFeaturedCharacters() {
    this._setHtml(this.els.featuredCharacters, this.featuredCharacterIds
      .map((id) => this.characterMap.get(id))
      .filter(Boolean)
      .map((character) => `
        <button class="quick-card" data-character-id="${character.id}">
          <span class="quick-card-name">${character.name}</span>
          <span class="quick-card-meta">${character.identity}</span>
        </button>
      `)
      .join(''));

    this.els.featuredCharacters.querySelectorAll('[data-character-id]').forEach((btn) => {
      btn.addEventListener('click', () => this._openCharacter(btn.dataset.characterId, { focusNeighbors: true }));
    });
  }

  _renderTopics() {
    this._setHtml(this.els.topicList, this.topics.map((topic) => `
      <button class="topic-card" data-topic-id="${topic.id}">
        <span class="topic-title">${topic.title}</span>
        <span class="topic-desc">${topic.description}</span>
        <span class="topic-tags">${topic.tags.join(' · ')}</span>
      </button>
    `).join(''));

    this.els.topicList.querySelectorAll('[data-topic-id]').forEach((btn) => {
      btn.addEventListener('click', () => this._openTopic(btn.dataset.topicId));
    });
  }

  _renderFamilyBrowser(stats) {
    if (!this.els.familyBrowser) return;
    
    const orderedFamilies = ['贾家', '史家', '王家', '薛家', '林家', '其他'];
    this._setHtml(this.els.familyBrowser, orderedFamilies.map((family) => `
      <button class="family-browser-item" data-family="${family}">
        <span>${family}</span>
        <strong>${stats.familyCounts[family] || 0}</strong>
      </button>
    `).join(''));

    this.els.familyBrowser.querySelectorAll('[data-family]').forEach((btn) => {
      btn.addEventListener('click', () => this._openFamily(btn.dataset.family));
    });
  }

  _setReadingGraphState() {
    this.graph.setInteractionMode('reading');
    this.graph.setDefaultReadingFilter();
  }

  _initSidebarResize() {
    const savedWidth = Number(localStorage.getItem('hlm-sidebar-width'));
    if (Number.isFinite(savedWidth)) {
      this._applySidebarWidth(savedWidth);
    }
  }

  _applySidebarWidth(width) {
    const clampedWidth = Math.min(480, Math.max(260, Math.round(width)));
    document.documentElement.style.setProperty('--sidebar-width', `${clampedWidth}px`);
    return clampedWidth;
  }

  _bindSidebarResize() {
    const handle = this.els.sidebarResizeHandle;
    if (!handle) return;

    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    const onPointerMove = (event) => {
      if (!isDragging) return;
      const nextWidth = startWidth + (event.clientX - startX);
      this._applySidebarWidth(nextWidth);
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      document.body.classList.remove('sidebar-resizing');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      const currentWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width'), 10) || 304;
      localStorage.setItem('hlm-sidebar-width', String(currentWidth));
      window.dispatchEvent(new Event('resize'));
    };

    handle.addEventListener('pointerdown', (event) => {
      if (window.innerWidth <= 1024 || this.activeView !== 'graph') return;

      isDragging = true;
      startX = event.clientX;
      startWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width'), 10) || 304;
      document.body.classList.add('sidebar-resizing');

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      event.preventDefault();
    });
  }

  _showOverview() {
    this.currentCharacterId = null;
    this.currentTopic = null;
    this.currentStage = null;
    this.currentRelationshipPair = null;
    this.currentFamily = null;
    this.currentView = { type: 'overview' };
    this._setReadingGraphState();
    this.graph.exitFocusMode();
    this.graph.showImportantOverview();
    this._renderOverviewDrawer();
    this._updateFloatingContext('默认概览');
    this._setFacetState({
      selectedCharacterIds: [],
      selectedTags: [],
      selectedFamily: null,
      selectedChapter: null,
      selectedCategory: null,
      query: '',
      breadcrumb: [{ label: '默认概览', type: 'overview' }],
      sourceView: 'graph'
    });
    this._updateActionStates();
    this._updateBackButton();
  }
  
  _initFontAndThemeControls() {
    const savedFont = localStorage.getItem('hlm-font-family') || 'serif';
    const savedTheme = localStorage.getItem('hlm-theme') || 'red-gold';
    
    this._setFont(savedFont);
    this._setTheme(savedTheme);
    
    this._createFontAndThemeControls();
  }
  
  _resetSearchFilters(event) {
    if (this.activeView === 'knowledge' && this.knowledgeView) {
      this.knowledgeView.searchQuery = '';
      this.knowledgeView.activeCategory = 'all';
      this.knowledgeView.activeSubcategory = 'all';
      this.knowledgeView.chapterFilter = 'all';
      this.knowledgeView.sortBy = 'relevance';
    }
    const searchInput = this.els.graphSearchInput || this.els.searchInput;
    if (searchInput) {
      const searchValue = searchInput.value.trim();
      if (searchValue) {
        this._onSearch(searchValue, this.els.graphSearchResults || this.els.searchResults);
      }
    }
  }
  
  _setFont(fontFamily) {
    document.body.classList.remove('font-serif-sc', 'font-sans-sc', 'font-title', 'font-traditional');
    
    switch(fontFamily) {
      case 'serif':
        document.body.classList.add('font-serif-sc');
        break;
      case 'sans':
        document.body.classList.add('font-sans-sc');
        break;
      case 'title':
        document.body.classList.add('font-title');
        break;
      case 'traditional':
        document.body.classList.add('font-traditional');
        break;
    }
    
    localStorage.setItem('hlm-font-family', fontFamily);
  }
  
  _setTheme(themeName) {
    document.body.classList.remove('theme-red-gold', 'theme-blue-green', 'theme-ink-wash', 'theme-purple-gold');
    
    switch(themeName) {
      case 'red-gold':
        document.body.classList.add('theme-red-gold');
        break;
      case 'blue-green':
        document.body.classList.add('theme-blue-green');
        break;
      case 'ink-wash':
        document.body.classList.add('theme-ink-wash');
        break;
      case 'purple-gold':
        document.body.classList.add('theme-purple-gold');
        break;
    }
    
    localStorage.setItem('hlm-theme', themeName);
  }
  
_createFontAndThemeControls() {
    const savedFont = localStorage.getItem('hlm-font-family') || 'serif';
    const savedTheme = localStorage.getItem('hlm-theme') || 'red-gold';
    
    this._setFont(savedFont);
    this._setTheme(savedTheme);
    
    this._createHeaderSettingsPanel();
  }
  
  _createHeaderSettingsPanel() {
    const headerRight = document.getElementById('header-right');
    if (!headerRight) return;

    const savedFont = localStorage.getItem('hlm-font-family') || 'serif';
    const savedTheme = localStorage.getItem('hlm-theme') || 'red-gold';

    // Settings button
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'header-settings-btn';
    settingsBtn.innerHTML = '⚙';
    settingsBtn.title = '主题与字体';
    settingsBtn.setAttribute('aria-label', '设置主题与字体');

    // Dropdown container (positioned relative to header-right)
    headerRight.style.position = 'relative';
    const dropdown = document.createElement('div');
    dropdown.className = 'settings-dropdown';

    // Theme section
    const themeSection = document.createElement('div');
    themeSection.className = 'settings-section';
    const themeTitle = document.createElement('div');
    themeTitle.className = 'settings-section-title';
    themeTitle.textContent = '主题';
    const themeGrid = document.createElement('div');
    themeGrid.className = 'settings-theme-grid';

    const themes = [
      { name: 'red-gold', tooltip: '红金', colors: ['#8B2500', '#D4A017'] },
      { name: 'blue-green', tooltip: '青绿', colors: ['#006666', '#2E8B57'] },
      { name: 'ink-wash', tooltip: '水墨', colors: ['#555', '#8B7355'] },
      { name: 'purple-gold', tooltip: '紫金', colors: ['#663399', '#FFD700'] }
    ];

    themes.forEach(theme => {
      const opt = document.createElement('div');
      opt.className = 'settings-theme-option';
      opt.dataset.theme = theme.name;
      opt.title = theme.tooltip;
      opt.style.background = `linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[1]})`;
      if (theme.name === savedTheme) opt.classList.add('active');

      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        this._setTheme(theme.name);
        themeGrid.querySelectorAll('.settings-theme-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
      themeGrid.appendChild(opt);
    });

    themeSection.appendChild(themeTitle);
    themeSection.appendChild(themeGrid);

    // Font section
    const fontSection = document.createElement('div');
    fontSection.className = 'settings-section';
    const fontTitle = document.createElement('div');
    fontTitle.className = 'settings-section-title';
    fontTitle.textContent = '字体';
    const fontList = document.createElement('div');
    fontList.className = 'settings-font-list';

    const fonts = [
      { name: 'serif', label: '宋体 / 衬线', preview: '宋' },
      { name: 'sans', label: '黑体 / 无衬线', preview: '黑' },
      { name: 'title', label: '书法体', preview: '书' },
      { name: 'traditional', label: '繁体宋', preview: '繁' }
    ];

    fonts.forEach(font => {
      const opt = document.createElement('button');
      opt.className = 'settings-font-option';
      if (font.name === savedFont) opt.classList.add('active');
      opt.innerHTML = `<span class="font-preview">${font.preview}</span><span class="font-label">${font.label}</span><span class="font-check">✓</span>`;
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        this._setFont(font.name);
        fontList.querySelectorAll('.settings-font-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
      fontList.appendChild(opt);
    });

    fontSection.appendChild(fontTitle);
    fontSection.appendChild(fontList);

    dropdown.appendChild(themeSection);
    dropdown.appendChild(fontSection);

    // Toggle
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.toggle('active');
      settingsBtn.classList.toggle('is-open', isOpen);
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== settingsBtn) {
        dropdown.classList.remove('active');
        settingsBtn.classList.remove('is-open');
      }
    });

    headerRight.appendChild(settingsBtn);
    headerRight.appendChild(dropdown);
  }

  _showFullGraph(skipHistory) {
    if (!skipHistory) this._pushView();
    this.currentCharacterId = null;
    this.currentTopic = null;
    this.currentStage = null;
    this.currentRelationshipPair = null;
    this.currentFamily = null;
    this.currentView = { type: 'fullgraph' };
    this.graph.exitFocusMode();
    this.graph.setInteractionMode('explore');
    this.graph.showFullGraph();
    this._renderFullGraphDrawer();
    this._updateFloatingContext('全图浏览');
    this._setFacetState({
      selectedCharacterIds: [],
      selectedTags: [],
      breadcrumb: [{ label: '默认概览', type: 'overview' }, { label: '全图浏览', type: 'graph' }],
      sourceView: 'graph'
    });
    this._updateActionStates();
    this._updateBackButton();
  }

  _handleNodeClick(character) {
    this._openCharacter(character.id, { focusNeighbors: this.currentView.type !== 'fullgraph', showCard: true });
  }

  _handleGraphBackgroundClick() {
    if (this.currentView.type === 'overview' || this.currentView.type === 'fullgraph') {
      this._closeDrawer();
    }
    this.currentCharacterId = null;
    this._updateActionStates();
  }

  _openCharacter(characterId, options = {}) {
    const character = this.characterMap.get(characterId);
    if (!character) return;

    if (!options._fromRestore) this._pushView();
    this.currentCharacterId = characterId;
    this.currentTopic = null;
    this.currentStage = null;
    this.currentFamily = null;
    if (!options.keepRelationship) this.currentRelationshipPair = null;
    this.currentView = { type: 'character', characterId };

    const isGraphView = this.activeView === 'graph';
    if (isGraphView) {
      if (this.currentView.type !== 'fullgraph') this._setReadingGraphState();
      if (options.focusNeighbors) this.graph.showNeighborhood(characterId, { center: true, includeSecondDegree: false });
      else this.graph.focusOnNode(characterId);
    }

    if (options.showCard !== false && !options._fromRestore) {
      this._showCard(character);
    }
    if (this.listView) {
      this.listView.relatedCharacterIds = new Set([characterId]);
    }
    if (this.treeView) {
      this.treeView.relatedCharacterIds = new Set([characterId]);
    }
    if (this.knowledgeView) {
      this.knowledgeView.relatedCharacterIds = new Set([characterId]);
    }
    this._setFacetState({
      selectedCharacterIds: [characterId],
      selectedFamily: character.family || null,
      breadcrumb: [{ label: '默认概览', type: 'overview' }, { label: character.name, type: 'character', characterId }],
      sourceView: this.activeView
    });
    this._updateActionStates();
    this._updateBackButton();
    if (isGraphView) this._toggleSidebar(false);
  }

  _openCharacterKnowledge(character) {
    if (!character || !this.knowledgeView) return;
    this._switchView('knowledge');
    if (!this.viewInitialized.knowledge) {
      this.knowledgeView.render();
      this.viewInitialized.knowledge = true;
      this.viewEverRendered.knowledge = true;
    }
    
    this.knowledgeView.activeCategory = 'all';
    this.knowledgeView.activeSubcategory = 'all';
    this.knowledgeView.chapterFilter = 'all';
    this.knowledgeView.sortBy = 'relevance';
    this.knowledgeView.searchQuery = character.name;
    this.knowledgeView.relatedCharacterIds = new Set([character.id]);
    this.knowledgeView.expandedIds.clear();
    this.knowledgeView.displayCount = 40;
    
    const input = this.els.knowledgeContainer?.querySelector('.knowledge-search-input');
    if (input) input.value = character.name;
    
    this.knowledgeView._invalidateFilterCache?.();
    this.knowledgeView._updateContent();
    this.knowledgeView._scrollToTop();
    
    const main = this.els.knowledgeContainer?.querySelector('.knowledge-main');
    if (main) main.scrollTo({ top: 0, behavior: 'instant' });
    
    this._updateFloatingContext(`知识：${character.name}`);
  }

  _openTopic(topicId, skipHistory) {
    const topic = this.topics.find((item) => item.id === topicId);
    if (!topic) return;

    if (!skipHistory) this._pushView();
    this.currentTopic = topic;
    this.currentStage = null;
    this.currentFamily = null;
    this.currentRelationshipPair = null;
    this.currentCharacterId = topic.focusId;
    this.currentView = { type: 'topic', topicId };

    this._setReadingGraphState();
    this.graph.showCharacterSet(topic.characterIds, { centerId: topic.focusId });
    this._renderTopicDrawer(topic);
    this._updateFloatingContext(`专题：${topic.title}`);
    this._setFacetState({
      selectedCharacterIds: topic.characterIds,
      selectedTags: topic.tags || [],
      breadcrumb: [{ label: '默认概览', type: 'overview' }, { label: topic.title, type: 'topic', topicId }],
      sourceView: 'graph'
    });
    this._updateActionStates();
    this._updateBackButton();
    this._toggleSidebar(false);
  }

  _openStage(stageId, skipHistory) {
    const stage = this.stages.find((item) => item.id === stageId);
    if (!stage) return;

    if (!skipHistory) this._pushView();
    this.currentStage = stage;
    this.currentTopic = null;
    this.currentFamily = null;
    this.currentRelationshipPair = null;
    this.currentCharacterId = stage.focusId;
    this.currentView = { type: 'stage', stageId };

    this._setReadingGraphState();
    this.graph.showCharacterSet(stage.characterIds, { centerId: stage.focusId });
    this._renderStageDrawer(stage);
    this._updateFloatingContext(`阶段：${stage.title}`);
    this._setFacetState({
      selectedCharacterIds: stage.characterIds,
      selectedChapter: stage.range,
      breadcrumb: [{ label: '默认概览', type: 'overview' }, { label: stage.title, type: 'stage', stageId }],
      sourceView: 'graph'
    });
    this._updateActionStates();
    this._updateBackButton();
    this._toggleSidebar(false);
  }

  _openFamily(family, skipHistory) {
    const familyCharacters = this.characters
      .filter((character) => this.graph._getFamilyGroup(character) === family)
      .sort((a, b) => (b.importance - a.importance));

    if (!familyCharacters.length) return;

    if (!skipHistory) this._pushView();
    const topIds = familyCharacters.slice(0, 12).map((character) => character.id);
    this.currentFamily = family;
    this.currentCharacterId = familyCharacters[0].id;
    this.currentTopic = null;
    this.currentStage = null;
    this.currentRelationshipPair = null;
    this.currentView = { type: 'family', family };

    this._setReadingGraphState();
    this.graph.showCharacterSet(topIds, { centerId: familyCharacters[0].id });
    this._renderFamilyDrawer(family, familyCharacters);
    this._updateFloatingContext(`家族：${family}`);
    this._setFacetState({
      selectedCharacterIds: topIds,
      selectedFamily: family,
      breadcrumb: [{ label: '默认概览', type: 'overview' }, { label: family, type: 'family', family }],
      sourceView: 'graph'
    });
    this._updateActionStates();
    this._updateBackButton();
    this._toggleSidebar(false);
  }

  _openRelationshipView(leftId, rightId, skipHistory) {
    if (!leftId || !rightId || leftId === rightId) {
      this._updateActionStates();
      return;
    }

    const left = this.characterMap.get(leftId);
    const right = this.characterMap.get(rightId);
    if (!left || !right) return;

    if (!skipHistory) this._pushView();
    this.currentRelationshipPair = { leftId, rightId };
    this.currentCharacterId = leftId;
    this.currentTopic = null;
    this.currentStage = null;
    this.currentFamily = null;
    this.currentView = { type: 'relationship', leftId, rightId };

    this._setReadingGraphState();
    this.els.compareLeft.value = leftId;
    this.els.compareRight.value = rightId;

    const networkIds = this._getPairNetworkIds(leftId, rightId);
    this.graph.showCharacterSet(networkIds, { centerId: leftId });
    this.graph.selectNodes([leftId, rightId]);
    this._renderRelationshipDrawer(left, right);
    this._updateFloatingContext(`关系：${left.name} × ${right.name}`);
    this._setFacetState({
      selectedCharacterIds: networkIds,
      selectedTags: [`${left.name} × ${right.name}`],
      breadcrumb: [{ label: '默认概览', type: 'overview' }, { label: `${left.name} × ${right.name}`, type: 'relationship', leftId, rightId }],
      sourceView: 'graph'
    });
    this._updateActionStates();
    this._updateBackButton();
    this._toggleSidebar(false);
  }

  _enterFocusMode(character) {
    this.graph.enterFocusMode(character.id);
    this.els.modeIndicator.classList.add('active');
    this.els.modeName.textContent = `聚焦：${character.name}`;
    this._updateActionStates();
  }

  _exitFocusMode() {
    if (!this.graph || !this.graph.focusMode) return;
    this.graph.exitFocusMode();
    this.els.modeIndicator.classList.remove('active');
    this._restoreCurrentView();
    this._updateActionStates();
  }

  _restoreCurrentView(fromFilterChange = false) {
    switch (this.currentView.type) {
      case 'character':
        // 如果是从筛选变更触发的恢复，不重新打开人物卡片
        if (!fromFilterChange) {
          this._openCharacter(this.currentView.characterId, { focusNeighbors: true, keepRelationship: true, _fromRestore: true });
        }
        break;
      case 'topic':
        this._openTopic(this.currentView.topicId, true);
        break;
      case 'stage':
        this._openStage(this.currentView.stageId, true);
        break;
      case 'relationship':
        this._openRelationshipView(this.currentView.leftId, this.currentView.rightId, true);
        break;
      case 'family':
        this._openFamily(this.currentView.family, true);
        break;
      case 'fullgraph':
        this._showFullGraph(true);
        break;
      default:
        this._showOverview();
        break;
    }
  }

  _refreshViewAfterFilterChange() {
    this._closeCard();
    this._syncGraphFilterUi();

    if (this.graph && this.graph.focusMode && this.graph.focusNodeId) {
      this.graph.enterFocusMode(this.graph.focusNodeId);
      return;
    }

    switch (this.currentView.type) {
      case 'character':
        if (this.currentCharacterId) {
          this.graph.showNeighborhood(this.currentCharacterId, { center: true, includeSecondDegree: false });
        }
        break;
      case 'topic':
        if (this.currentTopic) {
          this.graph.showCharacterSet(this.currentTopic.characterIds, { centerId: this.currentTopic.focusId });
        }
        break;
      case 'stage':
        if (this.currentStage) {
          this.graph.showCharacterSet(this.currentStage.characterIds, { centerId: this.currentStage.focusId });
        }
        break;
      case 'family': {
        if (this.currentFamily) {
          const familyCharacters = this.characters
            .filter((character) => this.graph._getFamilyGroup(character) === this.currentFamily)
            .sort((a, b) => b.importance - a.importance)
            .slice(0, 12)
            .map((character) => character.id);
          if (familyCharacters.length) {
            this.graph.showCharacterSet(familyCharacters, { centerId: familyCharacters[0] });
          }
        }
        break;
      }
      case 'relationship':
        if (this.currentRelationshipPair) {
          const { leftId, rightId } = this.currentRelationshipPair;
          const networkIds = this._getPairNetworkIds(leftId, rightId);
          this.graph.showCharacterSet(networkIds, { centerId: leftId });
          this.graph.selectNodes([leftId, rightId]);
        }
        break;
      case 'fullgraph':
        this.graph.showFullGraph();
        break;
      default:
        this.graph.showImportantOverview();
        break;
    }

    this._updateActionStates();
  }

  _onSearch(query, resultsEl) {
    const activeResultsEl = resultsEl || this.els.searchResults;
    const clean = query.trim();
    if (!clean) {
      activeResultsEl.classList.remove('active');
      activeResultsEl.innerHTML = '';
      this.graph.highlightSearch('');
      this._renderSidebarSearchResults([], '搜索人物、关系、专题或阶段，结果会同时出现在这里。');
      return;
    }

    const relationshipQuery = this._parseRelationshipQuery(clean);
    const matchedCharacters = this._searchCharacters(clean).slice(0, 8);
    const matchedTopics = this.topics.filter((topic) => {
      const haystack = [topic.title, topic.description, ...(topic.tags || [])].join(' ').toLowerCase();
      return haystack.includes(clean.toLowerCase());
    }).slice(0, 4);
    const matchedStages = this.stages.filter((stage) => {
      const haystack = [stage.title, stage.description, stage.range, ...(stage.questions || [])].join(' ').toLowerCase();
      return haystack.includes(clean.toLowerCase());
    }).slice(0, 3);

    this.graph.highlightSearch(clean);

    const resultGroups = [];
    if (relationshipQuery) {
      resultGroups.push({
        title: '关系问题',
        items: [{
          type: 'relationship',
          leftId: relationshipQuery.leftId,
          rightId: relationshipQuery.rightId,
          name: `${relationshipQuery.left.name} ↔ ${relationshipQuery.right.name}`,
          info: '直接查看两人之间的关系、共同关联人物与小型关系网'
        }]
      });
    }
    if (matchedCharacters.length) {
      resultGroups.push({
        title: '人物',
        items: matchedCharacters.map((character) => ({
          type: 'character',
          id: character.id,
          name: character.name,
          info: `${character.family} · ${character.identity}`
        }))
      });
    }
    if (matchedTopics.length) {
      resultGroups.push({
        title: '专题',
        items: matchedTopics.map((topic) => ({
          type: 'topic',
          id: topic.id,
          name: topic.title,
          info: topic.description
        }))
      });
    }
    if (matchedStages.length) {
      resultGroups.push({
        title: '阅读阶段',
        items: matchedStages.map((stage) => ({
          type: 'stage',
          id: stage.id,
          name: stage.title,
          info: `${stage.range} · ${stage.description}`
        }))
      });
    }

    this._renderSearchResultsDropdown(resultGroups, activeResultsEl);
this._renderSidebarSearchResults(resultGroups, '未找到匹配内容，可以试试"宝玉和黛玉""前二十回"。');
  }

  _renderSearchResultsDropdown(groups, targetEl) {
    const resultsEl = targetEl || this.els.searchResults;
    if (!groups.length) {
      this._setHtml(resultsEl, '<div class="search-result-item"><span class="search-result-info">未找到匹配的人物、关系或专题。</span></div>');
      resultsEl.classList.add('active');
      return;
    }

    this._setHtml(resultsEl, groups.map((group) => `
      <div class="search-group-title">${group.title}</div>
      ${group.items.map((item) => this._searchResultItemTemplate(item)).join('')}
    `).join(''));

    resultsEl.classList.add('active');
    this._bindSearchResultClicks(resultsEl);
  }

  _renderSidebarSearchResults(groups, emptyMessage) {
    if (!groups.length) {
      this._setHtml(this.els.sidebarSearchResults, `<div class="drawer-empty sidebar-search-empty">${emptyMessage}</div>`);
      return;
    }

    const topItems = groups.flatMap((group) => group.items).slice(0, 6);
    this._setHtml(this.els.sidebarSearchResults, topItems.map((item) => `
      <button class="quick-card sidebar-search-card" ${this._searchDatasetAttrs(item)}>
        <span class="quick-card-name">${item.name}</span>
        <span class="quick-card-meta">${item.info}</span>
      </button>
    `).join(''));

    this._bindSearchResultClicks(this.els.sidebarSearchResults);
  }

  _searchResultItemTemplate(item) {
    return `
      <div class="search-result-item" ${this._searchDatasetAttrs(item)}>
        <span class="search-result-name">${item.name}</span>
        <span class="search-result-info">${item.info}</span>
      </div>
    `;
  }

  _searchDatasetAttrs(item) {
    if (item.type === 'relationship') {
      return `data-type="relationship" data-left="${item.leftId}" data-right="${item.rightId}"`;
    }
    return `data-type="${item.type}" data-id="${item.id}"`;
  }

  _bindSearchResultClicks(container) {
    container.querySelectorAll('[data-type]').forEach((item) => {
      item.addEventListener('click', () => {
        const type = item.dataset.type;
        if (type === 'character') this._openCharacter(item.dataset.id, { focusNeighbors: true });
        if (type === 'topic') this._openTopic(item.dataset.id);
        if (type === 'stage') this._openStage(item.dataset.id);
        if (type === 'relationship') this._openRelationshipView(item.dataset.left, item.dataset.right);
        if (this.els.graphSearchInput) this.els.graphSearchInput.value = '';
        if (this.els.searchInput) this.els.searchInput.value = '';
        this.els.graphSearchResults?.classList.remove('active');
        this.els.searchResults?.classList.remove('active');
        this._closeMobileSearch();
      });
    });
  }

  _searchCharacters(query) {
    const lower = query.toLowerCase();
    return this.characters
      .map((character) => {
        const aliases = (character.alias || []).map((alias) => alias.toLowerCase());
        const nameLower = character.name.toLowerCase();
        const identityLower = (character.identity || '').toLowerCase();
        const familyLower = (character.family || '').toLowerCase();
        const eventsLower = (character.keyEvents || []).join(' ').toLowerCase();
        const searchStr = [nameLower, ...aliases, identityLower, familyLower, eventsLower].join(' ');

        if (!searchStr.includes(lower)) return null;

        let score = 0;
        if (nameLower === lower) score += 120;
        else if (aliases.includes(lower)) score += 105;
        else if (nameLower.startsWith(lower)) score += 88;
        else if (aliases.some((alias) => alias.startsWith(lower))) score += 76;
        else if (nameLower.includes(lower)) score += 60;
        else if (aliases.some((alias) => alias.includes(lower))) score += 52;
        else if (identityLower.includes(lower)) score += 26;
        else if (eventsLower.includes(lower)) score += 18;
        else if (familyLower.includes(lower)) score += 10;

        score += character.importance || 0;

        return { character, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || (b.character.importance || 0) - (a.character.importance || 0))
      .map((item) => item.character);
  }

  _findCharacterByLooseName(name) {
    const clean = name.replace(/[？?。！!，,、\n]/g, '').trim();
    if (!clean) return null;
    const directId = this.aliasMap.get(clean);
    if (directId) return this.characterMap.get(directId);

    return this.characters.find((character) => {
      const haystack = [character.name, ...(character.alias || [])].join(' ');
      return haystack.includes(clean) || clean.includes(character.name);
    }) || null;
  }

  _parseRelationshipQuery(query) {
    const normalized = query.replace(/和|与|跟|跟着|及|vs|VS/g, ' 和 ');
    const parts = normalized.split(' 和 ').map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) return null;

    const left = this._findCharacterByLooseName(parts[0]);
    const right = this._findCharacterByLooseName(parts[1]);
    if (!left || !right || left.id === right.id) return null;
    return { leftId: left.id, rightId: right.id, left, right };
  }

  _toggleSidebar(forceState) {
    const shouldOpen = forceState === undefined ? !this.els.sidebar.classList.contains('open') : forceState;
    this.els.sidebar.classList.toggle('open', shouldOpen);
    this.els.sidebarBackdrop.classList.toggle('active', shouldOpen);
  }

  _toggleFullscreen(forceState) {
    const nextState = forceState === undefined ? !this.isFullscreen : forceState;
    this.isFullscreen = nextState;
    this.els.body.classList.toggle('fullscreen', nextState);
    this.els.graphContainer.classList.toggle('is-fullscreen', nextState);
    if (this.els.btnHeaderFullscreen) this.els.btnHeaderFullscreen.classList.toggle('is-active', nextState);
    this.els.btnGraphFullscreen.classList.toggle('hidden', nextState);
    this.els.btnExitFullscreen.classList.toggle('hidden', !nextState);
    this.els.graphFloatingBar.classList.toggle('active', nextState);
    this._toggleSidebar(false);
    window.setTimeout(() => window.dispatchEvent(new Event('resize')), 20);
  }

  _updateFloatingContext(label) {
    this.els.fullscreenViewLabel.textContent = label;
    this._renderGlobalContextBar();
  }

  _buildRelationshipSummary(characterId) {
    const labelMap = {
      blood: '血缘', marriage: '婚姻', master_servant: '主仆', romance: '情感', social: '社交', rivalry: '敌对'
    };

    return this.graph.getCharacterRelations(characterId)
      .sort((a, b) => (b.character.importance || 0) - (a.character.importance || 0))
      .slice(0, 5)
      .map((rel) => ({
        ...rel,
        categoryLabel: labelMap[rel.type] || rel.type,
        summary: rel.description || `${rel.character.name} 与当前人物之间的关系为 ${rel.label}`
      }));
  }

  _buildCharacterRecommendations(characterId) {
    return this.graph.getCharacterRelations(characterId)
      .sort((a, b) => (b.character.importance || 0) - (a.character.importance || 0))
      .slice(0, 4)
      .map((rel) => rel.character);
  }

  _getDirectRelation(leftId, rightId) {
    return this.relationships.filter((rel) => {
      const sourceId = typeof rel.source === 'string' ? rel.source : rel.source.id;
      const targetId = typeof rel.target === 'string' ? rel.target : rel.target.id;
      return (sourceId === leftId && targetId === rightId) || (sourceId === rightId && targetId === leftId);
    });
  }

  _getMutualConnections(leftId, rightId) {
    const leftConnections = new Set(this.graph.getCharacterRelations(leftId).map((rel) => rel.character.id));
    const rightConnections = new Set(this.graph.getCharacterRelations(rightId).map((rel) => rel.character.id));
    return [...leftConnections]
      .filter((id) => rightConnections.has(id) && id !== leftId && id !== rightId)
      .map((id) => this.characterMap.get(id))
      .filter(Boolean)
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, 5);
  }

  _getPairNetworkIds(leftId, rightId) {
    const connected = new Set([leftId, rightId]);
    this.graph.getCharacterRelations(leftId).slice(0, 4).forEach((rel) => connected.add(rel.character.id));
    this.graph.getCharacterRelations(rightId).slice(0, 4).forEach((rel) => connected.add(rel.character.id));
    return [...connected];
  }

  _buildPairSummary(left, right) {
    const directRelations = this._getDirectRelation(left.id, right.id);
    if (directRelations.length) {
      return directRelations.map((rel) => `${left.name}与${right.name}之间存在${rel.label}（${rel.description || '关系直接明确'}）。`).join(' ');
    }

    const mutualConnections = this._getMutualConnections(left.id, right.id);
    if (mutualConnections.length) {
      return `${left.name}与${right.name}没有直接连线，但都与${mutualConnections.map((character) => character.name).slice(0, 2).join('、')}等人物有重要联系。`;
    }

    return `${left.name}与${right.name}在现有关系数据中没有直接关系记录，更适合从家族与章节背景理解他们的联系。`;
  }

  _openDrawer(html) {
    this._setHtml(this.els.drawerContent, html);
    this.els.detailDrawer.classList.add('active');
    this.els.detailDrawer.classList.remove('desktop-hidden');
  }

  _closeDrawer() {
    this.els.detailDrawer.classList.remove('active');
    // On desktop (>1024px) the drawer is in the grid, so also hide it
    this.els.detailDrawer.classList.add('desktop-hidden');
  }

  // View history management
  _pushView() {
    if (this.currentView && this.currentView.type !== 'overview') {
      this.viewHistory.push({ ...this.currentView });
      if (this.viewHistory.length > 20) this.viewHistory.shift();
    }
  }

  _goBack() {
    if (!this.viewHistory.length) {
      this._showOverview();
      return;
    }

    const prev = this.viewHistory.pop();
    this._navigateToView(prev);
    this._updateBackButton();
  }

  _navigateToView(view) {
    if (view.type === 'character') {
      this._openCharacter(view.characterId, { focusNeighbors: true, _fromRestore: true });
    } else if (view.type === 'topic') {
      this._openTopic(view.topicId, true);
    } else if (view.type === 'stage') {
      this._openStage(view.stageId, true);
    } else if (view.type === 'family') {
      this._openFamily(view.family, true);
    } else if (view.type === 'relationship') {
      this._openRelationshipView(view.leftId, view.rightId, true);
    } else if (view.type === 'fullgraph') {
      this._showFullGraph(true);
    } else {
      this._showOverview();
    }
  }

  _updateBackButton() {
    if (this.els.btnBack) {
      const show = this.viewHistory.length > 0 || this.currentView.type !== 'overview';
      this.els.btnBack.classList.toggle('hidden', !show);
    }
  }

  // Mobile search
  _openMobileSearch() {
    this.isMobileSearchOpen = true;
    if (this.els.mobileSearchOverlay) {
      this.els.mobileSearchOverlay.classList.add('active');
      this.els.mobileSearchInput.value = '';
      this.els.mobileSearchInput.focus();
    }
  }

  _closeMobileSearch() {
    this.isMobileSearchOpen = false;
    if (this.els.mobileSearchOverlay) {
      this.els.mobileSearchOverlay.classList.remove('active');
      this.els.mobileSearchInput.value = '';
      if (this.els.mobileSearchResults) this.els.mobileSearchResults.classList.remove('active');
    }
  }

  _renderOverviewDrawer() {
    this._openDrawer(`
      <div class="drawer-section drawer-hero-panel">
        <div class="drawer-eyebrow">默认视图</div>
        <h2 class="drawer-title">先看核心人物，再按线索展开</h2>
        <p class="drawer-description">默认只显示重要度较高的人物，适合初次打开时建立整体印象。搜索、点击人物、专题或阶段后，图谱会自动切换到更聚焦的关系范围。</p>
      </div>
      <div class="drawer-section">
        <div class="drawer-section-title">推荐起点</div>
        <div class="recommend-list">
          ${this.featuredCharacterIds.slice(0, 4).map((id) => this.characterMap.get(id)).filter(Boolean).map((character) => `<button class="recommend-pill" data-character-id="${character.id}">${character.name}</button>`).join('')}
        </div>
      </div>
      <div class="drawer-section">
        <div class="drawer-section-title">专题入口</div>
        <div class="summary-relations">
          ${this.topics.slice(0, 3).map((topic) => `<button class="summary-relation-item" data-topic-id="${topic.id}"><span class="summary-relation-head"><strong>${topic.title}</strong><em>${topic.tags.join(' · ')}</em></span><span class="summary-relation-desc">${topic.description}</span></button>`).join('')}
        </div>
      </div>
    `);
  }

  _renderFullGraphDrawer() {
    this._openDrawer(`
      <div class="drawer-section drawer-hero-panel">
        <div class="drawer-eyebrow">全图模式</div>
        <h2 class="drawer-title">当前显示完整人物关系网</h2>
        <p class="drawer-description">左侧的家族筛选、关系类型筛选会实时作用于全图。适合系统梳理结构，也适合放大后沿着局部关系慢慢阅读。</p>
      </div>
      <div class="drawer-section">
        <div class="drawer-section-title">接下来可以这样用</div>
        <div class="tips-list">
          <div class="tip-item">点击节点：普通视图打开右侧抽屉，大图模式直接打开完整人物卡。</div>
          <div class="tip-item">双击节点：进入扩展邻域聚焦，适合深挖某个人物的二度关系。</div>
          <div class="tip-item">切换筛选：家族与关系类型始终可用，不再依赖模式切换。</div>
        </div>
      </div>
    `);
  }

  _renderCharacterDrawer(character) {
    const summary = this._buildRelationshipSummary(character.id);
    const recommendations = this._buildCharacterRecommendations(character.id);

    this._openDrawer(`
      <div class="drawer-section drawer-hero-panel">
        <div class="drawer-eyebrow">人物详情</div>
        <h2 class="drawer-title">${character.name}</h2>
        <div class="summary-topline">
          <span class="summary-badge">${character.family}</span>
          <span class="summary-badge subtle">${character.identity}</span>
          <span class="summary-badge subtle">重要度 ${character.importance}/5</span>
        </div>
        <p class="drawer-description">${character.description || character.identity}</p>
      </div>
      <div class="drawer-section">
        <div class="drawer-section-title">最值得先看的关系</div>
        <div class="summary-relations">
          ${summary.map((item) => `
            <button class="summary-relation-item" data-character-id="${item.character.id}">
              <span class="summary-relation-head">
                <strong>${item.character.name}</strong>
                <em>${item.categoryLabel} · ${item.label}</em>
              </span>
              <span class="summary-relation-desc">${item.summary}</span>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="drawer-section drawer-actions-row">
        <button class="primary-action" data-open-card-id="${character.id}">查看完整卡片</button>
        <button class="secondary-action" data-compare-character-id="${character.id}">用此人物发起对比</button>
      </div>
      <div class="drawer-section">
        <div class="drawer-section-title">继续延伸</div>
        <div class="recommend-list">
          ${recommendations.map((item) => `<button class="recommend-pill" data-character-id="${item.id}">${item.name}</button>`).join('')}
        </div>
      </div>
    `);
  }

  _renderTopicDrawer(topic) {
    this._openDrawer(`
      <div class="drawer-section drawer-hero-panel">
        <div class="drawer-eyebrow">专题</div>
        <h2 class="drawer-title">${topic.title}</h2>
        <div class="summary-topline">
          ${topic.tags.map((tag) => `<span class="summary-badge">${tag}</span>`).join('')}
        </div>
        <p class="drawer-description">${topic.description}</p>
      </div>
      <div class="drawer-section">
        <div class="drawer-section-title">本专题人物</div>
        <div class="recommend-list">
          ${topic.characterIds.map((id) => this.characterMap.get(id)).filter(Boolean).map((character) => `<button class="recommend-pill" data-character-id="${character.id}">${character.name}</button>`).join('')}
        </div>
      </div>
      <div class="drawer-section drawer-actions-row">
        <button class="primary-action" data-character-id="${topic.focusId}">查看焦点人物</button>
        <button class="secondary-action" data-topic-id="${this._getNextTopic(topic.id).id}">下一个专题</button>
      </div>
    `);
  }

  _renderStageDrawer(stage) {
    this._openDrawer(`
      <div class="drawer-section drawer-hero-panel">
        <div class="drawer-eyebrow">阅读阶段</div>
        <h2 class="drawer-title">${stage.title}</h2>
        <div class="summary-topline">
          <span class="summary-badge">${stage.range}</span>
          <span class="summary-badge subtle">阶段入口</span>
        </div>
        <p class="drawer-description">${stage.description}</p>
      </div>
      <div class="drawer-section">
        <div class="drawer-section-title">这一段先认识的人</div>
        <div class="recommend-list">
          ${stage.characterIds.map((id) => this.characterMap.get(id)).filter(Boolean).map((character) => `<button class="recommend-pill" data-character-id="${character.id}">${character.name}</button>`).join('')}
        </div>
      </div>
      <div class="drawer-section">
        <div class="drawer-section-title">适合带着这些问题看</div>
        <div class="tips-list">
          ${(stage.questions || []).map((question) => `<div class="tip-item">${question}</div>`).join('')}
        </div>
      </div>
      <div class="drawer-section drawer-actions-row">
        <button class="primary-action" data-character-id="${stage.focusId}">查看焦点人物</button>
        <button class="secondary-action" data-stage-id="${this._getNextStage(stage.id).id}">下一个阶段</button>
      </div>
    `);
  }

  _renderFamilyDrawer(family, characters) {
    this._openDrawer(`
      <div class="drawer-section drawer-hero-panel">
        <div class="drawer-eyebrow">家族浏览</div>
        <h2 class="drawer-title">${family}</h2>
        <p class="drawer-description">这里优先展示 ${family} 中更关键的人物，帮助你先建立家族层级和主要关系印象。</p>
      </div>
      <div class="drawer-section">
        <div class="drawer-section-title">建议先看这些人物</div>
        <div class="summary-relations">
          ${characters.slice(0, 8).map((character) => `<button class="summary-relation-item" data-character-id="${character.id}"><span class="summary-relation-head"><strong>${character.name}</strong><em>${character.identity}</em></span><span class="summary-relation-desc">${character.description || character.identity}</span></button>`).join('')}
        </div>
      </div>
      <div class="drawer-section drawer-actions-row">
        <button class="primary-action" data-character-id="${characters[0].id}">查看当前核心人物</button>
        <button class="secondary-action" data-family-name="${family}">保持当前家族视图</button>
      </div>
    `);
  }

  _renderRelationshipDrawer(left, right) {
    const directRelations = this._getDirectRelation(left.id, right.id);
    const mutualConnections = this._getMutualConnections(left.id, right.id);

    this._openDrawer(`
      <div class="drawer-section drawer-hero-panel">
        <div class="drawer-eyebrow">双人物关系</div>
        <h2 class="drawer-title">${left.name} × ${right.name}</h2>
        <div class="summary-topline">
          <span class="summary-badge">${left.family}</span>
          <span class="summary-badge subtle">${right.family}</span>
        </div>
        <p class="drawer-description">${this._buildPairSummary(left, right)}</p>
      </div>
      <div class="drawer-section">
        <div class="drawer-section-title">直接关系</div>
        <div class="summary-relations">
          ${directRelations.length ? directRelations.map((rel) => `
            <div class="summary-relation-item static-item">
              <span class="summary-relation-head"><strong>${rel.label}</strong><em>${this.graph.relationLabels[rel.type] || rel.type}</em></span>
              <span class="summary-relation-desc">${rel.description || '现有数据中记录了这条直接关系。'}</span>
            </div>
          `).join('') : '<div class="tip-item">当前数据中没有这两人的直接关系线。</div>'}
        </div>
      </div>
      <div class="drawer-section">
        <div class="drawer-section-title">共同关联人物</div>
        <div class="recommend-list">
          ${mutualConnections.length ? mutualConnections.map((character) => `<button class="recommend-pill" data-character-id="${character.id}">${character.name}</button>`).join('') : '<span class="tip-item">暂无明显共同关联人物</span>'}
        </div>
      </div>
      <div class="drawer-section drawer-actions-row">
        <button class="primary-action" data-character-id="${left.id}">查看 ${left.name}</button>
        <button class="secondary-action" data-character-id="${right.id}">查看 ${right.name}</button>
      </div>
    `);
  }

  _getCompareState() {
    const leftValue = this.els.compareLeft.value || '';
    const rightValue = this.els.compareRight.value || '';

    if (!leftValue || !rightValue) {
      return { leftValue, rightValue, canCompare: false, reason: 'missing', message: '请先选两个人物，再查看关系。' };
    }
    if (leftValue === rightValue) {
      return { leftValue, rightValue, canCompare: false, reason: 'same', message: '对比双方不能是同一个人物，请重新选择。' };
    }
    return { leftValue, rightValue, canCompare: true, reason: 'valid', message: '' };
  }

  _handleCompareInputChange(changedSide) {
    const compareState = this._getCompareState();
    this._updateActionStates();
    if (compareState.reason !== 'same') return;
    if (changedSide === 'left') this.els.compareRight.focus();
    if (changedSide === 'right') this.els.compareLeft.focus();
  }

  _updateActionStates() {
    const hasCurrentCharacter = Boolean(this.currentCharacterId && this.characterMap.get(this.currentCharacterId));
    const compareState = this._getCompareState();
    const isFocusMode = Boolean(this.graph && this.graph.focusMode);

    this.els.btnCompareCurrent.disabled = !hasCurrentCharacter;
    this.els.btnRunCompare.disabled = !compareState.canCompare;
    this.els.btnRunCompare.title = compareState.canCompare ? '查看这两个人物的关系' : compareState.message;
    this.els.btnExitFocus.disabled = !isFocusMode;

    [this.els.compareLeft, this.els.compareRight].forEach((select) => {
      select.classList.toggle('is-invalid', compareState.reason === 'same');
      select.setAttribute('aria-invalid', compareState.reason === 'same' ? 'true' : 'false');
    });

    this._syncGraphFilterUi();
  }

  _prepareCompareFromCurrent(characterId) {
    this.els.compareLeft.value = characterId;
    if (this.els.compareRight.value === characterId) this.els.compareRight.value = '';
    this._updateActionStates();
    this._toggleSidebar(true);
    this._openSidebarTools();
    this.els.compareRight.focus();
  }

  _openSidebarTools() {
    if (this.els.moreTools && !this.els.moreTools.open) this.els.moreTools.open = true;
  }

  _getNextTopic(currentTopicId) {
    const currentIndex = this.topics.findIndex((topic) => topic.id === currentTopicId);
    return this.topics[(currentIndex + 1) % this.topics.length];
  }

  _getNextStage(currentStageId) {
    const currentIndex = this.stages.findIndex((stage) => stage.id === currentStageId);
    return this.stages[(currentIndex + 1) % this.stages.length];
  }

  _showCard(character) {
    const relations = this.graph.getCharacterRelations(character.id);
    const summaryRelations = this._buildRelationshipSummary(character.id);
    const recommendations = this._buildCharacterRecommendations(character.id);
    const relatedKnowledge = this.knowledgeView?.getCharacterKnowledge(character.id) || [];
    const familyColor = this.graph._getNodeColor(character);

    const relationTypeColors = {
      blood: '#4A90D9', marriage: '#E74C3C', master_servant: '#95A5A6', romance: '#E91E8C', social: '#F39C12', rivalry: '#8E44AD'
    };

    const relationTypeLabels = {
      blood: '血缘', marriage: '婚姻', master_servant: '主仆', romance: '情感', social: '社交', rivalry: '敌对'
    };

    this._setHtml(this.els.cardContent, `
      <button class="card-close-btn" data-close-card="true">✕</button>
      <div class="card-header">
        <div class="card-avatar" style="background:${familyColor}"><span class="card-avatar-text">${character.name.substring(0, 1)}</span></div>
        <div class="card-header-info">
          <div class="card-name">${character.name}${character.pinyin ? `<span class="card-pinyin">（${character.pinyin}）</span>` : ''}</div>
          ${character.alias?.length ? `<div class="card-alias">又名：${character.alias.join('、')}</div>` : ''}
          <div class="card-identity">${character.identity}</div>
          <div class="card-tags">
            <button class="card-tag family" data-tag-type="family" data-tag-value="${character.family}" style="color:${familyColor};border-color:${familyColor}40;background:${familyColor}15">${character.family}</button>
            <span class="card-tag ${character.gender === '男' ? 'gender-male' : 'gender-female'}">${character.gender}</span>
            <span class="card-tag card-tag-soft">重要度 ${character.importance}/5</span>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="card-section card-highlight-box">
          <div class="card-section-title">阅读时先看这几条</div>
          <div class="card-summary-list">
            ${summaryRelations.map((rel) => `
              <div class="card-summary-item">
                <div class="card-summary-head">
                  <strong>${rel.character.name}</strong>
                  <span class="card-summary-type" style="background:${relationTypeColors[rel.type] || '#999'}">${relationTypeLabels[rel.type] || rel.type} · ${rel.label}</span>
                </div>
                <div class="card-summary-desc">${rel.description || rel.summary}</div>
              </div>
            `).join('')}
          </div>
        </div>

        ${character.description ? `<div class="card-section"><div class="card-section-title">人物简介</div><div class="card-description">${character.description}</div></div>` : ''}
        ${character.sourceNote ? `<div class="card-section"><div class="card-section-title">版本说明</div><div class="card-source-note">${character.sourceNote}</div></div>` : ''}
        ${character.outcomeVersion ? `<div class="card-section"><div class="card-section-title">结局版本</div><div class="card-source-note"><div class="card-version-row"><strong>前八十回</strong><span>${character.outcomeVersion.original || '未注明'}</span></div><div class="card-version-row"><strong>后四十回</strong><span>${character.outcomeVersion.continuation || '未注明'}</span></div></div></div>` : ''}
        ${character.personality ? `<div class="card-section"><div class="card-section-title">性格特征</div><div class="card-personality">${character.personality}</div></div>` : ''}
        ${character.keyEvents?.length ? `<div class="card-section"><div class="card-section-title">关键事迹</div><ul class="card-events">${character.keyEvents.map((event) => `<li>${event}</li>`).join('')}</ul></div>` : ''}
        ${character.chapters?.length ? `<div class="card-section"><div class="card-section-title">相关章节</div><div class="card-chapters">${character.chapters.slice(0, 5).map((chapter) => `
          <div class="card-chapter-item">
            <div class="card-chapter-header"><span class="card-chapter-number">第${chapter.chapter}回</span><span class="card-chapter-title">${chapter.title}</span></div>
            <div class="card-chapter-summary">${chapter.summary}</div>
          </div>`).join('')}</div></div>` : ''}
        ${character.quotes?.length ? `<div class="card-section"><div class="card-section-title">经典语录</div>${character.quotes.slice(0, 2).map((quote) => `<div class="card-quote">${quote}</div>`).join('')}</div>` : ''}
        ${relations.length ? `<div class="card-section"><div class="card-section-title">全部人物关系</div><div class="card-relations">${relations.map((rel) => `
          <div class="card-relation-item" data-id="${rel.character.id}">
            <span class="card-relation-type" style="background:${relationTypeColors[rel.type] || '#999'}">${relationTypeLabels[rel.type] || rel.type}</span>
            <span class="card-relation-name">${rel.character.name}</span>
            <span class="card-relation-label">${rel.label}</span>
          </div>`).join('')}</div></div>` : ''}
        ${recommendations.length ? `<div class="card-section"><div class="card-section-title">继续阅读这些人物</div><div class="recommend-list">${recommendations.map((relChar) => `<button class="recommend-pill" data-character-id="${relChar.id}">${relChar.name}</button>`).join('')}</div></div>` : ''}
        ${relatedKnowledge.length ? `<div class="card-section"><div class="card-section-title">相关知识条目</div><div class="recommend-list">${relatedKnowledge.slice(0, 6).map((item) => `<button class="recommend-pill" data-knowledge-char-id="${character.id}">${item.title}</button>`).join('')}</div><div class="card-note-hint">点击可跳转知识库并自动检索该人物</div></div>` : ''}
      </div>
    `);

    this.els.cardContent.querySelector('[data-close-card="true"]').addEventListener('click', () => this._closeCard());
    this.els.cardContent.querySelectorAll('.card-relation-item,[data-character-id]').forEach((item) => {
      item.addEventListener('click', () => {
        const id = item.dataset.id || item.dataset.characterId;
        if (!this.characterMap.get(id)) return;
        this._openCharacter(id, { focusNeighbors: true, showCard: true });
      });
    });
    this.els.cardContent.querySelectorAll('[data-knowledge-char-id]').forEach((item) => {
      item.addEventListener('click', () => {
        this._closeCard();
        this._openCharacterKnowledge(character);
      });
    });
    this.els.cardContent.querySelectorAll('[data-tag-type]').forEach((item) => {
      item.addEventListener('click', () => this._handleFacetTagSelection({
        type: item.dataset.tagType,
        value: item.dataset.tagValue,
        view: 'card'
      }));
    });

    this.els.cardOverlay.classList.add('active');
  }

  _closeCard() {
    this.els.cardOverlay.classList.remove('active');
    this._setHtml(this.els.cardContent, '');
  }

  _setFacetState(nextState = {}, sourceView = 'graph') {
    const mergedState = {
      ...this.facetState,
      ...nextState,
      selectedCharacterIds: Array.from(new Set(nextState.selectedCharacterIds ?? this.facetState.selectedCharacterIds ?? [])),
      selectedTags: Array.from(new Set(nextState.selectedTags ?? this.facetState.selectedTags ?? []))
    };
    
    this.facetState = mergedState;
    
    if (facetStore) {
      facetStore.batchStart();
      facetStore.set({
        selectedCharacterIds: mergedState.selectedCharacterIds,
        selectedTags: mergedState.selectedTags,
        selectedFamily: mergedState.selectedFamily,
        selectedChapter: mergedState.selectedChapter,
        selectedCategory: mergedState.selectedCategory,
        breadcrumb: mergedState.breadcrumb
      }, sourceView);
      facetStore.batchEnd(sourceView);
    }
    
    this._renderGlobalContextBar();
    this._syncFacetStateToViews();
  }

  _syncFacetStateToViews() {
    const state = this.facetState;
    
    if (this.treeView) {
      this.treeView.setFacetContext({
        selectedCharacterIds: state.selectedCharacterIds
      });
      if (this.viewInitialized.tree) {
        this.treeView._syncTreeHighlights?.();
      }
    }
    
    if (this.listView) {
      this.listView.setFacetContext({
        selectedCharacterIds: state.selectedCharacterIds
      });
      if (this.viewInitialized.list) {
        this.listView._invalidateFilterCache?.();
        this.listView._renderList?.();
      }
    }
    
    if (this.knowledgeView) {
      this.knowledgeView.setFacetContext({
        selectedCharacterIds: state.selectedCharacterIds
      });
      if (this.viewInitialized.knowledge) {
        this.knowledgeView._invalidateFilterCache?.();
        this.knowledgeView._updateContent?.();
      }
    }
    
    if (this.graph) {
      this.graph.applyFacetSelection?.(state.selectedCharacterIds);
    }
  }

  _mergeFacetState(partial = {}) {
    return;
  }

  _handleFacetTagSelection(payload = {}) {
    if (!payload?.value) return;
    
    if (payload.type === 'family') {
      this._openFamily(payload.value);
      return;
    }
    
    if (payload.type === 'character' || payload.characterId) {
      const characterId = payload.characterId || payload.value;
      if (facetStore) {
        facetStore.toggleCharacter(characterId, payload.view || 'unknown');
      }
      this._openCharacter(characterId, { focusNeighbors: true });
      return;
    }
    
    if (payload.type === 'tag' || payload.tag) {
      const tag = payload.tag || payload.value;
      if (facetStore) {
        facetStore.toggleTag(tag, payload.view || 'unknown');
      }
      this._applyTagFilter(tag);
    }
  }

  _applyTagFilter(tag) {
    if (this.knowledgeView && this.viewInitialized.knowledge) {
      this.knowledgeView.searchQuery = tag;
      this.knowledgeView._invalidateFilterCache?.();
      this.knowledgeView._updateContent?.();
    }
  }

  previewCharacterHover(characterId, sourceView) {
    if (sourceView === 'graph' && this.treeView) {
      this.treeView.highlightCharacter?.(characterId);
    }
    if (sourceView === 'graph' && this.listView) {
      this.listView.highlightCharacter?.(characterId);
    }
    if (sourceView === 'tree' && this.graph) {
      this.graph.previewNode?.(characterId);
    }
    if (sourceView === 'list' && this.graph) {
      this.graph.previewNode?.(characterId);
    }
    if (sourceView === 'knowledge' && this.graph) {
      this.graph.previewNode?.(characterId);
    }
  }

  clearCharacterPreview(sourceView) {
    if (sourceView === 'graph') {
      this.treeView?.clearHighlight?.();
      this.listView?.clearHighlight?.();
    }
    if (sourceView === 'tree' || sourceView === 'list' || sourceView === 'knowledge') {
      this.graph?.clearPreview?.();
    }
  }

  _clearFacetContext() {
    this._showOverview();
    this.graph.showImportantOverview();
  }

  _applyFacetStateToViews() {
    return;
  }

  _renderGlobalContextBar() {
    if (!this.els.globalContextBar) return;
    this.els.globalContextBar.classList.remove('active');
    if (this.els.contextBreadcrumbs) this.els.contextBreadcrumbs.innerHTML = '';
    if (this.els.contextFacets) this.els.contextFacets.innerHTML = '';
  }

  _hideLoading() {
    setTimeout(() => {
      this.els.loading.classList.add('hidden');
      setTimeout(() => {
        this.els.loading.style.display = 'none';
      }, 400);
    }, 600);
  }

  _showError(message) {
    this._setHtml(this.els.loading, `
      <div class="loading-title">加载失败</div>
      <div class="loading-subtitle">${message}</div>
    `);
  }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new HongLouMengApp();
});
