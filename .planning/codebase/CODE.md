# Code Patterns: 红楼梦 · 知识探索工具

**Last updated:** 2025-04-13

## Class Structure

### Main Application (app.js)

```javascript
class HongLouMengApp {
  constructor() {
    // Data stores
    this.characters = [];
    this.relationships = [];
    this.knowledge = [];

    // View instances
    this.graph = null;
    this.treeView = null;
    // ...

    // UI state
    this.currentView = 'graph';
    this.currentCharacterId = null;
    this.facetState = { /* cross-view state */ };

    // Featured content
    this.featuredCharacterIds = [...];
    this.topics = [...];
    this.stages = [...];
  }

  async init() {
    await this.loadData();
    this.initGraph();
    this.bindEvents();
  }
}
```

### View Pattern

Each view is a class:

```javascript
class RelationshipGraph {
  constructor(container, app) {
    this.container = container;
    this.app = app;
  }

  async init() { /* D3 setup */ }
  render() { /* draw graph */ }
  focusOn(characterId) { /* show connections */ }
  destroy() { /* cleanup */ }
}
```

### State Pattern (FacetStore)

```javascript
class FacetStore {
  state = {};

  subscribe(key, callback) { /* register observer */ }
  update(key, value) { /* notify observers */ }
  get(key) { /* get state */ }
}
```

---

## Event Handling

- **Event delegation** on container elements
- **Data attributes** for view switching: `data-view="graph"`
- **ARIA attributes** for accessibility

---

## CSS Conventions

- **CSS variables** for theme colors
- **BEM-like naming**: `.sidebar-section`, `.sidebar-section-title`
- **Classical palette**:
  - Red: `#C0392B`
  - Gray: `#2C3E50`
  - Paper: `#FDF5E6`

---

## Data Conventions

- **Character IDs**: `jia_baoyu`, `lin_daiyu` (snake_case)
- **Family values**: 贾家, 史家, 王家, 薛家
- **Importance**: 1-5 scale
- **Chapters**: 1-120 (120-chapter edition)

---

## Code Quality Rules

From AGENTS.md:

1. **No type suppression** — never use `as any` or `@ts-ignore`
2. **No empty catch blocks**
3. **No deleting failing tests**
4. **Verify cross-view impact** before delivery

---

## Testing

- JSON validation: `python3 -m json.tool data/characters.json > /dev/null`
- Browser console: check for runtime errors
- Playwright: optional visual verification