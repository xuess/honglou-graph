# Architecture

**Analysis Date:** 2026-04-13

## Pattern Overview

**Overall:** Single-Page Application (SPA) with View-Based Architecture

**Key Characteristics:**
- Zero-build, zero-framework frontend: All JavaScript loaded via `<script>` tags, no bundler or transpiler
- Class-based component pattern: Each view is a class instance with `setData()`, `render()`, and lifecycle methods
- Centralized state management: `FacetStore` implements publish/subscribe pattern for cross-view state synchronization
- D3.js-driven force simulation: Relationship graph uses D3 force layout for node positioning

## Layers

**Application Layer (Orchestration):**
- Purpose: Entry point, view lifecycle, navigation, sidebar, search, global events
- Location: `js/app.js`
- Contains: `HongLouMengApp` class - the single orchestrator class
- Depends on: All view classes, FacetStore, D3.js
- Used by: Browser (global instantiation on page load)

**State Layer (Cross-View Communication):**
- Purpose: Centralized state with pub/sub notifications
- Location: `js/facet-store.js`
- Contains: `FacetStore` class with subscribe/unsubscribe/set pattern
- Depends on: None (pure JavaScript)
- Used by: All views receive state updates via subscription

**View Layer (Presentation Components):**
- Purpose: Render specific views, handle view-specific interactions
- Location: `js/graph.js`, `js/tree-view.js`, `js/list-view.js`, `js/knowledge-view.js`, `js/chapter-view.js`
- Contains: One class per view with common interface
- Depends on: Data layer, FacetStore (optional), DOM APIs
- Used by: Application layer instantiates and controls

**Data Layer (Static JSON):**
- Purpose: Character, relationship, and knowledge data
- Location: `data/characters.json`, `data/relationships.json`, `data/knowledge.json`
- Contains: Static JSON arrays loaded via `fetch()` at initialization
- Depends on: None (served as static files)
- Used by: Application and view layers

**Presentation Layer (Styling):**
- Purpose: Visual design, layout, responsive behavior
- Location: `css/style.css`, `css/fonts.css`
- Contains: Single monolithic stylesheet with Chinese classical aesthetic
- Depends on: Custom fonts (Noto Serif SC, ZCOOL XiaoWei)
- Used by: All HTML elements

## Data Flow

**Initialization Flow:**

1. Browser loads `index.html` with scripts in dependency order (D3 → FacetStore → Views → App)
2. `HongLouMengApp` constructor initializes, caches DOM elements
3. `_loadData()` fetches all JSON files in parallel
4. Character and relationship maps built for fast lookup
5. `RelationshipGraph` initialized with D3 force simulation
6. Views initialized with data, subscriptions registered with FacetStore
7. Default view rendered (graph view)

**View Switching Flow:**

1. User clicks navigation tab → `_switchView(viewName)` called
2. Previous view's overlays closed (card, drawer)
3. View panel visibility toggled via CSS classes
4. If view not initialized, `render()` called once
5. URL hash updated for browser history
6. FacetState applied to new view

**Character Selection Flow:**

1. User clicks node/card/list item → `_openCharacter(id)` called
2. View history pushed for back navigation
3. Graph view shows neighborhood (if active)
4. Character card displayed (modal overlay)
5. FacetStore updated with `selectedCharacterIds`
6. All subscribed views receive notification
7. Views update highlights based on selection

**State Management:**
- `FacetStore` maintains singleton state object
- Views subscribe to specific state keys
- State changes trigger batched notifications
- Source view tracked to prevent circular updates

## Key Abstractions

**View Class Pattern:**
- Purpose: Encapsulate view-specific rendering and interaction
- Examples: `js/graph.js`, `js/tree-view.js`, `js/list-view.js`
- Pattern: 
  ```javascript
  class SomeView {
    constructor(container) { /* setup properties */ }
    setData(data) { /* receive data */ }
    render() { /* initial render */ }
    setFacetContext(state) { /* receive cross-view state */ }
  }
  ```

**Character Data Structure:**
- Purpose: Represent a person from the novel
- Examples: `data/characters.json` (each object)
- Schema: `{ id, name, pinyin, alias[], gender, family, group, identity, importance, personality, keyEvents[], quotes[], chapters[], parentIds[], childrenIds[], spouseIds[], generation, isMainline, outcome }`

**Relationship Data Structure:**
- Purpose: Represent connections between characters
- Examples: `data/relationships.json` (each object)
- Schema: `{ source: id, target: id, type: enum, label: string, description: string }`
- Type enum: `blood | marriage | master_servant | romance | social | rivalry`

**Knowledge Data Structure:**
- Purpose: Represent literary/cultural knowledge entries
- Examples: `data/knowledge.json` (each object)
- Schema: `{ id, type, title, content, chapter, relatedCharacters[], relatedEvents[], tags[], analysis, category, versionNote? }`

**Graph Node/Link Abstraction:**
- Purpose: Transform character/relationship data for D3 simulation
- Examples: `js/graph.js` `_buildGraph()` method
- Pattern: Characters → nodes with position/radius/color; Relationships → links with style

## Entry Points

**HTML Entry Point:**
- Location: `index.html`
- Triggers: Browser navigation
- Responsibilities: Load scripts in order, provide DOM structure, define view panels

**Application Entry Point:**
- Location: `js/app.js` `HongLouMengApp` constructor
- Triggers: Script load complete
- Responsibilities: Initialize app state, load data, create views, bind events

**View Entry Points:**
- `js/graph.js`: `RelationshipGraph` constructor + `setData()` + `render()`
- `js/tree-view.js`: `TreeView` constructor + `setData()` + `render()`
- `js/list-view.js`: `ListView` constructor + `setData()` + `render()`
- `js/knowledge-view.js`: `KnowledgeView` constructor + `setData()` + `render()`
- `js/chapter-view.js`: `ChapterView` constructor + `setData()` + `render()`

## Error Handling

**Strategy:** Fail-fast on data load, graceful degradation on runtime

**Patterns:**
- Data load failure: Show error message, prevent app initialization
- Missing character: Early return from functions (null checks)
- D3 simulation issues: Caught and logged, simulation continues
- Search index: Empty results handled gracefully with UI feedback

**Loading State:**
- Full-page loading overlay shown during data fetch
- Overlay removed on successful initialization
- Error state displayed if fetch fails

## Cross-Cutting Concerns

**Logging:** Console logging for development; no production logging framework

**Validation:** 
- JSON validation via `python3 -m json.tool` during development
- Runtime: null checks and type coercion for safety

**Authentication:** None - static site, no user accounts

**Performance:**
- Performance mode detection based on device capabilities
- CSS class toggling (`performance-low`) for reduced animations
- Deferred rendering for large lists
- Simulation alpha cooling to reduce CPU usage

**Accessibility:**
- ARIA labels on interactive elements
- Semantic HTML structure
- Keyboard navigation support (Escape to close, / to focus search)
- Focus management in modals

**Internationalization:**
- All content in Chinese
- No i18n framework - hardcoded strings
- Pinyin stored for search indexing

---

*Architecture analysis: 2026-04-13*
