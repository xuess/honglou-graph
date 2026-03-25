class RelationshipGraph {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      nodeMinRadius: 8,
      nodeMaxRadius: 28,
      linkDistance: 120,
      chargeStrength: -240,
      collisionPadding: 10,
      labelVisibilityMode: 'smart',
      ...options
    };

    this.characters = [];
    this.relationships = [];
    this.nodes = [];
    this.links = [];
    this.simulation = null;
    this.svg = null;
    this.g = null;
    this.zoom = null;

    this.selectedNode = null;
    this.focusMode = false;
    this.focusNodeId = null;
    this.interactionMode = 'reading';
    this.activeRelationTypes = new Set(['blood', 'marriage', 'master_servant', 'romance', 'social', 'rivalry']);
    this.activeFamilies = new Set();
    this.showLabels = true;
    this.currentVisibleNodeIds = new Set();
    this.currentVisibleLinkKeys = new Set();
    this._highlightRaf = null;
    this._resizeTimer = null;
    this._tooltipEl = null;

    this.familyColors = {
      '贾家': '#C0392B',
      '史家': '#2980B9',
      '王家': '#27AE60',
      '薛家': '#8E44AD',
      '林家': '#16A085',
      '其他': '#E67E22'
    };

    this.relationColors = {
      blood: '#4A90D9',
      marriage: '#E74C3C',
      master_servant: '#95A5A6',
      romance: '#E91E8C',
      social: '#F39C12',
      rivalry: '#8E44AD'
    };

    this.relationLabels = {
      blood: '血缘',
      marriage: '婚姻',
      master_servant: '主仆',
      romance: '情感',
      social: '社交',
      rivalry: '敌对'
    };

    this.familyCenters = {
      '贾家': [0.36, 0.42],
      '史家': [0.2, 0.24],
      '王家': [0.2, 0.72],
      '薛家': [0.72, 0.72],
      '林家': [0.78, 0.24],
      '其他': [0.88, 0.48]
    };

    this.onNodeClick = null;
    this.onNodeDblClick = null;
    this.onBackgroundClick = null;

    this._init();
  }

  _init() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`);

    const defs = this.svg.append('defs');
    const filter = defs.append('filter').attr('id', 'soft-glow');
    filter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'coloredBlur');
    const merge = filter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'coloredBlur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    this.zoom = d3.zoom()
      .scaleExtent([0.5, 4])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });

    this.svg.call(this.zoom);
    this.g = this.svg.append('g');
    this.linkGroup = this.g.append('g').attr('class', 'links');
    this.linkLabelGroup = this.g.append('g').attr('class', 'link-labels');
    this.nodeGroup = this.g.append('g').attr('class', 'nodes');

    this._tooltipEl = document.createElement('div');
    this._tooltipEl.className = 'tooltip';
    document.body.appendChild(this._tooltipEl);

    this._resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(this._resizeTimer);
      this._resizeTimer = window.setTimeout(() => this._onResize(), 200);
    });
    this._resizeObserver.observe(this.container);
  }

  _onResize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);

    if (this.simulation) {
      this._applyFamilyForces();
      this.simulation.force('center', d3.forceCenter(this.width / 2, this.height / 2));
      this._warmSimulation(0.18);
      this._coolDownSimulation();
    }
  }

  setData(characters, relationships) {
    this.characters = characters;
    this.relationships = relationships;
    this.characterMap = new Map();
    characters.forEach(c => this.characterMap.set(c.id, c));
    this.activeFamilies = new Set(characters.map(c => this._getFamilyGroup(c)));

    this._buildGraph();
    this._render();
    this._setupSimulation();
    this.resetAllFilters();
    this.showImportantOverview();
  }

  _getFamilyGroup(character) {
    return this.familyColors[character.family] ? character.family : '其他';
  }

  _getNodeColor(character) {
    return this.familyColors[this._getFamilyGroup(character)] || this.familyColors['其他'];
  }

  _getNodeRadius(character) {
    const { nodeMinRadius, nodeMaxRadius } = this.options;
    const scale = ((character.importance || 1) - 1) / 4;
    return nodeMinRadius + scale * (nodeMaxRadius - nodeMinRadius);
  }

  _buildGraph() {
    this.nodes = this.characters.map(character => {
      const family = this._getFamilyGroup(character);
      const [xRatio, yRatio] = this.familyCenters[family] || this.familyCenters['其他'];
      const importanceShift = (character.importance || 1) * 8;
      return {
        id: character.id,
        character,
        family,
        radius: this._getNodeRadius(character),
        color: this._getNodeColor(character),
        x: this.width * xRatio + (Math.random() - 0.5) * 60 - importanceShift,
        y: this.height * yRatio + (Math.random() - 0.5) * 60 + importanceShift / 2
      };
    });

    const nodeIds = new Set(this.nodes.map(n => n.id));
    this.links = this.relationships
      .filter(rel => nodeIds.has(rel.source) && nodeIds.has(rel.target))
      .map(rel => ({
        source: rel.source,
        target: rel.target,
        type: rel.type,
        label: rel.label,
        description: rel.description,
        color: this.relationColors[rel.type] || '#999',
        key: `${rel.source}-${rel.target}-${rel.type}`
      }));
  }

  _setupSimulation() {
    if (this.simulation) this.simulation.stop();

    this.simulation = d3.forceSimulation(this.nodes)
      .force('link', d3.forceLink(this.links)
        .id(d => d.id)
        .distance(d => {
          if (d.type === 'blood' || d.type === 'marriage') return this.options.linkDistance * 0.82;
          if (d.type === 'master_servant') return this.options.linkDistance * 1.08;
          return this.options.linkDistance;
        })
        .strength(d => (d.type === 'blood' || d.type === 'marriage') ? 0.2 : 0.12)
      )
      .force('charge', d3.forceManyBody().strength(d => this.options.chargeStrength * (0.4 + d.character.importance * 0.12)))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide().radius(d => d.radius + this.options.collisionPadding))
      .on('tick', () => this._onTick());

    this._applyFamilyForces();
    this._warmSimulation(0.45);
  }

  _applyFamilyForces() {
    this.simulation
      .force('familyX', d3.forceX(d => this.width * (this.familyCenters[d.family]?.[0] || 0.5)).strength(this.focusMode ? 0.05 : 0.12))
      .force('familyY', d3.forceY(d => this.height * (this.familyCenters[d.family]?.[1] || 0.5)).strength(this.focusMode ? 0.05 : 0.12));
  }

  _warmSimulation(alpha = 0.22) {
    if (!this.simulation) return;
    this.simulation.alpha(alpha).restart();
  }

  _coolDownSimulation(delay = 900) {
    window.clearTimeout(this._coolDownTimer);
    this._coolDownTimer = window.setTimeout(() => {
      if (!this.simulation) return;
      this.simulation.alphaTarget(0);
    }, delay);
  }

  _render() {
    this.linkElements = this.linkGroup
      .selectAll('.link-line')
      .data(this.links, d => d.key)
      .join(
        enter => enter.append('line')
          .attr('class', 'link-line')
          .attr('stroke', d => d.color)
          .attr('stroke-width', d => (d.type === 'blood' || d.type === 'marriage') ? 2.2 : 1.6)
          .attr('stroke-dasharray', d => {
            if (d.type === 'romance') return '6,3';
            if (d.type === 'rivalry') return '3,5';
            if (d.type === 'social') return '8,5';
            return 'none';
          }),
        update => update,
        exit => exit.remove()
      );

    this.linkLabelElements = this.linkLabelGroup
      .selectAll('.link-label')
      .data(this.links, d => d.key)
      .join(
        enter => enter.append('text')
          .attr('class', 'link-label')
          .text(d => d.label),
        update => update.text(d => d.label),
        exit => exit.remove()
      );

    const nodeGroups = this.nodeGroup
      .selectAll('.node-group')
      .data(this.nodes, d => d.id)
      .join(
        enter => {
          const group = enter.append('g')
            .attr('class', d => `node-group family-${d.family}`)
            .call(this._drag());

          group.append('circle')
            .attr('class', 'node-circle')
            .attr('r', d => d.radius)
            .attr('fill', d => d.color)
            .attr('filter', d => d.character.importance >= 5 ? 'url(#soft-glow)' : null);

          group.append('text')
            .attr('class', 'node-text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('fill', 'white')
            .attr('font-size', d => `${Math.max(d.radius * 0.72, 8)}px`)
            .attr('font-family', "'ZCOOL XiaoWei', 'Noto Serif SC', serif")
            .attr('font-weight', '700')
            .attr('pointer-events', 'none')
            .text(d => d.character.name.length <= 2 ? d.character.name : d.character.name.substring(0, d.radius >= 20 ? 2 : 1));

          group.append('text')
            .attr('class', d => `node-label importance-${d.character.importance}`)
            .attr('dy', d => d.radius + 15)
            .text(d => d.character.name);

          group.on('click', (event, d) => {
            event.stopPropagation();
            this._selectNode(d);
            if (this.onNodeClick) this.onNodeClick(d.character);
          })
          .on('dblclick', (event, d) => {
            event.stopPropagation();
            event.preventDefault();
            if (this.onNodeDblClick) this.onNodeDblClick(d.character);
          })
          .on('mouseenter', (event, d) => {
            if (this._highlightRaf) return;
            this._highlightRaf = window.requestAnimationFrame(() => {
              this._highlightConnected(d);
              this._showTooltip(event, d);
              this._highlightRaf = null;
            });
          })
          .on('mouseleave', (event, d) => {
            if (this._highlightRaf) {
              window.cancelAnimationFrame(this._highlightRaf);
              this._highlightRaf = null;
            }
            if (!this.selectedNode) this._clearHighlight();
            this._hideTooltip();
          });

          return group;
        },
        update => update,
        exit => exit.remove()
      );

    this.nodeElements = nodeGroups;

    this.svg.on('click', () => {
      this._selectNode(null);
      this._clearHighlight();
      if (this.onBackgroundClick) this.onBackgroundClick();
    });
  }

  _onTick() {
    const visibleNodeIds = this.currentVisibleNodeIds;
    const visibleLinkKeys = this.currentVisibleLinkKeys;
    const hasVisibilityFilter = visibleNodeIds.size > 0 || visibleLinkKeys.size > 0;

    this.linkElements.each(function(d) {
      if (!hasVisibilityFilter || visibleLinkKeys.has(d.key)) {
        d3.select(this)
          .attr('x1', d.source.x)
          .attr('y1', d.source.y)
          .attr('x2', d.target.x)
          .attr('y2', d.target.y);
      }
    });

    this.linkLabelElements.each(function(d) {
      if (!hasVisibilityFilter || visibleLinkKeys.has(d.key)) {
        d3.select(this)
          .attr('x', (d.source.x + d.target.x) / 2)
          .attr('y', (d.source.y + d.target.y) / 2);
      }
    });

    this.nodeElements.each(function(d) {
      if (!hasVisibilityFilter || visibleNodeIds.has(d.id)) {
        d3.select(this).attr('transform', `translate(${d.x},${d.y})`);
      }
    });
  }

  _drag() {
    return d3.drag()
      .on('start', (event, d) => {
        if (!event.active) {
          this.simulation.alphaTarget(0.16);
          this._warmSimulation(0.18);
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) this._coolDownSimulation(700);
        d.fx = null;
        d.fy = null;
      });
  }

  _getLinkKey(link) {
    return link.key || `${link.source.id || link.source}-${link.target.id || link.target}-${link.type}`;
  }

  _getConnectedIds(nodeId, includeSecondDegree = false) {
    const connected = new Set([nodeId]);
    const firstDegree = new Set();

    this.links.forEach(link => {
      const sourceId = link.source.id || link.source;
      const targetId = link.target.id || link.target;
      if (sourceId === nodeId) firstDegree.add(targetId);
      if (targetId === nodeId) firstDegree.add(sourceId);
    });

    firstDegree.forEach(id => connected.add(id));

    if (includeSecondDegree) {
      this.links.forEach(link => {
        const sourceId = link.source.id || link.source;
        const targetId = link.target.id || link.target;
        if (firstDegree.has(sourceId)) connected.add(targetId);
        if (firstDegree.has(targetId)) connected.add(sourceId);
      });
    }

    return connected;
  }

  _highlightConnected(node) {
    const connectedIds = this._getConnectedIds(node.id, false);
    this.nodeElements
      .classed('dimmed', d => !connectedIds.has(d.id))
      .classed('highlighted', d => connectedIds.has(d.id));

    this.linkElements
      .classed('dimmed', d => {
        const sourceId = d.source.id || d.source;
        const targetId = d.target.id || d.target;
        return sourceId !== node.id && targetId !== node.id;
      })
      .classed('highlighted', d => {
        const sourceId = d.source.id || d.source;
        const targetId = d.target.id || d.target;
        return sourceId === node.id || targetId === node.id;
      });

    this.linkLabelElements.classed('visible', d => {
      const sourceId = d.source.id || d.source;
      const targetId = d.target.id || d.target;
      return sourceId === node.id || targetId === node.id;
    });
  }

  _clearHighlight() {
    this.nodeElements.classed('dimmed', false).classed('highlighted', false);
    this.linkElements.classed('dimmed', false).classed('highlighted', false);
    this._updateLabelVisibility();
  }

  _selectNode(node) {
    this.selectedNode = node;
    this.nodeElements.selectAll('.node-circle').classed('selected', d => node && d.id === node.id);
    if (node) this._highlightConnected(node);
    else this._clearHighlight();
  }

  selectNodes(nodeIds = []) {
    const idSet = new Set(nodeIds);
    this.selectedNode = null;
    this.nodeElements.selectAll('.node-circle').classed('selected', d => idSet.has(d.id));
    this.nodeElements
      .classed('dimmed', d => nodeIds.length > 0 && !idSet.has(d.id))
      .classed('highlighted', d => idSet.has(d.id));

    this.linkElements
      .classed('dimmed', d => {
        if (!nodeIds.length) return false;
        const sourceId = d.source.id || d.source;
        const targetId = d.target.id || d.target;
        return !(idSet.has(sourceId) && idSet.has(targetId));
      })
      .classed('highlighted', d => {
        const sourceId = d.source.id || d.source;
        const targetId = d.target.id || d.target;
        return idSet.has(sourceId) && idSet.has(targetId);
      });

    this.linkLabelElements.classed('visible', d => {
      const sourceId = d.source.id || d.source;
      const targetId = d.target.id || d.target;
      return idSet.has(sourceId) && idSet.has(targetId);
    });
  }

  _showTooltip(event, node) {
    if (!this._tooltipEl) return;

    this._tooltipEl.innerHTML = `<strong>${node.character.name}</strong><br>${node.character.identity}`;
    this._tooltipEl.classList.add('visible');

    const x = event.pageX;
    const y = event.pageY;
    this._tooltipEl.style.transform = `translate(${x}px, ${y - 52}px) translateX(-50%)`;
  }

  _hideTooltip() {
    if (this._tooltipEl) this._tooltipEl.classList.remove('visible');
  }

  _setVisibility(nodeIds, linkKeys, { centerId = null } = {}) {
    this.currentVisibleNodeIds = new Set(nodeIds);
    this.currentVisibleLinkKeys = new Set(linkKeys);

    this.nodeElements.style('display', d => this.currentVisibleNodeIds.has(d.id) ? null : 'none');
    this.linkElements.style('display', d => this.currentVisibleLinkKeys.has(this._getLinkKey(d)) ? null : 'none');
    this.linkLabelElements.style('display', d => this.currentVisibleLinkKeys.has(this._getLinkKey(d)) ? null : 'none');

    this._updateLabelVisibility();

    if (centerId) {
      const focusNode = this.nodes.find(node => node.id === centerId);
      if (focusNode) this._centerOnNode(focusNode, this.interactionMode === 'explore' ? 1.2 : 1.55);
    }
  }

  _getVisibleNodes() {
    return this.nodes.filter(node => this.currentVisibleNodeIds.has(node.id));
  }

  fitVisibleGraph({ padding = 72, maxScale = 1.08, minScale = 0.62, duration = 520 } = {}) {
    const visibleNodes = this._getVisibleNodes();
    if (!visibleNodes.length) {
      this.resetView();
      return;
    }

    if (visibleNodes.length === 1) {
      this._centerOnNode(visibleNodes[0], Math.min(maxScale, 1.45));
      return;
    }

    const bounds = visibleNodes.reduce((acc, node) => {
      acc.minX = Math.min(acc.minX, node.x - node.radius);
      acc.maxX = Math.max(acc.maxX, node.x + node.radius);
      acc.minY = Math.min(acc.minY, node.y - node.radius);
      acc.maxY = Math.max(acc.maxY, node.y + node.radius);
      return acc;
    }, {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity
    });

    const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
    const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);
    const contentWidth = Math.max(this.width - padding * 2, this.width * 0.45);
    const contentHeight = Math.max(this.height - padding * 2, this.height * 0.45);
    const scale = Math.max(minScale, Math.min(maxScale, contentWidth / boundsWidth, contentHeight / boundsHeight));
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const transform = d3.zoomIdentity
      .translate(this.width / 2, this.height / 2)
      .scale(scale)
      .translate(-centerX, -centerY);

    this.svg.interrupt().transition().duration(duration).call(this.zoom.transform, transform);
  }

  _collectLinksForNodeSet(nodeIds) {
    const keys = new Set();
    this.links.forEach(link => {
      const sourceId = link.source.id || link.source;
      const targetId = link.target.id || link.target;
      if (nodeIds.has(sourceId) && nodeIds.has(targetId) && this.activeRelationTypes.has(link.type)) {
        keys.add(this._getLinkKey(link));
      }
    });
    return keys;
  }

  setInteractionMode(mode) {
    this.interactionMode = mode;
    this._updateLabelVisibility();
  }

  setDefaultReadingFilter() {
    this.activeRelationTypes = new Set(['blood', 'marriage', 'romance']);
    this.activeFamilies = new Set(Object.keys(this.familyColors));
  }

  resetAllFilters() {
    this.activeRelationTypes = new Set(['blood', 'marriage', 'master_servant', 'romance', 'social', 'rivalry']);
    this.activeFamilies = new Set(Object.keys(this.familyColors));
  }

  showImportantOverview() {
    const important = this.nodes.filter(node => (node.character.importance || 1) >= 4);
    const nodeIds = new Set(important.map(node => node.id));
    const linkKeys = this._collectLinksForNodeSet(nodeIds);
    this._setVisibility(nodeIds, linkKeys, { centerId: 'jia_baoyu' });
    this._selectNode(null);
    this.fitVisibleGraph({ padding: 52, maxScale: 1.2, minScale: 0.78, duration: 420 });
  }

  showFullGraph() {
    const nodeIds = new Set(this.nodes
      .filter(node => this.activeFamilies.has(node.family))
      .map(node => node.id));
    const linkKeys = this._collectLinksForNodeSet(nodeIds);
    this._setVisibility(nodeIds, linkKeys);
    this._selectNode(null);
    this.fitVisibleGraph({ padding: 44, maxScale: 1.08, minScale: 0.72, duration: 520 });
  }

  showNeighborhood(characterId, options = {}) {
    const nodeIds = this._getConnectedIds(characterId, options.includeSecondDegree);
    const linkKeys = this._collectLinksForNodeSet(nodeIds);
    this._setVisibility(nodeIds, linkKeys, { centerId: options.center ? characterId : null });
    const node = this.nodes.find(item => item.id === characterId);
    if (node) this._selectNode(node);
  }

  showCharacterSet(characterIds, { centerId = null } = {}) {
    const nodeIds = new Set(characterIds);
    const linkKeys = this._collectLinksForNodeSet(nodeIds);
    this._setVisibility(nodeIds, linkKeys, { centerId });
    this._selectNode(centerId ? this.nodes.find(item => item.id === centerId) : null);
  }

  enterFocusMode(characterId) {
    this.focusMode = true;
    this.focusNodeId = characterId;
    this.showNeighborhood(characterId, { center: true, includeSecondDegree: true });
    if (this.simulation) this.simulation.alphaTarget(0.04);
    this._warmSimulation(0.14);
    this._coolDownSimulation(700);
  }

  exitFocusMode() {
    this.focusMode = false;
    this.focusNodeId = null;
    if (this.simulation) this.simulation.alphaTarget(0);
    this._selectNode(null);
  }

  _centerOnNode(node, scale = 1.4) {
    const transform = d3.zoomIdentity
      .translate(this.width / 2, this.height / 2)
      .scale(scale)
      .translate(-node.x, -node.y);

    this.svg.interrupt().transition().duration(600).call(this.zoom.transform, transform);
  }

  focusOnNode(characterId) {
    const node = this.nodes.find(item => item.id === characterId);
    if (!node) return;
    this._centerOnNode(node, 1.8);
    this._selectNode(node);
  }

  resetView() {
    this.svg.interrupt().transition().duration(450).call(this.zoom.transform, d3.zoomIdentity);
  }

  zoomIn() {
    this.svg.interrupt().transition().duration(250).call(this.zoom.scaleBy, 1.2);
  }

  zoomOut() {
    this.svg.interrupt().transition().duration(250).call(this.zoom.scaleBy, 0.85);
  }

  toggleRelationType(type) {
    if (this.activeRelationTypes.has(type)) this.activeRelationTypes.delete(type);
    else this.activeRelationTypes.add(type);
    this._applyFilters();
  }

  toggleFamily(family) {
    if (this.activeFamilies.has(family)) this.activeFamilies.delete(family);
    else this.activeFamilies.add(family);
    this._applyFilters();
  }

  _applyFilters() {
    if (this.focusMode && this.focusNodeId) {
      this.showNeighborhood(this.focusNodeId, { center: false, includeSecondDegree: true });
      return;
    }

    if (this.interactionMode === 'explore') {
      this.showFullGraph();
      return;
    }

    if (this.selectedNode) {
      this.showNeighborhood(this.selectedNode.id, { center: false, includeSecondDegree: false });
      return;
    }

    this.showImportantOverview();
  }

  _updateLabelVisibility() {
    const visibleIds = this.currentVisibleNodeIds;
    const shouldSmartShow = (node) => {
      if (!this.showLabels) return false;
      if (this.interactionMode === 'explore') return node.character.importance >= 4 || visibleIds.size <= 18;
      return node.character.importance >= 3 || visibleIds.size <= 12;
    };

    this.nodeElements.selectAll('.node-label').style('display', d => shouldSmartShow(d) ? null : 'none');

    this.linkLabelElements
      .classed('visible', d => {
        if (!this.showLabels) return false;
        if (this.selectedNode) {
          const sourceId = d.source.id || d.source;
          const targetId = d.target.id || d.target;
          return sourceId === this.selectedNode.id || targetId === this.selectedNode.id;
        }
        return this.currentVisibleLinkKeys.size <= 10;
      });
  }

  toggleLabels() {
    this.showLabels = !this.showLabels;
    this._updateLabelVisibility();
    return this.showLabels;
  }

  highlightSearch(query) {
    if (!query) {
      this._clearHighlight();
      return [];
    }

    const matches = this.nodes.filter(node => {
      const haystack = [node.character.name, ...(node.character.alias || []), node.character.identity, node.character.family].join(' ').toLowerCase();
      return haystack.includes(query.toLowerCase());
    }).map(node => node.character);

    if (matches.length) {
      const ids = new Set(matches.map(match => match.id));
      this.nodeElements.classed('dimmed', d => !ids.has(d.id)).classed('highlighted', d => ids.has(d.id));
      this.linkElements.classed('dimmed', true);
    }

    return matches;
  }

  getCharacterRelations(characterId) {
    return this.relationships
      .filter(rel => {
        const sourceId = typeof rel.source === 'string' ? rel.source : rel.source.id;
        const targetId = typeof rel.target === 'string' ? rel.target : rel.target.id;
        return sourceId === characterId || targetId === characterId;
      })
      .map(rel => {
        const sourceId = typeof rel.source === 'string' ? rel.source : rel.source.id;
        const targetId = typeof rel.target === 'string' ? rel.target : rel.target.id;
        const otherId = sourceId === characterId ? targetId : sourceId;
        return {
          character: this.characterMap.get(otherId),
          type: rel.type,
          label: rel.label,
          description: rel.description
        };
      })
      .filter(item => item.character);
  }

  getStats() {
    const familyCounts = {};
    this.characters.forEach(character => {
      const family = this._getFamilyGroup(character);
      familyCounts[family] = (familyCounts[family] || 0) + 1;
    });

    const relationCounts = {};
    this.relationships.forEach(rel => {
      relationCounts[rel.type] = (relationCounts[rel.type] || 0) + 1;
    });

    return {
      totalCharacters: this.characters.length,
      totalRelationships: this.relationships.length,
      familyCounts,
      relationCounts
    };
  }

  destroy() {
    window.clearTimeout(this._coolDownTimer);
    window.clearTimeout(this._resizeTimer);
    if (this._highlightRaf) window.cancelAnimationFrame(this._highlightRaf);
    if (this.simulation) this.simulation.stop();
    if (this._resizeObserver) this._resizeObserver.disconnect();
    if (this._tooltipEl) this._tooltipEl.remove();
    this.svg.remove();
  }
}
