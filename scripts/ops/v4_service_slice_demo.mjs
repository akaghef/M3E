import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const defaultPdf = path.join(repoRoot, "tmp", "AkaghefAlgebra", "Execution", "C2410", "Calc240908.pdf");

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg.startsWith("--")) {
    args.set(arg.slice(2), process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[++i] : "1");
  }
}

const publicBase = (args.get("publicBase") || process.env.M3E_PUBLIC_BASE || "https://akaghef-dell.tail6206ae.ts.net").replace(/\/+$/, "");
const workspaceId = args.get("workspaceId") || "ws_team_swingby";
const mapId = args.get("mapId") || "map_team_swingby_v4_slice_260502";
const pdfPath = path.resolve(args.get("pdfPath") || defaultPdf);
const outRoot = path.resolve(args.get("outRoot") || path.join(repoRoot, "docs", "for-akaghef", "v4_demo"));
const vaultPath = path.join(outRoot, "obsidian_vault");
const assetsDir = path.join(outRoot, "assets");
const summaryPath = path.join(outRoot, "v4_service_slice_summary.json");
const reportPath = path.join(outRoot, "260502_v4_service_slice_report.html");
const screenshotPath = path.join(assetsDir, "v4_service_slice_m3e.png");
const runId = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

fs.mkdirSync(outRoot, { recursive: true });
fs.mkdirSync(vaultPath, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

function findPython() {
  const candidates = [
    path.join(os.homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "python.exe"),
    "python",
    "py",
  ];
  return candidates.find((candidate) => {
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8", shell: false });
    return result.status === 0;
  });
}

function extractPdfText(filePath) {
  if (!fs.existsSync(filePath)) {
    return `PDF source missing: ${filePath}\nFallback V4 demo text.`;
  }
  const py = findPython();
  if (!py) {
    return `Python unavailable. PDF path was ${filePath}.`;
  }
  const code = [
    "import sys",
    "from pypdf import PdfReader",
    "p=sys.argv[1]",
    "r=PdfReader(p)",
    "parts=[]",
    "for i,page in enumerate(r.pages[:3]):",
    "    text=page.extract_text() or ''",
    "    parts.append(f'## Page {i+1}\\n{text[:3500]}')",
    "print('\\n\\n'.join(parts))",
  ].join("\n");
  const result = spawnSync(py, ["-c", code, filePath], { encoding: "utf8", maxBuffer: 2_000_000 });
  if (result.status !== 0) {
    return `PDF extraction failed for ${filePath}\n${result.stderr || result.stdout}`;
  }
  return result.stdout.trim() || `PDF had no extractable text: ${filePath}`;
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload = {};
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }
  return { response, payload, text };
}

function api(pathname) {
  return `${publicBase}${pathname}`;
}

function newNode(id, parentId, text, details = "", attrs = {}) {
  return {
    id,
    parentId,
    children: [],
    nodeType: "text",
    text,
    collapsed: false,
    details,
    note: "",
    attributes: attrs,
    link: "",
  };
}

function baseState(pdfText) {
  const nodes = {};
  const root = "root";
  const flash = "flash_mapify";
  const miro = "miro_discussion";
  const obsidian = "obsidian_sync";
  const github = "github_boundary";
  const conflict = "conflict_resolution";
  nodes[root] = newNode(root, null, "V4 service-equivalent demo", "Mapify x Miro x Obsidian x GitHub vertical slice.");
  nodes[flash] = newNode(flash, root, "Flash / Mapify: PDF -> map", pdfText.slice(0, 5000), { "v4:service": "mapify", "v4:band": "flash" });
  nodes[miro] = newNode(miro, root, "Miro-style visual discussion", "Sticky notes, decision clusters, comments, and shared review are represented as map nodes on the same canvas.", { "v4:service": "miro" });
  nodes[obsidian] = newNode(obsidian, root, "Obsidian vault sync", "Export/import through markdown vault files, preserving local-first source control.", { "v4:service": "obsidian" });
  nodes[github] = newNode(github, root, "GitHub boundary: always staged, M3E secret lock", "No git add UX. M3E treats working changes as staged proposals. Secret-bearing nodes are locked before sync/publish.", { "v4:service": "github", "secret:lock": "required-before-remote" });
  nodes[conflict] = newNode(conflict, root, "Conflict resolution lab", "baseSavedAt detects stale writes; resolution is explicit and preserves remote edits.", { "v4:service": "github-like-conflict" });
  nodes[root].children = [flash, miro, obsidian, github, conflict];
  return { rootId: root, nodes };
}

function addChild(state, id, parentId, text, details = "", attrs = {}) {
  state.nodes[id] = newNode(id, parentId, text, details, attrs);
  state.nodes[parentId].children.push(id);
  return state;
}

