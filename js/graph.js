/**
 * 《红楼梦》人物关系图谱 - D3.js 力导向图可视化
 * graph.js - 核心图谱渲染与交互逻辑
 */

class RelationshipGraph {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      nodeMinRadius: 8,
      nodeMaxRadius: 28,
      linkDistance: 120,
      chargeStrength: -300,
      collisionPadding: 8,
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
    
    // 状态
    this.selectedNode = null;
    this.focusMode = false;
    this.focusNodeId = null;
    this.activeRelationTypes = new Set(['blood', 'marriage', 'master_servant', 'romance', 'social', 'rivalry']);
    this.activeFamilies = new Set();
    this.showLabels = true;
    
    // 颜色映射
    this.familyColors = {
      '贾家': '#C0392B',
      '史家': '#2980B9',
      '王家': '#27AE60',
      '薛家': '#8E44AD',
      '林家': '#16A085',
      '其他': '#E67E22'
    };
    
    this.relationColors = {
      'blood': '#4A90D9',
      'marriage': '#E74C3C',
      'master_servant': '#95A5A6',
      'romance': '#E91E8C',
      'social': '#F39C12',
      'rivalry': '#8E44AD'
    };
    
    this.relationLabels = {
      'blood': '血缘',
      'marriage': '婚姻',
      'master_servant': '主仆',
      'romance': '情感',
      'social': '社交',
      'rivalry': '敌对'
    };
    
    // 回调
    this.onNodeClick = null;
    this.onNodeDblClick = null;
    
