import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  ChevronDown,
  CircleHelp,
  CircleUserRound,
  Cloud,
  Command,
  Eraser,
  Frame,
  Highlighter,
  Home,
  ListTree,
  Lock,
  MousePointer2,
  PanelRight,
  PenLine,
  Presentation,
  RefreshCw,
  SendHorizontal,
  Settings,
  Share2,
  Sparkles,
  Tag,
  TextCursorInput,
  UsersRound,
  Waypoints,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { edgePathBetweenRects, rectFromDomRect } from "./edge_geometry";
import "./workbench-ui.css";

type ToolId = "select" | "mindmap" | "pen" | "highlighter" | "date" | "eraser" | "note";
type ModalId = "menu" | "settings" | "share" | "help" | "ai" | null;
type ProgressiveSurfaceMode = "tree" | "system" | "scatter" | "mindmap" | "logic-chart" | "timeline";
type ProgressiveBranchDirection = "both" | "right" | "left";
type ProgressiveMode = "gui" | "active-node";
type RapidGenerateAction = "detail" | "examples" | "classify" | "related";
type ProgressiveNodeId =
  | "gui"
  | "active-root"
  | "rapid-expand"
  | "rapid-detail"
  | "rapid-examples"
  | "rapid-classify"
  | "rapid-related"
  | "rapid-summary"
  | "rapid-summary-node"
  | "rapid-summary-subtree"
  | "rapid-keypoints"
  | "rapid-action-items"
  | "rapid-restructure"
  | "rapid-reclassify"
  | "rapid-reorder"
  | "rapid-merge-duplicates"
  | "rapid-split"
  | "rapid-question"
  | "rapid-question-node"
  | "rapid-question-subtree"
  | "rapid-unknowns"
  | "rapid-evidence"
  | "rapid-output"
  | "rapid-markdown"
  | "rapid-outline"
  | "rapid-presentation"
  | "rapid-export"
  | "board"
  | "view"
  | "scatter"
  | "mindmap"
  | "annotation"
  | "panel"
  | "import"
  | "export-json"
  | "export-mm"
  | "export-vault"
  | "tree"
  | "mindmap-surface"
  | "mindmap-both"
  | "mindmap-right"
  | "mindmap-left"
  | "mindmap-compact"
  | "mindmap-spacious"
  | "mindmap-orthogonal"
  | "logic-chart-surface"
  | "logic-chart-compact"
  | "logic-chart-balanced"
  | "logic-chart-spacious"
  | "logic-chart-both"
  | "logic-chart-right"
  | "logic-chart-left"
  | "timeline-surface"
  | "timeline-compact"
  | "timeline-balanced"
  | "timeline-spacious"
  | "system"
  | "scatter-surface"
  | "scatter-normal"
  | "scatter-add-node"
  | "scatter-add-edge"
  | "scatter-colorize"
  | "scatter-delete"
  | "scatter-display-root"
  | "scatter-animate"
  | "scatter-reflow"
  | "add-child"
  | "toggle-scope"
  | "enter-scope"
  | "exit-scope"
  | "pen"
  | "highlighter"
  | "date"
  | "eraser"
  | "settings"
  | "help";

type ProgressiveNode = {
  id: ProgressiveNodeId;
  label: string;
  hint: string;
  parentId?: ProgressiveNodeId;
  action?: () => void;
};

type ProgressiveEdge = {
  id: string;
  d: string;
  active: boolean;
};

type ProgressivePlacement = {
  left: number;
  top: number;
};

type UiSnapshot = {
  mode: string;
  surface: string;
  scope: string;
  mapId: string;
  selected: string;
  selectedNodeId: string;
  selectedNodeLabel: string;
  nodes: string;
  links: string;
  annotations: string;
  zoom: string;
  status: string;
  cloud: string;
  collab: string;
  displayName: string;
  joinTokenRequired: boolean;
};

const q = <T extends Element>(selector: string): T | null => document.querySelector<T>(selector);
const byId = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

function clickLegacy(id: string): void {
  byId<HTMLButtonElement>(id)?.click();
}

function setSurfaceLayout(
  mode: ProgressiveSurfaceMode,
  density: "compact" | "balanced" | "spacious",
  direction?: ProgressiveBranchDirection,
): void {
  window.dispatchEvent(new CustomEvent("m3e:set-surface-layout", { detail: { mode, density, direction } }));
}

function sendKey(key: string, options: KeyboardEventInit = {}): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...options }));
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable ||
    Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
  );
}

function isActionKeyEvent(event: KeyboardEvent): boolean {
  const isSpace = event.key === " " || event.key === "Spacebar" || event.code === "Space";
  return isSpace && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && !event.repeat;
}

function dispatchRapidPreviewAction(label: string): void {
  window.dispatchEvent(new CustomEvent("m3e:rapid-action-preview", { detail: { label } }));
}

function dispatchRapidGenerateAction(action: RapidGenerateAction, label: string, instruction: string): void {
  window.dispatchEvent(new CustomEvent("m3e:rapid-action-generate", { detail: { action, label, instruction } }));
}

function setLegacyInput(id: string, value: string, eventName = "input"): void {
  const input = byId<HTMLInputElement>(id);
  if (!input) return;
  input.value = value;
  input.dispatchEvent(new Event(eventName, { bubbles: true }));
}

function parseField(text: string, label: string): string {
  const match = text.match(new RegExp(`${label}:\\s*([^|]+)`));
  return match ? match[1]!.trim() : "n/a";
}

