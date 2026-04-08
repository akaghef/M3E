// Rebuild strategy map with richer sub-scopes
var fs = require("fs");
var doc = JSON.parse(fs.readFileSync("tmp_map.json", "utf8"));
var nodes = doc.state.nodes;
var ts = Date.now();
var seq = 0;

function mkNode(text, parentId, attrs) {
  seq++;
  var id = "n_g_" + ts + "_" + seq;
  nodes[id] = { id: id, parentId: parentId, text: text, children: [], attributes: attrs || {} };
  nodes[parentId].children.push(id);
  return nodes[id];
}

function findChild(parentId, text) {
  var p = nodes[parentId];
  if (!p || !p.children) return null;
  for (var i = 0; i < p.children.length; i++) {
    var c = nodes[p.children[i]];
    if (c && c.text === text) return c;
  }
  return null;
}

// Find strategy node
var strategyId = null;
for (var id in nodes) {
  if (nodes[id].text === "strategy" && nodes[id].parentId === "n_1775548022525_s9nvf4") {
    strategyId = id; break;
  }
}

// === AI Integration: group into sub-scopes ===
var aiId = findChild(strategyId, "AI Integration").id;
var ai = nodes[aiId];

var mcpScope = mkNode("MCP Server", aiId, {});
var gatewayScope = mkNode("Gateway / LLM", aiId, {});
var subagentScope = mkNode("AI Subagents", aiId, {});

// Move existing children into sub-scopes
ai.children.slice().forEach(function(cid) {
  var c = nodes[cid];
  if (!c) return;
  if (c.id === mcpScope.id || c.id === gatewayScope.id || c.id === subagentScope.id) return;

  var target = null;
  if (c.text.match(/MCP/i)) target = mcpScope;
  else if (c.text.match(/Gateway|LiteLLM|Bitwarden/i)) target = gatewayScope;
  else target = subagentScope; // Linear text, Topic suggestion, etc.

  ai.children = ai.children.filter(function(x){ return x !== cid; });
  c.parentId = target.id;
  target.children.push(cid);
});

// Add detail nodes
mkNode("Claude Desktop integration test", mcpScope.id, {status:"ready", agent:"manage", priority:"P3"});

mkNode("Phase 1: direct call (done)", gatewayScope.id, {status:"done"});
mkNode("API key rotation design", gatewayScope.id, {status:"idea"});

mkNode("title-rewrite", subagentScope.id, {status:"planned"});
mkNode("duplicate-check", subagentScope.id, {status:"planned"});
mkNode("suggest-parent", subagentScope.id, {status:"planned"});
mkNode("summarize-subtree", subagentScope.id, {status:"idea"});

// === Collaboration & Sync: add detail ===
var collabId = findChild(strategyId, "Collaboration & Sync").id;
mkNode("entity list UI", collabId, {status:"ready", agent:"visual", priority:"P1"});
mkNode("conflict backup save/restore", collabId, {status:"ready", agent:"data", priority:"P1"});
mkNode("operation audit log", collabId, {status:"planned", agent:"data"});
mkNode("scope lock + alias consistency", collabId, {status:"planned"});

// === Data & Import/Export: dedup + add ===
var dataId = findChild(strategyId, "Data & Import/Export").id;
nodes[dataId].children.slice().forEach(function(cid) {
  var c = nodes[cid];
  if (!c) return;
  // remove duplicates without agent attr
  if (c.text.match(/Linear.*Tree.*L1/) && !c.attributes.agent) {
    nodes[dataId].children = nodes[dataId].children.filter(function(x){return x!==cid;});
    delete nodes[cid];
  }
  if (c.text.match(/parser.*reconcile/) && !c.attributes.agent) {
    nodes[dataId].children = nodes[dataId].children.filter(function(x){return x!==cid;});
    delete nodes[cid];
  }
});
mkNode("JSON/SQLite dual persistence (done)", dataId, {status:"done"});
mkNode("Freeplane .mm export", dataId, {status:"idea"});
mkNode("SQLite snapshot backup", dataId, {status:"idea"});

// === Scope & Structure: dedup + add ===
var scopeId = findChild(strategyId, "Scope & Structure").id;
nodes[scopeId].children.slice().forEach(function(cid) {
  var c = nodes[cid];
  if (c && c.text === "scope/alias Beta" && !c.attributes.agent) {
    nodes[scopeId].children = nodes[scopeId].children.filter(function(x){return x!==cid;});
    delete nodes[cid];
  }
});
mkNode("scope transition animation", scopeId, {status:"idea"});
mkNode("scope bookmark", scopeId, {status:"idea"});

// === Rendering & UX: add ===
var renderId = findChild(strategyId, "Rendering & UX").id;
mkNode("dark mode", renderId, {status:"idea"});
mkNode("node collapse/expand UX", renderId, {status:"idea"});
mkNode("minimap overview", renderId, {status:"idea"});
mkNode("Fit-to-content button", renderId, {status:"ready", agent:"visual", priority:"P4"});

// === Infrastructure: dedup + add ===
var infraId = findChild(strategyId, "Infrastructure").id;
nodes[infraId].children.slice().forEach(function(cid) {
  var c = nodes[cid];
  if (!c) return;
  if (c.text === "CI Stage A" && !c.attributes.agent) {
    nodes[infraId].children = nodes[infraId].children.filter(function(x){return x!==cid;});
    delete nodes[cid];
  }
  if (c.text === "test environment" && !c.attributes.agent) {
    nodes[infraId].children = nodes[infraId].children.filter(function(x){return x!==cid;});
    delete nodes[cid];
  }
});
mkNode("E2E test (Playwright)", infraId, {status:"ready", agent:"manage"});
mkNode("branch-role gate (CI)", infraId, {status:"planned", agent:"manage"});
mkNode("npm audit / dependency check", infraId, {status:"idea"});

// === Bugs: add agent attrs ===
var bugsId = findChild(strategyId, "Bugs").id;
var bugVisual = findChild(bugsId, "visual");
if (bugVisual) bugVisual.attributes = {agent:"visual"};
var bugData = findChild(bugsId, "data");
if (bugData) bugData.attributes = {agent:"data"};
var bugOp = findChild(bugsId, "operation");
if (bugOp) bugOp.attributes = {agent:"manage"};

// Print result
console.log("=== Updated strategy ===");
function pt(id, d) {
  if (d > 3) return;
  var n = nodes[id]; if(!n) return;
  var p = ""; for(var i=0;i<d;i++) p+="  ";
  var cc = (n.children||[]).length;
  var a = n.attributes && Object.keys(n.attributes).length ? " " + JSON.stringify(n.attributes) : "";
  console.log(p + n.text + (cc ? " ("+cc+")" : "") + a);
  if(n.children) n.children.forEach(function(c){pt(c,d+1);});
}
pt(strategyId, 0);

fs.writeFileSync("tmp_map_post.json", JSON.stringify({ state: doc.state }));
console.log("\nReady to POST");
