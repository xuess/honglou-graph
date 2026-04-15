# Phase 4: 面包屑导航 - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can see a clear hierarchical navigation path that shows their current location in the app. Clicking breadcrumb items allows quick navigation back to previous states. Works correctly on narrow screens.

**Requirements:** VIEW-06

</domain>

<decisions>
## Implementation Decisions

### Path Structure
- **D-01:** Flat format "视图 / 选中项" — Keep existing pattern (e.g., "图谱 / 林黛玉")
- Not full hierarchical trail — would require extensive state tracking
- Display shows current view + selected item (character, topic, stage, family, or relationship pair)

### Click Navigation
- **D-02:** Yes — Breadcrumb items should be clickable to navigate back
- Clicking the view name returns to view with no selection
- Clicking the selection item clears that specific selection
- Implementation: Add click handlers to `.context-crumb` elements

### Responsive Truncation
- **D-03:** Ellipsis truncation on narrow screens
- CSS: `text-overflow: ellipsis` with `overflow: hidden`
- Show at minimum the current view name
- Mobile: Show only view name without selection (or abbreviated)

### Clear Behavior
- **D-04:** Clear button shows when there's selection (existing pattern)
- Button clears all facet state and returns to initial view
- Already implemented in Phase 1: `btnClearContext` toggles visibility

### Agent's Discretion
- Exact CSS breakpoint values for truncation
- Touch target size for mobile clickability
- Animation for hover/click states

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### View State
- `js/app.js` — Lines 2660-2675: Current breadcrumb rendering
- `js/app.js` — Lines 2584-2585: Reset breadcrumb code
- `js/facet-store.js` — Lines 147-172: Breadcrumb state management
- `index.html` — Line 45: `#context-breadcrumbs` container
- `css/style.css` — Lines 418-448: Breadcrumb styles

### Related Requirements
- `.planning/REQUIREMENTS.md` — VIEW-06 (breadcrumb navigation requirement)
- `.planning/ROADMAP.md` — Phase 4 description, Success Criteria

[If no external specs: "No external specs — requirements fully captured in decisions above"]

</canonical_refs>

 ## Existing Code Insights

### Reusable Assets
- `facetState.breadcrumb` array: Already tracked in state
- `FacetStore.setBreadcrumb()`, `pushBreadcrumbItem()`: State management methods exist
- `.context-crumb` CSS class: Already styled
- `btnClearContext`: Clear button exists

### Established Patterns
- Flat format "view / item": Already working
- Phase 1-3: Cleared button, view switching work
- Cross-view facets: Already synchronized

### Integration Points
- `app.js` `_renderContextBar()`: Breadcrumb rendering method
- `app.js` line 2688-2690: Clear button toggle logic
- HTML `#context-breadcrumbs`: Container element

</## Existing Code Insights>

<specifics>
## Specific Ideas

"No specific requirements — open to standard approaches"

- Keep visual consistency with existing Chinese classical aesthetic
- Use established colors from `style.css` (red-wood tones)
- Maintain subtle animation for states

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

**Future consideration:**
- Full hierarchical trail (like "概览 → 宝黛专题 → 林黛玉") — would need extensive state tracking beyond current scope

</deferred>

---

*Phase: 04-breadcrumb*
*Context gathered: 2026-04-15*