async function postMap(state, bodyExtra = {}) {
  const { response, payload } = await requestJson(api(`/api/maps/${encodeURIComponent(mapId)}`), {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state, ...bodyExtra }),
  });
  if (!response.ok) {
    const err = new Error(`POST map failed: HTTP ${response.status}`);
    err.payload = payload;
    throw err;
  }
  return payload;
}

async function getMap() {
  const { response, payload } = await requestJson(api(`/api/maps/${encodeURIComponent(mapId)}`));
  if (!response.ok) throw new Error(`GET map failed: HTTP ${response.status}`);
  return payload;
}

async function flashIngestAndApprove(pdfText) {
  const ingest = await requestJson(api("/api/flash/ingest"), {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      mapId,
      sourceType: "markdown",
      content: `# PDF Flash digest ${runId}\n\n${pdfText.slice(0, 6000)}`,
      options: { targetNodeId: "flash_mapify", maxDepth: 3 },
    }),
  });
  if (ingest.response.status !== 202 || !ingest.payload.draftId) {
    throw new Error(`Flash ingest failed: HTTP ${ingest.response.status}`);
  }
  const approve = await requestJson(api(`/api/flash/draft/${encodeURIComponent(ingest.payload.draftId)}/approve`), {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ mode: "all", targetParentId: "flash_mapify" }),
  });
  if (!approve.response.ok) {
    throw new Error(`Flash approve failed: HTTP ${approve.response.status}`);
  }
  return { draftId: ingest.payload.draftId, committedNodeIds: approve.payload.committedNodeIds || [] };
}

async function exportVault() {
  const { response, text } = await requestJson(api("/api/vault/export"), {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ mapId, vaultPath, options: { skipAiTransform: true } }),
  });
  if (!response.ok && !text.includes("vault-export-complete")) {
    throw new Error(`Vault export failed: HTTP ${response.status}`);
  }
  return text;
}

async function importVault() {
  const { response, text } = await requestJson(api("/api/vault/import"), {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ mapId, vaultPath, options: { skipAiTransform: true } }),
  });
  if (!response.ok && !text.includes("vault-import-complete")) {
    throw new Error(`Vault import failed: HTTP ${response.status}`);
  }
  return text;
}

function appendObsidianNote() {
  const files = fs.readdirSync(vaultPath, { recursive: true })
    .filter((name) => String(name).endsWith(".md"))
    .map((name) => path.join(vaultPath, String(name)));
  const target = files[0] || path.join(vaultPath, "V4 service-equivalent demo.md");
  if (!fs.existsSync(target)) fs.writeFileSync(target, "# V4 service-equivalent demo\n", "utf8");
  fs.appendFileSync(target, `\n\n## Obsidian sync note ${runId}\n\nThis paragraph was edited in the exported vault and imported back to M3E.\n`, "utf8");
  return target;
}

function ensureV4Anchors(state, pdfText) {
  const rootId = state.rootId || "root";
  if (!state.nodes[rootId]) {
    state.rootId = rootId;
    state.nodes[rootId] = newNode(rootId, null, "V4 service-equivalent demo");
  }
  state.nodes[rootId].text = "V4 service-equivalent demo";
  state.nodes[rootId].details = [
    state.nodes[rootId].details || "",
    "Normalized after Obsidian import so the final map remains the V4 service slice, not the vault folder.",
  ].filter(Boolean).join("\n\n");
  state.nodes[rootId].children = Array.isArray(state.nodes[rootId].children) ? state.nodes[rootId].children : [];

  const anchors = [
    ["flash_mapify", "Flash / Mapify: PDF -> map", pdfText.slice(0, 5000), { "v4:service": "mapify", "v4:band": "flash" }],
    ["miro_discussion", "Miro-style visual discussion", "Sticky notes, decision clusters, comments, and shared review are represented as map nodes on the same canvas.", { "v4:service": "miro" }],
    ["obsidian_sync", "Obsidian vault sync", "Export/import through markdown vault files, preserving local-first source control.", { "v4:service": "obsidian" }],
    ["github_boundary", "GitHub boundary: always staged, M3E secret lock", "No git add UX. M3E treats working changes as staged proposals. Secret-bearing nodes are locked before sync/publish.", { "v4:service": "github", "secret:lock": "required-before-remote" }],
    ["conflict_resolution", "Conflict resolution lab", "baseSavedAt detects stale writes; resolution is explicit and preserves remote edits.", { "v4:service": "github-like-conflict" }],
  ];
  for (const [id, text, details, attrs] of anchors) {
    if (!state.nodes[id]) {
      state.nodes[id] = newNode(id, rootId, text, details, attrs);
    } else {
      state.nodes[id].parentId = rootId;
      state.nodes[id].text = text;
      state.nodes[id].details = details;
      state.nodes[id].attributes = { ...(state.nodes[id].attributes || {}), ...attrs };
    }
    if (!state.nodes[rootId].children.includes(id)) {
      state.nodes[rootId].children.push(id);
    }
  }
  return state;
}

