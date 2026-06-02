import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const repoRoot = path.resolve(projectRoot, "..", "..");
const specPath = path.join(projectRoot, "presentation_spec.json");
const summaryPath = path.join(repoRoot, "docs", "for-akaghef", "v4_demo", "v4_service_slice_summary.json");
const outDir = path.join(repoRoot, "docs", "for-akaghef", "pj05_presentation");
const outPath = path.join(outDir, "260514_v4_embedded_presentation.html");
const artifactPath = path.join(projectRoot, "artifacts", "260514_v4_embedded_presentation.html");

const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const summary = fs.existsSync(summaryPath)
  ? JSON.parse(fs.readFileSync(summaryPath, "utf8"))
  : { mapId: "map_team_swingby_v4_slice_260502", finalChecks: {}, links: {} };
const nodeWidth = 148;
const nodeHalfWidth = nodeWidth / 2;

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.dirname(artifactPath), { recursive: true });

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function jsonScript(id, value) {
  const json = JSON.stringify(value).replaceAll("<", "\\u003c");
  return `<script type="application/json" id="${id}">${json}</script>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(spec.title)}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0d1018;
      --panel: #141924;
      --panel-2: #10141d;
      --line: #283142;
      --text: #e8edf7;
      --muted: #8d98aa;
      --dim: #455064;
      --active: #f5bf22;
      --active-2: #ffd861;
      --actor: #f173b8;
      --surface: #42b9ee;
      --pipeline: #39d391;
      --data: #ffa51e;
      --external: #92a2b7;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: radial-gradient(circle at 35% 0%, #161b29 0, #0d1018 48%, #090b10 100%);
      color: var(--text);
      font-family: "Segoe UI", "Yu Gothic UI", sans-serif;
      letter-spacing: 0;
    }
    .shell {
      min-height: 100vh;
      padding: 22px 28px 26px;
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      gap: 16px;
    }
    header h1 {
      margin: 0 0 8px;
      font-size: 25px;
      line-height: 1.15;
    }
    header p {
      margin: 0;
      color: var(--muted);
      max-width: 980px;
      line-height: 1.45;
      font-size: 13px;
      font-weight: 600;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }
    .legend span { display: inline-flex; gap: 6px; align-items: center; }
    .swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
    .stage {
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(920px, 1fr) 360px;
      gap: 16px;
    }
    .board, .side {
      border: 1px solid rgba(146, 162, 183, .18);
      background: rgba(20, 25, 36, .76);
      border-radius: 8px;
      box-shadow: 0 24px 80px rgba(0,0,0,.28);
    }
    .board {
      position: relative;
      min-height: 610px;
      overflow: hidden;
    }
    .lane {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      border-left: 1px dashed rgba(146, 162, 183, .08);
    }
    .lane-label {
      position: absolute;
      top: 20px;
      color: rgba(141, 152, 170, .34);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .08em;
    }
    .node {
      position: absolute;
      width: ${nodeWidth}px;
      min-height: 56px;
      border: 1px solid rgba(146, 162, 183, .14);
      background: rgba(18, 24, 35, .72);
      border-radius: 7px;
      padding: 11px 12px;
      opacity: .42;
      transition: opacity .16s linear, border-color .16s linear, box-shadow .16s linear, background .16s linear;
    }
    .node .title {
      font-size: 13px;
      font-weight: 800;
      line-height: 1.2;
      white-space: normal;
    }
    .node .sub {
      margin-top: 4px;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.25;
      font-weight: 700;
    }
    .node.kind-actor { border-left: 3px solid var(--actor); }
    .node.kind-surface { border-left: 3px solid var(--surface); }
    .node.kind-pipeline { border-left: 3px solid var(--pipeline); }
    .node.kind-data { border-left: 3px solid var(--data); }
    .node.kind-external { border-left: 3px solid var(--external); }
    .node.active {
      opacity: 1;
      border-color: var(--active);
      box-shadow: 0 0 0 1px rgba(245, 191, 34, .56), 0 0 24px rgba(245, 191, 34, .13);
      background: rgba(26, 29, 39, .96);
    }
    svg.links {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
      pointer-events: none;
    }
    .edge {
      fill: none;
      stroke: rgba(146, 162, 183, .34);
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: .72;
      transition: stroke .16s linear, stroke-width .16s linear, opacity .16s linear;
    }
    .edge.active {
      stroke: var(--active);
      stroke-width: 4.2;
      opacity: 1;
      filter: drop-shadow(0 0 7px rgba(245,191,34,.54));
    }
    .edge-label {
      fill: rgba(174, 186, 203, .54);
      font-size: 10px;
      font-weight: 800;
      transition: fill .16s linear;
    }
    .edge-label.active { fill: var(--active-2); }
    .side {
      min-height: 610px;
      padding: 14px;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      gap: 12px;
    }
    .side h2 {
      margin: 0 0 10px;
      color: var(--muted);
      font-size: 12px;
      letter-spacing: .08em;
    }
    .flow-list, .steps {
      display: grid;
      gap: 8px;
    }
    button.flow, .step-card {
      width: 100%;
      border: 1px solid rgba(146, 162, 183, .12);
      border-radius: 7px;
      background: rgba(17, 22, 32, .86);
      color: var(--text);
      text-align: left;
      padding: 10px 11px;
    }
    button.flow {
      cursor: pointer;
      font-family: inherit;
    }
    button.flow:hover { border-color: rgba(245, 191, 34, .42); }
    button.flow.active {
      border-color: var(--active);
      box-shadow: inset 3px 0 0 var(--active);
    }
    .flow-title, .step-title {
      font-size: 13px;
      font-weight: 850;
      line-height: 1.25;
    }
    .flow-sub, .step-body {
      margin-top: 5px;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.35;
      font-weight: 650;
    }
    .steps-wrap {
      overflow: auto;
      padding-right: 2px;
    }
    .step-card {
      opacity: .42;
      cursor: pointer;
    }
    .step-card.active {
      opacity: 1;
      border-color: rgba(245, 191, 34, .62);
      background: rgba(25, 29, 39, .96);
    }
    .badge {
      display: inline-flex;
      width: 22px;
      height: 22px;
      border-radius: 999px;
      align-items: center;
      justify-content: center;
      background: var(--active);
      color: #2a2200;
      font-size: 12px;
      font-weight: 950;
      margin-right: 8px;
      vertical-align: top;
      flex: 0 0 auto;
    }
    .step-head {
      display: flex;
      align-items: flex-start;
    }
    .progress {
      display: grid;
      gap: 9px;
      border-top: 1px solid rgba(146, 162, 183, .13);
      padding-top: 12px;
    }
    .progress-row {
      display: grid;
      grid-template-columns: 64px minmax(0, 1fr) 42px;
      gap: 8px;
      align-items: center;
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
    }
    .bar {
      height: 7px;
      background: rgba(69, 80, 100, .48);
      border-radius: 999px;
      overflow: hidden;
    }
    .fill {
      height: 100%;
      width: 0;
      border-radius: inherit;
      background: linear-gradient(90deg, #f5bf22, #39d391);
      transition: width .18s ease;
    }
    .controls {
      display: flex;
      gap: 8px;
    }
    .controls button {
      height: 32px;
      padding: 0 10px;
      border: 1px solid rgba(146, 162, 183, .2);
      background: rgba(17, 22, 32, .9);
      color: var(--text);
      border-radius: 6px;
      font-weight: 800;
      cursor: pointer;
    }
    .meta {
      color: var(--muted);
      font-size: 11px;
      line-height: 1.45;
    }
    .meta code {
      color: #dbe7ff;
      background: rgba(255,255,255,.06);
      padding: 2px 4px;
      border-radius: 4px;
    }
    @media (max-width: 1180px) {
      .shell { padding: 18px; }
      .stage { grid-template-columns: 1fr; }
      .board { min-width: 920px; }
      .side { min-height: 520px; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header>
      <h1>${escapeHtml(spec.title)}</h1>
      <p>DaveJ 型の flow walkthrough を M3E の presentation surface として再構成した seed。node 座標は固定し、flow / step で変わるのは link highlight と右 pane だけ。</p>
    </header>
    <div class="legend">
      <span><i class="swatch" style="background:var(--actor)"></i>Actor</span>
      <span><i class="swatch" style="background:var(--surface)"></i>M3E surface</span>
      <span><i class="swatch" style="background:var(--pipeline)"></i>Flash / pipeline</span>
      <span><i class="swatch" style="background:var(--data)"></i>Map data</span>
      <span><i class="swatch" style="background:var(--external)"></i>External / derived</span>
    </div>
    <main class="stage">
      <section class="board" id="board" aria-label="Fixed node presentation map">
        <svg class="links" id="links"></svg>
      </section>
      <aside class="side">
        <section>
          <h2>FLOWS</h2>
          <div class="flow-list" id="flow-list"></div>
        </section>
        <section class="steps-wrap">
          <h2>STEPS</h2>
          <div class="steps" id="steps"></div>
        </section>
        <section class="progress">
          <div class="progress-row"><span>Flow</span><div class="bar"><div class="fill" id="flow-fill"></div></div><span id="flow-count"></span></div>
          <div class="progress-row"><span>Step</span><div class="bar"><div class="fill" id="step-fill"></div></div><span id="step-count"></span></div>
          <div class="controls">
            <button id="prev">Prev</button>
            <button id="next">Next</button>
            <button id="play">Play</button>
          </div>
          <div class="meta">mapId: <code>${escapeHtml(summary.mapId ?? "")}</code><br>final checks: nodes=<code>${escapeHtml(summary.finalChecks?.nodeCount ?? "?")}</code>, conflict=<code>${escapeHtml(summary.conflict?.staleStatus ?? "409")}</code></div>
        </section>
      </aside>
    </main>
  </div>
  ${jsonScript("presentation-spec", spec)}
  <script>
    const spec = JSON.parse(document.getElementById("presentation-spec").textContent);
    const board = document.getElementById("board");
    const svg = document.getElementById("links");
    const flowList = document.getElementById("flow-list");
    const stepsEl = document.getElementById("steps");
    const flowFill = document.getElementById("flow-fill");
    const stepFill = document.getElementById("step-fill");
    const flowCount = document.getElementById("flow-count");
    const stepCount = document.getElementById("step-count");
    const nodeById = new Map(spec.nodes.map((node) => [node.id, node]));
    const linkById = new Map(spec.links.map((link) => [link.id, link]));
    let flowIndex = 0;
    let stepIndex = 0;
    let timer = null;

    function center(node) {
      return { x: node.x + ${nodeHalfWidth}, y: node.y + 28 };
    }

    function route(link) {
      const from = center(nodeById.get(link.from));
      const to = center(nodeById.get(link.to));
      const startX = from.x + (to.x >= from.x ? ${nodeHalfWidth} : -${nodeHalfWidth});
      const startY = from.y;
      const endX = to.x + (to.x >= from.x ? -${nodeHalfWidth} : ${nodeHalfWidth});
      const endY = to.y;
      const gap = Math.abs(endX - startX);
      const verticalDelta = Math.abs(endY - startY);
      if (gap < 60 && verticalDelta < 36) {
        const midX = Math.round((startX + endX) / 2);
        const midY = Math.round(Math.min(startY, endY) - 52);
        return \`M \${startX} \${startY} C \${midX} \${midY}, \${midX} \${midY}, \${endX} \${endY}\`;
      }
      const midX = Math.round((startX + endX) / 2);
      return \`M \${startX} \${startY} C \${midX} \${startY}, \${midX} \${endY}, \${endX} \${endY}\`;
    }

    function drawStatic() {
      spec.lanes.forEach((lane) => {
        const line = document.createElement("div");
        line.className = "lane";
        line.style.left = lane.x + "px";
        board.appendChild(line);
        const label = document.createElement("div");
        label.className = "lane-label";
        label.textContent = lane.label;
        label.style.left = (lane.x + 16) + "px";
        board.appendChild(label);
      });

      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      defs.innerHTML = [
        '<marker id="arrow-muted" viewBox="0 0 10 10" refX="8.4" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">',
        '<path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(174,186,203,.72)"></path>',
        '</marker>',
        '<marker id="arrow-active" viewBox="0 0 10 10" refX="8.4" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">',
        '<path d="M 0 0 L 10 5 L 0 10 z" fill="#f5bf22"></path>',
        '</marker>',
      ].join("");
      svg.appendChild(defs);

      spec.links.forEach((link) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("id", "edge-" + link.id);
        path.setAttribute("class", "edge");
        path.setAttribute("d", route(link));
        path.setAttribute("marker-end", "url(#arrow-muted)");
        svg.appendChild(path);

        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        const a = center(nodeById.get(link.from));
        const b = center(nodeById.get(link.to));
        label.setAttribute("id", "edge-label-" + link.id);
        label.setAttribute("class", "edge-label");
        label.setAttribute("x", Math.round((a.x + b.x) / 2));
        label.setAttribute("y", Math.round((a.y + b.y) / 2) - 8);
        label.textContent = link.label;
        svg.appendChild(label);
      });

      spec.nodes.forEach((node) => {
        const div = document.createElement("div");
        div.id = "node-" + node.id;
        div.className = "node kind-" + node.kind;
        div.style.left = node.x + "px";
        div.style.top = node.y + "px";
        div.innerHTML = \`<div class="title">\${node.title}</div><div class="sub">\${node.subtitle}</div>\`;
        board.appendChild(div);
      });

      spec.flows.forEach((flow, index) => {
        const button = document.createElement("button");
        button.className = "flow";
        button.innerHTML = \`<div class="flow-title">\${flow.title}</div><div class="flow-sub">\${flow.subtitle}</div>\`;
        button.addEventListener("click", () => {
          flowIndex = index;
          stepIndex = 0;
          stop();
          render();
        });
        flowList.appendChild(button);
      });
    }

    function activeLinks() {
      const flow = spec.flows[flowIndex];
      const step = flow.steps[stepIndex];
      return new Set(step?.links?.length ? step.links : flow.links);
    }

    function activeNodes(links) {
      const nodes = new Set();
      links.forEach((id) => {
        const link = linkById.get(id);
        if (link) {
          nodes.add(link.from);
          nodes.add(link.to);
        }
      });
      return nodes;
    }

    function renderSteps(flow) {
      stepsEl.innerHTML = "";
      flow.steps.forEach((step, index) => {
        const card = document.createElement("button");
        card.className = "step-card" + (index === stepIndex ? " active" : "");
        card.innerHTML = \`<div class="step-head"><span class="badge">\${index + 1}</span><div><div class="step-title">\${step.title}</div><div class="step-body">\${step.body}</div></div></div>\`;
        card.addEventListener("click", () => {
          stepIndex = index;
          stop();
          render();
        });
        stepsEl.appendChild(card);
      });
    }

    function render() {
      const flow = spec.flows[flowIndex];
      const links = activeLinks();
      const nodes = activeNodes(links);

      spec.links.forEach((link) => {
        const edge = document.getElementById("edge-" + link.id);
        edge?.classList.toggle("active", links.has(link.id));
        edge?.setAttribute("marker-end", links.has(link.id) ? "url(#arrow-active)" : "url(#arrow-muted)");
        document.getElementById("edge-label-" + link.id)?.classList.toggle("active", links.has(link.id));
      });
      spec.nodes.forEach((node) => {
        document.getElementById("node-" + node.id)?.classList.toggle("active", nodes.has(node.id));
      });
      [...flowList.children].forEach((child, index) => child.classList.toggle("active", index === flowIndex));
      renderSteps(flow);

      flowFill.style.width = ((flowIndex + 1) / spec.flows.length * 100) + "%";
      stepFill.style.width = ((stepIndex + 1) / flow.steps.length * 100) + "%";
      flowCount.textContent = \`\${flowIndex + 1}/\${spec.flows.length}\`;
      stepCount.textContent = \`\${stepIndex + 1}/\${flow.steps.length}\`;
    }

    function next() {
      const flow = spec.flows[flowIndex];
      if (stepIndex < flow.steps.length - 1) stepIndex += 1;
      else {
        flowIndex = (flowIndex + 1) % spec.flows.length;
        stepIndex = 0;
      }
      render();
    }

    function prev() {
      if (stepIndex > 0) stepIndex -= 1;
      else {
        flowIndex = (flowIndex + spec.flows.length - 1) % spec.flows.length;
        stepIndex = spec.flows[flowIndex].steps.length - 1;
      }
      render();
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
      document.getElementById("play").textContent = "Play";
    }

    document.getElementById("next").addEventListener("click", () => { stop(); next(); });
    document.getElementById("prev").addEventListener("click", () => { stop(); prev(); });
    document.getElementById("play").addEventListener("click", () => {
      if (timer) return stop();
      timer = setInterval(next, 2300);
      document.getElementById("play").textContent = "Pause";
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") { stop(); next(); }
      if (event.key === "ArrowLeft") { stop(); prev(); }
      if (event.key === "Escape") stop();
    });

    drawStatic();
    render();
  </script>
</body>
</html>`;

fs.writeFileSync(outPath, html, "utf8");
fs.writeFileSync(artifactPath, html, "utf8");
console.log(JSON.stringify({ ok: true, outPath, artifactPath }, null, 2));
