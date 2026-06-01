# Technology Stack

**Analysis Date:** 2026-04-13

## Languages

**Primary:**
- JavaScript (ES6+) - Core application logic; vanilla JS with class-based architecture
- HTML5 - Single-page application structure with semantic markup
- CSS3 - Styling with CSS custom properties (CSS variables) for theming

**Secondary:**
- JSON - Data storage format for characters, relationships, and knowledge entries
- TypeScript Definition Files - Type hints in `vendor/pretext/*.d.ts` (documentation only, no compilation)

## Runtime

**Environment:**
- Browser runtime only (no Node.js server-side execution)
- Target browsers: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+

**Package Manager:**
- None required - Zero build, zero package manager
- All dependencies vendored locally or loaded via CDN

**Development Server:**
- Python `http.server` - `python3 -m http.server 8080`
- Node.js `serve` - `npx serve .`
- VS Code Live Server extension

## Frameworks

**Core:**
- D3.js v7.9.0 - Force-directed graph visualization for relationship mapping
  - Local copy at `js/d3.v7.min.js`
  - Used for SVG rendering, zoom/pan, force simulation, data binding

**Testing:**
- None - No automated testing framework
- Manual verification via browser DevTools

**Build/Dev:**
- None - Pure static files, no build step
- Cache busting via query string versioning (e.g., `?v=20260407c`)

## Key Dependencies

**Critical:**
- D3.js v7.9.0 - Core visualization engine for force-directed graph
  - Provides: `d3.forceSimulation`, `d3.zoom`, `d3.drag`, `d3.select`, SVG manipulation
  - Loaded synchronously via `<script>` tag in `index.html` line 11

**Typography:**
- Noto Serif SC - Primary serif font for classical aesthetic (local TTF files)
- Noto Sans SC - Sans-serif fallback (local TTF files)
- ZCOOL XiaoWei - Decorative title font (local TTF files)
- Font files stored at `assets/fonts/font-0.ttf` through `font-8.ttf`
- Font definitions in `css/fonts.css`

**Text Layout:**
- Pretext - Custom text layout library for Chinese typography
  - Located at `vendor/pretext/`
  - Modules: `analysis.js`, `bidi.js`, `layout.js`, `line-break.js`, `measurement.js`, `rich-inline.js`
  - Used for line breaking, bidirectional text, and measurement in Chinese text rendering

## Configuration

**Environment:**
- No environment variables required
- No `.env` files (confirmed absent)
- All configuration is static in code

**Build:**
- `wrangler.jsonc` - Cloudflare Pages deployment configuration
- `index.html` - Script loading order defines dependency graph
- CSS cache busting via query strings (e.g., `style.css?v=20260407c`)

**Script Loading Order** (from `index.html`):
1. `js/d3.v7.min.js` - D3.js (line 11, in `<head>`)
2. `js/facet-store.js` - State management (line 208)
3. `js/text-layout.js` - Text layout utilities (line 209)
4. `js/graph.js` - Relationship graph visualization (line 210)
5. `js/tree-view.js` - Family tree view (line 211)
6. `js/list-view.js` - Character list view (line 212)
7. `js/chapter-view.js` - Chapter view (line 213)
8. `js/knowledge-view.js` - Knowledge base view (line 214)
9. `js/app.js` - Main application entry (line 215)

## Platform Requirements

**Development:**
- HTTP server required (CORS blocks `fetch` from `file://` protocol)
- Python 3.x or Node.js for local server
- Modern browser with DevTools for debugging

**Production:**
- Cloudflare Pages static hosting
- No server-side runtime required
- Assets served from root directory (`assets.directory: "."`)
- Compatibility date: 2025-09-27
- Node.js compatibility flag enabled for edge runtime

## Data Architecture

**Storage:**
- JSON files loaded via `fetch()` at runtime
- `data/characters.json` - Character data (~172KB, 4720+ lines)
- `data/relationships.json` - Relationship edges (~25KB)
- `data/knowledge.json` - Knowledge entries (~369KB, poetry, prophecies, etc.)

**In-Memory State:**
- `FacetStore` - Global state management via publish/subscribe pattern
- `HongLouMengApp` class - Main application controller
- View classes: `RelationshipGraph`, `TreeView`, `ListView`, `ChapterView`, `KnowledgeView`

---

*Stack analysis: 2026-04-13*