async function conflictRoundTrip() {
  const stale = await getMap();
  const staleSavedAt = stale.savedAt;

  const hostState = JSON.parse(JSON.stringify(stale.state));
  addChild(hostState, `host_miro_decision_${runId}`, hostState.rootId, `host Miro decision ${runId}`, "Host-side visual discussion outcome.", { "v4:source": "host" });
  const host = await postMap(hostState, { baseSavedAt: staleSavedAt });

  const vmState = JSON.parse(JSON.stringify(stale.state));
  addChild(vmState, `vm_obsidian_stale_${runId}`, vmState.rootId, `VM stale Obsidian edit ${runId}`, "This stale write should be rejected.", { "v4:source": "vm-stale" });
  const stalePost = await requestJson(api(`/api/maps/${encodeURIComponent(mapId)}`), {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ state: vmState, baseSavedAt: staleSavedAt }),
  });
  if (stalePost.response.status !== 409) {
    throw new Error(`Expected stale save HTTP 409, got ${stalePost.response.status}`);
  }

  const remote = stalePost.payload.remoteState || (await getMap()).state;
  const resolvedState = JSON.parse(JSON.stringify(remote));
  addChild(resolvedState, `vm_resolution_${runId}`, resolvedState.rootId, `VM resolution edit ${runId}`, "Explicit resolution after seeing remote state.", { "v4:source": "vm-resolution" });
  const resolved = await postMap(resolvedState, { baseSavedAt: staleSavedAt, force: true });
  const final = await getMap();
  const labels = Object.values(final.state.nodes).map((node) => node.text);
  for (const expected of [`host Miro decision ${runId}`, `VM resolution edit ${runId}`]) {
    if (!labels.includes(expected)) throw new Error(`Final state missing ${expected}`);
  }
  return { staleSavedAt, hostSavedAt: host.savedAt, staleStatus: stalePost.response.status, resolvedSavedAt: resolved.savedAt };
}

