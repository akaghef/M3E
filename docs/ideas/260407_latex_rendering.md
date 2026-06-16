# LaTeX Rendering in Nodes

## Why

Math expressions in mind-map nodes are currently stored as raw LaTeX strings and displayed as plain text. Rendering them visually (e.g. `$E = mc^2$` → typeset equation) makes M3E useful for STEM note-taking, research structuring, and academic work.

---

## Detection Rule

A `"text"` node is treated as a LaTeX node when its **entire** `node.text` is a LaTeX expression — no surrounding prose.

| Node text | Rendered? |
|---|---|
| `$E = mc^2$` | Yes — inline math |
| `$$\frac{a}{b}$$` | Yes — display math |
| `supplement $2=1+1$` | No — partial match, plain text |
| `$100 budget` | No — not a closed expression |

```typescript
const INLINE_MATH_RE  = /^\$([^$]+)\$$/;
const DISPLAY_MATH_RE = /^\$\$([\s\S]+)\$\$$/;

function isLatexNode(node: TreeNode): boolean {
  const t = node.text.trim();
  return DISPLAY_MATH_RE.test(t) || INLINE_MATH_RE.test(t);
}

function latexSource(text: string): { latex: string; displayMode: boolean } {
  const t = text.trim();
  const dm = DISPLAY_MATH_RE.exec(t);
  if (dm) return { latex: dm[1]!, displayMode: true };
  const im = INLINE_MATH_RE.exec(t);
  return { latex: im ? im[1]! : t, displayMode: false };
}
```

No new `NodeType` is needed. `node.nodeType` stays `"text"` (or undefined). The delimiters are the signal.

---

## Option: New Node Type (deferred)

A `"latex"` entry in `NodeType` could be added later if explicit tooling (dedicated toolbar button, type badge, distinct styling) becomes necessary. For now, delimiter detection is sufficient and requires no schema change.

---

## Library: KaTeX

- Synchronous rendering API — matches the synchronous SVG string-building in `layoutNodes()` / `drawNode()`
- Small bundle (~300 KB); no runtime dependencies
- `katex.renderToString()` → HTML string for `<foreignObject>` embedding
- `katex.render()` → DOM render for pre-measurement

Add to `viewer.html` (or bundle locally under `beta/public/`):
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.js"></script>
```

---

## Layout Integration (`visit()` ~line 1595)

Currently `visit()` sets `metrics[nodeId].w` from `textWidth()`. For LaTeX nodes, we need rendered pixel dimensions measured before placement.

### Pre-measurement

Run once before the layout pass for each unique LaTeX text seen in the tree:

```typescript
const latexMetricsCache = new Map<string, { w: number; h: number }>();

function measureLatex(text: string): { w: number; h: number } {
  if (latexMetricsCache.has(text)) return latexMetricsCache.get(text)!;
  const { latex, displayMode } = latexSource(text);
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;top:-9999px;left:-9999px";
  document.body.appendChild(probe);
  try {
    katex.render(latex, probe, { displayMode, throwOnError: false });
    const result = {
      w: Math.max(80, probe.offsetWidth + 24),
      h: Math.max(VIEWER_TUNING.layout.leafHeight, probe.offsetHeight + 16),
    };
    latexMetricsCache.set(text, result);
    return result;
  } finally {
    probe.remove();
  }
}
```

### In `visit()` — node metric assignment

```typescript
// Replace the non-root metrics line:
if (isLatexNode(node)) {
  const m = measureLatex(node.text);
  metrics[nodeId] = { w: m.w, h: m.h };
} else {
  metrics[nodeId] = {
    w: textWidth(node.text || "", VIEWER_TUNING.typography.nodeFont) + 20,
    h: 56,
  };
}
```

`subtreeHeight()` already derives block height from `metrics`, so taller display-math nodes flow through the vertical layout automatically.

---

## Rendering Integration (`drawNode()` ~line 1819)

Replace the `<text class="label-node">` branch for LaTeX nodes with a `<foreignObject>`:

```typescript
if (isLatexNode(node)) {
  const { latex, displayMode } = latexSource(node.text);
  const htmlStr = katex.renderToString(latex, { displayMode, throwOnError: false });
  const foH = metrics[nodeId]?.h ?? VIEWER_TUNING.layout.leafHeight;
  const foX = p.x;
  const foY = p.y - foH / 2;
  nodes += `<foreignObject x="${foX}" y="${foY}" width="${p.w}" height="${foH}">
    <div xmlns="http://www.w3.org/1999/xhtml" class="latex-node-content">${htmlStr}</div>
  </foreignObject>`;
} else {
  nodes += `<text class="${labelClasses.join(" ")}" data-node-id="${nodeId}"
    x="${p.x}" y="${p.y}" text-anchor="start" dominant-baseline="middle">${label}</text>`;
}
```

Add to `viewer.css`:
```css
.latex-node-content {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 4px;
  color: var(--node-text-color, #1a1a2e);
  font-size: 14px;
  box-sizing: border-box;
}
```

---

## Hit Area Height

`drawNode()` uses `VIEWER_TUNING.layout.nodeHitHeight` (fixed 64 px) for the hit rect. Display math can be taller. The hit rect height should grow to match:

```typescript
const hitH = Math.max(VIEWER_TUNING.layout.nodeHitHeight, metrics[nodeId]?.h ?? 0);
nodes += `<rect class="${classNames.join(" ")}" ... height="${hitH}" rx="12" />`;
```

---

## Edit Mode

No change needed. `startEditingNode()` positions a textarea over the node showing `node.text` (the raw `$...$` source). The user edits LaTeX directly. On commit, `latexMetricsCache` should be cleared for the changed text before re-render so the layout recalculates with updated dimensions.

---

## Text Truncation Bypass

`uiLabel()` truncates at `maxNodeTextChars` (55). LaTeX nodes should bypass this since KaTeX handles display:

```typescript
function uiLabel(node: TreeNode): string {
  if (isLatexNode(node)) return node.text;  // no truncation
  // ... existing truncation logic
}
```

---

## Open Questions

1. **KaTeX error display** — `throwOnError: false` renders a red error span for invalid LaTeX. Should we fall back to plain `<text>` rendering instead when KaTeX errors, so broken expressions don't break layout?

2. **Local bundle vs CDN** — bundling KaTeX locally avoids network dependency and content-security-policy issues. Recommend copying to `beta/public/katex/` and updating `start_viewer.ts` to serve it.

3. **Cache lifetime** — `latexMetricsCache` can live for the session. Should it be invalidated on document switch, or is it safe to keep across documents (same text → same dimensions)?

4. **Linear text panel** — LaTeX source round-trips cleanly through the linear-text format. No special handling needed.

---

## Next Action

- [ ] Decide: local bundle or CDN for KaTeX?
- [ ] Implement `isLatexNode`, `latexSource`, `measureLatex` as small helpers near `textWidth` (~line 302)
- [ ] Patch `visit()` metric assignment and `drawNode()` label branch
- [ ] Fix hit-area height for taller display-math nodes
- [ ] Add visual regression snapshot: node with `$$E=mc^2$$`
