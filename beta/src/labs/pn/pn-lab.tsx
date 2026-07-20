import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ChevronDown } from "lucide-react";
import { layoutProgressiveNav, type PnNode } from "../../shared/pn_layout";
import { getPnLabSample, pnLabSamples, pnNodeMetrics, type PnSampleId } from "./pn_samples";
import "./pn-lab.css";

function App(): React.ReactElement {
  const [sampleId, setSampleId] = useState<PnSampleId>("view-layout-3rd-level");
  const sample = getPnLabSample(sampleId);
  const [activeId, setActiveId] = useState(sample.activeId);
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [search, setSearch] = useState(sampleId === "search-filter-keeps-path" ? "Right" : "");
  const [focusIndex, setFocusIndex] = useState(0);
  const nodesById = useMemo(() => new Map(sample.nodes.map((node) => [node.id, node])), [sample.nodes]);
  const childrenByParent = useMemo(() => {
    const grouped = new Map<string, PnNode[]>();
    sample.nodes.forEach((node) => {
      if (!node.parentId) return;
      const children = grouped.get(node.parentId) || [];
      children.push(node);
      grouped.set(node.parentId, children);
    });
    return grouped;
  }, [sample.nodes]);
  const result = layoutProgressiveNav({
    nodes: sample.nodes,
    rootId: sample.rootId,
    activeId,
    anchorRect: sample.anchorRect,
    viewport: sample.viewport,
    safeZones: showSafeZones ? sample.safeZones : [],
    nodeMetrics: pnNodeMetrics(sample.nodes, sample.rootId),
    options: { routeStyle: "orthogonal", searchQuery: search },
  });
  const visibleNodes = result.visibleNodeIds
    .filter((id) => id !== sample.rootId)
    .map((id) => nodesById.get(id))
    .filter((node): node is PnNode => Boolean(node));

  function reset(nextSampleId = sampleId): void {
    const nextSample = getPnLabSample(nextSampleId);
    setActiveId(nextSample.activeId);
    setSearch(nextSampleId === "search-filter-keeps-path" ? "Right" : "");
    setFocusIndex(0);
  }

  function moveFocus(delta: number): void {
    if (result.focusOrder.length === 0) return;
    const next = (focusIndex + delta + result.focusOrder.length) % result.focusOrder.length;
    setFocusIndex(next);
    setActiveId(result.focusOrder[next] || activeId);
  }

  return (
    <main
      className="pn-lab"
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") moveFocus(1);
        if (event.key === "ArrowUp") moveFocus(-1);
        if (event.key === "Escape") reset();
      }}
    >
      <aside className="pn-lab-panel">
        <h1>PN Lab</h1>
        <label className="pn-lab-control" htmlFor="sample">
          Sample
          <select
            id="sample"
            value={sampleId}
            onChange={(event) => {
              const next = event.currentTarget.value as PnSampleId;
              setSampleId(next);
              reset(next);
            }}
          >
            {pnLabSamples.map((item) => <option key={item.sample_id} value={item.sample_id}>{item.label}</option>)}
          </select>
        </label>
        <label className="pn-lab-control" htmlFor="active-node">
          Active
          <select id="active-node" value={activeId} onChange={(event) => setActiveId(event.currentTarget.value)}>
            {sample.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
          </select>
        </label>
        <label className="pn-lab-control" htmlFor="search">
          Search
          <input id="search" value={search} onChange={(event) => setSearch(event.currentTarget.value)} />
        </label>
        <label className="pn-lab-control" htmlFor="safe-zones">
          Safe zones
          <input id="safe-zones" type="checkbox" checked={showSafeZones} onChange={(event) => setShowSafeZones(event.currentTarget.checked)} />
        </label>
        <div className="pn-lab-actions">
          <button type="button" onClick={() => moveFocus(-1)}>Prev</button>
          <button type="button" onClick={() => moveFocus(1)}>Next</button>
          <button type="button" onClick={() => reset()}>Reset</button>
        </div>
        <div className="pn-lab-summary" data-testid="pn-lab-summary">
          <span>placement: {result.placement.mode}</span>
          <span>canvas overlap: {result.placement.canvasNodeOverlapScore}</span>
          <span>overflow: {result.overflow.mode}</span>
          <span>focus: {result.focusOrder.join(" > ")}</span>
        </div>
      </aside>
      <section className="pn-lab-stage-wrap">
        <div
          className="pn-lab-stage"
          tabIndex={0}
          data-testid="pn-lab-stage"
          style={{ width: `${Math.max(1200, sample.viewport.width)}px`, height: `${Math.max(760, sample.viewport.height)}px` }}
        >
          <div
            className="pn-lab-anchor"
            data-testid="pn-lab-anchor"
            style={{ left: sample.anchorRect.x, top: sample.anchorRect.y, width: sample.anchorRect.w, height: sample.anchorRect.h }}
          />
          {showSafeZones && sample.safeZones.map((zone) => (
            <div
              key={zone.id}
              className="pn-lab-safe-zone"
              data-testid="pn-lab-safe-zone"
              style={{ left: zone.rect.x, top: zone.rect.y, width: zone.rect.w, height: zone.rect.h }}
            >
              <span>{zone.id}</span>
            </div>
          ))}
          <div
            className={`wb-progressive-nav is-open is-overflow-${result.overflow.mode}`}
            data-testid="progressive-navigation"
            data-pn-placement={result.placement.mode}
            data-pn-overflow={result.overflow.mode}
            data-pn-canvas-overlap={result.placement.canvasNodeOverlapScore}
            data-active-pn-node={activeId}
            style={{
              left: result.overlayRect.x,
              top: result.overlayRect.y,
              width: result.overlayRect.w,
              height: result.overlayRect.h,
            }}
          >
            <svg className="wb-progressive-edges" viewBox={`0 0 ${result.overlayRect.w} ${result.overlayRect.h}`} aria-hidden="true">
              {result.edges.map((edge) => (
                <path
                  key={edge.id}
                  className={edge.active ? "is-active-edge" : undefined}
                  data-pn-edge={edge.id}
                  data-source-side={edge.sourceSide}
                  data-target-side={edge.targetSide}
                  d={edge.d}
                />
              ))}
            </svg>
            <div className="wb-progressive-columns" style={{ width: result.overlayRect.w, height: result.overlayRect.h }}>
              {visibleNodes.map((node) => {
                const nodeRect = result.nodeRectsById[node.id];
                const hasChildren = Boolean(childrenByParent.get(node.id)?.length);
                const selected = result.pathIds.includes(node.id) || activeId === node.id;
                return (
                  <button
                    key={node.id}
                    type="button"
                    className={`wb-progressive-node${selected ? " is-selected" : ""}${node.action && !hasChildren ? " is-action" : ""}`}
                    data-pn-node={node.id}
                    style={nodeRect ? { left: nodeRect.x, top: nodeRect.y } : undefined}
                    onMouseEnter={() => setActiveId(node.id)}
                    onFocus={() => setActiveId(node.id)}
                    onClick={() => setActiveId(node.id)}
                  >
                    <span>
                      <strong>{node.label}</strong>
                      <small>{node.hint}</small>
                    </span>
                    {hasChildren ? <ChevronDown size={14} /> : <span className="wb-progressive-dot" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

const root = document.getElementById("pn-lab-root");
if (!root) throw new Error("pn-lab-root not found");
createRoot(root).render(<App />);
