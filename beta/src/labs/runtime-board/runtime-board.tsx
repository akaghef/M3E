import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CATEGORY_META,
  EDGES,
  NODES,
  STEP_INTERVAL_MS,
  STEPS,
  SUBTITLE,
  TITLE,
  WORLD,
  type GraphEdge,
  type GraphNode,
  type NodeCategory,
} from "./graph_data";
import "./runtime-board.css";

type Camera = { x: number; y: number; scale: number };

function nodeCenter(node: GraphNode): { x: number; y: number } {
  return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
}

function edgePath(edge: GraphEdge, byId: Map<string, GraphNode>): string {
  const from = byId.get(edge.from);
  const to = byId.get(edge.to);
  if (!from || !to) return "";
  const a = nodeCenter(from);
  const b = nodeCenter(to);
  // exit/enter at box edges toward target
  const dx = b.x - a.x;
  const startX = a.x + Math.sign(dx || 1) * (from.w / 2);
  const endX = b.x - Math.sign(dx || 1) * (to.w / 2);
  const startY = a.y;
  const endY = b.y;
  const midX = (startX + endX) / 2;
  if (edge.via && edge.via.length > 0) {
    const pts = edge.via.map((p) => `${p.x},${p.y}`).join(" ");
    return `M ${startX} ${startY} L ${pts} L ${endX} ${endY}`;
  }
  // smooth horizontal elbow
  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function App(): React.ReactElement {
  const [stepIndex, setStepIndex] = useState(0); // 0-based
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [camera, setCamera] = useState<Camera>({ x: 40, y: 20, scale: 0.78 });
  const [panning, setPanning] = useState(false);
  const panRef = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const byId = useMemo(() => new Map(NODES.map((n) => [n.id, n])), []);
  const step = STEPS[stepIndex]!;
  const totalSteps = STEPS.length;

  const activeNodes = useMemo(() => new Set(step.activeNodeIds), [step]);
  const activeEdges = useMemo(() => new Set(step.activeEdgeIds), [step]);
  const completedNodes = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < stepIndex; i += 1) {
      for (const id of STEPS[i]!.activeNodeIds) set.add(id);
      for (const id of STEPS[i]!.completedNodeIds ?? []) set.add(id);
    }
    for (const id of step.completedNodeIds ?? []) set.add(id);
    // current actives are not "completed" for styling priority
    for (const id of step.activeNodeIds) set.delete(id);
    return set;
  }, [step, stepIndex]);

  const goPrev = useCallback(() => {
    setPlaying(false);
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((i) => {
      if (i >= totalSteps - 1) {
        setPlaying(false);
        return i;
      }
      return i + 1;
    });
  }, [totalSteps]);

  const togglePlay = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setStepIndex((i) => {
        if (i >= totalSteps - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, STEP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing, totalSteps]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        if (e.key === " ") togglePlay();
        else goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, togglePlay]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setCamera((cam) => {
      const nextScale = clamp(cam.scale * (e.deltaY > 0 ? 0.92 : 1.08), 0.35, 1.8);
      const wx = (mx - cam.x) / cam.scale;
      const wy = (my - cam.y) / cam.scale;
      return {
        scale: nextScale,
        x: mx - wx * nextScale,
        y: my - wy * nextScale,
      };
    });
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as Element;
    if (target.closest(".node")) return;
    panRef.current = { sx: e.clientX, sy: e.clientY, cx: camera.x, cy: camera.y };
    setPanning(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [camera.x, camera.y]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!panRef.current) return;
    const dx = e.clientX - panRef.current.sx;
    const dy = e.clientY - panRef.current.sy;
    setCamera((cam) => ({
      ...cam,
      x: panRef.current!.cx + dx,
      y: panRef.current!.cy + dy,
    }));
  }, []);

  const onPointerUp = useCallback(() => {
    panRef.current = null;
    setPanning(false);
  }, []);

  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const progressPct = ((stepIndex + 1) / totalSteps) * 100;

  const transform = `translate(${camera.x} ${camera.y}) scale(${camera.scale})`;

  return (
    <div className="board" data-testid="runtime-board">
      <header className="board-header">
        <div className="title-block">
          <h1>{TITLE}</h1>
          <p>{SUBTITLE}</p>
        </div>
        <div className="help-chip" data-testid="help-chip">
          ホイール: 拡大縮小 / ドラッグ: 移動 / クリック: 詳細 / ▶ ボタン: API 処理フロー再生
        </div>
      </header>

      <div className="playback" data-testid="playback-controls" role="group" aria-label="再生コントロール">
        <button type="button" aria-label="最初へ" data-testid="btn-reset" onClick={() => { setPlaying(false); setStepIndex(0); }}>
          ⏮
        </button>
        <button type="button" aria-label="前のステップ" data-testid="btn-prev" onClick={goPrev}>
          ⏪
        </button>
        <button
          type="button"
          className="primary"
          aria-label={playing ? "一時停止" : "再生"}
          data-testid="btn-play"
          onClick={togglePlay}
        >
          {playing ? "⏸ 一時停止" : "▶ API処理フローを再生"}
        </button>
        <button type="button" aria-label="次のステップ" data-testid="btn-next" onClick={goNext}>
          ⏩
        </button>
        <div className="step-counter" data-testid="step-counter">
          <strong>{stepIndex + 1}</strong> / {totalSteps}
        </div>
      </div>
      <div className="pan-hint" aria-hidden="true">✋</div>

      <div
        ref={viewportRef}
        className={`viewport${panning ? " panning" : ""}`}
        data-testid="graph-viewport"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg className="world" data-testid="graph-svg">
          <g transform={transform}>
            {EDGES.map((edge) => {
              const d = edgePath(edge, byId);
              const isActive = activeEdges.has(edge.id);
              const isCompleted =
                !isActive &&
                completedNodes.has(edge.from) &&
                completedNodes.has(edge.to);
              const cls = ["edge", isActive ? "active" : "", isCompleted ? "completed" : ""]
                .filter(Boolean)
                .join(" ");
              return (
                <g key={edge.id}>
                  <path
                    className={cls}
                    d={d}
                    data-edge-id={edge.id}
                    data-active={isActive ? "true" : "false"}
                  />
                  {edge.label ? (
                    <text
                      className={`edge-label${isActive ? " active" : ""}`}
                      x={(byId.get(edge.from)!.x + byId.get(edge.to)!.x) / 2 + 40}
                      y={(byId.get(edge.from)!.y + byId.get(edge.to)!.y) / 2 + 12}
                    >
                      {edge.label}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {NODES.map((node) => {
              const meta = CATEGORY_META[node.category];
              const isActive = activeNodes.has(node.id);
              const isCompleted = completedNodes.has(node.id);
              const isSelected = selectedId === node.id;
              const cls = [
                "node",
                isActive ? "active" : "",
                isCompleted ? "completed" : "",
                isSelected ? "selected" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <g
                  key={node.id}
                  className={cls}
                  data-node-id={node.id}
                  data-active={isActive ? "true" : "false"}
                  data-completed={isCompleted ? "true" : "false"}
                  data-testid={`node-${node.id}`}
                  transform={`translate(${node.x} ${node.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(node.id);
                  }}
                >
                  <rect
                    className="node-body"
                    width={node.w}
                    height={node.h}
                    fill={meta.fill}
                    stroke={meta.stroke}
                  />
                  <text
                    className="node-label"
                    x={10}
                    y={node.sublabel ? 18 : node.h / 2 + 4}
                    fill={meta.text}
                  >
                    {node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label}
                  </text>
                  {node.sublabel ? (
                    <text className="node-sub" x={10} y={34} fill={meta.text}>
                      {node.sublabel}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <aside className="legend" data-testid="legend" aria-label="凡例">
        <h2>凡例</h2>
        <ul>
          {(Object.keys(CATEGORY_META) as NodeCategory[]).map((key) => {
            const m = CATEGORY_META[key];
            return (
              <li key={key}>
                <span className="swatch" style={{ background: m.fill, borderColor: m.stroke }} />
                {m.label}
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="step-overlay" data-testid="step-overlay" aria-live="polite">
        <div className="step-head">
          <span className="step-badge" data-testid="step-badge">
            {stepIndex + 1}/{totalSteps} STEP {step.index}:
          </span>
          <span className="step-title" data-testid="step-title">
            {step.title}
          </span>
        </div>
        <pre className="step-detail" data-testid="step-detail">
          {step.detail}
        </pre>
        <div className="progress" data-testid="step-progress">
          <span style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="minimap" data-testid="minimap" aria-label="ミニマップ">
        <svg viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} preserveAspectRatio="xMidYMid meet">
          {NODES.map((node) => {
            const m = CATEGORY_META[node.category];
            const isActive = activeNodes.has(node.id);
            return (
              <rect
                key={node.id}
                className="mm-node"
                x={node.x}
                y={node.y}
                width={node.w}
                height={node.h}
                rx={4}
                fill={m.fill}
                stroke={isActive ? m.stroke : "transparent"}
                strokeWidth={isActive ? 6 : 0}
                opacity={isActive ? 1 : 0.55}
              />
            );
          })}
          {/* rough viewport indicator */}
          <rect
            className="mm-viewport"
            x={(-camera.x / camera.scale)}
            y={(-camera.y / camera.scale)}
            width={(viewportRef.current?.clientWidth ?? 1200) / camera.scale}
            height={(viewportRef.current?.clientHeight ?? 700) / camera.scale}
          />
        </svg>
      </div>

      {selected ? (
        <button
          type="button"
          className="drawer-backdrop"
          aria-label="詳細を閉じる"
          data-testid="drawer-backdrop"
          onClick={() => setSelectedId(null)}
        />
      ) : null}

      <aside
        className={`drawer${selected ? " open" : ""}`}
        data-testid="node-drawer"
        data-open={selected ? "true" : "false"}
        aria-hidden={selected ? "false" : "true"}
      >
        {selected ? (
          <>
            <div className="drawer-head">
              <div>
                <h2 data-testid="drawer-title">{selected.method && selected.path ? `${selected.method} ${selected.path}` : selected.label}</h2>
                <div className="api-type">
                  {CATEGORY_META[selected.category].label}
                  {selected.method ? " · API" : ""}
                </div>
              </div>
              <button
                type="button"
                className="drawer-close"
                aria-label="閉じる"
                data-testid="drawer-close"
                onClick={() => setSelectedId(null)}
              >
                ✕
              </button>
            </div>
            <div className="drawer-body">
              {(selected.method || selected.path) && (
                <section>
                  <h3>エンドポイント</h3>
                  <div className="method-path">
                    {selected.method ? <span className="method-badge">{selected.method}</span> : null}
                    <span data-testid="drawer-path">{selected.path ?? selected.label}</span>
                  </div>
                </section>
              )}
              <section>
                <h3>概要</h3>
                <p data-testid="drawer-overview">{selected.overview}</p>
              </section>
              <section>
                <h3>実装コード</h3>
                <pre data-testid="drawer-code">{selected.code}</pre>
              </section>
              <section>
                <h3>ソース</h3>
                <div className="source-link" data-testid="drawer-source">
                  {selected.sourceLink}
                </div>
              </section>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}

const root = document.getElementById("runtime-board-root");
if (!root) throw new Error("runtime-board-root not found");
createRoot(root).render(<App />);
