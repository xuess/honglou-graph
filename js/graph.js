class RelationshipGraph {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      nodeMinRadius: 10,
      nodeMaxRadius: 36,
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
    this.importanceThreshold = 4;
    this.showLabels = true;
    this.currentVisibleNodeIds = new Set();
    this.currentVisibleLinkKeys = new Set();
    this._highlightRaf = null;
    this._resizeTimer = null;
    this._tooltipEl = null;
    this._tickPending = false;
    this._subSimulationMode = false;
    this._linkMap = new Map();
    this._cachedVisibleNodes = [];
    this._searchIndex = [];
    this._simulationPaused = false;
    this._pausedSimulationAlpha = 0;

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
    this.width = rect.width || 800;
    this.height = rect.height || 600;

    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('role', 'img')
      .attr('aria-label', '红楼梦人物关系图谱');

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
        this._updateLinkLabelVisibilityOnZoom(event.transform.k);
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
    if (rect.width === 0 || rect.height === 0) return;
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
    this._linkMap = new Map(this.links.map((link) => [link.key, link]));
    this._searchIndex = this.nodes.map((node) => ({
      node,
      haystack: [node.character.name, ...(node.character.alias || []), node.character.identity, node.character.family].join(' ').toLowerCase()
    }));
  }

  _setupSimulation(nodes = this.nodes, links = this.links) {
    if (this.simulation) this.simulation.stop();

    this.simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links)
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
    if (alpha <= 0.12 && this.simulation.alpha() > alpha) return;
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
            .attr('tabindex', '0')
            .attr('role', 'button')
            .attr('aria-label', d => `${d.character.name}，${d.character.identity || ''}`)
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
          })
          .on('keydown', (event, d) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              this._selectNode(d);
              if (this.onNodeClick) this.onNodeClick(d.character);
            }
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
    if (this._tickPending) return;
    this._tickPending = true;
    
    window.requestAnimationFrame(() => {
      if (!this._tickPending) return;
      this._tickPending = false;
      
      const visibleNodeIds = this.currentVisibleNodeIds;
      const visibleLinkKeys = this.currentVisibleLinkKeys;
      const hasVisibilityFilter = visibleNodeIds.size > 0;

      if (hasVisibilityFilter) {
        // Performance optimization: only update visible elements
        this.linkElements.each(function(d) {
          if (!visibleLinkKeys.has(d.key)) return;
          this.setAttribute('x1', d.source.x);
          this.setAttribute('y1', d.source.y);
          this.setAttribute('x2', d.target.x);
          this.setAttribute('y2', d.target.y);
        });

        this.linkLabelElements.each(function(d) {
          if (!visibleLinkKeys.has(d.key)) return;
          this.setAttribute('x', (d.source.x + d.target.x) / 2);
          this.setAttribute('y', (d.source.y + d.target.y) / 2);
        });

        this.nodeElements.each(function(d) {
          if (!visibleNodeIds.has(d.id)) return;
          this.setAttribute('transform', `translate(${d.x},${d.y})`);
        });
      } else {
        // No filter - update all (but skip hidden ones)
        this.linkElements.each(function(d) {
          if (this.style.display === 'none') return;
          this.setAttribute('x1', d.source.x);
          this.setAttribute('y1', d.source.y);
          this.setAttribute('x2', d.target.x);
          this.setAttribute('y2', d.target.y);
        });

        this.linkLabelElements.each(function(d) {
          if (this.style.display === 'none') return;
          this.setAttribute('x', (d.source.x + d.target.x) / 2);
          this.setAttribute('y', (d.source.y + d.target.y) / 2);
        });

        this.nodeElements.each(function(d) {
          if (this.style.display === 'none') return;
          this.setAttribute('transform', `translate(${d.x},${d.y})`);
        });
      }
    });
  }

  // Enable/disable particle animation on links
  toggleParticles() {
    this._particlesEnabled = !this._particlesEnabled;
    if (this._particlesEnabled) {
      this._startParticleAnimation();
    } else {
      this._stopParticleAnimation();
    }
    return this._particlesEnabled;
  }

  _startParticleAnimation() {
    if (this._particleTimer) return;
    
    // Create particle group if not exists
    if (!this._particleGroup) {
      this._particleGroup = this.g.append('g').attr('class', 'particles');
    }
    
    const animate = () => {
      if (!this._particlesEnabled) return;
      
      // Get visible links
      const visibleLinks = this.links.filter(link => {
        if (this.currentVisibleLinkKeys.size === 0) return true;
        return this.currentVisibleLinkKeys.has(link.key);
      });
      
      // Create particles on random links
      const link = visibleLinks[Math.floor(Math.random() * visibleLinks.length)];
      if (link && link.source.x !== undefined) {
        this._createParticle(link);
      }
      
      this._particleTimer = window.setTimeout(animate, 200 + Math.random() * 300);
    };
    
    animate();
  }

  _stopParticleAnimation() {
    if (this._particleTimer) {
      window.clearTimeout(this._particleTimer);
      this._particleTimer = null;
    }
    if (this._particleGroup) {
      this._particleGroup.selectAll('.particle').remove();
    }
  }

  _createParticle(link) {
    if (!this._particleGroup) return;
    
    const particle = this._particleGroup.append('circle')
      .attr('class', 'particle')
      .attr('r', 3)
      .attr('fill', link.color)
      .attr('opacity', 0.8)
      .attr('cx', link.source.x)
      .attr('cy', link.source.y);
    
    // Animate along the link
    particle.transition()
      .duration(1500)
      .ease(d3.easeLinear)
      .attr('cx', link.target.x)
      .attr('cy', link.target.y)
      .attr('opacity', 0)
      .remove();
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

    const relCount = this._getNodeRelationCount(node.id);
    const stars = '★'.repeat(node.character.importance || 1) + '☆'.repeat(5 - (node.character.importance || 1));
    const family = this._getFamilyGroup(node.character);
    this._tooltipEl.innerHTML = `
      <strong>${node.character.name}</strong>
      <span class="tooltip-identity">${node.character.identity || ''}</span>
      <span class="tooltip-meta">${family} · ${stars} · ${relCount}条关系</span>
    `;
    this._tooltipEl.classList.add('visible');

    const x = event.clientX;
    const y = event.clientY;
    this._tooltipEl.style.transform = `translate(${x}px, ${y - 68}px) translateX(-50%)`;
  }

  _getNodeRelationCount(nodeId) {
    let count = 0;
    for (const link of this.links) {
      const src = link.source.id || link.source;
      const tgt = link.target.id || link.target;
      if (src === nodeId || tgt === nodeId) count++;
    }
    return count;
  }

  _hideTooltip() {
    if (this._tooltipEl) this._tooltipEl.classList.remove('visible');
  }

  _updateLinkLabelVisibilityOnZoom(scale) {
    if (!this.linkLabelElements) return;
    const shouldShow = scale >= 1.5;
    this.linkLabelElements.classed('zoom-visible', shouldShow);
  }

  _setVisibility(nodeIds, linkKeys, { centerId = null } = {}) {
    this.currentVisibleNodeIds = new Set(nodeIds);
    this.currentVisibleLinkKeys = new Set(linkKeys);
    this._cachedVisibleNodes = this.nodes.filter(node => this.currentVisibleNodeIds.has(node.id));

    this.nodeElements.style('display', d => this.currentVisibleNodeIds.has(d.id) ? null : 'none');
    this.linkElements.style('display', d => this.currentVisibleLinkKeys.has(this._getLinkKey(d)) ? null : 'none');
    this.linkLabelElements.style('display', d => this.currentVisibleLinkKeys.has(this._getLinkKey(d)) ? null : 'none');

    this._updateLabelVisibility();
    this._refreshSimulationForVisibleSubset();

    if (centerId) {
      const focusNode = this.nodes.find(node => node.id === centerId);
      if (focusNode) this._centerOnNode(focusNode, this.interactionMode === 'explore' ? 1.2 : 1.55);
    }
  }

  _getVisibleNodes() {
    return this._cachedVisibleNodes.length ? this._cachedVisibleNodes : this.nodes.filter(node => this.currentVisibleNodeIds.has(node.id));
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

  _refreshSimulationForVisibleSubset() {
    const visibleNodes = this.nodes.filter((node) => this.currentVisibleNodeIds.has(node.id));
    const visibleLinks = this.links.filter((link) => this.currentVisibleLinkKeys.has(this._getLinkKey(link)));
    
    const shouldUseSubset = visibleNodes.length > 0 && visibleNodes.length < this.nodes.length * 0.6;
    
    if (shouldUseSubset) {
      if (!this._subSimulationMode) {
        this._subSimulationMode = true;
        this._setupSimulation(visibleNodes, visibleLinks);
        this._warmSimulation(0.15);
      }
      return;
    }
    
    if (this._subSimulationMode) {
      this._subSimulationMode = false;
      this._setupSimulation(this.nodes, this.links);
      this._warmSimulation(0.12);
    }
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
    this.importanceThreshold = 4;
  }

  showImportantOverview() {
    const important = this.nodes.filter(node => (node.character.importance || 1) >= this.importanceThreshold);
    const nodeIds = new Set(important.map(node => node.id));
    const linkKeys = this._collectLinksForNodeSet(nodeIds);
    this._setVisibility(nodeIds, linkKeys, { centerId: 'jia_baoyu' });
    this._selectNode(null);
    this.fitVisibleGraph({ padding: 52, maxScale: 1.2, minScale: 0.78, duration: 420 });
  }

  showFullGraph() {
    const nodeIds = new Set(this.nodes
      .filter(node => this.activeFamilies.has(node.family))
      .filter(node => (node.character.importance || 1) >= this.importanceThreshold)
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

  setImportanceThreshold(threshold = 4) {
    const nextThreshold = Math.max(1, Math.min(5, Number(threshold) || 4));
    this.importanceThreshold = nextThreshold;
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

  // Toggle clustering mode - groups characters by relationship density
  toggleClustering() {
    this._clusteringMode = !this._clusteringMode;
    if (this._clusteringMode) {
      this._applyClusteringForces();
    } else {
      this._applyFamilyForces();
    }
    this._warmSimulation(0.3);
    return this._clusteringMode;
  }

  _applyClusteringForces() {
    if (!this.simulation) return;
    
    // Build adjacency map
    const adjacency = new Map();
    this.nodes.forEach(n => adjacency.set(n.id, new Set()));
    this.links.forEach(link => {
      const srcId = link.source.id || link.source;
      const tgtId = link.target.id || link.target;
      adjacency.get(srcId)?.add(tgtId);
      adjacency.get(tgtId)?.add(srcId);
    });
    
    // Find connected components using BFS
    const visited = new Set();
    const clusters = [];
    this.nodes.forEach(node => {
      if (visited.has(node.id)) return;
      const cluster = [];
      const queue = [node.id];
      while (queue.length) {
        const current = queue.shift();
        if (visited.has(current)) continue;
        visited.add(current);
        cluster.push(current);
        adjacency.get(current)?.forEach(neighbor => {
          if (!visited.has(neighbor)) queue.push(neighbor);
        });
      }
      clusters.push(cluster);
    });
    
    // Assign cluster index to each node
    const nodeCluster = new Map();
    clusters.forEach((cluster, idx) => {
      cluster.forEach(id => nodeCluster.set(id, idx));
    });
    
    // Calculate cluster centers
    const clusterCenters = clusters.map((cluster, idx) => {
      const angle = (2 * Math.PI * idx) / clusters.length;
      const radius = Math.min(this.width, this.height) * 0.3;
      return {
        x: this.width / 2 + Math.cos(angle) * radius,
        y: this.height / 2 + Math.sin(angle) * radius
      };
    });
    
    // Apply cluster forces
    this.simulation
      .force('clusterX', d3.forceX(d => {
        const clusterIdx = nodeCluster.get(d.id) || 0;
        return clusterCenters[clusterIdx]?.x || this.width / 2;
      }).strength(0.15))
      .force('clusterY', d3.forceY(d => {
        const clusterIdx = nodeCluster.get(d.id) || 0;
        return clusterCenters[clusterIdx]?.y || this.height / 2;
      }).strength(0.15));
    
    // Remove family forces
    this.simulation.force('familyX', null).force('familyY', null);
  }

  highlightSearch(query) {
    if (!query) {
      this._clearHighlight();
      return [];
    }

    const normalized = query.toLowerCase();
    const matches = this._searchIndex
      .filter(entry => entry.haystack.includes(normalized))
      .map(entry => entry.node.character);

    if (matches.length) {
      const ids = new Set(matches.map(match => match.id));
      this.nodeElements.classed('dimmed', d => !ids.has(d.id)).classed('highlighted', d => ids.has(d.id));
      this.linkElements.classed('dimmed', true);
    }

    return matches;
  }

  applyFacetSelection(characterIds = []) {
    const ids = new Set(characterIds || []);
    if (!ids.size) {
      this.selectNodes([]);
      return;
    }
    this.selectNodes([...ids]);
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

  previewNode(characterId) {
    const node = this.nodes.find(n => n.id === characterId);
    if (!node) return;
    
    this.nodeElements.classed('preview-dimmed', d => d.id !== characterId);
    this.linkElements.classed('preview-dimmed', d => {
      const srcId = d.source.id || d.source;
      const tgtId = d.target.id || d.target;
      return srcId !== characterId && tgtId !== characterId;
    });
  }

  clearPreview() {
    this.nodeElements.classed('preview-dimmed', false);
    this.linkElements.classed('preview-dimmed', false);
  }

  // Find shortest path between two nodes using BFS
  findShortestPath(startId, endId) {
    if (startId === endId) return [startId];
    
    const visited = new Set([startId]);
    const queue = [[startId]];
    
    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];
      
      // Get neighbors
      for (const link of this.links) {
        const sourceId = link.source.id || link.source;
        const targetId = link.target.id || link.target;
        let neighborId = null;
        
        if (sourceId === current) neighborId = targetId;
        else if (targetId === current) neighborId = sourceId;
        
        if (neighborId && !visited.has(neighborId)) {
          const newPath = [...path, neighborId];
          if (neighborId === endId) return newPath;
          visited.add(neighborId);
          queue.push(newPath);
        }
      }
    }
    
    return null; // No path found
  }

  // Highlight a specific path
  highlightPath(pathNodeIds) {
    if (!pathNodeIds || pathNodeIds.length === 0) {
      this._clearHighlight();
      return;
    }
    
    const pathSet = new Set(pathNodeIds);
    const pathEdges = new Set();
    
    // Find edges that are part of the path
    for (let i = 0; i < pathNodeIds.length - 1; i++) {
      const from = pathNodeIds[i];
      const to = pathNodeIds[i + 1];
      
      for (const link of this.links) {
        const sourceId = link.source.id || link.source;
        const targetId = link.target.id || link.target;
        if ((sourceId === from && targetId === to) || (sourceId === to && targetId === from)) {
          pathEdges.add(link.key);
        }
      }
    }
    
    this.nodeElements
      .classed('dimmed', d => !pathSet.has(d.id))
      .classed('highlighted', d => pathSet.has(d.id))
      .classed('path-node', d => pathSet.has(d.id));
    
    this.linkElements
      .classed('dimmed', d => !pathEdges.has(d.key))
      .classed('highlighted', d => pathEdges.has(d.key))
      .classed('path-link', d => pathEdges.has(d.key));
    
    this.linkLabelElements.classed('visible', d => pathEdges.has(d.key));
  }

  // Clear path highlighting
  clearPath() {
    this.nodeElements.classed('path-node', false);
    this.linkElements.classed('path-link', false);
    this._clearHighlight();
  }

  pauseSimulation() {
    if (!this.simulation || this._simulationPaused) return;
    this._simulationPaused = true;
    this._pausedSimulationAlpha = this.simulation.alpha();
    this.simulation.stop();
  }

  resumeSimulation({ alpha = null, delay = 120 } = {}) {
    if (!this.simulation || !this._simulationPaused) return;
    this._simulationPaused = false;
    const nextAlpha = Math.max(alpha ?? this._pausedSimulationAlpha ?? 0, 0);
    if (nextAlpha <= 0.015) {
      this._pausedSimulationAlpha = 0;
      return;
    }

    window.clearTimeout(this._resumeTimer);
    this._resumeTimer = window.setTimeout(() => {
      if (!this.simulation || this._simulationPaused) return;
      this.simulation.alpha(Math.min(nextAlpha, 0.08)).restart();
      this._coolDownSimulation(480);
      this._pausedSimulationAlpha = 0;
    }, delay);
  }

  // Export graph as PNG
  async exportAsPng(filename = 'honglou-graph.png') {
    const svgElement = this.svg.node();
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = 2; // High DPI
        canvas.width = this.width * scale;
        canvas.height = this.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        
        // Fill background
        const bgColor = getComputedStyle(document.body).getPropertyValue('--color-cream') || '#FFF8EE';
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, this.width, this.height);
        
        ctx.drawImage(img, 0, 0, this.width, this.height);
        URL.revokeObjectURL(url);
        
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = filename;
          link.click();
          URL.revokeObjectURL(link.href);
          resolve();
        }, 'image/png');
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  // Export graph as PNG with title and description
  async exportAsCardPng(title = '红楼梦人物关系图', description = '', filename = 'honglou-share.png') {
    const svgElement = this.svg.node();
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const padding = 40;
        const headerHeight = 80;
        const footerHeight = description ? 60 : 0;
        const totalWidth = this.width + padding * 2;
        const totalHeight = this.height + padding * 2 + headerHeight + footerHeight;
        
        const canvas = document.createElement('canvas');
        const scale = 2;
        canvas.width = totalWidth * scale;
        canvas.height = totalHeight * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        
        // Background
        const bgColor = getComputedStyle(document.body).getPropertyValue('--color-cream') || '#FFF8EE';
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, totalWidth, totalHeight);
        
        // Border
        const borderColor = getComputedStyle(document.body).getPropertyValue('--color-border') || '#C4A882';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, totalWidth - 2, totalHeight - 2);
        
        // Title
        const primaryColor = getComputedStyle(document.body).getPropertyValue('--color-primary') || '#8B2500';
        ctx.fillStyle = primaryColor;
        ctx.font = 'bold 24px "Noto Serif SC", serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, totalWidth / 2, padding + 35);
        
        // Subtitle line
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding + 50, padding + 55);
        ctx.lineTo(totalWidth - padding - 50, padding + 55);
        ctx.stroke();
        
        // Graph image
        ctx.drawImage(img, padding, padding + headerHeight, this.width, this.height);
        URL.revokeObjectURL(url);
        
        // Description
        if (description) {
          ctx.fillStyle = '#666';
          ctx.font = '14px "Noto Serif SC", serif';
          ctx.textAlign = 'center';
          ctx.fillText(description, totalWidth / 2, totalHeight - padding - 15);
        }
        
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = filename;
          link.click();
          URL.revokeObjectURL(link.href);
          resolve();
        }, 'image/png');
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  destroy() {
    window.clearTimeout(this._coolDownTimer);
    window.clearTimeout(this._resizeTimer);
    window.clearTimeout(this._resumeTimer);
    if (this._highlightRaf) window.cancelAnimationFrame(this._highlightRaf);
    if (this.simulation) this.simulation.stop();
    if (this._resizeObserver) this._resizeObserver.disconnect();
    if (this._tooltipEl) this._tooltipEl.remove();
    this.svg.remove();
  }
}
