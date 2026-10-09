import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderNode } from "../../shared/node_draw_svg";
import { nodeLabSamples, surfaceViews, withSurface, type NodeLabSampleId } from "./node_samples";
import "./node-lab.css";

function App(): React.ReactElement {
  const [sampleId, setSampleId] = useState<NodeLabSampleId>("plain");
  const [surface, setSurface] = useState(surfaceViews[0]!);
  const sample = nodeLabSamples.find((item) => item.sample_id === sampleId) || nodeLabSamples[0]!;
  const input = useMemo(() => withSurface(sample.input, surface), [sample, surface]);
  const output = useMemo(() => renderNode(input), [input]);
  const loadedStyleSheets = typeof document === "undefined"
    ? []
    : Array.from(document.querySelectorAll<HTMLLinkElement>("link[data-node-lab-stylesheet]"))
        .map((link) => `${link.dataset.nodeLabStylesheet}:${link.sheet ? "loaded" : "pending"}`);

  return (
    <main className="node-lab">
      <aside className="lab-panel">
        <h1 className="lab-title">Node Lab</h1>
        <div className="control-group">
          <label htmlFor="sample">Sample</label>
          <select id="sample" value={sampleId} onChange={(event) => setSampleId(event.currentTarget.value as NodeLabSampleId)}>
            {nodeLabSamples.map((item) => <option key={item.sample_id} value={item.sample_id}>{item.sample_id}</option>)}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="surface">Surface View</label>
          <select id="surface" value={surface} onChange={(event) => setSurface(event.currentTarget.value as typeof surface)}>
            {surfaceViews.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="lab-status" data-testid="node-lab-status">
          <div className="lab-status-pass">renderer: shared node_draw_svg</div>
          <div data-testid="loaded-stylesheets">{loadedStyleSheets.join(" ")}</div>
        </div>
      </aside>
      <section className="stage">
        <svg className="node-lab-canvas" viewBox="0 0 860 520" role="img" aria-label="Node draw sample">
          <g data-testid="node-fragment" dangerouslySetInnerHTML={{ __html: output.svg }} />
        </svg>
      </section>
      <aside className="lab-panel right">
        <h2 className="lab-title">Snapshot</h2>
        <div className="json-block">
          <pre>{JSON.stringify({ input, bounds: output.bounds }, null, 2)}</pre>
        </div>
        <h2 className="lab-title">Fragment</h2>
        <div className="fragment-block" data-testid="node-fragment-text">
          <pre>{output.svg}</pre>
        </div>
      </aside>
    </main>
  );
}

const root = document.getElementById("node-lab-root");
if (!root) throw new Error("node-lab-root not found");
createRoot(root).render(<App />);
