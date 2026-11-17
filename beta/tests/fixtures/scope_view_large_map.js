"use strict";
// Synthetic map for the scope view tests and measurements. No real data.
//
// Shaped after the figures known about the map this feature is for: about 20,000 nodes and
// 8 MB as JSON; the opened scope "S" owns about 650 nodes, holds about 30 nested scope
// nodes, and its whole subtree is about 16,400 nodes. How the other 3,600 nodes are split
// is an assumption: half are plain nodes of the map root's own scope (`rootOwn`), half sit
// in sibling scopes. Nested and sibling scopes hold further scope nodes of their own.
// GraphLinks run inside S, out of S, and outside S.

function node(id, parentId, text, more = {}) {
  return { id, parentId, children: [], nodeType: "text", text, collapsed: false, details: "", note: "", attributes: {}, link: "", ...more };
}

const DETAILS = "detail text for a realistic node payload. ".repeat(5);

function largeScopedMap({ total = 20000, own = 650, nested = 30, subtree = 16400, rootOwn = 1800 } = {}) {
  const nodes = { root: node("root", null, "Large Root") };
  let count = 1;
  const add = (id, parentId, text, more = {}) => {
    nodes[id] = node(id, parentId, text, { details: DETAILS, attributes: { "m3e:status": "open" }, ...more });
    nodes[parentId].children.push(id);
    count += 1;
  };
  add("area", "root", "Area");
  add("S", "area", "Opened scope", { nodeType: "folder" });
  const groups = 25;
  for (let g = 0; g < groups; g += 1) add(`s_g${g}`, "S", `Own group ${g}`);
  // Loaded in scope view: root, area, S, the own nodes and the nested scope nodes.
  for (let i = 0; count < own - nested; i += 1) add(`s_n${i}`, `s_g${i % groups}`, `Own item ${i}`);
  for (let e = 0; e < nested; e += 1) add(`s_e${e}`, e % 2 === 0 ? "S" : `s_g${e % groups}`, `Nested scope ${e}`, { nodeType: "folder" });

  // A region (a nested scope or a sibling scope) gets plain children and, now and then,
  // a scope node of its own that takes the next 25 nodes.
  const regions = new Map();
  const unloaded = [];
  const fill = (prefix, regionIds, until) => {
    for (let i = 0; count < until; i += 1) {
      const regionId = regionIds[i % regionIds.length];
      const region = regions.get(regionId) ?? { seen: 0, sub: null, left: 0 };
      regions.set(regionId, region);
      region.seen += 1;
      const id = `${prefix}${i}`;
      if (region.seen % 60 === 0) {
        add(id, regionId, `Sub scope ${id}`, { nodeType: "folder" });
        region.sub = id;
        region.left = 25;
        continue;
      }
      add(id, region.left > 0 ? region.sub : regionId, `Unloaded item ${id}`);
      if (region.left > 0) region.left -= 1;
      unloaded.push(id);
    }
  };
  // The contents of the nested scopes: the subtree of S, less what is counted above (root, area).
  fill("x", Array.from({ length: nested }, (_, e) => `s_e${e}`), subtree + 2);

  // The map root's own scope: plain, uncollapsed nodes.
  const rootGroups = 30;
  const rootOwnEnd = count + rootOwn;
  for (let g = 0; g < rootGroups && count < rootOwnEnd; g += 1) add(`r_g${g}`, "root", `Root group ${g}`);
  for (let i = 0; count < rootOwnEnd; i += 1) add(`r_n${i}`, `r_g${i % rootGroups}`, `Root item ${i}`);

  // Sibling scopes take the rest.
  const outside = 20;
  for (let o = 0; o < outside; o += 1) add(`o${o}`, "root", `Other scope ${o}`, { nodeType: "folder" });
  fill("y", Array.from({ length: outside }, (_, o) => `o${o}`), total);

  const links = {};
  const link = (id, sourceNodeId, targetNodeId) => {
    links[id] = { id, sourceNodeId, targetNodeId, direction: "forward", style: "default", attributes: {} };
  };
  for (let i = 0; i < 40; i += 1) link(`l_in${i}`, `s_n${i}`, `s_n${i + 100}`);
  for (let i = 0; i < 20; i += 1) link(`l_out${i}`, `s_n${i + 200}`, unloaded[i * 7]);
  for (let i = 0; i < 2000 && (i * 9 + 5) < unloaded.length; i += 1) link(`l_far${i}`, unloaded[i * 9], unloaded[i * 9 + 5]);
  return { rootId: "root", nodes, links };
}

module.exports = { largeScopedMap, node };
