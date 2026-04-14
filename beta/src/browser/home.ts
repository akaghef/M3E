// HOME page controller.
//
// Standalone entry for beta/home.html. Talks to the data-agent REST API
// (see beta/src/shared/home_types.ts for the contract). When the API is
// unavailable (e.g. data agent has not landed yet), falls back to mock data
// so the UI can still be developed and demoed.
//
// Cross-tab "currently open" awareness uses BroadcastChannel (decision Q9).
// HOME is read-only with respect to the broadcast — viewer pages send
// `doc-open` / `doc-close` and HOME pings them on mount.

// NOTE: The browser tsconfig uses `module: "none"` and concatenates files,
// so we cannot `import` the shared DTO module here. The canonical contract
// lives in beta/src/shared/home_types.ts (co-owned with the data agent);
// the local declarations below MUST stay in sync with that file.

interface DocSummary {
  id: string;
  label: string;
  savedAt: string;
  nodeCount: number;
  charCount: number;
  tags: string[];
  archived: boolean;
}
interface DocListResponse { ok: true; docs: DocSummary[]; }
interface DocIdResponse { ok: true; id: string; }
interface DocOkResponse { ok: true; }
interface ApiError {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}
type HomeBroadcastMessage =
  | { type: "doc-open"; docId: string; ts: number }
  | { type: "doc-close"; docId: string; ts: number }
  | { type: "ping"; ts: number };

const HOME_BROADCAST_CHANNEL = "m3e:home:v1";

// ---------------------------------------------------------------------------
// Japanese UI strings (decision Q10: hardcoded JA in v1, dictionary in v2).
// Keep all user-facing text here so future i18n work is mechanical.
// ---------------------------------------------------------------------------
const JA = {
  loading: "読み込み中...",
  loadError: "ドキュメント一覧の取得に失敗しました。モックデータを表示しています。",
  emptyAll: "ドキュメントがありません。",
  emptyTrash: "ゴミ箱は空です。",
  newLabelPrompt: "新しいドキュメントのラベル（空欄で 'Untitled'）",
  renamePrompt: "新しいラベル",
  tagsPrompt: "タグ（カンマ区切り）",
  confirmArchive: (label: string) => `「${label}」をゴミ箱に移動しますか？`,
  confirmRestore: (label: string) => `「${label}」をゴミ箱から戻しますか？`,
  confirmDelete: (label: string) => `「${label}」を完全に削除します。元に戻せません。`,
  archived: "ゴミ箱に移動しました。",
  restored: "ゴミ箱から戻しました。",
  deleted: "完全に削除しました。",
  duplicated: "複製しました。",
  renamed: "ラベルを更新しました。",
  tagsUpdated: "タグを更新しました。",
  created: "新規ドキュメントを作成しました。",
  apiError: "API エラー",
} as const;

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------
type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError["error"] };

async function apiCall<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(init.headers || {}),
      },
    });
    let body: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    if (!res.ok || !body || (body as { ok?: unknown }).ok !== true) {
      const errBody = body as ApiError | null;
      const error = errBody && errBody.ok === false
        ? errBody.error
        : { code: `HTTP_${res.status}`, message: res.statusText || "Request failed" };
      return { ok: false, error };
    }
    return { ok: true, data: body as T };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

