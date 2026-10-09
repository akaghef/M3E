import React from "react";
import { createRoot } from "react-dom/client";
import { AGENT_ORRERY_FIXTURE, type OrreryNode } from "./agent_orrery_fixture";
import "./agent-orrery-lab.css";

const stateLabels = ["working", "waiting", "attention", "finished"] as const;

function edgePath(from: OrreryNode, to: OrreryNode): string {
  const startX = from.x + (to.x >= from.x ? 62 : -62);
  const endX = to.x + (to.x >= from.x ? -62 : 62);
  const midX = (startX + endX) / 2;
  return `M ${startX} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${endX} ${to.y}`;
}

function NodeMark({ node }: { node: OrreryNode }): React.ReactElement {
  if (node.kind === "agent") {
    return <g className={`orrery-node agent-node state-${node.state}`} data-node-kind="agent">
      <circle cx={node.x} cy={node.y} r="53" />
      <text className="agent-name" x={node.x} y={node.y - 5}>{node.label}</text>
      <text className="agent-role" x={node.x} y={node.y + 20}>{node.promptRole}</text>
      <title>{`${node.label}: ${node.state}; prompt role ${node.promptRole}`}</title>
    </g>;
  }
  return <g className={`orrery-node node-${node.kind}`} data-node-kind={node.kind}>
    <rect x={node.x - 62} y={node.y - 27} width="124" height="54" rx="12" />
    <text x={node.x} y={node.y + 5}>{node.label}</text>
    <text className="node-kind" x={node.x} y={node.y - 39}>{node.kind}</text>
  </g>;
}

function App(): React.ReactElement {
  const byId = new Map(AGENT_ORRERY_FIXTURE.nodes.map((node) => [node.id, node]));
  return <main className="orrery-lab">
    <header className="orrery-header">
      <div className="eyebrow">M3E / isolated visual lab</div>
      <h1 data-testid="breadcrumb">{AGENT_ORRERY_FIXTURE.breadcrumb}</h1>
      <p>{AGENT_ORRERY_FIXTURE.note}</p>
    </header>
    <section className="lab-layout">
      <div className="graph-card" aria-label="Static mixed node graph">
        <svg viewBox="0 0 1280 510" role="img" aria-label="Mixed M3E nodes and agent relationships">
          <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
          <g className="edges">
            {AGENT_ORRERY_FIXTURE.edges.map((edge) => { const from = byId.get(edge.from)!; const to = byId.get(edge.to)!; return <path key={`${edge.from}-${edge.to}`} className={`edge edge-${edge.relation}`} d={edgePath(from, to)} markerEnd="url(#arrow)" />; })}
          </g>
          {AGENT_ORRERY_FIXTURE.nodes.map((node) => <NodeMark key={node.id} node={node} />)}
        </svg>
      </div>
      <aside className="details" aria-label="Orrery mock legend">
        <div className="panel-kicker">Reading the mock</div>
        <h2>Two independent axes</h2>
        <p>{AGENT_ORRERY_FIXTURE.note}</p>
        <div className="legend-group"><h3>Node type</h3><div className="type-list">{["text", "image", "folder", "alias", "agent"].map((kind) => <span key={kind} className={`type-pill type-${kind}`}>{kind}</span>)}</div></div>
        <div className="legend-group"><h3>Agent runtime state</h3><div className="state-list">{stateLabels.map((state) => <span key={state}><i className={`state-dot state-${state}`} />{state}</span>)}</div></div>
        <div className="legend-group"><h3>Mock relations</h3><p className="relation-note"><span>→ spawn</span><span>→ communication</span><span>→ assignment</span></p></div>
        <div className="canon-note"><strong>Prompt role</strong> is runtime/execution metadata (lead, review, tests, docs). It is not future canonical <strong>Role/Contract</strong>.</div>
        <div className="profile-note"><strong>Force profile:</strong> Orrery<br /><span>Static coordinates only; no solver or live OT data.</span></div>
      </aside>
    </section>
  </main>;
}

createRoot(document.getElementById("agent-orrery-root")!).render(<App />);
