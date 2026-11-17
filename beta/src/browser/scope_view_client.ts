/**
 * Scope view in the viewer (opt-in: `viewer.html?...&scope=<id>&partial=1`).
 *
 * The viewer then holds only the nodes that belong to one scope (see
 * ../shared/scope_view.ts). This module keeps what the server told about the
 * rest of the map and decides everything that differs from the whole-map
 * viewer: where the map is fetched, how a save is sent, which operations are
 * unavailable, and when the page has to move to another scope.
 *
 * Rule: in scope view the viewer never sends its state as the whole map.
 * Every save is a Command built from the edits; anything else is answered as
 * a failed save.
 */
import { diffState } from "../shared/map_changes";
import { SCOPE_VIEW_HEADER, scopeViewChanges, type ScopeViewInfo } from "../shared/scope_view";
import type { AppState, TreeNode } from "../shared/types";
import { commandForChanges, settleSaveCommand } from "./save_command";

const JSON_HEADERS = "application/json; charset=utf-8";
/** Response header of a save this module refused. The viewer shows its value as the failure reason. */
export const SAVE_BLOCKED_HEADER = "X-M3E-Save-Blocked";

/** Controls that would read or replace the whole map from the partial state. */
const DISABLED_CONTROL_IDS = [
  "cloud-pull", "cloud-push", "cloud-use-local", "cloud-use-cloud",
  "collab-join-btn",
  "import-file-btn", "import-vault-btn", "load-default",
  "download-btn", "download-mm-btn",
  "integrate-vault-live-btn",
  "conflict-use-local",
];
const DISABLED_TITLE = "unavailable in scope view (partial load). Open the full map to use it.";
const DISABLED_LABELS: Record<string, string> = {
  "cloud-pull": "Cloud pull", "cloud-push": "Cloud push", "cloud-use-local": "Cloud force push", "cloud-use-cloud": "Cloud pull",
  "collab-join-btn": "Team collaboration",
  "import-file-btn": "Import file", "import-vault-btn": "Vault import", "load-default": "Loading the sample map",
  "download-btn": "Export JSON", "download-mm-btn": "Export .mm",
  "integrate-vault-live-btn": "Obsidian Live Mode",
  "conflict-use-local": "Use Local (forced whole-map save)",
};

export interface ScopeViewHost {
  setStatus(message: string, isError?: boolean): void;
  /** The node the viewer currently shows as its scope. */
  currentScopeId(): string;
  /** Puts the viewer back on the opened scope. `history` is what "exit scope" steps back through. */
  resetScope(scopeRootId: string, history: string[]): void;
  /** Saves pending edits. False when the save failed. */
  flush(): Promise<boolean>;
}

export type ScopeViewLoadResult =
  | { ok: true; payload: unknown }
  | { ok: false; reason: "not-found" | "failed"; message: string };

let requestedScopeId = "";
let info: ScopeViewInfo | null = null;
let host: ScopeViewHost | null = null;
let leaving = false;
let controlsGuarded = false;

function readRequest(search: string): string {
  const params = new URLSearchParams(search);
  const scope = (params.get("scope") || params.get("scopeId") || "").trim();
  const localFs = (params.get("localFsRoot") || params.get("localFsPath") || "").trim();
  return params.get("partial") === "1" && scope && !localFs ? scope : "";
}

function blocked(reason: string): Response {
  return new Response(JSON.stringify({ ok: false, error: `Scope view: ${reason}.` }), {
    status: 422,
    headers: { "Content-Type": JSON_HEADERS, [SAVE_BLOCKED_HEADER]: `scope view: ${reason}` },
  });
}

function guardControls(): void {
  if (typeof document === "undefined") return;
  document.body.classList.add("scope-view-partial");
  for (const id of DISABLED_CONTROL_IDS) {
    const control = document.getElementById(id) as HTMLButtonElement | null;
    if (!control) continue;
    control.disabled = true;
    control.title = `${DISABLED_LABELS[id] ?? "This operation"}: ${DISABLED_TITLE}`;
  }
  const search = document.getElementById("entity-list-search") as HTMLInputElement | null;
  if (search) search.placeholder = "Search the loaded scope only";
  if (info) {
    let badge = document.getElementById("scope-view-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.id = "scope-view-badge";
      document.getElementById("scope-meta")?.after(badge);
    }
    badge.textContent = ` | scope view: ${info.loadedNodeCount} of ${info.totalNodeCount} nodes loaded`;
    badge.title = "Only the nodes of this scope are loaded. Nested scopes open as their own page.";
  }
  if (controlsGuarded) return;
  controlsGuarded = true;
  // Other code re-enables some of these controls; keep them disabled and inert.
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const control = record.target as HTMLButtonElement;
      if (!control.disabled) control.disabled = true;
    }
  });
  for (const id of DISABLED_CONTROL_IDS) {
    const control = document.getElementById(id);
    if (control) observer.observe(control, { attributes: true, attributeFilter: ["disabled"] });
  }
  // The workbench menus press these controls for the user and report a disabled one here.
  window.addEventListener("m3e:disabled-control", (event) => {
    const message = (event as CustomEvent<{ message?: string }>).detail?.message;
    if (message) host?.setStatus(message, true);
  });
  document.addEventListener("click", (event) => {
    const control = (event.target as Element | null)?.closest?.("[id]");
    if (!control || !DISABLED_CONTROL_IDS.includes(control.id)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    scopeView.blocks(DISABLED_LABELS[control.id] ?? "This operation");
  }, true);
}