function readSnapshot(): UiSnapshot {
  const metaEl = byId("meta");
  const meta = metaEl?.textContent || "";
  const modeMeta = byId("mode-meta")?.textContent || "";
  const zoom = q<SVGSVGElement>("#canvas")?.style.transform.match(/scale\(([^)]+)\)/)?.[1];
  const displayName = byId<HTMLInputElement>("collab-display-name")?.value.trim() || "Akaghef";
  const selectedNodeId = metaEl?.dataset.selectedNodeId?.trim() || "";
  const selectedNodeLabel = metaEl?.dataset.selectedNodeLabel?.trim() || "";
  return {
    mode: modeMeta.match(/mode:\s*([^/]+)/)?.[1]?.trim() || "Rapid",
    surface: modeMeta.match(/\/\s*(.+)$/)?.[1]?.trim() || "Tree",
    scope: metaEl?.dataset.scopeId?.trim() || parseField(meta, "scope"),
    mapId: metaEl?.dataset.mapId?.trim() || meta.match(/map:\s*[^|]*\(([^)]+)\)/)?.[1]?.trim() || "local-map",
    selected: parseField(meta, "selected"),
    selectedNodeId,
    selectedNodeLabel,
    nodes: parseField(meta, "nodes"),
    links: parseField(meta, "links"),
    annotations: parseField(meta, "annotations"),
    zoom: zoom ? `${Math.round(Number(zoom) * 100)}%` : "100%",
    status: byId("status")?.textContent || "Ready",
    cloud: byId("cloud-sync-badge")?.textContent || "Cloud: off",
    collab: byId("collab-sync-badge")?.textContent || "Collab: off",
    displayName,
    joinTokenRequired: !(byId<HTMLInputElement>("collab-join-token")?.hidden ?? true),
  };
}

function useViewerSnapshot(): UiSnapshot {
  const [snapshot, setSnapshot] = useState<UiSnapshot>(() => readSnapshot());
  useEffect(() => {
    const update = () => setSnapshot(readSnapshot());
    const observer = new MutationObserver(update);
    ["meta", "mode-meta", "status", "cloud-sync-badge", "collab-sync-badge"].forEach((id) => {
      const el = byId(id);
      if (el) observer.observe(el, { childList: true, subtree: true, characterData: true, attributes: true });
    });
    const interval = window.setInterval(update, 500);
    update();
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);
  return snapshot;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "A";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
}

function IconButton(props: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onFocus?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      className={`wb-icon-btn${props.active ? " is-active" : ""}`}
      type="button"
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      onFocus={props.onFocus}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
    >
      {props.children}
    </button>
  );
}

function PillButton(props: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}): React.ReactElement {
  return (
    <button className={`wb-pill${props.active ? " is-active" : ""}`} type="button" disabled={props.disabled} onClick={props.onClick}>
      {props.children}
    </button>
  );
}

function TopBar({ snapshot, openModal }: { snapshot: UiSnapshot; openModal: (id: ModalId) => void }): React.ReactElement {
  const joined = snapshot.collab.includes("joined");
  return (
    <div className="wb-topbar" data-testid="workbench-topbar">
      <div className="wb-brand">
        <button className="wb-home" type="button" aria-label="Home" onClick={() => (window.location.href = "./home.html")}>
          <Home size={17} />
        </button>
        <div className="wb-logo">M3E</div>
        <button className="wb-board-title" type="button" onClick={() => openModal("menu")}>
          <small>{snapshot.surface}</small>
          <ChevronDown size={14} />
        </button>
      </div>
      <div className="wb-top-actions">
        <div className="wb-status-chip" title={snapshot.status}>
          <Cloud size={14} />
          <span>{snapshot.cloud.replace("Cloud: ", "")}</span>
        </div>
        <IconButton label="Activity">
          <Bell size={18} />
        </IconButton>
        <IconButton label="Settings" onClick={() => openModal("settings")}>
          <Settings size={18} />
        </IconButton>
        <button className="wb-user" type="button" onClick={() => openModal("settings")} title={snapshot.collab}>
          <span className={`wb-avatar${joined ? " is-online" : ""}`}>{initials(snapshot.displayName)}</span>
          <ChevronDown size={13} />
        </button>
        <button className="wb-present" type="button" onClick={() => clickLegacy("view-tree")}>
          <Presentation size={15} />
          Present
        </button>
        <button className="wb-share" type="button" onClick={() => openModal("share")}>
          <Lock size={14} />
          Share
        </button>
      </div>
    </div>
  );
}

function LeftRail({
  tool,
  setTool,
  openModal,
  setProgressiveOpen,
  setProgressiveMode,
}: {
  tool: ToolId;
  setTool: (tool: ToolId) => void;
  openModal: (id: ModalId) => void;
  setProgressiveOpen: (open: boolean | ((current: boolean) => boolean)) => void;
  setProgressiveMode: (mode: ProgressiveMode) => void;
}): React.ReactElement {
  const activate = (next: ToolId, legacyId?: string) => {
    setTool(next);
    if (legacyId) clickLegacy(legacyId);
  };
  return (
    <div className="wb-left-rail" data-testid="workbench-left-rail">
      <IconButton label="AI sidekick" onClick={() => openModal("ai")}>
        <Sparkles size={19} />
      </IconButton>
      <div className="wb-rail-group">
        <IconButton label="Select" active={tool === "select"} onClick={() => activate("select", "draw-select")}>
          <MousePointer2 size={20} />
        </IconButton>
        <IconButton label="Mindmap" active={tool === "mindmap"} onClick={() => activate("mindmap", "view-tree")}>
          <Waypoints size={20} />
        </IconButton>
        <IconButton
          label="Scope list"
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "e", altKey: true, bubbles: true }));
          }}
        >
          <ListTree size={20} />
        </IconButton>
        <IconButton label="Linear note" active={tool === "note"} onClick={() => activate("note")}>
          <TextCursorInput size={20} />
        </IconButton>
      </div>
      <div className="wb-rail-group">
        <IconButton label="Pen" active={tool === "pen"} onClick={() => activate("pen", "draw-pen")}>
          <PenLine size={20} />
        </IconButton>
        <IconButton label="Highlighter" active={tool === "highlighter"} onClick={() => activate("highlighter", "draw-highlighter")}>
          <Highlighter size={20} />
        </IconButton>
        <IconButton label="Date label" active={tool === "date"} onClick={() => activate("date", "draw-date")}>
          <Tag size={20} />
        </IconButton>
        <IconButton label="Eraser" active={tool === "eraser"} onClick={() => activate("eraser", "draw-eraser")}>
          <Eraser size={20} />
        </IconButton>
      </div>
      <IconButton
        label="[GUI] navigation root"
        onClick={() => {
          setProgressiveMode("gui");
          setProgressiveOpen((current) => !current);
        }}
      >
        <Command size={19} />
      </IconButton>
    </div>
  );
}

