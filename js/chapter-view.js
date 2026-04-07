class ChapterView {
  constructor(container) {
    this.container = container;
    this.knowledge = [];
    this.characters = [];
    this.characterMap = new Map();
    this.relatedCharacterIds = new Set();
    this.chapterEntries = [];
    this.chapterProfiles = [];
    this.chapterProfileMap = new Map();
    this.visibleProfiles = [];
    this.activeChapter = null;
    this.versionFilter = 'all';
    this.searchQuery = '';
    this.characterTierFilter = 'all';
    this.sourceFilter = 'all';
    this._searchTimer = null;
    this._deferredMainTimer = null;
    this._deferredMainToken = 0;
    this._eventsBound = false;

    this.onCharacterClick = null;
    this.onKnowledgeNavigate = null;
    this.onTagClick = null;
    this.searchInput = null;

    this.categoryConfig = {
      '回目知识': { icon: '📚', color: '#27AE60' },
      '判词': { icon: '📜', color: '#8B2500' },
      '曲词': { icon: '🎵', color: '#8E44AD' },
      '诗词': { icon: '✒️', color: '#2980B9' },
      '典故': { icon: '📖', color: '#16A085' },
      '名场面': { icon: '🎭', color: '#E67E22' },
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
      '人物专题': { icon: '👤', color: '#C0605A' },
      '其他': { icon: '📄', color: '#8C7B6B' }
    };
  }

  _isLowPerformanceMode() {
    return document.body.classList.contains('performance-low');
  }

  _getVisibleKnowledgeLimit() {
    return this._isLowPerformanceMode() ? 10 : 18;
  }

  _getVisibleCharacterEvidenceLimit() {
    return this._isLowPerformanceMode() ? 2 : 3;
  }

  _getDeferredKnowledgeChunkSize() {
    return this._isLowPerformanceMode() ? 3 : 6;
  }

  _clearDeferredMainRender() {
    this._deferredMainToken += 1;
    if (this._deferredMainTimer) {
      window.clearTimeout(this._deferredMainTimer);
      this._deferredMainTimer = null;
    }
  }

  _scheduleDeferredKnowledgeCards(container, items = [], token) {
    if (!container || !items.length) return;

    const activeToken = token ?? this._deferredMainToken;
    const step = () => {
      if (activeToken !== this._deferredMainToken || !container.isConnected) return;
      const chunk = items.splice(0, this._getDeferredKnowledgeChunkSize());
      if (chunk.length) {
        container.insertAdjacentHTML('beforeend', chunk.map((item) => this._renderKnowledgeLinkCard(item)).join(''));
      }
      if (items.length) {
        this._deferredMainTimer = window.setTimeout(step, 32);
        return;
      }
      this._deferredMainTimer = null;
      this._syncCharacterHighlights();
    };

    this._deferredMainTimer = window.setTimeout(step, 32);
  }

  setData(knowledge, characters) {
    this.knowledge = knowledge || [];
    this.characters = characters || [];
    this.characterMap = new Map();
    this.characters.forEach((character) => this.characterMap.set(character.id, character));
    this._buildChapterProfiles();
    if (this.activeChapter === null && this.chapterProfiles.length) {
      this.activeChapter = this.chapterProfiles[0].chapter;
    }
  }

  setFacetContext(facetState = {}) {
    this.relatedCharacterIds = new Set(facetState.selectedCharacterIds || []);
  }

  render() {
    const existingLayout = this.container.querySelector('.chapter-shell');
    if (existingLayout) {
      const liveInput = this.container.querySelector('.chapter-search-input');
      if (liveInput && liveInput.value !== this.searchQuery) liveInput.value = this.searchQuery;
      this._updateContent();
      return;
    }

    this._clearDeferredMainRender();
    this.container.innerHTML = this._renderShell();
    this._flushDeferredMain(this._resolveCurrentProfile(this._getVisibleProfiles()));
    if (!this._eventsBound) this._bindEvents();
  }

  _renderShell() {
    const overview = this._getOverviewStats();
    const visibleProfiles = this._getVisibleProfiles();
    const currentProfile = this._resolveCurrentProfile(visibleProfiles);

    return `
      <section class="chapter-shell">
        <div class="chapter-hero card-surface">
          <div class="chapter-hero-copy">
            <span class="chapter-hero-eyebrow">回目知识专视图</span>
            <h2 class="chapter-hero-title">以回目为纲，把人物与知识条目重新串成一条阅读线</h2>
            <p class="chapter-hero-desc">每一回先看回目提要，再看本回牵动的人物、同回可互证的知识条目，以及前八十回与后四十回的版本分界。</p>
          </div>
          <div class="chapter-hero-stats">
            <div class="chapter-stat-card"><span>回目条数</span><strong>${overview.totalChapters}</strong></div>
            <div class="chapter-stat-card"><span>关联人物</span><strong>${overview.totalCharacters}</strong></div>
            <div class="chapter-stat-card"><span>联动知识</span><strong>${overview.totalKnowledge}</strong></div>
            <div class="chapter-stat-card"><span>覆盖版本</span><strong>${overview.versionLabel}</strong></div>
          </div>
        </div>

        <div class="chapter-layout">
          <aside class="chapter-sidebar card-surface">
            <div class="chapter-sidebar-section">
              <div class="chapter-sidebar-title">搜索回目</div>
              <div class="chapter-search-box">
                <span class="chapter-search-icon">🔍</span>
                <input class="chapter-search-input" type="text" placeholder="搜回目、人名、关键词…" value="${this._escapeHtml(this.searchQuery)}">
              </div>
            </div>

            <div class="chapter-sidebar-section">
              <div class="chapter-sidebar-title">版本范围</div>
              <div class="chapter-filter-group">
                <button class="chapter-filter-chip ${this.versionFilter === 'all' ? 'active' : ''}" data-version="all">全部回目</button>
                <button class="chapter-filter-chip ${this.versionFilter === 'original' ? 'active' : ''}" data-version="original">前八十回</button>
                <button class="chapter-filter-chip ${this.versionFilter === 'continuation' ? 'active' : ''}" data-version="continuation">后四十回</button>
              </div>
            </div>

            <div class="chapter-sidebar-section">
              <div class="chapter-sidebar-title">回目目录</div>
              <div class="chapter-directory" id="chapter-directory-content">
                ${this._renderDirectory(visibleProfiles, currentProfile)}
              </div>
            </div>
          </aside>

          <div class="chapter-main" id="chapter-main-content">
            ${currentProfile ? this._renderMain(currentProfile, visibleProfiles) : this._renderEmptyState()}
          </div>
        </div>
      </section>
    `;
  }

  _updateContent() {
    const liveInput = this.container.querySelector('.chapter-search-input');
    if (liveInput && liveInput.value !== this.searchQuery) liveInput.value = this.searchQuery;
    const directoryEl = this.container.querySelector('#chapter-directory-content');
    const mainEl = this.container.querySelector('#chapter-main-content');
    this._clearDeferredMainRender();
    const visibleProfiles = this._getVisibleProfiles();
    const currentProfile = this._resolveCurrentProfile(visibleProfiles);

    this.visibleProfiles = visibleProfiles;

    if (directoryEl) directoryEl.innerHTML = this._renderDirectory(visibleProfiles, currentProfile);
    if (mainEl) {
      mainEl.innerHTML = currentProfile ? this._renderMain(currentProfile, visibleProfiles) : this._renderEmptyState();
      this._flushDeferredMain(currentProfile);
    }

    this._syncCharacterHighlights();
  }

  _renderDirectory(visibleProfiles, currentProfile) {
    if (!visibleProfiles.length) {
      return '<div class="chapter-directory-empty">没有符合条件的回目，请试试别的关键词。</div>';
    }

    return visibleProfiles.map((profile) => {
      const isActive = currentProfile && profile.chapter === currentProfile.chapter;
      return `
        <button class="chapter-directory-item ${isActive ? 'active' : ''}" data-chapter="${profile.chapter}">
          <span class="chapter-directory-number">第${profile.chapter}回</span>
          <span class="chapter-directory-title">${this._escapeHtml(profile.titleShort || profile.entry.title || '')}</span>
          <span class="chapter-directory-meta">${profile.characterCount}人 · ${profile.relatedKnowledge.length}条知识</span>
        </button>
      `;
    }).join('');
  }

  _renderMain(profile, visibleProfiles) {
    const parsed = this._parseChapterEntry(profile.entry);
    const previous = visibleProfiles.find((item) => item.chapter === profile.chapter - 1) || null;
    const next = visibleProfiles.find((item) => item.chapter === profile.chapter + 1) || null;
    const layeredCharacters = this._groupCharactersByTier(profile.characters);
    const visibleKnowledge = profile.relatedKnowledge.slice(0, this._getVisibleKnowledgeLimit());
    const immediateKnowledgeCount = this._isLowPerformanceMode() ? Math.min(visibleKnowledge.length, 4) : visibleKnowledge.length;
    const immediateKnowledge = visibleKnowledge.slice(0, immediateKnowledgeCount);
    const hasDeferredKnowledge = visibleKnowledge.length > immediateKnowledgeCount;

    return `
      <div class="chapter-focus card-surface">
        <div class="chapter-focus-head">
          <div>
            <div class="chapter-focus-eyebrow">${profile.version === 'continuation' ? '后四十回 · 续书线' : '前八十回 · 原著线'}</div>
            <h3 class="chapter-focus-title">${this._escapeHtml(profile.entry.title || '')}</h3>
            <p class="chapter-focus-desc">${this._escapeHtml(parsed.summary || '本回以回目知识为中心，联动人物与同回知识条目。')}</p>
          </div>
          <div class="chapter-focus-actions">
            ${previous ? `<button class="chapter-nav-btn" data-jump-chapter="${previous.chapter}">← 上一回</button>` : ''}
            <button class="chapter-nav-btn primary" data-action="open-knowledge" data-chapter="${profile.chapter}">在知识库查看本回</button>
            ${next ? `<button class="chapter-nav-btn" data-jump-chapter="${next.chapter}">下一回 →</button>` : ''}
          </div>
        </div>

        <div class="chapter-focus-grid">
          <div class="chapter-summary-card">
            <div class="chapter-section-title">本回知识骨架</div>
            <div class="chapter-summary-lines">
              <div class="chapter-summary-line">
                <span class="chapter-summary-label">回次</span>
                <strong>第${profile.chapter}回</strong>
              </div>
              <div class="chapter-summary-line">
                <span class="chapter-summary-label">版本说明</span>
                <span>${this._escapeHtml(profile.entry.versionNote || '待补充')}</span>
              </div>
            </div>
            <div class="chapter-point-group">
              ${(parsed.points.length ? parsed.points : (profile.entry.tags || [])).slice(0, 12).map((point) => `
                <button class="chapter-point-chip" data-tag="${this._escapeHtmlAttr(point)}">${this._escapeHtml(point)}</button>
              `).join('') || '<span class="chapter-muted">暂无知识点标签</span>'}
            </div>
          </div>

          <div class="chapter-summary-card emphasis">
            <div class="chapter-section-title">本回联动摘要</div>
            <div class="chapter-kpi-row">
              <div class="chapter-kpi-item"><strong>${profile.characterCount}</strong><span>牵动人物</span></div>
              <div class="chapter-kpi-item"><strong>${profile.relatedKnowledge.length}</strong><span>同回知识</span></div>
              <div class="chapter-kpi-item"><strong>${profile.entry.tags?.length || parsed.points.length || 0}</strong><span>知识线索</span></div>
            </div>
            <p class="chapter-interpretation">${this._escapeHtml(this._buildInterpretation(profile, parsed))}</p>
          </div>
        </div>
      </div>

      <section class="chapter-section card-surface">
        <div class="chapter-section-head">
          <div>
            <div class="chapter-section-title">本回牵动人物</div>
            <div class="chapter-section-subtitle">分成主线人物、有名有姓人物、旁及人物三层；每个人物都标出它为什么会出现在这一回。</div>
          </div>
        </div>
        <div class="chapter-character-filterbar">
          <div class="chapter-filter-block">
            <div class="chapter-filter-block-label">人物层级</div>
            <div class="chapter-filter-inline">
              ${this._renderCharacterTierFilter()}
            </div>
          </div>
          <div class="chapter-filter-block">
            <div class="chapter-filter-block-label">来源说明</div>
            <div class="chapter-filter-inline">
              ${this._renderSourceFilter()}
            </div>
          </div>
        </div>
        ${this._renderLayeredCharacterSections(layeredCharacters)}
      </section>

      <section class="chapter-section card-surface">
        <div class="chapter-section-head">
          <div>
            <div class="chapter-section-title">同回知识关联</div>
            <div class="chapter-section-subtitle">把这一回可互相印证的判词、场景、器物、礼俗与名场面并排放在一起看。</div>
          </div>
          <button class="chapter-text-action" data-action="open-knowledge" data-chapter="${profile.chapter}">打开完整知识库</button>
        </div>
        <div class="chapter-related-grid">
          ${visibleKnowledge.length ? immediateKnowledge.map((item) => this._renderKnowledgeLinkCard(item)).join('') : '<div class="chapter-empty-block">目前这一回还没有补充更多同回知识条目。</div>'}
          ${hasDeferredKnowledge ? '<div class="chapter-deferred-anchor" aria-hidden="true"></div>' : ''}
        </div>
      </section>
    `;
  }

  _flushDeferredMain(profile) {
    this._clearDeferredMainRender();
    if (!profile) return;

    const visibleKnowledge = profile.relatedKnowledge.slice(0, this._getVisibleKnowledgeLimit());
    const immediateKnowledgeCount = this._isLowPerformanceMode() ? Math.min(visibleKnowledge.length, 4) : visibleKnowledge.length;
    const remainingKnowledge = visibleKnowledge.slice(immediateKnowledgeCount);
    if (!remainingKnowledge.length) return;

    const grid = this.container.querySelector('.chapter-related-grid');
    const anchor = grid?.querySelector('.chapter-deferred-anchor');
    if (!grid) return;
    if (anchor) anchor.remove();
    this._scheduleDeferredKnowledgeCards(grid, remainingKnowledge, this._deferredMainToken);
  }

  _renderCharacterCard(item) {
    const character = item.character;
    const isRelated = this.relatedCharacterIds.has(character.id);
    const sourceSummary = this._summarizeCharacterSources(item);
    return `
      <button class="chapter-character-card ${isRelated ? 'is-related' : ''}" data-char-id="${character.id}">
        <div class="chapter-character-top">
          <span class="chapter-character-name">${this._escapeHtml(character.name)}</span>
          <span class="chapter-character-score">${item.score}线索</span>
        </div>
        <div class="chapter-character-identity">${this._escapeHtml(character.identity || character.family || '人物')}</div>
        <div class="chapter-character-meta">
          <span>${this._escapeHtml(character.family || '其他')}</span>
          <span>★${character.importance || 1}</span>
        </div>
        <div class="chapter-source-row">
          ${sourceSummary.map((source) => `<span class="chapter-source-chip ${source.className}">${this._escapeHtml(source.label)}</span>`).join('')}
        </div>
        <div class="chapter-evidence-group">
          ${item.evidence.slice(0, this._getVisibleCharacterEvidenceLimit()).map((evidence) => `<span class="chapter-evidence-chip">${this._escapeHtml(evidence)}</span>`).join('')}
        </div>
      </button>
    `;
  }

  _renderLayeredCharacterSections(layeredCharacters) {
    const sections = [
      {
        key: 'main',
        title: '主线人物',
        desc: '重要度高、且本回确有情节牵动的人物。适合先读这一层。'
      },
      {
        key: 'named',
        title: '有名有姓人物',
        desc: '虽非绝对主线，但本回明确点名、能帮助你补足章回现场感的人物。'
      },
      {
        key: 'peripheral',
        title: '旁及人物',
        desc: '更多是规则补全、伏笔牵连或外围映带的人物，可作为深读参考。'
      }
    ];

    const rendered = sections.map((section) => {
      if (this.characterTierFilter !== 'all' && this.characterTierFilter !== section.key) return '';
      const items = this._applySourceFilter(layeredCharacters[section.key] || []);
      if (!items.length) return '';
      return `
        <div class="chapter-character-group ${section.key}">
          <div class="chapter-character-group-head">
            <div>
              <div class="chapter-character-group-title">${section.title}</div>
              <div class="chapter-character-group-desc">${section.desc}</div>
            </div>
            <div class="chapter-character-group-count">${items.length} 人</div>
          </div>
          <div class="chapter-character-grid">
            ${items.map((item) => this._renderCharacterCard(item)).join('')}
          </div>
        </div>
      `;
    }).filter(Boolean).join('');

    return rendered || '<div class="chapter-empty-block">本回暂无结构化人物关联，后续可继续补全。</div>';
  }

  _renderCharacterTierFilter() {
    const options = [
      { key: 'all', label: '全部层级' },
      { key: 'main', label: '只看主线' },
      { key: 'named', label: '只看有名有姓' },
      { key: 'peripheral', label: '只看旁及' }
    ];
    return options.map((option) => `
      <button class="chapter-filter-mini ${this.characterTierFilter === option.key ? 'active' : ''}" data-character-tier="${option.key}">${option.label}</button>
    `).join('');
  }

  _renderSourceFilter() {
    const options = [
      { key: 'all', label: '全部来源' },
      { key: 'direct', label: '回目直指' },
      { key: 'knowledge', label: '同回知识' },
      { key: 'keyword', label: '规则补全' },
      { key: 'chapterRecord', label: '章节档案' },
      { key: 'textMention', label: '文本提及' }
    ];
    return options.map((option) => `
      <button class="chapter-filter-mini ${this.sourceFilter === option.key ? 'active' : ''}" data-source-filter="${option.key}">${option.label}</button>
    `).join('');
  }

  _applySourceFilter(items = []) {
    if (this.sourceFilter === 'all') return items;
    return items.filter((item) => (item.sources || []).includes(this.sourceFilter));
  }

  _renderKnowledgeLinkCard(item) {
    const config = this.categoryConfig[item.category] || this.categoryConfig['其他'];
    const relatedCharacters = (item.relatedCharacters || [])
      .map((id) => this.characterMap.get(id))
      .filter(Boolean)
      .slice(0, 4);

    return `
      <article class="chapter-knowledge-card">
        <div class="chapter-knowledge-head">
          <span class="chapter-knowledge-icon" style="background:${config.color}15;color:${config.color}">${config.icon}</span>
          <div>
            <div class="chapter-knowledge-title">${this._escapeHtml(item.title || '')}</div>
            <div class="chapter-knowledge-meta">
              <span style="color:${config.color}">${this._escapeHtml(item.category || '其他')}</span>
              ${item.subcategory ? `<span>${this._escapeHtml(item.subcategory)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="chapter-knowledge-snippet">${this._escapeHtml(this._truncate(item.analysis || item.content || '', 120))}</div>
        <div class="chapter-knowledge-footer">
          <div class="chapter-knowledge-chars">
            ${relatedCharacters.map((character) => `<button class="chapter-inline-pill ${this.relatedCharacterIds.has(character.id) ? 'is-related' : ''}" data-char-id="${character.id}">${this._escapeHtml(character.name)}</button>`).join('') || '<span class="chapter-muted">暂无人物标注</span>'}
          </div>
          <button class="chapter-inline-link" data-action="open-knowledge-item" data-chapter="${item.chapter || ''}" data-query="${this._escapeHtmlAttr(item.title || '')}">去知识库查看</button>
        </div>
      </article>
    `;
  }

  _renderEmptyState() {
    return `
      <div class="chapter-empty card-surface">
        <div class="chapter-empty-title">没有匹配的回目</div>
        <div class="chapter-empty-desc">你可以更换关键词，或切回“全部回目”查看完整目录。</div>
      </div>
    `;
  }

  _bindEvents() {
    this._eventsBound = true;

    const searchInput = this.container.querySelector('.chapter-search-input');
    this.searchInput = searchInput;
    if (searchInput) {
      let searchIsComposing = false;
      const handleSearch = (event) => {
        if (searchIsComposing) return;
        window.clearTimeout(this._searchTimer);
        this._searchTimer = window.setTimeout(() => {
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

    this.container.addEventListener('click', (event) => {
      const versionButton = event.target.closest('[data-version]');
      if (versionButton) {
        this.versionFilter = versionButton.dataset.version || 'all';
        this._updateContent();
        return;
      }

      const tierButton = event.target.closest('[data-character-tier]');
      if (tierButton) {
        this.characterTierFilter = tierButton.dataset.characterTier || 'all';
        this._updateContent();
        return;
      }

      const sourceButton = event.target.closest('[data-source-filter]');
      if (sourceButton) {
        this.sourceFilter = sourceButton.dataset.sourceFilter || 'all';
        this._updateContent();
        return;
      }

      const chapterButton = event.target.closest('[data-chapter]');
      if (chapterButton && chapterButton.classList.contains('chapter-directory-item')) {
        this.activeChapter = Number(chapterButton.dataset.chapter);
        this._updateContent();
        this._scrollMainToTop();
        return;
      }

      const jumpButton = event.target.closest('[data-jump-chapter]');
      if (jumpButton) {
        this.activeChapter = Number(jumpButton.dataset.jumpChapter);
        this._updateContent();
        this._scrollMainToTop();
        return;
      }

      const characterButton = event.target.closest('[data-char-id]');
      if (characterButton) {
        const charId = characterButton.dataset.charId;
        if (charId && this.onCharacterClick) this.onCharacterClick(charId);
        return;
      }

      const tagButton = event.target.closest('[data-tag]');
      if (tagButton) {
        const tag = tagButton.dataset.tag || '';
        if (!tag) return;
        if (this.onTagClick) this.onTagClick({ type: 'tag', value: tag, view: 'chapter' });
        if (this.onKnowledgeNavigate) this.onKnowledgeNavigate({ chapter: this.activeChapter, query: tag });
        return;
      }

      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;
      if (actionButton.dataset.action === 'open-knowledge' && this.onKnowledgeNavigate) {
        this.onKnowledgeNavigate({ chapter: Number(actionButton.dataset.chapter) || this.activeChapter, query: '' });
      }
      if (actionButton.dataset.action === 'open-knowledge-item' && this.onKnowledgeNavigate) {
        this.onKnowledgeNavigate({
          chapter: Number(actionButton.dataset.chapter) || this.activeChapter,
          query: actionButton.dataset.query || ''
        });
      }
    });
  }

  _buildChapterProfiles() {
    this.chapterEntries = this.knowledge
      .filter((item) => item.category === '回目知识' || item.category === '回目知识点')
      .sort((a, b) => (a.chapter || 999) - (b.chapter || 999));

    this.chapterProfiles = this.chapterEntries.map((entry) => this._buildChapterProfile(entry));
    this.chapterProfileMap = new Map(this.chapterProfiles.map((profile) => [profile.chapter, profile]));
  }

  _buildChapterProfile(entry) {
    const relatedKnowledge = this.knowledge
      .filter((item) => item.chapter === entry.chapter && item.id !== entry.id && item.category !== '回目知识' && item.category !== '回目知识点')
      .sort((a, b) => {
        const aCharacters = (a.relatedCharacters || []).length;
        const bCharacters = (b.relatedCharacters || []).length;
        return bCharacters - aCharacters || (a.title || '').localeCompare(b.title || '', 'zh-Hans-CN');
      });

    const characterEvidence = new Map();
    const parsed = this._parseChapterEntry(entry);
    const baseTexts = [
      entry.title || '',
      entry.content || '',
      ...(entry.tags || []),
      ...relatedKnowledge.flatMap((item) => [item.title || '', ...(item.tags || []), ...(item.relatedEvents || [])])
    ].join(' ');

    (entry.relatedCharacters || []).forEach((characterId) => {
      this._pushCharacterEvidence(characterEvidence, characterId, '回目直连', 3);
    });

    relatedKnowledge.forEach((item) => {
      (item.relatedCharacters || []).forEach((characterId) => {
        this._pushCharacterEvidence(characterEvidence, characterId, item.title || item.category || '同回知识', 2);
      });
    });

    this._inferCharactersFromChapterMetadata(entry, characterEvidence, parsed);

    this.characters.forEach((character) => {
      const aliases = [character.name, ...(character.alias || [])].filter((term) => term && String(term).length >= 2);
      const hitTerm = aliases.find((term) => baseTexts.includes(term));
      if (hitTerm) this._pushCharacterEvidence(characterEvidence, character.id, `文本提及：${hitTerm}`, 1);
    });

    const characters = Array.from(characterEvidence.entries())
      .map(([characterId, detail]) => ({
        character: this.characterMap.get(characterId),
        score: detail.score,
        evidence: Array.from(detail.evidence),
        sources: Array.from(detail.sources || [])
      }))
      .filter((item) => item.character)
      .sort((a, b) => b.score - a.score || (b.character.importance || 0) - (a.character.importance || 0) || a.character.name.localeCompare(b.character.name, 'zh-Hans-CN'));

    return {
      chapter: entry.chapter,
      entry,
      version: entry.version || (entry.chapter > 80 ? 'continuation' : 'original'),
      titleShort: parsed.titleShort,
      parsed,
      relatedKnowledge,
      characters,
      characterCount: characters.length
    };
  }

  _pushCharacterEvidence(store, characterId, label, score = 1) {
    if (!characterId || !this.characterMap.has(characterId)) return;
    if (!store.has(characterId)) {
      store.set(characterId, { score: 0, evidence: new Set(), sources: new Set() });
    }
    const current = store.get(characterId);
    current.score += score;
    if (label) current.evidence.add(label);
    current.sources.add(this._classifyEvidenceSource(label));
  }

  _classifyEvidenceSource(label = '') {
    const text = String(label || '');
    if (text.startsWith('回目直连')) return 'direct';
    if (text.startsWith('回目线索')) return 'keyword';
    if (text.startsWith('人物章节档案')) return 'chapterRecord';
    if (text.startsWith('文本提及')) return 'textMention';
    return 'knowledge';
  }

  _summarizeCharacterSources(item) {
    const sourceMeta = {
      direct: { label: '回目直指', className: 'is-direct' },
      knowledge: { label: '同回知识', className: 'is-knowledge' },
      keyword: { label: '回目规则补全', className: 'is-keyword' },
      chapterRecord: { label: '人物章节档案', className: 'is-record' },
      textMention: { label: '文本提及', className: 'is-text' }
    };
    return (item.sources || [])
      .map((source) => sourceMeta[source])
      .filter(Boolean)
      .slice(0, 3);
  }

  _groupCharactersByTier(characters = []) {
    const groups = { main: [], named: [], peripheral: [] };
    characters.forEach((item) => {
      const importance = item.character?.importance || 1;
      const hasDirectSignal = (item.sources || []).some((source) => ['direct', 'knowledge'].includes(source));
      const hasNamedSignal = (item.sources || []).some((source) => ['keyword', 'chapterRecord', 'textMention'].includes(source));

      if (importance >= 4 || (importance >= 3 && hasDirectSignal)) {
        groups.main.push(item);
      } else if (hasNamedSignal || importance >= 2) {
        groups.named.push(item);
      } else {
        groups.peripheral.push(item);
      }
    });
    return groups;
  }

  _inferCharactersFromChapterMetadata(entry, store, parsed = null) {
    const sourceTerms = [
      ...(entry.tags || []),
      ...((parsed || this._parseChapterEntry(entry)).points || []),
      entry.title || ''
    ].filter(Boolean);

    const specialCases = [
      { pattern: /金寡妇/, ids: ['jin_guafu'] },
      { pattern: /张太医/, ids: ['zhang_taiyi'] },
      { pattern: /鲍二家的/, ids: ['bao_er_jias'] },
      { pattern: /多姑娘/, ids: ['duo_guniang'] },
      { pattern: /张道士/, ids: ['zhang_daoshi'] },
      { pattern: /佳蕙/, ids: ['jia_hui'] },
      { pattern: /乌进孝/, ids: ['wu_jinxiao'] },
      { pattern: /来旺妇/, ids: ['laiwang_furen'] },
      { pattern: /老学究/, ids: ['old_xuejiu'] },
      { pattern: /甄家仆/, ids: ['zhenjia_servant'] },
      { pattern: /赖尚荣家/, ids: ['lai_da'] },
      { pattern: /胡庸医/, ids: ['hu_yongyi'] },
      { pattern: /宝蟾/, ids: ['bao_chan'] },
      { pattern: /五儿/, ids: ['wu_er'] },
      { pattern: /秋桐/, ids: ['qiutong'] },
      { pattern: /藕官/, ids: ['ouguan'] },
      { pattern: /菂官/, ids: ['diguan'] },
      { pattern: /甄应嘉/, ids: ['zhen_yingjia'] },
      { pattern: /宝黛/, ids: ['jia_baoyu', 'lin_daiyu'] },
      { pattern: /钗黛/, ids: ['xue_baochai', 'lin_daiyu'] },
      { pattern: /宁国府除夕祭宗祠/, ids: ['jia_zhen', 'you_shi'] },
      { pattern: /荣国府元宵开夜宴/, ids: ['jia_mu'] },
      { pattern: /承包制|大观园改革|开源节流/, ids: ['li_wan'] },
      { pattern: /薛家官司|人命案|放流刑/, ids: ['xue_yima'] },
      { pattern: /妙玉抚琴|走火入魔|深秋感怀/, ids: ['lin_daiyu'] },
      { pattern: /薛蝌岫烟婚事|失绵衣|贫女/, ids: ['xue_yima'] },
      { pattern: /巧姐读列女传|慕贤良/, ids: ['wang_xifeng'] },
      { pattern: /仆投贾家|甄府败落/, ids: ['jia_zheng', 'wang_furen'] },
      { pattern: /海棠花开妖|花妖/, ids: ['wang_furen'] },
      { pattern: /假玉混真|元妃薨逝/, ids: ['wang_furen'] },
      { pattern: /凤姐设调包计|机关泄露/, ids: ['jia_baoyu'] },
      { pattern: /邸报|官场风波/, ids: ['wang_furen', 'jia_mu'] },
      { pattern: /神签|不祥之兆/, ids: ['yuanyang'] },
      { pattern: /驱邪作法|病灾|符水驱妖/, ids: ['you_shi', 'jia_rong'] },
      { pattern: /金桂之死|自焚身/, ids: ['xue_pan', 'bao_chan'] },
      { pattern: /宁国府查封|锦衣卫/, ids: ['you_shi'] },
      { pattern: /消祸|家族困境/, ids: ['jia_zheng'] },
      { pattern: /潇湘馆鬼哭|死缠绵/, ids: ['lin_daiyu', 'jia_baoyu'] },
      { pattern: /候芳魂|错爱/, ids: ['xiren'] },
      { pattern: /寿终|人心离散/, ids: ['jia_zheng'] },
      { pattern: /家奴偷盗|欺天/, ids: ['jia_she'] },
      { pattern: /活冤孽|赴冥曹/, ids: ['wang_furen'] },
      { pattern: /凤姐病死|历幻返金陵/, ids: ['jia_lian'] },
      { pattern: /惜春出家|看破红尘/, ids: ['miaoyu'] },
      { pattern: /送灵|尽孝/, ids: ['jia_zheng', 'xiren'] },
      { pattern: /宝钗生日/, ids: ['xue_baochai'] },
      { pattern: /元妃省亲|元妃送谜/, ids: ['jia_yuanchun'] },
      { pattern: /宝黛吵架|宝黛和解|宝黛斗嘴/, ids: ['jia_baoyu', 'lin_daiyu'] },
      { pattern: /金玉良缘|金玉之说/, ids: ['jia_baoyu', 'xue_baochai', 'lin_daiyu'] },
      { pattern: /平儿救贾琏/, ids: ['pinger', 'jia_lian'] },
      { pattern: /小红遗帕|遗帕传情|小红私会/, ids: ['xiaohong', 'jia_yun'] },
      { pattern: /倪二借钱|醉金刚/, ids: ['ni_er', 'jia_yun'] },
      { pattern: /坠儿传话|坠儿/, ids: ['zhui_er'] },
      { pattern: /黛玉葬花|葬花吟/, ids: ['lin_daiyu'] },
      { pattern: /龄官画蔷|龄官/, ids: ['lingguan', 'jia_baoyu'] },
      { pattern: /割腥啖膻|烤鹿肉|脂粉香娃/, ids: ['shi_xiangyun', 'jia_baoyu'] },
      { pattern: /白首双星|金麒麟/, ids: ['shi_xiangyun', 'wei_ruolan'] },
      { pattern: /敏探春/, ids: ['jia_tanchun'] },
      { pattern: /俏平儿|虾须镯/, ids: ['pinger', 'zhui_er', 'qingwen'] },
      { pattern: /夏金桂/, ids: ['xia_jingui'] },
      { pattern: /鲍二/, ids: ['bao_er_jias', 'jia_lian'] },
      { pattern: /来旺妇/, ids: ['laiwang_furen'] }
    ];

    sourceTerms.forEach((term) => {
      specialCases.forEach((rule) => {
        if (rule.pattern.test(term)) {
          rule.ids.forEach((id) => this._pushCharacterEvidence(store, id, `回目线索：${term}`, 2));
        }
      });
    });

    this.characters.forEach((character) => {
      const chapterMentions = (character.chapters || []).filter((chapter) => Number(chapter.chapter) === Number(entry.chapter));
      if (!chapterMentions.length) return;
      const isAlreadyLinked = store.has(character.id);
      const score = isAlreadyLinked ? 1 : 2;
      chapterMentions.forEach((chapterItem) => {
        this._pushCharacterEvidence(store, character.id, `人物章节档案：${chapterItem.summary || `第${entry.chapter}回`}`, score);
      });
    });
  }

  _getVisibleProfiles() {
    const query = this.searchQuery.trim().toLowerCase();
    const visible = this.chapterProfiles.filter((profile) => {
      if (this.versionFilter !== 'all' && profile.version !== this.versionFilter) return false;
      if (!query) return true;

      const haystack = [
        profile.entry.title || '',
        profile.entry.content || '',
        ...(profile.entry.tags || []),
        ...profile.characters.slice(0, 8).map((item) => item.character.name),
        ...profile.relatedKnowledge.slice(0, 8).map((item) => item.title || '')
      ].join(' ').toLowerCase();

      return haystack.includes(query);
    });

    return visible;
  }

  _resolveCurrentProfile(visibleProfiles) {
    if (!visibleProfiles.length) return null;
    const current = visibleProfiles.find((item) => item.chapter === this.activeChapter);
    if (current) return current;
    this.activeChapter = visibleProfiles[0].chapter;
    return visibleProfiles[0];
  }

  _getOverviewStats() {
    const relatedCharacters = new Set();
    let totalKnowledge = 0;
    this.chapterProfiles.forEach((profile) => {
      profile.characters.forEach((item) => relatedCharacters.add(item.character.id));
      totalKnowledge += profile.relatedKnowledge.length;
    });

    const hasContinuation = this.chapterProfiles.some((profile) => profile.version === 'continuation');
    return {
      totalChapters: this.chapterProfiles.length,
      totalCharacters: relatedCharacters.size,
      totalKnowledge,
      versionLabel: hasContinuation ? '前80 / 后40' : '前80回'
    };
  }

  _buildInterpretation(profile, parsed) {
    const pointCount = (parsed.points.length || profile.entry.tags?.length || 0);
    if (profile.characters.length >= 6) {
      return `这一回是人物网络明显扩张的一回：可见 ${profile.characters.length} 位人物被同回知识牵出，适合把它当作阶段性节点来读。`;
    }
    if (pointCount >= 5) {
      return '这一回的知识点密度很高，适合作为情节转折或主题集中章节来回看，并据此追索相关人物。';
    }
    return '这一回更像一枚结构性锚点：先抓住回目与知识点，再向外延展人物和后续情节。';
  }

  _parseChapterEntry(entry) {
    const content = String(entry?.content || '');
    const titleMatch = content.match(/【回目】([^\n]+)/);
    const pointsMatch = content.match(/【主要知识点】([^\n]+)/);
    const summary = titleMatch ? titleMatch[1].trim() : (entry?.title || '');
    const points = pointsMatch
      ? pointsMatch[1].split(/[、，,]/).map((item) => item.trim()).filter(Boolean)
      : [];

    return {
      titleShort: summary.replace(/^第\d+回\s*/, ''),
      summary,
      points
    };
  }

  _syncCharacterHighlights() {
    this.container.querySelectorAll('[data-char-id]').forEach((button) => {
      button.classList.toggle('is-related', this.relatedCharacterIds.has(button.dataset.charId));
    });
  }

  _scrollMainToTop() {
    const main = this.container.querySelector('.chapter-main');
    if (main) main.scrollTo({ top: 0, behavior: 'instant' });
  }

  _truncate(text, limit = 80) {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    if (value.length <= limit) return value;
    return `${value.slice(0, limit)}…`;
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  }

  _escapeHtmlAttr(str) {
    return this._escapeHtml(str).replace(/"/g, '&quot;');
  }

  destroy() {
    this._clearDeferredMainRender();
    window.clearTimeout(this._searchTimer);
    this._eventsBound = false;
    this.searchInput = null;
    this.container.innerHTML = '';
  }
}