    this._init();
  }
  
  _init() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    
    // 创建 SVG
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`);
    
    // 定义箭头标记
    const defs = this.svg.append('defs');
    
    Object.keys(this.relationColors).forEach(type => {
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', this.relationColors[type])
        .attr('opacity', 0.6);
    });
    
    // 添加渐变背景
    const bgGradient = defs.append('radialGradient')
      .attr('id', 'bg-gradient')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '50%');
    
    bgGradient.append('stop')
      .attr('offset', '0%')
      .attr('style', 'stop-color: rgba(245, 230, 211, 0.3)');
    
    bgGradient.append('stop')
      .attr('offset', '100%')
      .attr('style', 'stop-color: rgba(245, 230, 211, 0)');
    
    // 缩放行为
    this.zoom = d3.zoom()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });
    
    this.svg.call(this.zoom);
    
    // 主绘图组
    this.g = this.svg.append('g');
    
    // 连线组 & 节点组
    this.linkGroup = this.g.append('g').attr('class', 'links');
    this.linkLabelGroup = this.g.append('g').attr('class', 'link-labels');
    this.nodeGroup = this.g.append('g').attr('class', 'nodes');
    
    // 窗口大小变化
    this._resizeObserver = new ResizeObserver(() => this._onResize());
    this._resizeObserver.observe(this.container);
  }
  
  _onResize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
    
    if (this.simulation) {
      this.simulation.force('center', d3.forceCenter(this.width / 2, this.height / 2));
      this.simulation.alpha(0.3).restart();
    }
  }
  
  /**
   * 设置数据
   */
  setData(characters, relationships) {
    this.characters = characters;
    this.relationships = relationships;
    
    // 构建节点映射
    this.characterMap = new Map();
    characters.forEach(c => this.characterMap.set(c.id, c));
    
    // 收集所有家族
    this.activeFamilies = new Set(characters.map(c => this._getFamilyGroup(c)));
    
    this._buildGraph();
    this._render();
    this._setupSimulation();
  }
  
  _getFamilyGroup(character) {
    const family = character.family;
    if (this.familyColors[family]) return family;
    return '其他';
  }
  
  _getNodeColor(character) {
    const group = this._getFamilyGroup(character);
    return this.familyColors[group] || this.familyColors['其他'];
  }
  
  _getNodeRadius(character) {
    const { nodeMinRadius, nodeMaxRadius } = this.options;
    const scale = (character.importance - 1) / 4;
    return nodeMinRadius + scale * (nodeMaxRadius - nodeMinRadius);
  }
  
  /**
   * 构建图数据
   */
  _buildGraph() {
    this.nodes = this.characters.map(c => ({
      id: c.id,
      character: c,
      radius: this._getNodeRadius(c),
      color: this._getNodeColor(c),
      x: this.width / 2 + (Math.random() - 0.5) * 400,
      y: this.height / 2 + (Math.random() - 0.5) * 400
    }));
    
    const nodeIds = new Set(this.nodes.map(n => n.id));
    
    this.links = this.relationships
      .filter(r => nodeIds.has(r.source) && nodeIds.has(r.target))
      .map(r => ({
        source: r.source,
        target: r.target,
        type: r.type,
        label: r.label,
        description: r.description,
        color: this.relationColors[r.type] || '#999'
      }));
  }
  
  /**
   * 设置力模拟
   */
  _setupSimulation() {
    if (this.simulation) this.simulation.stop();
    
    this.simulation = d3.forceSimulation(this.nodes)
      .force('link', d3.forceLink(this.links)
        .id(d => d.id)
        .distance(d => {
          const base = this.options.linkDistance;
          if (d.type === 'blood' || d.type === 'marriage') return base * 0.8;
          if (d.type === 'master_servant') return base * 1.2;
          return base;
        })
      )
      .force('charge', d3.forceManyBody()
        .strength(d => {
          const base = this.options.chargeStrength;
          return base * (0.5 + d.character.importance * 0.2);
        })
      )
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide()
        .radius(d => d.radius + this.options.collisionPadding)
      )
      .force('x', d3.forceX(this.width / 2).strength(0.03))
      .force('y', d3.forceY(this.height / 2).strength(0.03))
      .on('tick', () => this._onTick());
    
    // 初始运行一段时间后降温
    this.simulation.alpha(1).restart();
  }
  
  /**
   * 渲染图形元素
   */
  _render() {
    // --- 连线 ---
    this.linkElements = this.linkGroup
      .selectAll('.link-line')
      .data(this.links, d => `${d.source.id || d.source}-${d.target.id || d.target}`)
      .join(
        enter => enter.append('line')
          .attr('class', 'link-line')
          .attr('stroke', d => d.color)
          .attr('stroke-width', d => {
            if (d.type === 'blood' || d.type === 'marriage') return 2;
            return 1.5;
          })
          .attr('stroke-dasharray', d => {
            if (d.type === 'romance') return '6,3';
            if (d.type === 'rivalry') return '4,4';
            if (d.type === 'social') return '8,4';
            return 'none';
          }),
        update => update,
        exit => exit.remove()
      );
    
    // --- 连线标签 ---
    this.linkLabelElements = this.linkLabelGroup
      .selectAll('.link-label')
      .data(this.links, d => `${d.source.id || d.source}-${d.target.id || d.target}`)
      .join(
        enter => enter.append('text')
          .attr('class', 'link-label')
          .text(d => d.label),
        update => update.text(d => d.label),
        exit => exit.remove()
      );
    
    // --- 节点组 ---
    const nodeGroups = this.nodeGroup
      .selectAll('.node-group')
      .data(this.nodes, d => d.id)
      .join(
        enter => {
          const g = enter.append('g')
            .attr('class', 'node-group')
            .call(this._drag());
          
          // 节点圆形
          g.append('circle')
            .attr('class', 'node-circle')
            .attr('r', d => d.radius)
            .attr('fill', d => d.color);
          
          // 节点文字（名字首字）
          g.append('text')
            .attr('class', 'node-text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('fill', 'white')
            .attr('font-size', d => Math.max(d.radius * 0.7, 8) + 'px')
            .attr('font-family', "'ZCOOL XiaoWei', 'Noto Serif SC', serif")
            .attr('font-weight', '700')
            .attr('pointer-events', 'none')
            .text(d => {
              const name = d.character.name;
              if (d.radius >= 20) return name.length <= 3 ? name : name.substring(0, 2);
              return name.substring(0, 1);
            });
          
          // 节点标签（姓名）
          g.append('text')
            .attr('class', d => `node-label importance-${d.character.importance}`)
            .attr('dy', d => d.radius + 14)
            .text(d => d.character.name);
          
          // 事件处理
          g.on('click', (event, d) => {
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
            this._highlightConnected(d);
            this._showTooltip(event, d);
          })
          .on('mouseleave', () => {
            if (!this.selectedNode) {
              this._clearHighlight();
            }
            this._hideTooltip();
          });
          
          return g;
        },
        update => update,
        exit => exit.remove()
      );
    
    this.nodeElements = nodeGroups;
    
    // 点击空白处取消选择
    this.svg.on('click', () => {
      this._selectNode(null);
      this._clearHighlight();
    });
  }
  
  /**
   * 每帧更新位置
   */
  _onTick() {
    this.linkElements
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
    
    this.linkLabelElements
      .attr('x', d => (d.source.x + d.target.x) / 2)
      .attr('y', d => (d.source.y + d.target.y) / 2);
    
    this.nodeElements
      .attr('transform', d => `translate(${d.x},${d.y})`);
  }
  
  /**
   * 拖拽行为
   */
  _drag() {
    return d3.drag()
      .on('start', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
  }
  
  /**
   * 高亮连接的节点
   */
  _highlightConnected(node) {
    const connectedIds = new Set([node.id]);
    
    this.links.forEach(link => {
      const sourceId = link.source.id || link.source;
      const targetId = link.target.id || link.target;
      if (sourceId === node.id) connectedIds.add(targetId);
      if (targetId === node.id) connectedIds.add(sourceId);
    });
    
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
    
    // 显示连线标签
    this.linkLabelElements
      .classed('visible', d => {
        const sourceId = d.source.id || d.source;
        const targetId = d.target.id || d.target;
        return sourceId === node.id || targetId === node.id;
      });
  }
  
  _clearHighlight() {
    this.nodeElements
      .classed('dimmed', false)
      .classed('highlighted', false);
    
    this.linkElements
      .classed('dimmed', false)
      .classed('highlighted', false);
    
    this.linkLabelElements
      .classed('visible', false);
  }
  
  /**
   * 选中节点
   */
  _selectNode(node) {
    this.selectedNode = node;
    
    this.nodeElements.selectAll('.node-circle')
      .classed('selected', d => node && d.id === node.id);
    
    if (node) {
      this._highlightConnected(node);
    } else {
      this._clearHighlight();
    }
  }
  
  /**
   * 提示框
   */
  _showTooltip(event, node) {
    let tooltip = document.querySelector('.tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      document.body.appendChild(tooltip);
    }
    
    const char = node.character;
    tooltip.innerHTML = `<strong>${char.name}</strong><br>${char.identity}`;
    tooltip.classList.add('visible');
    
    const x = event.pageX;
    const y = event.pageY - 50;
    tooltip.style.left = x - tooltip.offsetWidth / 2 + 'px';
    tooltip.style.top = y + 'px';
  }
  
  _hideTooltip() {
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) tooltip.classList.remove('visible');
  }
  
  /**
   * 聚焦模式 - 显示某人物的直接关系网络
   */
  enterFocusMode(characterId) {
    this.focusMode = true;
    this.focusNodeId = characterId;
    
    const connectedIds = new Set([characterId]);
    this.relationships.forEach(r => {
      if (r.source === characterId || (r.source.id && r.source.id === characterId)) {
        connectedIds.add(typeof r.target === 'string' ? r.target : r.target.id);
      }
      if (r.target === characterId || (r.target.id && r.target.id === characterId)) {
        connectedIds.add(typeof r.source === 'string' ? r.source : r.source.id);
      }
    });
    
    // 隐藏非相关节点
    this.nodeElements
      .style('display', d => connectedIds.has(d.id) ? null : 'none');
    
    this.linkElements
      .style('display', d => {
        const sourceId = d.source.id || d.source;
        const targetId = d.target.id || d.target;
        return (sourceId === characterId || targetId === characterId) ? null : 'none';
      });
    
    this.linkLabelElements
      .classed('visible', d => {
        const sourceId = d.source.id || d.source;
        const targetId = d.target.id || d.target;
        return sourceId === characterId || targetId === characterId;
      })
      .style('display', d => {
        const sourceId = d.source.id || d.source;
        const targetId = d.target.id || d.target;
        return (sourceId === characterId || targetId === characterId) ? null : 'none';
      });
    
    // 聚焦视图
    const focusNode = this.nodes.find(n => n.id === characterId);
    if (focusNode) {
      this._centerOnNode(focusNode);
    }
    
    // 重启模拟
    this.simulation.alpha(0.5).restart();
  }
  
  /**
   * 退出聚焦模式
   */
  exitFocusMode() {
    this.focusMode = false;
    this.focusNodeId = null;
    
    this.nodeElements.style('display', null);
    this.linkElements.style('display', null);
    this.linkLabelElements
      .classed('visible', false)
      .style('display', null);
    
    this._applyFilters();
    this.resetView();
    this.simulation.alpha(0.3).restart();
  }
  
  /**
   * 居中到某节点
   */
  _centerOnNode(node, scale = 1.5) {
    const transform = d3.zoomIdentity
      .translate(this.width / 2, this.height / 2)
      .scale(scale)
      .translate(-node.x, -node.y);
    
    this.svg.transition()
      .duration(750)
      .call(this.zoom.transform, transform);
  }
  
  /**
   * 定位到某节点
   */
  focusOnNode(characterId) {
    const node = this.nodes.find(n => n.id === characterId);
    if (node) {
      this._centerOnNode(node, 2);
      this._selectNode(node);
    }
  }
  
  /**
   * 重置视图
   */
  resetView() {
    this.svg.transition()
      .duration(750)
      .call(this.zoom.transform, d3.zoomIdentity);
  }
  
  /**
   * 缩放
   */
  zoomIn() {
    this.svg.transition().duration(300)
      .call(this.zoom.scaleBy, 1.3);
  }
  
  zoomOut() {
    this.svg.transition().duration(300)
      .call(this.zoom.scaleBy, 0.7);
  }
  
  /**
   * 筛选关系类型
   */
  setRelationFilter(types) {
    this.activeRelationTypes = new Set(types);
    this._applyFilters();
  }
  
  toggleRelationType(type) {
    if (this.activeRelationTypes.has(type)) {
      this.activeRelationTypes.delete(type);
    } else {
      this.activeRelationTypes.add(type);
    }
    this._applyFilters();
  }
  
  /**
   * 筛选家族
   */
  setFamilyFilter(families) {
    this.activeFamilies = new Set(families);
    this._applyFilters();
  }
  
  toggleFamily(family) {
    if (this.activeFamilies.has(family)) {
      this.activeFamilies.delete(family);
    } else {
      this.activeFamilies.add(family);
    }
    this._applyFilters();
  }
  
  /**
   * 应用所有筛选器
   */
  _applyFilters() {
    if (this.focusMode) return;
    
    // 节点可见性
    const visibleNodeIds = new Set();
    this.nodes.forEach(n => {
      const familyGroup = this._getFamilyGroup(n.character);
      if (this.activeFamilies.has(familyGroup)) {
        visibleNodeIds.add(n.id);
      }
    });
    
    this.nodeElements
      .style('display', d => visibleNodeIds.has(d.id) ? null : 'none');
    
    // 连线可见性
    this.linkElements
      .style('display', d => {
        const sourceId = d.source.id || d.source;
        const targetId = d.target.id || d.target;
        return (this.activeRelationTypes.has(d.type) && 
                visibleNodeIds.has(sourceId) && 
                visibleNodeIds.has(targetId)) ? null : 'none';
      });
    
    this.linkLabelElements
      .style('display', d => {
        const sourceId = d.source.id || d.source;
        const targetId = d.target.id || d.target;
        return (this.activeRelationTypes.has(d.type) && 
                visibleNodeIds.has(sourceId) && 
                visibleNodeIds.has(targetId)) ? null : 'none';
      });
  }
  
  /**
   * 切换标签显示
   */
  toggleLabels() {
    this.showLabels = !this.showLabels;
    this.nodeElements.selectAll('.node-label')
      .style('display', this.showLabels ? null : 'none');
    return this.showLabels;
  }
  
  /**
   * 搜索高亮
   */
  highlightSearch(query) {
    if (!query) {
      this._clearHighlight();
      this.nodeElements.style('display', null);
      return [];
    }
    
    const matches = [];
    this.nodes.forEach(n => {
      const char = n.character;
      const searchStr = [char.name, ...(char.alias || []), char.identity, char.family].join(' ');
      if (searchStr.toLowerCase().includes(query.toLowerCase())) {
        matches.push(char);
      }
    });
    
    if (matches.length > 0) {
      const matchIds = new Set(matches.map(m => m.id));
      this.nodeElements
        .classed('dimmed', d => !matchIds.has(d.id))
        .classed('highlighted', d => matchIds.has(d.id));
      this.linkElements
        .classed('dimmed', true);
    }
    
    return matches;
  }
  
  /**
   * 获取某人物的所有关系
   */
  getCharacterRelations(characterId) {
    return this.relationships.filter(r => {
      const sourceId = typeof r.source === 'string' ? r.source : r.source.id;
      const targetId = typeof r.target === 'string' ? r.target : r.target.id;
      return sourceId === characterId || targetId === characterId;
    }).map(r => {
      const sourceId = typeof r.source === 'string' ? r.source : r.source.id;
      const targetId = typeof r.target === 'string' ? r.target : r.target.id;
      const otherId = sourceId === characterId ? targetId : sourceId;
      const other = this.characterMap.get(otherId);
      return {
        character: other,
        type: r.type,
        label: r.label,
        description: r.description
      };
    }).filter(r => r.character);
  }
  
  /**
   * 获取统计数据
   */
  getStats() {
    const familyCounts = {};
    this.characters.forEach(c => {
      const family = this._getFamilyGroup(c);
      familyCounts[family] = (familyCounts[family] || 0) + 1;
    });
    
    const relationCounts = {};
    this.relationships.forEach(r => {
      relationCounts[r.type] = (relationCounts[r.type] || 0) + 1;
    });
    
    return {
      totalCharacters: this.characters.length,
      totalRelationships: this.relationships.length,
      familyCounts,
      relationCounts
    };
  }
  
  /**
   * 销毁
   */
  destroy() {
    if (this.simulation) this.simulation.stop();
    if (this._resizeObserver) this._resizeObserver.disconnect();
    this.svg.remove();
  }
}