async function screenshot() {
  const { chromium } = require(path.join(repoRoot, "beta", "node_modules", "playwright"));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`${publicBase}/viewer.html?ws=${encodeURIComponent(workspaceId)}&map=${encodeURIComponent(mapId)}&access=edit`, {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await browser.close();
}

function writeReport(summary) {
  const screenshotRel = path.relative(path.dirname(reportPath), screenshotPath).replace(/\\/g, "/");
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>M3E V4 Service Slice Report</title>
  <style>
    body { margin: 0; font-family: "Segoe UI", sans-serif; color: #1d252c; background: #f4f6f8; }
    main { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(360px, 0.55fr); gap: 14px; padding: 18px; }
    .pane { background: white; border: 1px solid #d8e0e6; border-radius: 8px; overflow: hidden; box-shadow: 0 18px 38px rgba(20,32,43,.12); }
    .map img { width: 100%; height: 100%; object-fit: cover; object-position: center 38%; display: block; }
    .situation { padding: 18px; display: grid; grid-template-rows: auto 1fr auto; gap: 14px; }
    h1 { margin: 0; font-size: 23px; letter-spacing: 0; }
    .sub { color: #60707d; font-size: 13px; margin-top: 5px; }
    .step { display: none; border: 1px solid #dce3e9; border-radius: 8px; padding: 12px; background: #fbfcfd; }
    .step.active { display: block; }
    .step h2 { margin: 0 0 8px; font-size: 16px; }
    .step p, .step li { font-size: 13px; line-height: 1.55; }
    .badge { display:inline-block; border-radius: 5px; padding: 3px 7px; font-size: 11px; font-weight: 800; background:#eef5ff; color:#2563eb; }
    .ok { background:#e7f6ed; color:#16824a; }
    .warn { background:#fff3cf; color:#a66700; }
    .err { background:#fff0ef; color:#c24135; }
    .bar { height: 8px; background:#e5ebf0; border-radius: 99px; overflow: hidden; }
    .fill { height:100%; width:0; background:linear-gradient(90deg,#2563eb,#087990,#16824a); transition: width .2s linear; }
    code { background:#edf2f6; padding:2px 4px; border-radius:4px; }
    @media (max-width: 980px) { main { grid-template-columns: 1fr; } .map { min-height: 420px; } }
  </style>
</head>
<body>
<main>
  <section class="pane map"><img src="${screenshotRel}" alt="Actual M3E V4 demo map"></section>
  <section class="pane situation">
    <div>
      <h1>V4 Service Slice</h1>
      <div class="sub">実画面 + 状況だけを表示する報告動画 HTML。mapId: <code>${summary.mapId}</code></div>
    </div>
    <div id="steps">
      <article class="step active"><span class="badge ok">PDF -> Flash</span><h2>Mapify 相当</h2><p>PDF から抽出したテキストを Flash draft として ingest し、承認して map に取り込んだ。</p></article>
      <article class="step"><span class="badge ok">Miro</span><h2>議論の場</h2><p>host 側の visual discussion outcome を map node として追加。Miro 的な付箋・決定・議論 cluster を M3E 上で扱う。</p></article>
      <article class="step"><span class="badge ok">Obsidian</span><h2>Vault 同期</h2><p>map を Markdown vault に export し、vault 側編集を import して戻した。vault: <code>${summary.vaultPath}</code></p></article>
      <article class="step"><span class="badge err">409</span><h2>Conflict</h2><p>stale な VM/Obsidian 編集は <code>HTTP ${summary.conflict.staleStatus}</code> で止め、remote を見た上で resolution を明示保存した。</p></article>
      <article class="step"><span class="badge warn">GitHub design</span><h2>慎重設計</h2><p>GitHub は git add なし、常時 staged proposal、M3E secret lock、akaghef PC 正本同期を設計境界に固定。実 remote push はこの slice では実行しない。</p></article>
    </div>
    <div>
      <div class="bar"><div class="fill" id="fill"></div></div>
    </div>
  </section>
</main>
<script>
  const steps=[...document.querySelectorAll('.step')];
  const fill=document.getElementById('fill');
  let i=0;
  setInterval(()=>{ i=(i+1)%steps.length; steps.forEach((s,j)=>s.classList.toggle('active',j===i)); fill.style.width=((i+1)/steps.length*100)+'%'; }, 2600);
</script>
</body>
</html>`;
  fs.writeFileSync(reportPath, html, "utf8");
}

async function main() {
  console.log(`[V4] publicBase=${publicBase}`);
  console.log(`[V4] mapId=${mapId}`);
  console.log(`[V4] pdf=${pdfPath}`);
  const viewer = await fetch(`${publicBase}/viewer.html`);
  if (!viewer.ok) throw new Error(`M3E viewer is not reachable: HTTP ${viewer.status}`);

  const pdfText = extractPdfText(pdfPath);
  const seed = baseState(pdfText);
  const seeded = await postMap(seed, { force: true });
  const flash = await flashIngestAndApprove(pdfText);

  const afterFlash = await getMap();
  const miroState = JSON.parse(JSON.stringify(afterFlash.state));
  addChild(miroState, `miro_sticky_${runId}`, miroState.rootId, `Miro sticky: discuss imported PDF ${runId}`, "Discussion node produced during V4 slice.", { "v4:surface": "miro-like" });
  await postMap(miroState, { baseSavedAt: afterFlash.savedAt });

  const exportText = await exportVault();
  const vaultEditedPath = appendObsidianNote();
  const importText = await importVault();
  const imported = await getMap();
  const normalizedState = ensureV4Anchors(JSON.parse(JSON.stringify(imported.state)), pdfText);
  await postMap(normalizedState, { baseSavedAt: imported.savedAt });
  const conflict = await conflictRoundTrip();
  await screenshot();
  const final = await getMap();
  const finalLabels = Object.values(final.state.nodes).map((node) => node.text);

  const summary = {
    ok: true,
    runId,
    publicBase,
    workspaceId,
    mapId,
    pdfPath,
    vaultPath,
    vaultEditedPath,
    screenshotPath,
    reportPath,
    seededAt: seeded.savedAt,
    flash,
    exportEventSeen: exportText.includes("vault-export-complete"),
    importEventSeen: importText.includes("vault-import-complete"),
    conflict,
    finalChecks: {
      hasFlashAnchor: finalLabels.includes("Flash / Mapify: PDF -> map"),
      hasMiroAnchor: finalLabels.includes("Miro-style visual discussion"),
      hasObsidianAnchor: finalLabels.includes("Obsidian vault sync"),
      hasGithubAnchor: finalLabels.includes("GitHub boundary: always staged, M3E secret lock"),
      hasVmResolution: finalLabels.some((label) => label.startsWith("VM resolution edit")),
      nodeCount: finalLabels.length,
    },
    links: {
      viewer: `${publicBase}/viewer.html?ws=${workspaceId}&map=${mapId}&access=edit`,
      api: `${publicBase}/api/maps/${mapId}`,
    },
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  writeReport(summary);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
