<!-- GSD:project-start source:PROJECT.md -->
## Project

**红楼梦知识图谱优化**

《红楼梦》交互式知识探索工具，包含关系图谱、家族谱系、人物名录、知识库四个核心视图。现有功能已可使用，但视图联动体验不佳、数据质量参差不齐。

本次优化目标：让用户在任何时候都清楚"我在看什么、在哪里"，并能方便地清空状态和回退；同时确保数据准确、完整、无冗余。

**Core Value:** **用户时刻知道自己在哪里、在看什么，数据可信。**

### Constraints

- **技术栈**：保持现有技术栈不变（零框架、零构建）
- **原著准确性**：数据必须以原著为唯一依据，不能凭记忆或改编版本
- **浏览器测试**：每个修改必须在浏览器中验证
- **渐进式修改**：不破坏现有功能，逐步优化
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- JavaScript (ES6+) - Core application logic; vanilla JS with class-based architecture
- HTML5 - Single-page application structure with semantic markup
- CSS3 - Styling with CSS custom properties (CSS variables) for theming
- JSON - Data storage format for characters, relationships, and knowledge entries
- TypeScript Definition Files - Type hints in `vendor/pretext/*.d.ts` (documentation only, no compilation)
## Runtime
- Browser runtime only (no Node.js server-side execution)
- Target browsers: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- None required - Zero build, zero package manager
- All dependencies vendored locally or loaded via CDN
- Python `http.server` - `python3 -m http.server 8080`
- Node.js `serve` - `npx serve .`
- VS Code Live Server extension
## Frameworks
- D3.js v7.9.0 - Force-directed graph visualization for relationship mapping
- None - No automated testing framework
- Manual verification via browser DevTools
- None - Pure static files, no build step
- Cache busting via query string versioning (e.g., `?v=20260407c`)
## Key Dependencies
- D3.js v7.9.0 - Core visualization engine for force-directed graph
- Noto Serif SC - Primary serif font for classical aesthetic (local TTF files)
- Noto Sans SC - Sans-serif fallback (local TTF files)
- ZCOOL XiaoWei - Decorative title font (local TTF files)
- Font files stored at `assets/fonts/font-0.ttf` through `font-8.ttf`
- Font definitions in `css/fonts.css`
- Pretext - Custom text layout library for Chinese typography
## Configuration
- No environment variables required
- No `.env` files (confirmed absent)
- All configuration is static in code
- `wrangler.jsonc` - Cloudflare Pages deployment configuration
- `index.html` - Script loading order defines dependency graph
- CSS cache busting via query strings (e.g., `style.css?v=20260407c`)
## Platform Requirements
- HTTP server required (CORS blocks `fetch` from `file://` protocol)
- Python 3.x or Node.js for local server
- Modern browser with DevTools for debugging
- Cloudflare Pages static hosting
- No server-side runtime required
- Assets served from root directory (`assets.directory: "."`)
- Compatibility date: 2025-09-27
- Node.js compatibility flag enabled for edge runtime
## Data Architecture
- JSON files loaded via `fetch()` at runtime
- `data/characters.json` - Character data (~172KB, 4720+ lines)
- `data/relationships.json` - Relationship edges (~25KB)
- `data/knowledge.json` - Knowledge entries (~369KB, poetry, prophecies, etc.)
- `FacetStore` - Global state management via publish/subscribe pattern
- `HongLouMengApp` class - Main application controller
- View classes: `RelationshipGraph`, `TreeView`, `ListView`, `ChapterView`, `KnowledgeView`
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- PascalCase for all class names
- Examples: `HongLouMengApp`, `RelationshipGraph`, `TreeView`, `ListView`, `KnowledgeView`, `FacetStore`, `ChapterView`, `TextLayoutService`
- camelCase for all method names
- Private/internal methods prefixed with underscore: `_init`, `_bindEvents`, `_renderList`, `_updateContent`
- Public methods without prefix: `render`, `setData`, `destroy`, `highlightCharacter`
- camelCase for instance variables and local variables
- Examples: `currentFamily`, `searchQuery`, `visibleCount`, `relatedCharacterIds`
- Constants at class level use camelCase: `familyColors`, `relationColors`, `categoryConfig`
- kebab-case for JavaScript files: `tree-view.js`, `list-view.js`, `knowledge-view.js`, `facet-store.js`, `text-layout.js`
- Single main app file: `app.js`
- Single main graph file: `graph.js`
- kebab-case for DOM element IDs: `graph-container`, `tree-container`, `list-container`
- kebab-case for data attributes: `data-char-id`, `data-family`, `data-chapter`, `data-action`
## Code Style
- No automated formatter detected (no `.prettierrc`, `.eslintrc`, or `biome.json`)
- 2-space indentation observed throughout
- Single quotes for string literals (occasionally double quotes for HTML attributes in template strings)
- Semicolons used consistently
- Trailing commas in multi-line arrays/objects
- Arrow functions for callbacks: `(item) => item.id`
- `function` keyword not used; methods defined as class properties
- Template literals (backticks) for all multi-line HTML generation
- Example from `js/tree-view.js`:
- ES6 classes (no ES modules)
- `const` and `let` (no `var`)
- Template literals
- Arrow functions
- Destructuring
- Spread operator
- `async/await` for async operations
- Optional chaining (`?.`) and nullish coalescing (`??`)
## Import Organization
- All JS files share global scope
- Classes defined at global level, accessible via window
- Services attached to window: `window.textLayoutService`, `window.facetStore`
## Error Handling
- `console.error()` for errors with context message
- `console.warn()` for non-critical issues
- Example from `js/text-layout.js`:
- Fallback implementations when optional features unavailable
- Example from `js/text-layout.js`:
- Null checks with optional chaining: `character?.outcome`
- Default values: `this.characters = characters || []`
- Type coercion for safety: `String(text || '')`
## Logging
- Initialization failures
- Data loading errors
- Optional dependency failures
- Cross-view notification errors
## Comments
- JSDoc-style comments for public APIs in `facet-store.js`
- Minimal inline comments in other files
- Chinese comments for business logic explanations
## Function Design
- Methods typically 5-30 lines
- Large methods (>50 lines) are rare and usually render methods
- Complex logic extracted to helper methods with `_` prefix
- Options objects for optional parameters
- Default values in destructuring
- Example:
- Methods that query data return values directly
- Methods that modify state typically return nothing or return `this` for chaining
- Boolean returns for state checks: `isReady()`, `isCharacterSelected()`
## Module Design
- No explicit exports (global scope)
- Singleton pattern for services
- Classes available globally after script load
## Event Binding
## CSS Conventions
- BEM-like naming: `.tree-item-row`, `.tree-person-card`, `.knowledge-card-header`
- Utility classes: `.card-surface`, `.hidden`, `.active`
- State classes: `.expanded`, `.dimmed`, `.highlighted`, `.is-related`
- Theme classes on body: `.theme-red-gold`, `.theme-blue-green`, `.theme-ink-wash`, `.theme-purple-gold`
- Font classes: `.font-serif-sc`, `.font-sans-sc`, `.font-title`, `.font-traditional`
- Performance classes: `.performance-auto`, `.performance-balanced`, `.performance-smooth`, `.performance-low`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Zero-build, zero-framework frontend: All JavaScript loaded via `<script>` tags, no bundler or transpiler
- Class-based component pattern: Each view is a class instance with `setData()`, `render()`, and lifecycle methods
- Centralized state management: `FacetStore` implements publish/subscribe pattern for cross-view state synchronization
- D3.js-driven force simulation: Relationship graph uses D3 force layout for node positioning
## Layers
- Purpose: Entry point, view lifecycle, navigation, sidebar, search, global events
- Location: `js/app.js`
- Contains: `HongLouMengApp` class - the single orchestrator class
- Depends on: All view classes, FacetStore, D3.js
- Used by: Browser (global instantiation on page load)
- Purpose: Centralized state with pub/sub notifications
- Location: `js/facet-store.js`
- Contains: `FacetStore` class with subscribe/unsubscribe/set pattern
- Depends on: None (pure JavaScript)
- Used by: All views receive state updates via subscription
- Purpose: Render specific views, handle view-specific interactions
- Location: `js/graph.js`, `js/tree-view.js`, `js/list-view.js`, `js/knowledge-view.js`, `js/chapter-view.js`
- Contains: One class per view with common interface
- Depends on: Data layer, FacetStore (optional), DOM APIs
- Used by: Application layer instantiates and controls
- Purpose: Character, relationship, and knowledge data
- Location: `data/characters.json`, `data/relationships.json`, `data/knowledge.json`
- Contains: Static JSON arrays loaded via `fetch()` at initialization
- Depends on: None (served as static files)
- Used by: Application and view layers
- Purpose: Visual design, layout, responsive behavior
- Location: `css/style.css`, `css/fonts.css`
- Contains: Single monolithic stylesheet with Chinese classical aesthetic
- Depends on: Custom fonts (Noto Serif SC, ZCOOL XiaoWei)
- Used by: All HTML elements
## Data Flow
- `FacetStore` maintains singleton state object
- Views subscribe to specific state keys
- State changes trigger batched notifications
- Source view tracked to prevent circular updates
## Key Abstractions
- Purpose: Encapsulate view-specific rendering and interaction
- Examples: `js/graph.js`, `js/tree-view.js`, `js/list-view.js`
- Pattern: 
- Purpose: Represent a person from the novel
- Examples: `data/characters.json` (each object)
- Schema: `{ id, name, pinyin, alias[], gender, family, group, identity, importance, personality, keyEvents[], quotes[], chapters[], parentIds[], childrenIds[], spouseIds[], generation, isMainline, outcome }`
- Purpose: Represent connections between characters
- Examples: `data/relationships.json` (each object)
- Schema: `{ source: id, target: id, type: enum, label: string, description: string }`
- Type enum: `blood | marriage | master_servant | romance | social | rivalry`
- Purpose: Represent literary/cultural knowledge entries
- Examples: `data/knowledge.json` (each object)
- Schema: `{ id, type, title, content, chapter, relatedCharacters[], relatedEvents[], tags[], analysis, category, versionNote? }`
- Purpose: Transform character/relationship data for D3 simulation
- Examples: `js/graph.js` `_buildGraph()` method
- Pattern: Characters → nodes with position/radius/color; Relationships → links with style
## Entry Points
- Location: `index.html`
- Triggers: Browser navigation
- Responsibilities: Load scripts in order, provide DOM structure, define view panels
- Location: `js/app.js` `HongLouMengApp` constructor
- Triggers: Script load complete
- Responsibilities: Initialize app state, load data, create views, bind events
- `js/graph.js`: `RelationshipGraph` constructor + `setData()` + `render()`
- `js/tree-view.js`: `TreeView` constructor + `setData()` + `render()`
- `js/list-view.js`: `ListView` constructor + `setData()` + `render()`
- `js/knowledge-view.js`: `KnowledgeView` constructor + `setData()` + `render()`
- `js/chapter-view.js`: `ChapterView` constructor + `setData()` + `render()`
## Error Handling
- Data load failure: Show error message, prevent app initialization
- Missing character: Early return from functions (null checks)
- D3 simulation issues: Caught and logged, simulation continues
- Search index: Empty results handled gracefully with UI feedback
- Full-page loading overlay shown during data fetch
- Overlay removed on successful initialization
- Error state displayed if fetch fails
## Cross-Cutting Concerns
- JSON validation via `python3 -m json.tool` during development
- Runtime: null checks and type coercion for safety
- Performance mode detection based on device capabilities
- CSS class toggling (`performance-low`) for reduced animations
- Deferred rendering for large lists
- Simulation alpha cooling to reduce CPU usage
- ARIA labels on interactive elements
- Semantic HTML structure
- Keyboard navigation support (Escape to close, / to focus search)
- Focus management in modals
- All content in Chinese
- No i18n framework - hardcoded strings
- Pinyin stored for search indexing
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
