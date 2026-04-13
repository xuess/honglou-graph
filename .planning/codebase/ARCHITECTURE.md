# Architecture: 红楼梦 · 知识探索工具

**Last updated:** 2025-04-13

## Project Overview

This is a **brownfield project** — an existing working application with comprehensive features.

### Core Value

Interactive knowledge exploration tool for 红楼梦 (Dream of the Red Chamber), enabling users to discover relationships, family genealogy, character profiles, and literary knowledge (poems/judgments/allusions) through an explorable interface.

---

## Component Structure

### File Responsibilities

| File | Responsibility |
|------|---------------|
| `index.html` | Entry point, view markup, navigation |
| `js/app.js` | Main application, routing, search, UI orchestration |
| `js/facet-store.js` | Cross-view state management (pub/sub) |
| `js/graph.js` | RelationshipGraph class — D3 force-directed visualization |
| `js/tree-view.js` | TreeView — family genealogy tree |
| `js/list-view.js` | ListView — character card/list display |
| `js/chapter-view.js` | Chapter view — chapter-by-chapter navigation |
| `js/knowledge-view.js` | KnowledgeView — literature knowledge base |
| `js/text-layout.js` | Text rendering utilities |
| `css/style.css` | Global styles, classical Chinese aesthetic |

### State Management

**FacetStore** is the single source of truth for cross-view state:

```javascript
facetState = {
  selectedCharacterIds: [],
  selectedTags: [],
  selectedFamily: null,
  selectedChapter: null,
  selectedCategory: null,
  selectedRelationTypes: [],
  query: '',
  breadcrumb: [{ label: '默认概览', type: 'overview' }],
  sourceView: 'graph'
}
```

**Key constraint:** When switching top-level views, the previous view's implicit filter conditions (currentFamily, selectedChapter) must NOT carry over.

---

## Data Models

### characters.json

```json
{
  "id": "jia_baoyu",
  "name": "贾宝玉",
  "alias": ["宝二爷", "怡红公子"],
  "family": "贾家",
  "group": "贾家-玉字辈",
  "importance": 5,
  "personality": "多情、叛逆",
  "keyEvents": ["衔玉而生"],
  "quotes": ["女儿是水作的骨肉"],
  "description": "...",
  "chapters": [3, 5, 7, 9]
}
```

### relationships.json

```json
{
  "source": "jia_baoyu",
  "target": "lin_daiyu",
  "type": "romance",
  "label": "恋人",
  "description": "木石前盟"
}
```

**type values:** `blood | marriage | master_servant | romance | social | rivalry`

### knowledge.json

```json
{
  "id": "poem-001",
  "type": "poem",
  "title": "《葬花吟》",
  "content": "花谢花飞花满天...",
  "chapter": 27,
  "relatedCharacters": ["lin_daiyu"],
  "category": "poem"
}
```

---

## View Architecture

### View Initialization

Views follow lazy initialization pattern:

```javascript
class HongLouMengApp {
  viewInitialized = { graph: true, tree: false, list: false, chapter: false, knowledge: false };
  viewEverRendered = { tree: false, list: false, chapter: false, knowledge: false };

  // First render triggers initialization
  async switchToView(viewType) {
    if (!this.viewInitialized[viewType]) {
      this[`${viewType}View`] = new TreeView(this);
      this.viewInitialized[viewType] = true;
    }
  }
}
```

### Graph View (D3.js)

- Uses D3.js v7 force simulation
- Supports focus mode (show only character + direct connections)
- Drag, zoom, pan interactions
- Relationship type-based edge styling

### Tree View

- Family-based tree structure
- Multi-family support (Jia, Wang, Xue, Shi)
- Collapsible branches

### List View

- Card view and compact view modes
- Sort by importance, family, name
- Filter by family, importance

### Chapter View

- Chapter-by-chapter navigation
- Character appearance tracking
- Reading progress

### Knowledge View

- Categories: poem, judgment, allusion, event
- Related character linking
- Search and filter

---

## Integration Points

### Cross-View Navigation

1. Click character in any view → opens detail card
2. Detail card links to related knowledge entries
3. Search results highlight across all views
4. Global context bar shows current exploration state

### Sidebar Integration

- Featured characters (quick access)
- Topic entry points (pre-curated character groups)
- Reading stages (chapter-based guidance)
- Filters (family, relation type, importance)
- Comparison tool (side-by-side relationship view)

---

## Deployment

- **Cloudflare Pages** (wrangler.jsonc)
- No server-side logic
- Static assets only
- Base directory: `.`

---

## Key Patterns Observed

1. **No build step** — all JS loaded via `<script>` tags
2. **No framework** — vanilla JavaScript classes
3. **Classical aesthetic** — red (#C0392B), ink gray, rice paper white
4. **Chinese fonts** — Noto Serif SC → Noto Serif TC → ZCOOL XiaoWei
5. **Pub/sub state** — FacetStore isolates views