/**
 * 《红楼梦》人物关系图谱 - 主应用逻辑
 * app.js - 数据加载、UI 控制、搜索、筛选
 */

class HongLouMengApp {
  constructor() {
    this.graph = null;
    this.characters = [];
    this.relationships = [];
    this.characterMap = new Map();
    
    // DOM 引用
    this.els = {};
    
    this._init();
  }
  
  async _init() {
    this._cacheDom();
    this._bindEvents();
    
    try {
      await this._loadData();
      this._initGraph();
      this._buildSidebar();
      this._hideLoading();
    } catch (err) {
      console.error('初始化失败:', err);
      this._showError('数据加载失败，请刷新页面重试。');
    }
  }
  
  /**
   * 缓存 DOM 元素
   */
  _cacheDom() {
    this.els = {
      loading: document.getElementById('loading-overlay'),
      graphContainer: document.getElementById('graph-container'),
      searchInput: document.getElementById('search-input'),
      searchResults: document.getElementById('search-results'),
      sidebarToggle: document.getElementById('sidebar-toggle'),
      sidebar: document.getElementById('sidebar'),
      sidebarBackdrop: document.getElementById('sidebar-backdrop'),
      familyFilters: document.getElementById('family-filters'),
      relationFilters: document.getElementById('relation-filters'),
      statsSection: document.getElementById('stats-section'),
      cardOverlay: document.getElementById('character-card-overlay'),
      cardContent: document.getElementById('card-content'),
      modeIndicator: document.getElementById('mode-indicator'),
      modeName: document.getElementById('mode-name'),
      btnFullView: document.getElementById('btn-full-view'),
      btnZoomIn: document.getElementById('btn-zoom-in'),
      btnZoomOut: document.getElementById('btn-zoom-out'),
      btnReset: document.getElementById('btn-reset'),
      btnToggleLabels: document.getElementById('btn-toggle-labels'),
      btnExitFocus: document.getElementById('btn-exit-focus')
    };
  }
  
  /**
   * 绑定事件
   */
  _bindEvents() {
    // 搜索
    this.els.searchInput.addEventListener('input', (e) => this._onSearch(e.target.value));
    this.els.searchInput.addEventListener('focus', () => {
      if (this.els.searchInput.value) this.els.searchResults.classList.add('active');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-box')) {
        this.els.searchResults.classList.remove('active');
      }
    });
    
    // 侧边栏
    this.els.sidebarToggle.addEventListener('click', () => this._toggleSidebar());
    this.els.sidebarBackdrop.addEventListener('click', () => this._toggleSidebar(false));
    
    // 卡片关闭
    this.els.cardOverlay.addEventListener('click', (e) => {
      if (e.target === this.els.cardOverlay) this._closeCard();
    });
    