async function leaveTo(targetId: string): Promise<void> {
  if (leaving || !info || !host) return;
  leaving = true;
  const saved = await host.flush().catch(() => false);
  if (!saved) {
    leaving = false;
    host.setStatus("Save failed. Staying in this scope so the edits are not lost.", true);
    return;
  }
  window.location.assign(scopeView.hrefFor(targetId, window.location.href));
}

export const scopeView = {
  /** Reads `scope` and `partial` from a URL query. Called once with the page URL; tests call it directly. */
  configure(search: string): void {
    requestedScopeId = readRequest(search);
    info = null;
    leaving = false;
  },

  init(viewerHost: ScopeViewHost): void {
    host = viewerHost;
  },

  /** True for the whole page session when the URL asked for a scope view. */
  active(): boolean {
    return requestedScopeId !== "";
  },

  info(): ScopeViewInfo | null {
    return info;
  },

  /** The scope a freshly loaded map opens on: the opened scope in scope view, `mapRootId` otherwise. */
  homeScopeId(mapRootId: string): string {
    return info?.scopeRootId ?? mapRootId;
  },

  /**
   * The scopes "exit scope" steps back through from the home scope, map root first: the
   * ancestors that are scope roots, so leaving the scope opens another scope view.
   */
  homeHistory(): string[] {
    return info ? info.ancestors.filter((ancestor) => ancestor.isScope).map((ancestor) => ancestor.nodeId) : [];
  },

  mapUrl(mapId: string): string {
    return `/api/maps/${encodeURIComponent(mapId)}?scope=${encodeURIComponent(requestedScopeId)}&view=scope`;
  },

  /** Fetches the scope view. Used for the first load and for every reload after an external change. */
  async fetchPayload(mapId: string): Promise<ScopeViewLoadResult> {
    const fail = (reason: "not-found" | "failed", message: string): ScopeViewLoadResult => {
      if (info) host?.setStatus(`Scope view reload failed (${message}).`, true);
      return { ok: false, reason, message };
    };
    try {
      const response = await fetch(scopeView.mapUrl(mapId), { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: unknown } | null;
        const error = body?.error;
        const message = typeof error === "string" ? error
          : (error && typeof (error as { message?: unknown }).message === "string") ? String((error as { message: string }).message)
          : `HTTP ${response.status}`;
        return fail(response.status === 404 ? "not-found" : "failed", message);
      }
      return { ok: true, payload: await response.json() };
    } catch (err) {
      return fail("failed", (err as Error).message);
    }
  },

  /**
   * Called with every payload the viewer is about to show. In scope view only a
   * scope view of the requested scope is accepted: a whole map or a file would be
   * edited and saved as if it were the loaded part.
   */
  adopt(payload: unknown): boolean {
    if (!scopeView.active()) return true;
    const view = (payload as { scopeView?: ScopeViewInfo } | null)?.scopeView;
    if (!view || view.scopeRootId !== requestedScopeId || !view.entries || !Array.isArray(view.ancestors)) {
      scopeView.blocks("Loading another map or file");
      return false;
    }
    info = view;
    guardControls();
    return true;
  },

  /**
   * One save in scope view: the edits since `base` as a Command, never the state itself.
   * No base, a forced save, or a map that is only saved through the whole-map route all
   * answer as a failed save.
   */
  async save(saveUrl: string, tabId: string, base: AppState | null, state: AppState | null, savedAt: string | null): Promise<Response> {
    if (!info) return blocked("the scope view is not loaded");
    if (!base || !state || typeof base.rootId !== "string" || !base.nodes) {
      return blocked("a whole-map save (forced save, Use Local) is disabled");
    }
    const mapped = scopeViewChanges(diffState(base, state), info, base, state);
    if (!mapped.ok) return blocked(mapped.reason);
    if (mapped.changes.length === 0) {
      settleSaveCommand();
      return new Response(JSON.stringify(savedAt ? { ok: true, savedAt } : { ok: true }), { status: 200, headers: { "Content-Type": JSON_HEADERS } });
    }
    const command = commandForChanges(mapped.changes, tabId);
    const response = await fetch(`${saveUrl}/commands`, {
      method: "POST",
      headers: { "Content-Type": JSON_HEADERS, "X-M3E-Tab-Id": tabId, [SCOPE_VIEW_HEADER]: encodeURIComponent(info.scopeRootId) },
      body: JSON.stringify(command),
    });
    if (response.status < 500) settleSaveCommand();
    // 404 means "use the whole-map route" (no row yet, or a live vault map). Not in scope view.
    if (response.status === 404) return blocked("this map is saved through the whole-map route, which is disabled");
    return response;
  },

  /** True (and a status message) when scope view is on: the caller must not run the operation. */
  blocks(label: string, announce = true): boolean {
    if (!scopeView.active()) return false;
    if (announce) host?.setStatus(`${label} is unavailable in scope view (partial load). Open the full map to use it.`, true);
    return true;
  },

  /** Like `blocks`, for operations that are only unsafe when the scope has nested scopes. */
  blocksWithEntries(label: string): boolean {
    return Boolean(info) && Object.keys(info!.entries).length > 0 && scopeView.blocks(label);
  },

  isEntry(nodeId: string): boolean {
    return Boolean(info?.entries[nodeId]);
  },

  /** Real child count of an entry, for the count drawn on it. Undefined for other nodes. */
  entryChildCount(nodeId: string): number | undefined {
    return info?.entries[nodeId]?.childCount || undefined;
  },

  /** Descendants of a loaded node that exist in the map but are not loaded directly below it. */
  unloadedBelow(nodeId: string): number {
    if (!info) return 0;
    const entry = info.entries[nodeId];
    if (entry) return entry.descendantCount;
    const index = info.ancestors.findIndex((ancestor) => ancestor.nodeId === nodeId);
    if (index < 0) return 0;
    const next = info.ancestors[index + 1];
    return info.ancestors[index]!.descendantCount - 1 - (next ? next.descendantCount : info.scopeDescendantCount);
  },

  /** An alias target that exists in the map but is not loaded: the alias is not broken. */
  isExternalTarget(nodeId: string | undefined): boolean {
    return Boolean(nodeId && info?.externalAliasTargets[nodeId]);
  },

  /**
   * True (and a status message) when deleting these subtrees needs nodes that are not
   * loaded: an entry's contents would be left without a parent, an outside alias or
   * GraphLink without its node.
   */
  refusesDelete(rootIds: readonly string[], nodes: Record<string, TreeNode>): boolean {
    if (!info) return false;
    const stack = [...rootIds];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const reason = info.entries[id] ? "it contains a nested scope whose contents are not loaded"
        : info.outsideReferences?.[id] ? "an alias or a GraphLink outside the loaded scope points into it"
        : id === info.scopeRootId || info.ancestors.some((ancestor) => ancestor.nodeId === id) ? "it is the opened scope or one of its ancestors"
        : "";
      if (reason) {
        host?.setStatus(`Cannot delete in scope view: ${reason}. Open the full map to delete it.`, true);
        return true;
      }
      stack.push(...(nodes[id]?.children ?? []));
    }
    return false;
  },

  /** The page URL for another scope: scope view when it is a scope root, the whole map otherwise. */
  hrefFor(targetId: string, currentHref: string): string {
    const url = new URL(currentHref);
    url.searchParams.delete("scopeId");
    url.searchParams.set("scope", targetId);
    const ancestor = info?.ancestors.find((item) => item.nodeId === targetId);
    if (info?.entries[targetId] || ancestor?.isScope) url.searchParams.set("partial", "1");
    else url.searchParams.delete("partial");
    return url.toString();
  },

  /**
   * Called before every draw. The contents of an entry and of an ancestor are not
   * loaded, so showing one of them as the current scope moves the page there
   * (after saving) instead of drawing the trimmed nodes.
   */
  guardScope(): void {
    if (!info || !host) return;
    const current = host.currentScopeId();
    if (current === info.scopeRootId) return;
    const outside = Boolean(info.entries[current]) || info.ancestors.some((ancestor) => ancestor.nodeId === current);
    if (!outside) return;
    host.resetScope(info.scopeRootId, scopeView.homeHistory());
    void leaveTo(current);
  },

  /** Opens an entry as its own page. True when `nodeId` is an entry. */
  openEntry(nodeId: string): boolean {
    if (!info?.entries[nodeId]) return false;
    void leaveTo(nodeId);
    return true;
  },
};

if (typeof window !== "undefined") scopeView.configure(window.location.search);