const api = {
  list: () => apiCall<DocListResponse>("/api/docs"),
  create: (label?: string) =>
    apiCall<DocIdResponse>("/api/docs/new", {
      method: "POST",
      body: JSON.stringify({ label: label ?? null }),
    }),
  duplicate: (id: string) =>
    apiCall<DocIdResponse>(`/api/docs/${encodeURIComponent(id)}/duplicate`, {
      method: "POST",
      body: "{}",
    }),
  rename: (id: string, label: string) =>
    apiCall<DocOkResponse>(`/api/docs/${encodeURIComponent(id)}/rename`, {
      method: "POST",
      body: JSON.stringify({ label }),
    }),
  archive: (id: string) =>
    apiCall<DocOkResponse>(`/api/docs/${encodeURIComponent(id)}/archive`, {
      method: "POST",
      body: "{}",
    }),
  restore: (id: string) =>
    apiCall<DocOkResponse>(`/api/docs/${encodeURIComponent(id)}/restore`, {
      method: "POST",
      body: "{}",
    }),
  setTags: (id: string, tags: string[]) =>
    apiCall<DocOkResponse>(`/api/docs/${encodeURIComponent(id)}/tags`, {
      method: "POST",
      body: JSON.stringify({ tags }),
    }),
  delete: (id: string) =>
    apiCall<DocOkResponse>(`/api/docs/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};

// ---------------------------------------------------------------------------
// Mock data fallback (used when GET /api/docs fails)
// ---------------------------------------------------------------------------
function buildMockDocs(): DocSummary[] {
  const now = Date.now();
  const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();
  return [
    {
      id: "akaghef-beta",
      label: "(モック) Rapid 開発マップ",
      savedAt: iso(1000 * 60 * 5),
      nodeCount: 412,
      charCount: 18234,
      tags: ["dev", "strategy"],
      archived: false,
    },
    {
      id: "mock-doc-2",
      label: "(モック) リサーチ思考ボード",
      savedAt: iso(1000 * 60 * 60 * 26),
      nodeCount: 87,
      charCount: 3210,
      tags: ["research"],
      archived: false,
    },
    {
      id: "mock-doc-3",
      label: "(モック) 旧プロジェクト",
      savedAt: iso(1000 * 60 * 60 * 24 * 14),
      nodeCount: 23,
      charCount: 540,
      tags: [],
      archived: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// View state
// ---------------------------------------------------------------------------
interface HomeState {
  docs: DocSummary[];
  /** Doc IDs currently open in some viewer tab, populated via BroadcastChannel. */
  openDocIds: Set<string>;
  /** Last-seen wall-clock per open docId; used to expire stale entries. */
  openDocSeen: Map<string, number>;
  showArchived: boolean;
  filter: string;
  isMock: boolean;
}

const state: HomeState = {
  docs: [],
  openDocIds: new Set(),
  openDocSeen: new Map(),
  showArchived: false,
  filter: "",
  isMock: false,
};

const STALE_OPEN_MS = 30_000;

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
}

const els = {
  list: () => $<HTMLUListElement>("home-list"),
  empty: () => $<HTMLDivElement>("home-empty"),
  status: () => $<HTMLDivElement>("home-status"),
  search: () => $<HTMLInputElement>("home-search"),
  showArchived: () => $<HTMLInputElement>("home-show-archived"),
  newBtn: () => $<HTMLButtonElement>("home-new"),
  rowTemplate: () => $<HTMLTemplateElement>("home-row-template"),
};

function setStatus(message: string | null, isError = false): void {
  const el = els.status();
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    el.classList.remove("is-error");
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle("is-error", isError);
}

function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}日前`;
  return d.toLocaleString("ja-JP", { hour12: false });
}

function formatStats(d: DocSummary): string {
  const nodes = d.nodeCount.toLocaleString("ja-JP");
  const chars = d.charCount.toLocaleString("ja-JP");
  return `ノード ${nodes} / 文字 ${chars}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" :
    c === "<" ? "&lt;" :
    c === ">" ? "&gt;" :
    c === '"' ? "&quot;" : "&#39;",
  );
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function pruneStaleOpenDocs(): void {
  const cutoff = Date.now() - STALE_OPEN_MS;
  for (const [id, seen] of state.openDocSeen) {
    if (seen < cutoff) {
      state.openDocSeen.delete(id);
      state.openDocIds.delete(id);
    }
  }
}

function visibleDocs(): DocSummary[] {
  const q = state.filter.trim().toLowerCase();
  return state.docs.filter((d) => {
    if (!state.showArchived && d.archived) return false;
    if (state.showArchived && !d.archived) return false;
    if (!q) return true;
    if (d.label.toLowerCase().includes(q)) return true;
    if (d.tags.some((t) => t.toLowerCase().includes(q))) return true;
    return false;
  });
}

function render(): void {
  pruneStaleOpenDocs();
  const list = els.list();
  list.innerHTML = "";
  const docs = visibleDocs();

  if (docs.length === 0) {
    els.empty().hidden = false;
    els.empty().querySelector("p")!.textContent = state.showArchived
      ? JA.emptyTrash
      : JA.emptyAll;
    return;
  }
  els.empty().hidden = true;

  const tpl = els.rowTemplate();
  for (const d of docs) {
    const frag = tpl.content.cloneNode(true) as DocumentFragment;
    const row = frag.querySelector<HTMLLIElement>(".home-row")!;
    row.dataset.id = d.id;
    if (d.archived) row.classList.add("is-archived");

    const link = row.querySelector<HTMLAnchorElement>('[data-role="open"]')!;
    link.href = `./viewer.html?localDocId=${encodeURIComponent(d.id)}`;

    row.querySelector<HTMLElement>('[data-role="label"]')!.textContent = d.label || "(無題)";
    row.querySelector<HTMLElement>('[data-role="saved"]')!.textContent = formatSavedAt(d.savedAt);
    row.querySelector<HTMLElement>('[data-role="stats"]')!.textContent = formatStats(d);

    const tagsEl = row.querySelector<HTMLElement>('[data-role="tags"]')!;
    tagsEl.innerHTML = d.tags
      .map((t) => `<span class="home-tag">${escapeHtml(t)}</span>`)
      .join("");

    const openBadge = row.querySelector<HTMLElement>('[data-role="open-badge"]')!;
    openBadge.hidden = !state.openDocIds.has(d.id);

    const archivedBadge = row.querySelector<HTMLElement>('[data-role="archived-badge"]')!;
    archivedBadge.hidden = !d.archived;

    // Action button visibility per archived state.
    const archiveBtn = row.querySelector<HTMLButtonElement>('[data-role="archive"]')!;
    const restoreBtn = row.querySelector<HTMLButtonElement>('[data-role="restore"]')!;
    const deleteBtn = row.querySelector<HTMLButtonElement>('[data-role="delete"]')!;
    archiveBtn.hidden = d.archived;
    restoreBtn.hidden = !d.archived;
    deleteBtn.hidden = !d.archived;

    list.appendChild(row);
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
function findDoc(id: string): DocSummary | undefined {
  return state.docs.find((d) => d.id === id);
}

function reportError(prefix: string, error: ApiError["error"]): void {
  setStatus(`${prefix}: ${error.code} — ${error.message}`, true);
}

async function reload(): Promise<void> {
  const r = await api.list();
  if (r.ok) {
    state.docs = r.data.docs;
    state.isMock = false;
    setStatus(null);
  } else {
    state.docs = buildMockDocs();
    state.isMock = true;
    setStatus(`${JA.loadError} (${r.error.code}: ${r.error.message})`, true);
  }
  render();
}

async function handleNew(): Promise<void> {
  const raw = window.prompt(JA.newLabelPrompt, "");
  if (raw === null) return;
  const label = raw.trim() || undefined;
  if (state.isMock) {
    state.docs.unshift({
      id: `mock-${Date.now()}`,
      label: label || "Untitled",
      savedAt: new Date().toISOString(),
      nodeCount: 1,
      charCount: 0,
      tags: [],
      archived: false,
    });
    setStatus(`${JA.created} (モック)`);
    render();
    return;
  }
  const r = await api.create(label);
  if (!r.ok) return reportError(JA.apiError, r.error);
  setStatus(JA.created);
  await reload();
}

async function handleRename(id: string): Promise<void> {
  const doc = findDoc(id);
  if (!doc) return;
  const next = window.prompt(JA.renamePrompt, doc.label);
  if (next === null) return;
  const label = next.trim();
  if (!label || label === doc.label) return;
  if (state.isMock) {
    doc.label = label;
    setStatus(`${JA.renamed} (モック)`);
    render();
    return;
  }
  const r = await api.rename(id, label);
  if (!r.ok) return reportError(JA.apiError, r.error);
  doc.label = label;
  setStatus(JA.renamed);
  render();
}

async function handleDuplicate(id: string): Promise<void> {
  if (state.isMock) {
    const src = findDoc(id);
    if (!src) return;
    state.docs.unshift({
      ...src,
      id: `mock-${Date.now()}`,
      label: `${src.label} (コピー)`,
      savedAt: new Date().toISOString(),
    });
    setStatus(`${JA.duplicated} (モック)`);
    render();
    return;
  }
  const r = await api.duplicate(id);
  if (!r.ok) return reportError(JA.apiError, r.error);
  setStatus(JA.duplicated);
  await reload();
}

async function handleArchive(id: string): Promise<void> {
  const doc = findDoc(id);
  if (!doc) return;
  if (!window.confirm(JA.confirmArchive(doc.label))) return;
  if (state.isMock) {
    doc.archived = true;
    setStatus(`${JA.archived} (モック)`);
    render();
    return;
  }
  const r = await api.archive(id);
  if (!r.ok) return reportError(JA.apiError, r.error);
  doc.archived = true;
  setStatus(JA.archived);
  render();
}

async function handleRestore(id: string): Promise<void> {
  const doc = findDoc(id);
  if (!doc) return;
  if (!window.confirm(JA.confirmRestore(doc.label))) return;
  if (state.isMock) {
    doc.archived = false;
    setStatus(`${JA.restored} (モック)`);
    render();
    return;
  }
  const r = await api.restore(id);
  if (!r.ok) return reportError(JA.apiError, r.error);
  doc.archived = false;
  setStatus(JA.restored);
  render();
}

async function handleDelete(id: string): Promise<void> {
  const doc = findDoc(id);
  if (!doc) return;
  if (!doc.archived) return; // Safety: only allow when archived.
  if (!window.confirm(JA.confirmDelete(doc.label))) return;
  if (state.isMock) {
    state.docs = state.docs.filter((d) => d.id !== id);
    setStatus(`${JA.deleted} (モック)`);
    render();
    return;
  }
  const r = await api.delete(id);
  if (!r.ok) return reportError(JA.apiError, r.error);
  state.docs = state.docs.filter((d) => d.id !== id);
  setStatus(JA.deleted);
  render();
}

async function handleEditTags(id: string): Promise<void> {
  const doc = findDoc(id);
  if (!doc) return;
  const current = doc.tags.join(", ");
  const next = window.prompt(JA.tagsPrompt, current);
  if (next === null) return;
  const tags = next
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (state.isMock) {
    doc.tags = tags;
    setStatus(`${JA.tagsUpdated} (モック)`);
    render();
    return;
  }
  const r = await api.setTags(id, tags);
  if (!r.ok) return reportError(JA.apiError, r.error);
  doc.tags = tags;
  setStatus(JA.tagsUpdated);
  render();
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------
function wireEvents(): void {
  els.search().addEventListener("input", (e) => {
    state.filter = (e.target as HTMLInputElement).value;
    render();
  });
  els.showArchived().addEventListener("change", (e) => {
    state.showArchived = (e.target as HTMLInputElement).checked;
    render();
  });
  els.newBtn().addEventListener("click", () => void handleNew());

  // Single delegated listener for row-level actions.
  els.list().addEventListener("click", (ev) => {
    const target = ev.target as HTMLElement;
    const actionEl = target.closest<HTMLElement>("[data-role]");
    const rowEl = target.closest<HTMLElement>(".home-row");
    if (!rowEl || !actionEl) return;
    const id = rowEl.dataset.id;
    if (!id) return;
    const role = actionEl.dataset.role;

    // The "open" link is a real anchor; let the browser navigate.
    if (role === "open") return;

    ev.preventDefault();
    switch (role) {
      case "rename": void handleRename(id); break;
      case "duplicate": void handleDuplicate(id); break;
      case "archive": void handleArchive(id); break;
      case "restore": void handleRestore(id); break;
      case "delete": void handleDelete(id); break;
      case "tags-edit": void handleEditTags(id); break;
    }
  });
}

// ---------------------------------------------------------------------------
// BroadcastChannel: receive viewer "open" announcements
// ---------------------------------------------------------------------------
function wireBroadcast(): void {
  if (typeof BroadcastChannel === "undefined") return;
  const ch = new BroadcastChannel(HOME_BROADCAST_CHANNEL);
  ch.addEventListener("message", (ev) => {
    const msg = ev.data as HomeBroadcastMessage | null;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "doc-open") {
      state.openDocIds.add(msg.docId);
      state.openDocSeen.set(msg.docId, msg.ts || Date.now());
      render();
    } else if (msg.type === "doc-close") {
      state.openDocIds.delete(msg.docId);
      state.openDocSeen.delete(msg.docId);
      render();
    }
  });
  // Ask any existing viewers to re-announce.
  ch.postMessage({ type: "ping", ts: Date.now() } satisfies HomeBroadcastMessage);
  // Periodically prune stale entries.
  window.setInterval(() => {
    const before = state.openDocIds.size;
    pruneStaleOpenDocs();
    if (state.openDocIds.size !== before) render();
  }, 10_000);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
function boot(): void {
  setStatus(JA.loading);
  wireEvents();
  wireBroadcast();
  void reload();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