    // 控制按钮
    this.els.btnFullView.addEventListener('click', () => this._exitFocusMode());
    this.els.btnZoomIn.addEventListener('click', () => this.graph.zoomIn());
    this.els.btnZoomOut.addEventListener('click', () => this.graph.zoomOut());
    this.els.btnReset.addEventListener('click', () => this.graph.resetView());
    this.els.btnToggleLabels.addEventListener('click', () => {
      const visible = this.graph.toggleLabels();
      this.els.btnToggleLabels.classList.toggle('active', visible);
    });
    this.els.btnExitFocus.addEventListener('click', () => this._exitFocusMode());
    
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._closeCard();
        if (this.graph && this.graph.focusMode) this._exitFocusMode();
      }
      if (e.key === '/' && !e.target.closest('input')) {
        e.preventDefault();
        this.els.searchInput.focus();
      }
    });
  }
  
  /**
   * 加载数据
   */
  async _loadData() {
    const [charRes, relRes] = await Promise.all([
      fetch('data/characters.json'),
      fetch('data/relationships.json')
    ]);
    
    if (!charRes.ok || !relRes.ok) {
      throw new Error('无法加载数据文件');
    }
    
    this.characters = await charRes.json();
    this.relationships = await relRes.json();
    
    this.characters.forEach(c => this.characterMap.set(c.id, c));
  }
  
  /**
   * 初始化图谱
   */
  _initGraph() {
    this.graph = new RelationshipGraph(this.els.graphContainer);
    
    this.graph.onNodeClick = (character) => this._showCard(character);
    this.graph.onNodeDblClick = (character) => this._enterFocusMode(character);
    
    this.graph.setData(this.characters, this.relationships);
  }
  
  /**
   * 构建侧边栏
   */
  _buildSidebar() {
    const stats = this.graph.getStats();
    
    // 家族筛选
    this._buildFamilyFilters(stats);
    
    // 关系类型筛选
    this._buildRelationFilters(stats);
    
    // 统计信息
    this._buildStats(stats);
  }
  
  _buildFamilyFilters(stats) {
    const families = [
      { key: '贾家', label: '贾家', color: '#C0392B' },
      { key: '史家', label: '史家', color: '#2980B9' },
      { key: '王家', label: '王家', color: '#27AE60' },
      { key: '薛家', label: '薛家', color: '#8E44AD' },
      { key: '林家', label: '林家', color: '#16A085' },
      { key: '其他', label: '其他人物', color: '#E67E22' }
    ];
    
    this.els.familyFilters.innerHTML = families.map(f => {
      const count = stats.familyCounts[f.key] || 0;
      return `
        <div class="family-filter-item active" data-family="${f.key}">
          <div class="custom-checkbox checked"></div>
          <div class="family-color-dot" style="background: ${f.color}"></div>
          <span class="family-filter-label">${f.label}</span>
          <span class="family-filter-count">${count}</span>
        </div>
      `;
    }).join('');
    
    // 事件
    this.els.familyFilters.querySelectorAll('.family-filter-item').forEach(item => {
      item.addEventListener('click', () => {
        const family = item.dataset.family;
        item.classList.toggle('active');
        item.querySelector('.custom-checkbox').classList.toggle('checked');
        this.graph.toggleFamily(family);
      });
    });
  }
  
  _buildRelationFilters(stats) {
    const relations = [
      { key: 'blood', label: '血缘关系', color: '#4A90D9' },
      { key: 'marriage', label: '婚姻关系', color: '#E74C3C' },
      { key: 'master_servant', label: '主仆关系', color: '#95A5A6' },
      { key: 'romance', label: '情感关系', color: '#E91E8C' },
      { key: 'social', label: '社交关系', color: '#F39C12' },
      { key: 'rivalry', label: '敌对关系', color: '#8E44AD' }
    ];
    
    this.els.relationFilters.innerHTML = relations.map(r => {
      const count = stats.relationCounts[r.key] || 0;
      return `
        <div class="relation-filter-item active" data-type="${r.key}">
          <div class="custom-checkbox checked"></div>
          <div class="relation-line-icon" style="background: ${r.color}"></div>
          <span class="relation-filter-label">${r.label}</span>
          <span class="relation-filter-count">${count}</span>
        </div>
      `;
    }).join('');
    
    // 事件
    this.els.relationFilters.querySelectorAll('.relation-filter-item').forEach(item => {
      item.addEventListener('click', () => {
        const type = item.dataset.type;
        item.classList.toggle('active');
        item.querySelector('.custom-checkbox').classList.toggle('checked');
        this.graph.toggleRelationType(type);
      });
    });
  }
  
  _buildStats(stats) {
    this.els.statsSection.innerHTML = `
      <div class="stat-item">
        <span>人物总数</span>
        <span class="stat-value">${stats.totalCharacters}</span>
      </div>
      <div class="stat-item">
        <span>关系总数</span>
        <span class="stat-value">${stats.totalRelationships}</span>
      </div>
      <div class="stat-item">
        <span>家族数</span>
        <span class="stat-value">${Object.keys(stats.familyCounts).length}</span>
      </div>
      <div class="stat-item">
        <span>关系类型</span>
        <span class="stat-value">${Object.keys(stats.relationCounts).length}</span>
      </div>
    `;
  }
  
  /**
   * 搜索
   */
  _onSearch(query) {
    if (!query.trim()) {
      this.els.searchResults.classList.remove('active');
      this.els.searchResults.innerHTML = '';
      if (this.graph) this.graph.highlightSearch('');
      return;
    }
    
    const matches = this.graph.highlightSearch(query.trim());
    
    if (matches.length > 0) {
      this.els.searchResults.innerHTML = matches.slice(0, 10).map(char => `
        <div class="search-result-item" data-id="${char.id}">
          <span class="search-result-name">${char.name}</span>
          <span class="search-result-info">${char.family} · ${char.identity}</span>
        </div>
      `).join('');
      
      this.els.searchResults.classList.add('active');
      
      // 点击搜索结果
      this.els.searchResults.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.id;
          this.graph.focusOnNode(id);
          const char = this.characterMap.get(id);
          if (char) this._showCard(char);
          this.els.searchResults.classList.remove('active');
          this.els.searchInput.value = '';
          this.graph.highlightSearch('');
        });
      });
    } else {
      this.els.searchResults.innerHTML = `
        <div class="search-result-item">
          <span class="search-result-info">未找到匹配的人物</span>
        </div>
      `;
      this.els.searchResults.classList.add('active');
    }
  }
  
  /**
   * 侧边栏
   */
  _toggleSidebar(forceState) {
    const isOpen = forceState !== undefined ? !forceState : this.els.sidebar.classList.contains('open');
    
    if (isOpen) {
      this.els.sidebar.classList.remove('open');
      this.els.sidebarBackdrop.classList.remove('active');
    } else {
      this.els.sidebar.classList.add('open');
      this.els.sidebarBackdrop.classList.add('active');
    }
  }
  
  /**
   * 聚焦模式
   */
  _enterFocusMode(character) {
    this.graph.enterFocusMode(character.id);
    this.els.modeIndicator.classList.add('active');
    this.els.modeName.textContent = `聚焦：${character.name}`;
  }
  
  _exitFocusMode() {
    if (this.graph && this.graph.focusMode) {
      this.graph.exitFocusMode();
    }
    this.els.modeIndicator.classList.remove('active');
  }
  
  /**
   * 人物信息卡片
   */
  _showCard(character) {
    const relations = this.graph.getCharacterRelations(character.id);
    
    const relationTypeColors = {
      'blood': '#4A90D9',
      'marriage': '#E74C3C',
      'master_servant': '#95A5A6',
      'romance': '#E91E8C',
      'social': '#F39C12',
      'rivalry': '#8E44AD'
    };
    
    const relationTypeLabels = {
      'blood': '血缘',
      'marriage': '婚姻',
      'master_servant': '主仆',
      'romance': '情感',
      'social': '社交',
      'rivalry': '敌对'
    };
    
    const familyColor = this.graph._getNodeColor(character);
    
    this.els.cardContent.innerHTML = `
      <button class="card-close-btn" onclick="app._closeCard()">✕</button>
      
      <div class="card-header">
        <div class="card-avatar" style="background: ${familyColor}">
          <span class="card-avatar-text">${character.name.substring(0, 1)}</span>
        </div>
        <div class="card-header-info">
          <div class="card-name">${character.name}${character.pinyin ? `<span class="card-pinyin">（${character.pinyin}）</span>` : ''}</div>
          ${character.alias && character.alias.length > 0 
            ? `<div class="card-alias">又名：${character.alias.join('、')}</div>` 
            : ''}
          <div class="card-identity">${character.identity}</div>
          <div class="card-tags">
            <span class="card-tag family" style="color: ${familyColor}; border-color: ${familyColor}40; background: ${familyColor}15">${character.family}</span>
            <span class="card-tag ${character.gender === '男' ? 'gender-male' : 'gender-female'}">${character.gender}</span>
          </div>
        </div>
      </div>
      
      <div class="card-body">
        ${character.description ? `
        <div class="card-section">
          <div class="card-section-title">人物简介</div>
          <div class="card-description">${character.description}</div>
        </div>
        ` : ''}
        
        ${character.personality ? `
        <div class="card-section">
          <div class="card-section-title">性格特征</div>
          <div class="card-personality">${character.personality}</div>
        </div>
        ` : ''}
        
        ${character.keyEvents && character.keyEvents.length > 0 ? `
        <div class="card-section">
          <div class="card-section-title">关键事迹</div>
          <ul class="card-events">
            ${character.keyEvents.map(e => `<li>${e}</li>`).join('')}
          </ul>
        </div>
        ` : ''}
        
        ${character.quotes && character.quotes.length > 0 ? `
        <div class="card-section">
          <div class="card-section-title">经典语录</div>
          ${character.quotes.map(q => `<div class="card-quote">${q}</div>`).join('')}
        </div>
        ` : ''}
        
        ${character.chapters && character.chapters.length > 0 ? `
        <div class="card-section">
          <div class="card-section-title">📖 相关章节</div>
          <div class="card-chapters">
            ${character.chapters.map(ch => `
              <div class="card-chapter-item">
                <div class="card-chapter-header">
                  <span class="card-chapter-number">第${ch.chapter}回</span>
                  <span class="card-chapter-title">${ch.title}</span>
                </div>
                <div class="card-chapter-summary">${ch.summary}</div>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        ${relations.length > 0 ? `
        <div class="card-section">
          <div class="card-section-title">人物关系</div>
          <div class="card-relations">
            ${relations.map(r => `
              <div class="card-relation-item" data-id="${r.character.id}">
                <span class="card-relation-type" style="background: ${relationTypeColors[r.type] || '#999'}">
                  ${relationTypeLabels[r.type] || r.type}
                </span>
                <span class="card-relation-name">${r.character.name}</span>
                <span class="card-relation-label">${r.label}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
      </div>
    `;
    
    // 关系项点击事件
    this.els.cardContent.querySelectorAll('.card-relation-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const char = this.characterMap.get(id);
        if (char) {
          this._showCard(char);
          this.graph.focusOnNode(id);
        }
      });
    });
    
    this.els.cardOverlay.classList.add('active');
  }
  
  _closeCard() {
    this.els.cardOverlay.classList.remove('active');
  }
  
  /**
   * 加载动画
   */
  _hideLoading() {
    setTimeout(() => {
      this.els.loading.classList.add('hidden');
      setTimeout(() => {
        this.els.loading.style.display = 'none';
      }, 500);
    }, 800);
  }
  
  _showError(message) {
    const loading = this.els.loading;
    loading.innerHTML = `
      <div class="loading-title">加载失败</div>
      <div class="loading-subtitle">${message}</div>
    `;
  }
}

// 启动应用
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new HongLouMengApp();
});
