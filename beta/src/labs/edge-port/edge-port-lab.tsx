import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { selectPorts, type EdgeBranchDirection } from "../../shared/edge_port";
import { route, type EdgeRouteStyle } from "../../shared/edge_route";
import { edgePortSamples, type EdgePortLabSample } from "./edge_port_samples";
import "./edge-port-lab.css";

const routeStyles: EdgeRouteStyle[] = ["orthogonal", "line", "curve", "force-link"];

function updatedDirection(sample: EdgePortLabSample, routeStyle: EdgeRouteStyle): EdgePortLabSample {
  return { ...sample, input: { ...sample.input, routeStyle } };
}

function directionLabel(direction: EdgeBranchDirection): string {
  if (direction.view === "Tree" && direction.direction === "both") return "Tree both " + direction.branchSide;
  return `${direction.view} ${direction.direction}`;
}

function App(): React.ReactElement {
  const [sampleId, setSampleId] = useState(edgePortSamples[0]!.sample_id);
  const sample = edgePortSamples.find((item) => item.sample_id === sampleId) || edgePortSamples[0]!;
  const [routeStyle, setRouteStyle] = useState<EdgeRouteStyle>(sample.input.routeStyle);
  const activeSample = updatedDirection(sample, routeStyle);
  const ports = useMemo(
    () => selectPorts(activeSample.input.srcRect, activeSample.input.dstRect, activeSample.input.branchDirection),
    [activeSample],
  );
  const path = route(ports, activeSample.input.routeStyle);
  const sideMatch = ports.source.side === activeSample.expected.ports.sourceSide
    && ports.target.side === activeSample.expected.ports.targetSide;
  const endpointMatch = path.commands[0]?.op === "M"
    && path.commands[0].x === ports.source.x
    && path.commands[0].y === ports.source.y
    && path.commands[path.commands.length - 1]?.x === ports.target.x
    && path.commands[path.commands.length - 1]?.y === ports.target.y;
  const width = 560;
  const height = 420;

  return (
    <main className="edge-port-lab">
      <aside className="lab-panel">
        <h1 className="lab-title">Edge Port Lab</h1>
        <div className="control-group">
          <label htmlFor="sample">Sample</label>
          <select
            id="sample"
            value={sampleId}
            onChange={(event) => {
              const next = event.currentTarget.value;
              const nextSample = edgePortSamples.find((item) => item.sample_id === next);
              setSampleId(next);
              if (nextSample) setRouteStyle(nextSample.input.routeStyle);
            }}
          >
            {edgePortSamples.map((item) => (
              <option key={item.sample_id} value={item.sample_id}>{item.sample_id}</option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="route-style">Route Style</label>
          <select id="route-style" value={routeStyle} onChange={(event) => setRouteStyle(event.currentTarget.value as EdgeRouteStyle)}>
            {routeStyles.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="check-list">
          <div className={sideMatch ? "check-pass" : "check-fail"}>side match: {String(sideMatch)}</div>
          <div className={endpointMatch ? "check-pass" : "check-fail"}>endpoint match: {String(endpointMatch)}</div>
          <div>direction: {directionLabel(activeSample.input.branchDirection)}</div>
        </div>
      </aside>
      <section className="stage">
        <svg viewBox="-140 -100 680 520" width={width} height={height} role="img" aria-label="Edge port sample">
          <rect className="node-rect" x={activeSample.input.srcRect.x} y={activeSample.input.srcRect.y} width={activeSample.input.srcRect.w} height={activeSample.input.srcRect.h} rx={6} />
          <rect className="node-rect" x={activeSample.input.dstRect.x} y={activeSample.input.dstRect.y} width={activeSample.input.dstRect.w} height={activeSample.input.dstRect.h} rx={6} />
          <path className={`route-path ${sideMatch ? "" : "mismatch"}`} d={path.d} />
          <circle className="port-dot" cx={ports.source.x} cy={ports.source.y} r={5} />
          <circle className="port-dot" cx={ports.target.x} cy={ports.target.y} r={5} />
          <text x={activeSample.input.srcRect.x + 8} y={activeSample.input.srcRect.y + 24}>source</text>
          <text x={activeSample.input.dstRect.x + 8} y={activeSample.input.dstRect.y + 24}>target</text>
        </svg>
      </section>
      <aside className="lab-panel right">
        <h2 className="lab-title">Snapshot</h2>
        <div className="json-block">
          <pre>{JSON.stringify({ sample: activeSample, ports, path }, null, 2)}</pre>
        </div>
      </aside>
    </main>
  );
}

const root = document.getElementById("edge-port-lab-root");
if (!root) throw new Error("edge-port-lab-root not found");
createRoot(root).render(<App />);

