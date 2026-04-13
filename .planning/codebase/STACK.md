# Stack: 红楼梦 · 知识探索工具

**Last updated:** 2025-04-13

## Technology Choices

| Category | Choice | Version |
|----------|--------|---------|
| **Visualization** | D3.js | v7 (via CDN) |
| **Language** | Vanilla JavaScript | ES6+ |
| **Markup** | HTML5 | — |
| **Styling** | CSS3 | — |
| **Data Format** | JSON | — |
| **Deployment** | Cloudflare Pages | — |

### No Build Tools

This is a **zero-build** project:
- No webpack, vite, rollup
- No React, Vue, Svelte
- No CSS preprocessors
- All JS loaded via `<script>` in dependency order

### CDN Dependencies

- D3.js v7: `js/d3.v7.min.js` (local copy)

---

## Data Storage

| File | Purpose | Size (approx) |
|------|---------|---------------|
| `data/characters.json` | Character profiles | ~60 entries |
| `data/relationships.json` | Relationship edges | ~150 entries |
| `data/knowledge.json` | Poems, judgments, allusions | ~50 entries |

---

## Project Constraints

1. **Static-only deployment** — no server-side logic
2. **Modern browser target** — no IE11 support needed
3. **No localStorage/IndexedDB** — all state in memory
4. **CORS limitation** — must serve via HTTP (not file://)

---

## Local Development

```bash
# Python HTTP server
python3 -m http.server 8080

# or Node serve
npx serve .
```

Access: `http://localhost:8080`

---

## Future Considerations

Given this is a knowledge graph system:

- Consider adding search index for faster lookups
- Consider offline-capable PWA for mobile
- Consider more structured data for relationships