// Usage: node snapshot.mjs <url> <outDir> [label]
// Captures screenshot.png, edges.json (all graph-link paths), console.log
// from PJ04 viewer for visual verification loops.

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [, , url, outDirArg, labelArg] = process.argv;
if (!url || !outDirArg) {
  console.error("usage: node snapshot.mjs <url> <outDir> [label]");
  process.exit(1);
}
const outDir = resolve(outDirArg);
const label = labelArg || "snap";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();

const consoleMsgs = [];
page.on("console", (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => consoleMsgs.push(`[pageerror] ${e.message}`));

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
// Wait for SVG to appear (viewer mounted)
await page.waitForSelector("svg", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500); // let layout settle

// Switch view mode if requested via SNAP_VIEW env (tree|system). Default: don't switch.
const desired = process.env.SNAP_VIEW;
if (desired === "system" || desired === "tree") {
  const btnId = desired === "system" ? "view-system" : "view-tree";
  await page
    .evaluate((id) => {
      const btn = document.getElementById(id);
      if (btn && !btn.classList.contains("is-active")) btn.click();
    }, btnId)
    .catch(() => {});
  await page.waitForTimeout(600);
}

// Capture SVG edge structure + box rects + collision validation
const pageData = await page.evaluate(() => {
  const paths = Array.from(document.querySelectorAll("path.graph-link, path.flow-preview-edge, path.edge"));
  const edges = paths.map((p) => {
    const b = p.getBBox();
    return {
      cls: p.getAttribute("class"),
      id: p.getAttribute("data-link-id") || null,
      d: p.getAttribute("d"),
      stroke: p.getAttribute("stroke") || null,
      markerStart: p.getAttribute("marker-start") || null,
      markerEnd: p.getAttribute("marker-end") || null,
      bbox: { x: b.x, y: b.y, w: b.width, h: b.height },
    };
  });
  // Collect node rects via the node-hit elements (the interactive click zones outline each box)
  const nodeHits = Array.from(document.querySelectorAll("rect.node-hit, g.node-hit"));
  const boxes = nodeHits.map((el) => {
    const b = el.getBBox();
    const id = el.getAttribute("data-node-id") || el.id || null;
    return { id, x: b.x, y: b.y, w: b.width, h: b.height };
  }).filter((b) => b.w > 4 && b.h > 4);
  return { edges, boxes };
});

// Sample points along each path and check if they fall inside any non-endpoint box.
// Uses getPointAtLength via a fresh DOM reference inside page.evaluate.
const collisions = await page.evaluate((boxes) => {
  const results = [];
  const paths = Array.from(document.querySelectorAll("path.graph-link, path.flow-preview-edge, path.edge"));
  for (const path of paths) {
    const id = path.getAttribute("data-link-id") || null;
    const d = path.getAttribute("d");
    const len = path.getTotalLength();
    if (len < 2) continue;
    // Determine endpoints to exempt (approximate: first and last points, within pad)
    const first = path.getPointAtLength(0);
    const last = path.getPointAtLength(len);
    const endpointPad = 12;
    const samples = Math.max(20, Math.floor(len / 10));
    const hits = new Set();
    for (let i = 0; i <= samples; i++) {
      const t = (i / samples) * len;
      const pt = path.getPointAtLength(t);
      // Skip points close to the two endpoints
      const distFirst = Math.hypot(pt.x - first.x, pt.y - first.y);
      const distLast = Math.hypot(pt.x - last.x, pt.y - last.y);
      if (distFirst < endpointPad || distLast < endpointPad) continue;
      for (const b of boxes) {
        const cx = pt.x;
        const cy = pt.y;
        // Inner box (shrink by pad so edge grazing the border is tolerated)
        const pad = 2;
        if (cx > b.x + pad && cx < b.x + b.w - pad && cy > b.y + pad && cy < b.y + b.h - pad) {
          hits.add(b.id || `${b.x.toFixed(0)},${b.y.toFixed(0)}`);
        }
      }
    }
    if (hits.size > 0) {
      results.push({ id, d, hits: [...hits] });
    }
  }
  return results;
}, pageData.boxes);

writeFileSync(`${outDir}/${label}_edges.json`, JSON.stringify(pageData.edges, null, 2));
writeFileSync(`${outDir}/${label}_boxes.json`, JSON.stringify(pageData.boxes, null, 2));
writeFileSync(`${outDir}/${label}_collisions.json`, JSON.stringify(collisions, null, 2));
writeFileSync(`${outDir}/${label}_console.log`, consoleMsgs.join("\n"));
await page.screenshot({ path: `${outDir}/${label}_screenshot.png`, fullPage: false });
console.log(`[snapshot] collisions: ${collisions.length}`);

await browser.close();
console.log(`[snapshot] wrote ${outDir}/${label}_*.{png,edges.json,console.log}`);
console.log(`[snapshot] edges captured: ${pageData.edges.length}`);
console.log(`[snapshot] boxes captured: ${pageData.boxes.length}`);
console.log(`[snapshot] console msgs: ${consoleMsgs.length}`);