type AiTopicResponse = {
  ok?: boolean;
  error?: string;
  proposal?: {
    result?: {
      topics?: unknown[];
      rawText?: unknown;
    };
  };
};

function cleanSelectedLabel(selected: string): string {
  const cleaned = selected.replace(/\s*\(\d+\)$/, "").trim();
  return cleaned && cleaned !== "n/a" ? cleaned : "Selected node";
}

function AiSidekickPanel({ snapshot, close }: { snapshot: UiSnapshot; close: () => void }): React.ReactElement {
  const quickActions = ["より簡潔に", "詳細を追加", "翻訳先", "再生成"];
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Ready");
  const [topics, setTopics] = useState<string[]>([]);
  const [topicTargetNodeId, setTopicTargetNodeId] = useState("");
  const selectedLabel = snapshot.selectedNodeLabel || cleanSelectedLabel(snapshot.selected);
  const selectedNodeId = snapshot.selectedNodeId;

  const runPrompt = async (seed?: string) => {
    const instruction = (seed || prompt).trim();
    if (!selectedNodeId) {
      setMessage("Select a node first.");
      setTopics([]);
      setTopicTargetNodeId("");
      return;
    }
    setBusy(true);
    setMessage("Thinking...");
    setTopics([]);
    setTopicTargetNodeId("");
    try {
      const payload = {
        mapId: snapshot.mapId,
        scopeId: snapshot.scope,
        mode: "proposal",
        input: {
          nodeText: selectedLabel,
          nodeDetails: instruction,
          maxTopics: 5,
        },
        clientContext: {
          selectionNodeId: selectedNodeId,
          requestId: `wb-ai-${Date.now()}`,
        },
      };
      const response = await fetch("/api/ai/subagent/topic-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({})) as AiTopicResponse;
      if (!response.ok) {
        throw new Error(String(body.error || `HTTP ${response.status}`));
      }
      const nextTopics = Array.isArray(body.proposal?.result?.topics)
        ? body.proposal.result.topics.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 5)
        : [];
      setTopics(nextTopics);
      setTopicTargetNodeId(selectedNodeId);
      setMessage(nextTopics.length > 0 ? `${nextTopics.length} suggestions` : "No suggestions");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const applyTopics = () => {
    if (topics.length === 0 || !topicTargetNodeId) return;
    window.dispatchEvent(new CustomEvent("m3e:ai-append-topics", { detail: { topics, targetNodeId: topicTargetNodeId } }));
    setMessage(`Applied ${topics.length}`);
  };

  return (
    <div className="wb-ai-dock" data-testid="ai-sidekick-panel">
      <div className="wb-ai-head">
        <span><Sparkles size={15} /> AI</span>
        <strong>{selectedLabel}</strong>
        <button type="button" onClick={close} aria-label="Close AI sidekick">x</button>
      </div>
      <div className="wb-ai-actions">
        {quickActions.map((label) => (
          <button
            key={label}
            type="button"
            disabled={busy}
            onClick={() => {
              setPrompt(label);
              void runPrompt(label);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {topics.length > 0 && (
        <div className="wb-ai-suggestions">
          {topics.map((topic) => <span key={topic}>{topic}</span>)}
        </div>
      )}
      <div className="wb-ai-composer">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.currentTarget.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void runPrompt();
            }
          }}
          placeholder="Ask about this selected node..."
          rows={2}
        />
        <button type="button" disabled={busy} onClick={() => void runPrompt()} aria-label="Send AI prompt">
          <SendHorizontal size={18} />
        </button>
      </div>
      <div className="wb-ai-foot">
        <span>{message}</span>
        <button type="button" disabled={topics.length === 0 || !topicTargetNodeId} onClick={applyTopics}>Apply</button>
      </div>
    </div>
  );
}

function RightPanel({
  snapshot,
  tool,
  openModal,
  collapsed,
  setCollapsed,
}: {
  snapshot: UiSnapshot;
  tool: ToolId;
  openModal: (id: ModalId) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}): React.ReactElement {
  if (collapsed) {
    return (
      <button
        className="wb-panel-tab"
        type="button"
        aria-label="Show inspector"
        title="Show inspector"
        onClick={() => setCollapsed(false)}
      >
        <PanelRight size={17} />
        <span>Inspector</span>
      </button>
    );
  }

  return (
    <aside className="wb-right-panel" data-testid="workbench-right-panel">
      <div className="wb-panel-head">
        <div>
          <strong>Inspector</strong>
          <span>{snapshot.mode} / {snapshot.surface}</span>
        </div>
        <div className="wb-panel-head-actions">
          <IconButton label="Hide inspector" onClick={() => setCollapsed(true)}>
            <PanelRight size={17} />
          </IconButton>
          <IconButton label="Settings" onClick={() => openModal("settings")}>
            <Settings size={17} />
          </IconButton>
        </div>
      </div>
      <section className="wb-panel-section">
        <div className="wb-section-title">Selected node</div>
        <div className="wb-selected-card">
          <strong>{snapshot.selected.replace(/\s*\(\d+\)$/, "")}</strong>
          <span>scope {snapshot.scope}</span>
        </div>
        <div className="wb-stats">
          <span>{snapshot.nodes} nodes</span>
          <span>{snapshot.links} links</span>
          <span>{snapshot.annotations} marks</span>
        </div>
      </section>
      <section className="wb-panel-section">
        <div className="wb-section-title">Mindmap</div>
        <div className="wb-action-grid">
          <button type="button" onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }))}>Add child</button>
          <button type="button" onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", bubbles: true }))}>Toggle scope</button>
          <button type="button" onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "]", bubbles: true }))}>Enter scope</button>
          <button type="button" onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "[", bubbles: true }))}>Exit scope</button>
        </div>
      </section>
      <section className="wb-panel-section">
        <div className="wb-section-title">Annotation</div>
        <div className="wb-tool-summary">
          <span className="wb-dot" />
          <span>{tool === "select" ? "Select mode" : `${tool} active`}</span>
        </div>
        <div className="wb-colors">
          {["#242424", "#7c3cff", "#e64980", "#2f9e44"].map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Stroke ${color}`}
              style={{ backgroundColor: color }}
              onClick={() => q<HTMLButtonElement>(`[data-pen-color="${color}"]`)?.click()}
            />
          ))}
        </div>
        <input
          className="wb-range"
          type="range"
          min="1"
          max="8"
          step="0.5"
          defaultValue="2"
          onInput={(event) => setLegacyInput("pen-width", event.currentTarget.value)}
        />
      </section>
      <section className="wb-panel-section">
        <div className="wb-section-title">Collaboration</div>
        <div className="wb-user-row">
          <span className="wb-avatar sm">{initials(snapshot.displayName)}</span>
          <div>
            <strong>{snapshot.displayName}</strong>
            <span>{snapshot.collab}</span>
          </div>
        </div>
      </section>
    </aside>
  );
}

function BottomControls({ snapshot, openModal }: { snapshot: UiSnapshot; openModal: (id: ModalId) => void }): React.ReactElement {
  return (
    <div className="wb-bottom-controls" data-testid="workbench-bottom-controls">
      <IconButton label="Frames">
        <Frame size={18} />
      </IconButton>
      <IconButton label="Zoom out" onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "-", bubbles: true }))}>
        <ZoomOut size={18} />
      </IconButton>
      <button className="wb-zoom" type="button" onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "0", ctrlKey: true, bubbles: true }))}>
        {snapshot.zoom}
      </button>
      <IconButton label="Zoom in" onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "=", bubbles: true }))}>
        <ZoomIn size={18} />
      </IconButton>
      <IconButton label="Help and shortcuts" onClick={() => openModal("help")}>
        <CircleHelp size={18} />
      </IconButton>
    </div>
  );
}

function setScatterRange(id: string, value: string): void {
  setLegacyInput(id, value, "input");
  setLegacyInput(id, value, "change");
}

function ScatterToolbar({ visible }: { visible: boolean }): React.ReactElement | null {
  if (!visible) {
    return null;
  }
  return (
    <div className="wb-scatter-panel" data-testid="workbench-scatter-panel">
      <div className="wb-scatter-modes">
        <button type="button" onClick={() => clickLegacy("scatter-normal")}>Normal</button>
        <button type="button" onClick={() => clickLegacy("scatter-add-node")}>Add Node</button>
        <button type="button" onClick={() => clickLegacy("scatter-add-edge")}>Add Edge</button>
        <button type="button" onClick={() => clickLegacy("scatter-colorize")}>Colorize</button>
        <button type="button" onClick={() => clickLegacy("scatter-delete")}>Delete</button>
      </div>
      <div className="wb-scatter-sim">
        <button type="button" onClick={() => clickLegacy("scatter-display-root")}>Toggle Display Root</button>
        <button type="button" onClick={() => clickLegacy("scatter-animate")}>Animate</button>
        <button type="button" onClick={() => clickLegacy("scatter-reflow")}>
          <RefreshCw size={15} /> Reflow
        </button>
        <label>
          <span>Repel</span>
          <input
            type="range"
            min="20000"
            max="600000"
            step="10000"
            defaultValue={byId<HTMLInputElement>("scatter-repulsion")?.value || "200000"}
            onChange={(event) => setScatterRange("scatter-repulsion", event.currentTarget.value)}
          />
        </label>
        <label>
          <span>Length</span>
          <input
            type="range"
            min="80"
            max="320"
            step="10"
            defaultValue={byId<HTMLInputElement>("scatter-edge-length")?.value || "180"}
            onChange={(event) => setScatterRange("scatter-edge-length", event.currentTarget.value)}
          />
        </label>
      </div>
    </div>
  );
}

function makeProgressiveNodes(openModal: (id: ModalId) => void): ProgressiveNode[] {
  return [
    { id: "gui", label: "[GUI]", hint: "overlay root" },
    { id: "board", label: "Board", hint: "file and board output", parentId: "gui" },
    { id: "view", label: "View", hint: "surface navigation", parentId: "gui" },
    { id: "scatter", label: "Scatter", hint: "scatter editing tools", parentId: "gui" },
    { id: "mindmap", label: "Mindmap", hint: "node and scope actions", parentId: "gui" },
    { id: "annotation", label: "Annotation", hint: "drawing tools", parentId: "gui" },
    { id: "panel", label: "Panel", hint: "settings and help", parentId: "gui" },
    { id: "import", label: "Import file", hint: "board input", parentId: "board", action: () => clickLegacy("import-file-btn") },
    { id: "export-json", label: "Export JSON", hint: "download map JSON", parentId: "board", action: () => clickLegacy("download-btn") },
    { id: "export-mm", label: "Export .mm", hint: "FreeMind output", parentId: "board", action: () => clickLegacy("download-mm-btn") },
    { id: "export-vault", label: "Export to Vault", hint: "write linear notes", parentId: "board", action: () => clickLegacy("export-vault-btn") },
    { id: "tree", label: "Tree surface", hint: "classic right tree", parentId: "view", action: () => clickLegacy("view-tree") },
    { id: "mindmap-surface", label: "Mind Map", hint: "mapify-like map templates", parentId: "view", action: () => setSurfaceLayout("mindmap", "balanced", "both") },
    { id: "mindmap-both", label: "Mind both", hint: "depth on both sides", parentId: "mindmap-surface", action: () => setSurfaceLayout("mindmap", "balanced", "both") },
    { id: "mindmap-right", label: "Mind right", hint: "one-sided right depth", parentId: "mindmap-surface", action: () => setSurfaceLayout("mindmap", "balanced", "right") },
    { id: "mindmap-left", label: "Mind left", hint: "one-sided left depth", parentId: "mindmap-surface", action: () => setSurfaceLayout("mindmap", "balanced", "left") },
    { id: "mindmap-compact", label: "Mind compact", hint: "dense both-side map", parentId: "mindmap-surface", action: () => setSurfaceLayout("mindmap", "compact", "both") },
    { id: "mindmap-spacious", label: "Mind spacious", hint: "wide both-side map", parentId: "mindmap-surface", action: () => setSurfaceLayout("mindmap", "spacious", "both") },
    { id: "mindmap-orthogonal", label: "Mind orthogonal", hint: "both-side logic links", parentId: "mindmap-surface", action: () => setSurfaceLayout("logic-chart", "balanced", "both") },
    { id: "logic-chart-surface", label: "Logic Chart", hint: "logic templates", parentId: "view", action: () => setSurfaceLayout("logic-chart", "compact", "right") },
    { id: "logic-chart-compact", label: "Logic compact", hint: "mapify-like dense ranks", parentId: "logic-chart-surface", action: () => setSurfaceLayout("logic-chart", "compact", "right") },
    { id: "logic-chart-balanced", label: "Logic balanced", hint: "readable mid-density ranks", parentId: "logic-chart-surface", action: () => setSurfaceLayout("logic-chart", "balanced", "right") },
    { id: "logic-chart-spacious", label: "Logic spacious", hint: "wide review spacing", parentId: "logic-chart-surface", action: () => setSurfaceLayout("logic-chart", "spacious", "right") },
    { id: "logic-chart-both", label: "Logic both", hint: "depth on both sides", parentId: "logic-chart-surface", action: () => setSurfaceLayout("logic-chart", "balanced", "both") },
    { id: "logic-chart-right", label: "Logic right", hint: "one-sided right depth", parentId: "logic-chart-surface", action: () => setSurfaceLayout("logic-chart", "balanced", "right") },
    { id: "logic-chart-left", label: "Logic left", hint: "one-sided left depth", parentId: "logic-chart-surface", action: () => setSurfaceLayout("logic-chart", "balanced", "left") },
    { id: "timeline-surface", label: "Timeline", hint: "axis-based layout", parentId: "view", action: () => clickLegacy("view-timeline") },
    { id: "timeline-compact", label: "Timeline compact", hint: "short axis spacing", parentId: "timeline-surface", action: () => setSurfaceLayout("timeline", "compact") },
    { id: "timeline-balanced", label: "Timeline balanced", hint: "standard axis spacing", parentId: "timeline-surface", action: () => setSurfaceLayout("timeline", "balanced") },
    { id: "timeline-spacious", label: "Timeline spacious", hint: "wide axis spacing", parentId: "timeline-surface", action: () => setSurfaceLayout("timeline", "spacious") },
    { id: "system", label: "System surface", hint: "diagram canvas", parentId: "view", action: () => clickLegacy("view-system") },
    { id: "scatter-surface", label: "Scatter surface", hint: "spatial graph canvas", parentId: "view", action: () => clickLegacy("view-scatter") },
    { id: "scatter-normal", label: "Normal", hint: "select scatter objects", parentId: "scatter", action: () => clickLegacy("scatter-normal") },
    { id: "scatter-add-node", label: "Add node", hint: "create scatter node", parentId: "scatter", action: () => clickLegacy("scatter-add-node") },
    { id: "scatter-add-edge", label: "Add edge", hint: "connect scatter nodes", parentId: "scatter", action: () => clickLegacy("scatter-add-edge") },
    { id: "scatter-colorize", label: "Colorize", hint: "apply scatter color", parentId: "scatter", action: () => clickLegacy("scatter-colorize") },
    { id: "scatter-delete", label: "Delete", hint: "remove scatter object", parentId: "scatter", action: () => clickLegacy("scatter-delete") },
    { id: "scatter-display-root", label: "Toggle display root", hint: "toggle root visibility", parentId: "scatter", action: () => clickLegacy("scatter-display-root") },
    { id: "scatter-animate", label: "Animate", hint: "run force layout", parentId: "scatter", action: () => clickLegacy("scatter-animate") },
    { id: "scatter-reflow", label: "Reflow", hint: "settle force layout", parentId: "scatter", action: () => clickLegacy("scatter-reflow") },
    { id: "add-child", label: "Add child", hint: "Tab", parentId: "mindmap", action: () => sendKey("Tab") },
    { id: "toggle-scope", label: "Toggle scope", hint: "f", parentId: "mindmap", action: () => sendKey("f") },
    { id: "enter-scope", label: "Enter scope", hint: "]", parentId: "mindmap", action: () => sendKey("]") },
    { id: "exit-scope", label: "Exit scope", hint: "[", parentId: "mindmap", action: () => sendKey("[") },
    { id: "pen", label: "Pen", hint: "freehand draw", parentId: "annotation", action: () => clickLegacy("draw-pen") },
    { id: "highlighter", label: "Highlighter", hint: "wide translucent stroke", parentId: "annotation", action: () => clickLegacy("draw-highlighter") },
    { id: "date", label: "Date label", hint: "stamp date", parentId: "annotation", action: () => clickLegacy("draw-date") },
    { id: "eraser", label: "Eraser", hint: "remove annotations", parentId: "annotation", action: () => clickLegacy("draw-eraser") },
    { id: "settings", label: "Settings", hint: "open panel settings", parentId: "panel", action: () => openModal("settings") },
    { id: "help", label: "Shortcuts", hint: "keyboard reference", parentId: "panel", action: () => openModal("help") },
  ];
}

function makeActiveNodeProgressiveNodes(rootLabel: string): ProgressiveNode[] {
  const rapidAction = (label: string) => () => dispatchRapidPreviewAction(label);
  const rapidGenerate = (action: RapidGenerateAction, label: string, instruction: string) => (
    () => dispatchRapidGenerateAction(action, label, instruction)
  );
  return [
    { id: "active-root", label: rootLabel, hint: "active node" },
    { id: "rapid-expand", label: "N2 展開", hint: "node/subtree を広げる", parentId: "active-root" },
    { id: "rapid-detail", label: "N3 詳細化", hint: "生成", parentId: "rapid-expand", action: rapidGenerate("detail", "N3 詳細化", "詳細を追加") },
    { id: "rapid-examples", label: "N4 例を追加", hint: "生成", parentId: "rapid-expand", action: rapidGenerate("examples", "N4 例を追加", "具体例を追加") },
    { id: "rapid-classify", label: "N5 子分類を追加", hint: "生成", parentId: "rapid-expand", action: rapidGenerate("classify", "N5 子分類を追加", "子分類を追加") },
    { id: "rapid-related", label: "N6 関連topic追加", hint: "生成", parentId: "rapid-expand", action: rapidGenerate("related", "N6 関連topic追加", "関連topicを追加") },
    { id: "rapid-summary", label: "N7 要約", hint: "要点へ圧縮", parentId: "active-root" },
    { id: "rapid-summary-node", label: "N8 このnodeを要約", hint: "GUI-only", parentId: "rapid-summary", action: rapidAction("N8 このnodeを要約") },
    { id: "rapid-summary-subtree", label: "N9 subtreeを要約", hint: "GUI-only", parentId: "rapid-summary", action: rapidAction("N9 subtreeを要約") },
    { id: "rapid-keypoints", label: "N10 重要点抽出", hint: "GUI-only", parentId: "rapid-summary", action: rapidAction("N10 重要点抽出") },
    { id: "rapid-action-items", label: "N11 action item抽出", hint: "GUI-only", parentId: "rapid-summary", action: rapidAction("N11 action item抽出") },
    { id: "rapid-restructure", label: "N12 再構成", hint: "構造を整える", parentId: "active-root" },
    { id: "rapid-reclassify", label: "N13 分類し直す", hint: "GUI-only", parentId: "rapid-restructure", action: rapidAction("N13 分類し直す") },
    { id: "rapid-reorder", label: "N14 順序を整える", hint: "GUI-only", parentId: "rapid-restructure", action: rapidAction("N14 順序を整える") },
    { id: "rapid-merge-duplicates", label: "N15 重複を統合", hint: "GUI-only", parentId: "rapid-restructure", action: rapidAction("N15 重複を統合") },
    { id: "rapid-split", label: "N16 分割する", hint: "GUI-only", parentId: "rapid-restructure", action: rapidAction("N16 分割する") },
    { id: "rapid-question", label: "N17 問う", hint: "不足を問う", parentId: "active-root" },
    { id: "rapid-question-node", label: "N18 このnodeに質問", hint: "GUI-only", parentId: "rapid-question", action: rapidAction("N18 このnodeに質問") },
    { id: "rapid-question-subtree", label: "N19 subtreeに質問", hint: "GUI-only", parentId: "rapid-question", action: rapidAction("N19 subtreeに質問") },
    { id: "rapid-unknowns", label: "N20 不明点を列挙", hint: "GUI-only", parentId: "rapid-question", action: rapidAction("N20 不明点を列挙") },
    { id: "rapid-evidence", label: "N21 根拠を確認", hint: "GUI-only", parentId: "rapid-question", action: rapidAction("N21 根拠を確認") },
    { id: "rapid-output", label: "N22 出力", hint: "形式へ変換", parentId: "active-root" },
    { id: "rapid-markdown", label: "N23 Markdown化", hint: "GUI-only", parentId: "rapid-output", action: rapidAction("N23 Markdown化") },
    { id: "rapid-outline", label: "N24 outline化", hint: "GUI-only", parentId: "rapid-output", action: rapidAction("N24 outline化") },
    { id: "rapid-presentation", label: "N25 presentation化", hint: "GUI-only", parentId: "rapid-output", action: rapidAction("N25 presentation化") },
    { id: "rapid-export", label: "N26 export用に整形", hint: "GUI-only", parentId: "rapid-output", action: rapidAction("N26 export用に整形") },
  ];
}

function activeNodeAnchorElement(): Element | null {
  return (
    document.querySelector(".label-node.primary-selected") ||
    document.querySelector(".node-visual-box.primary-selected") ||
    document.querySelector(".scatter-node-circle.primary-selected") ||
    document.querySelector(".node-hit.primary-selected")
  );
}

function fallbackProgressiveAnchorElement(): Element | null {
  return document.querySelector('[aria-label="[GUI] navigation root"]');
}

function clampPlacement(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function placementForAnchor(anchor: Element | null): ProgressivePlacement {
  if (!anchor) {
    return { left: 72, top: 307 };
  }
  const rect = anchor.getBoundingClientRect();
  const left = clampPlacement(rect.right + 18, 72, Math.max(72, window.innerWidth - 510));
  const top = clampPlacement(rect.top + rect.height / 2 - 120, 72, Math.max(72, window.innerHeight - 430));
  return { left, top };
}

function ProgressiveNavigation({
  close,
  openModal,
  open,
  mode,
  activeRootLabel,
}: {
  close: () => void;
  openModal: (id: ModalId) => void;
  open: boolean;
  mode: ProgressiveMode;
  activeRootLabel: string;
}): React.ReactElement {
  const rootId: ProgressiveNodeId = mode === "active-node" ? "active-root" : "gui";
  const nodes = useMemo(
    () => (mode === "active-node" ? makeActiveNodeProgressiveNodes(activeRootLabel) : makeProgressiveNodes(openModal)),
    [activeRootLabel, mode, openModal],
  );
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const childrenByParent = useMemo(() => {
    const grouped = new Map<ProgressiveNodeId, ProgressiveNode[]>();
    nodes.forEach((node) => {
      if (!node.parentId) return;
      const siblings = grouped.get(node.parentId) || [];
      siblings.push(node);
      grouped.set(node.parentId, siblings);
    });
    return grouped;
  }, [nodes]);
  const [activeId, setActiveId] = useState<ProgressiveNodeId>(rootId);
  const path = useMemo(() => {
    const ids: ProgressiveNodeId[] = [];
    let cur = nodeById.get(activeId);
    while (cur) {
      ids.unshift(cur.id);
      cur = cur.parentId ? nodeById.get(cur.parentId) : undefined;
    }
    return ids;
  }, [activeId, nodeById]);
  const columns = useMemo(() => path.map((id) => childrenByParent.get(id) || []), [childrenByParent, path]);
  const rootChildren = columns[0] || [];
  const activeRootIndex = Math.max(0, rootChildren.findIndex((node) => node.id === path[1]));
  const activeChildren = columns[1] || [];
  const [navRootCenterY, setNavRootCenterY] = useState(156);
  const nodeCenterOffsetY = 23.5;
  const nodeStepY = 53;
  const columnStepX = 194;
  const groupHeight = (count: number) => (count > 0 ? 47 + (count - 1) * nodeStepY : 0);
  const groupTop = (count: number, parentCenterY: number) => parentCenterY - groupHeight(count) / 2;
  const rootColumnTop = groupTop(rootChildren.length, navRootCenterY);
  const nodeCenterY = (columnTop: number, index: number) => columnTop + nodeCenterOffsetY + index * nodeStepY;
  const activeRootCenterY = nodeCenterY(rootColumnTop, activeRootIndex);
  const childColumnTop = groupTop(activeChildren.length, activeRootCenterY);
  const columnTop = (index: number, count: number) => {
    if (index === 0) return rootColumnTop;
    if (index === 1) return childColumnTop;
    return groupTop(count, activeRootCenterY);
  };
  const navRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState<ProgressiveEdge[]>([]);
  const [edgeSize, setEdgeSize] = useState({ width: 486, height: 420 });
  const [placement, setPlacement] = useState<ProgressivePlacement>({ left: 72, top: 307 });

  const measureEdges = () => {
    const nav = navRef.current;
    const rootAnchor = mode === "active-node"
      ? activeNodeAnchorElement() || fallbackProgressiveAnchorElement()
      : fallbackProgressiveAnchorElement();
    if (!nav || !rootAnchor) return;
    if (mode === "active-node") {
      const nextPlacement = placementForAnchor(rootAnchor);
      setPlacement((current) => (
        Math.abs(current.left - nextPlacement.left) > 0.5 || Math.abs(current.top - nextPlacement.top) > 0.5
          ? nextPlacement
          : current
      ));
    }
    const navRect = nav.getBoundingClientRect();
    const toRect = (el: Element) => rectFromDomRect(el.getBoundingClientRect(), navRect);
    const rootRect = toRect(rootAnchor);
    const measuredRootCenterY = rootRect.y + rootRect.h / 2;
    setNavRootCenterY((current) => (Math.abs(current - measuredRootCenterY) > 0.5 ? measuredRootCenterY : current));
    const nextEdges: ProgressiveEdge[] = [];
    rootChildren.forEach((node) => {
      const el = nav.querySelector(`[data-pn-node="${node.id}"]`);
      if (!el) return;
      nextEdges.push({ id: `${rootId}-${node.id}`, d: edgePathBetweenRects(rootRect, toRect(el), 0), active: false });
    });
    const activeParentId = path[1];
    const activeParentEl = activeParentId ? nav.querySelector(`[data-pn-node="${activeParentId}"]`) : null;
    if (activeParentEl) {
      const fromRect = toRect(activeParentEl);
      activeChildren.forEach((node) => {
        const el = nav.querySelector(`[data-pn-node="${node.id}"]`);
        if (!el) return;
        nextEdges.push({ id: `${activeParentId}-${node.id}`, d: edgePathBetweenRects(fromRect, toRect(el), 0), active: true });
      });
    }
    setEdgeSize({ width: Math.ceil(navRect.width), height: Math.ceil(navRect.height) });
    setEdges(nextEdges);
  };

  useLayoutEffect(() => {
    measureEdges();
    window.addEventListener("resize", measureEdges);
    window.addEventListener("m3e:viewport-changed", measureEdges);
    return () => {
      window.removeEventListener("resize", measureEdges);
      window.removeEventListener("m3e:viewport-changed", measureEdges);
    };
  }, [activeId, rootChildren.length, activeChildren.length, navRootCenterY, mode, placement.left, placement.top]);

  useEffect(() => {
    setActiveId(rootId);
  }, [rootId, open]);

  const activate = (node: ProgressiveNode) => {
    setActiveId(node.id);
    if (node.action && !(childrenByParent.get(node.id)?.length)) {
      node.action();
      close();
    }
  };

  return (
    <div
      className={`wb-progressive-nav${open ? " is-open" : ""}${mode === "active-node" ? " is-active-node" : ""}`}
      data-testid="progressive-navigation"
      data-pn-mode={mode}
      ref={navRef}
      style={mode === "active-node" ? { left: `${placement.left}px`, top: `${placement.top}px` } : undefined}
      onMouseLeave={() => setActiveId(rootId)}
    >
      <svg className="wb-progressive-edges" viewBox={`0 0 ${edgeSize.width} ${edgeSize.height}`} aria-hidden="true">
        {edges.map((edge) => (
          <path className={edge.active ? "is-active-edge" : undefined} key={edge.id} d={edge.d} />
        ))}
      </svg>
      <div className="wb-progressive-columns">
        {columns.map((column, index) => (
          <div
            className="wb-progressive-column"
            key={`${path[index]}-${index}`}
            style={{ left: `${index * columnStepX}px`, top: `${columnTop(index, column.length)}px` }}
          >
            {column.map((node) => {
              const selected = path.includes(node.id) || activeId === node.id;
              const hasChildren = Boolean(childrenByParent.get(node.id)?.length);
              return (
                <button
                  className={`wb-progressive-node${selected ? " is-selected" : ""}${node.action && !hasChildren ? " is-action" : ""}`}
                  key={node.id}
                  data-pn-node={node.id}
                  type="button"
                  onMouseEnter={() => setActiveId(node.id)}
                  onFocus={() => setActiveId(node.id)}
                  onClick={() => activate(node)}
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
        ))}
      </div>
    </div>
  );
}

function ShareModal({ snapshot, close }: { snapshot: UiSnapshot; close: () => void }): React.ReactElement {
  const [name, setName] = useState(snapshot.displayName);
  const [token, setToken] = useState("");
  return (
    <div className="wb-modal-backdrop" onMouseDown={close}>
      <section className="wb-modal wb-share-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>Share</h2>
          <button type="button" onClick={close}>x</button>
        </header>
        <div className="wb-tabs"><span className="is-active">Invite</span><span>Embed</span><span>Public</span></div>
        <label className="wb-field">
          <span>Display name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        {snapshot.joinTokenRequired && (
          <label className="wb-field">
            <span>Join token</span>
            <input type="password" value={token} onChange={(event) => setToken(event.target.value)} />
          </label>
        )}
        <div className="wb-share-link">This board is private to the current workspace.</div>
        <div className="wb-modal-actions">
          <button type="button" onClick={() => { setLegacyInput("collab-display-name", name); setLegacyInput("collab-join-token", token); clickLegacy("collab-join-btn"); }}>
            <UsersRound size={16} /> Join collaboration
          </button>
          <button type="button" onClick={() => clickLegacy("collab-leave-btn")}>Leave</button>
        </div>
      </section>
    </div>
  );
}

function SettingsModal({ snapshot, close }: { snapshot: UiSnapshot; close: () => void }): React.ReactElement {
  const [grid, setGrid] = useState(true);
  const [objectSize, setObjectSize] = useState(true);
  const [comments, setComments] = useState(true);
  useEffect(() => {
    document.body.classList.toggle("wb-grid-off", !grid);
    document.body.classList.toggle("wb-object-size-off", !objectSize);
    document.body.classList.toggle("wb-comments-off", !comments);
  }, [grid, objectSize, comments]);
  return (
    <div className="wb-modal-backdrop" onMouseDown={close}>
      <section className="wb-modal wb-settings-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2>Settings</h2>
          <button type="button" onClick={close}>x</button>
        </header>
        <div className="wb-settings-grid">
          <div className="wb-settings-nav">
            <button className="is-active" type="button">Appearance</button>
            <button type="button">Navigation</button>
            <button type="button">Annotation</button>
            <button type="button">Collaboration</button>
            <button type="button">Shortcuts</button>
          </div>
          <div className="wb-settings-body">
            <label className="wb-toggle"><span>Grid</span><input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /></label>
            <label className="wb-toggle"><span>Board comments</span><input type="checkbox" checked={comments} onChange={(e) => setComments(e.target.checked)} /></label>
            <label className="wb-toggle"><span>Object sizes</span><input type="checkbox" checked={objectSize} onChange={(e) => setObjectSize(e.target.checked)} /></label>
            <label className="wb-field"><span>Linear font scale</span><input type="range" min="0.8" max="1.5" step="0.05" defaultValue="1" /></label>
            <div className="wb-disabled-list">
              <button disabled type="button"><CircleUserRound size={16} /> Profile settings</button>
              <button disabled type="button"><Share2 size={16} /> Advanced permissions</button>
              <button disabled type="button"><Sparkles size={16} /> Tool marketplace</button>
            </div>
            <div className="wb-status-line">{snapshot.status}</div>
          </div>
        </div>
      </section>
    </div>
  );
}

function HelpModal({ close }: { close: () => void }): React.ReactElement {
  return (
    <div className="wb-modal-backdrop" onMouseDown={close}>
      <section className="wb-modal wb-help-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header><h2>Shortcuts</h2><button type="button" onClick={close}>x</button></header>
        <div className="wb-shortcuts">
          <span><kbd>Tab</kbd>Add child</span>
          <span><kbd>[</kbd><kbd>]</kbd>Scope</span>
          <span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>Mode</span>
          <span><kbd>-</kbd><kbd>=</kbd>Zoom</span>
          <span><kbd>Ctrl+Alt+C</kbd>Copy node path</span>
          <span><kbd>Ctrl+Alt+I</kbd>Copy scope ID</span>
          <span><kbd>Alt+E</kbd>Entity list</span>
          <span><kbd>Alt+D</kbd>Markdown preview</span>
        </div>
      </section>
    </div>
  );
}

function WorkbenchApp(): React.ReactElement {
  const snapshot = useViewerSnapshot();
  const [tool, setTool] = useState<ToolId>("select");
  const [modal, setModal] = useState<ModalId>(null);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [progressiveOpen, setProgressiveOpen] = useState(false);
  const [progressiveMode, setProgressiveMode] = useState<ProgressiveMode>("gui");
  const activeRootLabel = cleanSelectedLabel(snapshot.selected);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isActionKeyEvent(event) || isTextEntryTarget(event.target) || event.isComposing) {
        return;
      }
      event.preventDefault();
      setProgressiveMode("active-node");
      setProgressiveOpen((current) => progressiveMode === "active-node" ? !current : true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [progressiveMode]);
  const modalContent = useMemo(() => {
    if (modal === "settings") return <SettingsModal snapshot={snapshot} close={() => setModal(null)} />;
    if (modal === "share") return <ShareModal snapshot={snapshot} close={() => setModal(null)} />;
    if (modal === "help") return <HelpModal close={() => setModal(null)} />;
    if (modal === "ai") return <AiSidekickPanel snapshot={snapshot} close={() => setModal(null)} />;
    return null;
  }, [modal, snapshot]);
  return (
    <div className="wb-shell">
      <TopBar snapshot={snapshot} openModal={setModal} />
      <LeftRail
        tool={tool}
        setTool={setTool}
        openModal={setModal}
        setProgressiveOpen={setProgressiveOpen}
        setProgressiveMode={setProgressiveMode}
      />
      <ProgressiveNavigation
        close={() => setProgressiveOpen(false)}
        open={progressiveOpen}
        openModal={setModal}
        mode={progressiveMode}
        activeRootLabel={activeRootLabel}
      />
      <ScatterToolbar visible={snapshot.surface === "Scatter"} />
      <RightPanel
        snapshot={snapshot}
        tool={tool}
        openModal={setModal}
        collapsed={inspectorCollapsed}
        setCollapsed={setInspectorCollapsed}
      />
      <BottomControls snapshot={snapshot} openModal={setModal} />
      <div className="wb-toast">{snapshot.status}</div>
      {modalContent}
    </div>
  );
}

const root = byId("workbench-root");
if (root) {
  createRoot(root).render(<WorkbenchApp />);
}
