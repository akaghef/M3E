"use strict";

(function () {
interface DocSource {
  kind: "obsidian";
  path: string;
}

interface DocSummary {
  id: string;
  label: string;
  savedAt: string;
  nodeCount: number;
  charCount: number;
  tags: string[];
  archived: boolean;
  pinned: boolean;
  source?: DocSource;
}

interface DocListResponse {
  docs: DocSummary[];
}

const queryParams = new URLSearchParams(window.location.search);
const DEFAULT_WORKSPACE_ID = "ws_REMH1Z5TFA7S93R3HA0XK58JNR";
const workspaceId = normalizeId(queryParams.get("ws"), DEFAULT_WORKSPACE_ID);

let allDocs: DocSummary[] = [];
let searchQuery = "";
let archivedExpanded = false;

const pinnedSectionEl = document.getElementById("home-pinned-section") as HTMLElement;
const pinnedGridEl = document.getElementById("home-pinned-grid") as HTMLElement;
const docListEl = document.getElementById("home-doc-list") as HTMLElement;
const emptyEl = document.getElementById("home-empty") as HTMLElement;
const archivedSectionEl = document.getElementById("home-archived-section") as HTMLElement;
const archivedToggleEl = document.getElementById("home-archived-toggle") as HTMLButtonElement;
const archivedListEl = document.getElementById("home-archived-list") as HTMLElement;
const archivedCountEl = document.getElementById("home-archived-count") as HTMLElement;
const searchEl = document.getElementById("home-search") as HTMLInputElement;
const statusEl = document.getElementById("home-status") as HTMLElement;
const menuEl = document.getElementById("home-menu") as HTMLElement;
const importInputEl = document.getElementById("home-import-input") as HTMLInputElement;

function normalizeId(raw: string | null, fallback: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/[\\/]/g, "_");
}

function setStatus(text: string): void {
  statusEl.textContent = text;
  if (!text) return;
  window.setTimeout(() => {
    if (statusEl.textContent === text) statusEl.textContent = "";
  }, 4000);
}

function relTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const seconds = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function viewerHref(docId: string): string {
  const params = new URLSearchParams({
    ws: workspaceId,
    map: docId,
  });
  return `./viewer.html?${params.toString()}`;
}

function navigateToDoc(docId: string): void {
  window.location.href = viewerHref(docId);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  if (text.trim().length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`${res.status}: invalid JSON response`);
    }
  }
  if (!res.ok) {
    const msg = (
      body &&
      typeof body === "object" &&
      (body as { error?: { message?: string } }).error?.message
    ) || `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return body as T;
}

async function fetchDocs(): Promise<DocSummary[]> {
  const data = await apiJson<DocListResponse>("/api/maps?includeArchived=true");
  return Array.isArray(data.docs) ? data.docs : [];
}

async function createBlank(): Promise<string> {
  const body = await apiJson<{ ok: true; id: string }>("/api/maps/new", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return body.id;
}

async function importFromFile(file: File): Promise<string> {
  const content = await file.text();
  const body = await apiJson<{ ok: true; id: string }>("/api/maps/import-file", {
    method: "POST",
    body: JSON.stringify({ filename: file.name, content }),
  });
  return body.id;
}

async function importFromVault(vaultPath: string): Promise<string> {
  const body = await apiJson<{ ok: true; id: string }>("/api/maps/import-vault", {
    method: "POST",
    body: JSON.stringify({ vaultPath }),
  });
  return body.id;
}

async function setPinned(docId: string, pinned: boolean): Promise<void> {
  await apiJson(`/api/maps/${encodeURIComponent(docId)}/pin`, {
    method: "PATCH",
    body: JSON.stringify({ pinned }),
  });
}

async function renameDoc(docId: string, label: string): Promise<void> {
  await apiJson(`/api/maps/${encodeURIComponent(docId)}/rename`, {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

async function duplicateDoc(docId: string): Promise<string> {
  const body = await apiJson<{ ok: true; id: string }>(
    `/api/maps/${encodeURIComponent(docId)}/duplicate`,
    { method: "POST" },
  );
  return body.id;
}

async function archiveDoc(docId: string): Promise<void> {
  await apiJson(`/api/maps/${encodeURIComponent(docId)}/archive`, { method: "POST" });
}

async function restoreDoc(docId: string): Promise<void> {
  await apiJson(`/api/maps/${encodeURIComponent(docId)}/restore`, { method: "POST" });
}

async function deleteDoc(docId: string): Promise<void> {
  await apiJson(`/api/maps/${encodeURIComponent(docId)}`, { method: "DELETE" });
}

async function bindVault(docId: string, vaultPath: string): Promise<void> {
  await apiJson(`/api/maps/${encodeURIComponent(docId)}/bind-vault`, {
    method: "POST",
    body: JSON.stringify({ vaultPath }),
  });
}

async function unbindVault(docId: string): Promise<void> {
  await apiJson(`/api/maps/${encodeURIComponent(docId)}/unbind-vault`, { method: "POST" });
}

function matchesSearch(doc: DocSummary, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase().replace(/^#/, "");
  if (doc.label.toLowerCase().includes(lower)) return true;
  for (const tag of doc.tags) {
    if (tag.toLowerCase().includes(lower)) return true;
  }
  return false;
}

function sortByUpdatedDesc(docs: DocSummary[]): DocSummary[] {
  return docs.slice().sort((a, b) => {
    const ta = Date.parse(a.savedAt) || 0;
    const tb = Date.parse(b.savedAt) || 0;
    return tb - ta;
  });
}

function buildPinnedCard(doc: DocSummary): HTMLElement {
  const card = document.createElement("div");
  card.className = "home-pinned-card";
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.setAttribute("aria-label", `Open ${doc.label}`);

  const icon = doc.source?.kind === "obsidian" ? "📘" : "🗺";
  card.innerHTML = `
    <div class="home-pinned-icon" aria-hidden="true">${icon}</div>
    <div class="home-pinned-label">${escapeHtml(doc.label)}</div>
    <div class="home-pinned-meta">${doc.nodeCount} nodes · ${escapeHtml(relTime(doc.savedAt))}</div>
  `;

  const open = () => navigateToDoc(doc.id);
  card.addEventListener("click", open);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  });
  return card;
}

function buildDocRow(doc: DocSummary): HTMLElement {
  const row = document.createElement("div");
  row.className = "home-doc-row";
  if (doc.archived) row.classList.add("is-archived");
  row.setAttribute("role", "listitem");
  row.dataset.docId = doc.id;

  const pinBtn = document.createElement("button");
  pinBtn.type = "button";
  pinBtn.className = "home-doc-pin" + (doc.pinned ? " is-pinned" : "");
  pinBtn.setAttribute("aria-label", doc.pinned ? "Unpin map" : "Pin map");
  pinBtn.textContent = doc.pinned ? "★" : "☆";
  pinBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await setPinned(doc.id, !doc.pinned);
      doc.pinned = !doc.pinned;
      render();
    } catch (err) {
      setStatus(`Pin failed: ${(err as Error).message}`);
    }
  });
  row.appendChild(pinBtn);

  const icon = document.createElement("span");
  icon.className = "home-doc-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = doc.source?.kind === "obsidian" ? "📘" : "🗺";
  row.appendChild(icon);

  const body = document.createElement("div");
  body.className = "home-doc-body";

  const labelLink = document.createElement("a");
  labelLink.className = "home-doc-label";
  labelLink.href = viewerHref(doc.id);
  labelLink.textContent = doc.label;
  body.appendChild(labelLink);

  const metaParts: string[] = [];
  metaParts.push(`${doc.nodeCount} nodes`);
  metaParts.push(`updated ${relTime(doc.savedAt)}`);
  if (doc.tags.length > 0) metaParts.push(doc.tags.map((t) => `#${t}`).join(" "));
  if (doc.source?.kind === "obsidian") metaParts.push(`obsidian: ${doc.source.path}`);
  const meta = document.createElement("div");
  meta.className = "home-doc-meta";
  meta.textContent = metaParts.join(" · ");
  body.appendChild(meta);

  row.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "home-doc-actions";

  if (doc.archived) {
    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "home-doc-action";
    restoreBtn.textContent = "restore";
    restoreBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await restoreDoc(doc.id);
        await reload();
        setStatus(`Restored: ${doc.label}`);
      } catch (err) {
        setStatus(`Restore failed: ${(err as Error).message}`);
      }
    });
    actions.appendChild(restoreBtn);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "home-doc-action danger";
    delBtn.textContent = "delete";
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!window.confirm(`Permanently delete "${doc.label}"? This cannot be undone.`)) return;
      try {
        await deleteDoc(doc.id);
        await reload();
        setStatus(`Deleted: ${doc.label}`);
      } catch (err) {
        setStatus(`Delete failed: ${(err as Error).message}`);
      }
    });
    actions.appendChild(delBtn);
  } else {
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "home-doc-action primary";
    openBtn.textContent = "open";
    openBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigateToDoc(doc.id);
    });
    actions.appendChild(openBtn);

    const moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.className = "home-doc-action";
    moreBtn.setAttribute("aria-label", "More actions");
    moreBtn.textContent = "⋯";
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openMenu(doc, moreBtn);
    });
    actions.appendChild(moreBtn);
  }

  row.appendChild(actions);
  return row;
}

function render(): void {
  const visible = allDocs
    .filter((d) => !d.archived)
    .filter((d) => matchesSearch(d, searchQuery));
  const sorted = sortByUpdatedDesc(visible);

  const pinned = sorted.filter((d) => d.pinned);
  pinnedGridEl.replaceChildren();
  if (pinned.length === 0) {
    pinnedSectionEl.hidden = true;
  } else {
    pinnedSectionEl.hidden = false;
    for (const doc of pinned) {
      pinnedGridEl.appendChild(buildPinnedCard(doc));
    }
  }

  docListEl.replaceChildren();
  if (sorted.length === 0) {
    emptyEl.hidden = false;
  } else {
    emptyEl.hidden = true;
    for (const doc of sorted) {
      docListEl.appendChild(buildDocRow(doc));
    }
  }

  const archived = sortByUpdatedDesc(allDocs.filter((d) => d.archived));
  if (archived.length === 0) {
    archivedSectionEl.hidden = true;
  } else {
    archivedSectionEl.hidden = false;
    archivedCountEl.textContent = String(archived.length);
    archivedToggleEl.setAttribute("aria-expanded", String(archivedExpanded));
    archivedToggleEl.classList.toggle("is-expanded", archivedExpanded);
    archivedListEl.hidden = !archivedExpanded;
    archivedListEl.replaceChildren();
    if (archivedExpanded) {
      for (const doc of archived) {
        archivedListEl.appendChild(buildDocRow(doc));
      }
    }
  }
}

async function reload(): Promise<void> {
  try {
    allDocs = await fetchDocs();
  } catch (err) {
    setStatus(`Could not load maps: ${(err as Error).message}`);
    allDocs = [];
  }
  render();
}

interface MenuItem {
  label: string;
  danger?: boolean;
  onSelect: () => Promise<void> | void;
}

function openMenu(doc: DocSummary, anchor: HTMLElement): void {
  const items: MenuItem[] = [
    {
      label: "rename",
      onSelect: async () => {
        const next = window.prompt("New label", doc.label);
        if (next === null) return;
        const trimmed = next.trim();
        if (trimmed.length === 0 || trimmed === doc.label) return;
        try {
          await renameDoc(doc.id, trimmed);
          await reload();
          setStatus(`Renamed to "${trimmed}"`);
        } catch (err) {
          setStatus(`Rename failed: ${(err as Error).message}`);
        }
      },
    },
    {
      label: "duplicate",
      onSelect: async () => {
        try {
          const newId = await duplicateDoc(doc.id);
          await reload();
          setStatus(`Duplicated as ${newId}`);
        } catch (err) {
          setStatus(`Duplicate failed: ${(err as Error).message}`);
        }
      },
    },
  ];

  if (doc.source?.kind === "obsidian") {
    items.push({
      label: "unbind from vault",
      onSelect: async () => {
        if (!window.confirm(`Unbind "${doc.label}" from vault ${doc.source!.path}?`)) return;
        try {
          await unbindVault(doc.id);
          await reload();
          setStatus("Vault unbound");
        } catch (err) {
          setStatus(`Unbind failed: ${(err as Error).message}`);
        }
      },
    });
  } else {
    items.push({
      label: "bind to vault...",
      onSelect: async () => {
        const p = window.prompt("Path to Obsidian vault directory:", "");
        if (!p) return;
        try {
          await bindVault(doc.id, p.trim());
          await reload();
          setStatus("Vault bound");
        } catch (err) {
          setStatus(`Bind failed: ${(err as Error).message}`);
        }
      },
    });
  }

  items.push({
    label: "archive",
    onSelect: async () => {
      try {
        await archiveDoc(doc.id);
        await reload();
        setStatus(`Archived: ${doc.label}`);
      } catch (err) {
        setStatus(`Archive failed: ${(err as Error).message}`);
      }
    },
  });

  items.push({
    label: "delete",
    danger: true,
    onSelect: async () => {
      if (!window.confirm(`Delete "${doc.label}"? It will be archived first if necessary.`)) return;
      try {
        try {
          await archiveDoc(doc.id);
        } catch {
        }
        await deleteDoc(doc.id);
        await reload();
        setStatus(`Deleted: ${doc.label}`);
      } catch (err) {
        setStatus(`Delete failed: ${(err as Error).message}`);
      }
    },
  });

  menuEl.replaceChildren();
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "home-menu-item" + (item.danger ? " danger" : "");
    btn.setAttribute("role", "menuitem");
    btn.textContent = item.label;
    btn.addEventListener("click", () => {
      closeMenu();
      void item.onSelect();
    });
    menuEl.appendChild(btn);
  }

  const rect = anchor.getBoundingClientRect();
  menuEl.hidden = false;
  const menuRect = menuEl.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - menuRect.width - 8, rect.right - menuRect.width));
  const top = rect.bottom + 4;
  menuEl.style.left = `${left}px`;
  menuEl.style.top = `${top}px`;

  const dismiss = (e: MouseEvent | KeyboardEvent) => {
    if (e instanceof KeyboardEvent && e.key !== "Escape") return;
    if (e instanceof MouseEvent && menuEl.contains(e.target as Node)) return;
    closeMenu();
  };

  function closeMenu(): void {
    menuEl.hidden = true;
    document.removeEventListener("mousedown", dismiss as EventListener);
    document.removeEventListener("keydown", dismiss as EventListener);
  }

  window.setTimeout(() => {
    document.addEventListener("mousedown", dismiss as EventListener);
    document.addEventListener("keydown", dismiss as EventListener);
  }, 0);
}

function wireCreateCards(): void {
  const blankBtn = document.querySelector('[data-create="blank"]') as HTMLButtonElement | null;
  const vaultBtn = document.querySelector('[data-create="vault"]') as HTMLButtonElement | null;
  const importBtn = document.querySelector('[data-create="import"]') as HTMLButtonElement | null;

  blankBtn?.addEventListener("click", async () => {
    try {
      const id = await createBlank();
      navigateToDoc(id);
    } catch (err) {
      setStatus(`Create failed: ${(err as Error).message}`);
    }
  });

  vaultBtn?.addEventListener("click", async () => {
    const p = window.prompt("Path to Obsidian vault directory:", "");
    if (!p) return;
    try {
      const id = await importFromVault(p.trim());
      setStatus("Vault imported");
      navigateToDoc(id);
    } catch (err) {
      setStatus(`Vault import failed: ${(err as Error).message}`);
    }
  });

  importBtn?.addEventListener("click", () => {
    importInputEl.click();
  });

  importInputEl.addEventListener("change", async () => {
    const file = importInputEl.files?.[0];
    if (!file) return;
    try {
      const id = await importFromFile(file);
      setStatus(`Imported: ${file.name}`);
      navigateToDoc(id);
    } catch (err) {
      setStatus(`Import failed: ${(err as Error).message}`);
    } finally {
      importInputEl.value = "";
    }
  });
}

function wireSearch(): void {
  searchEl.addEventListener("input", () => {
    searchQuery = searchEl.value.trim();
    render();
  });
}

function wireArchivedToggle(): void {
  archivedToggleEl.addEventListener("click", () => {
    archivedExpanded = !archivedExpanded;
    render();
  });
}

function wireLogo(): void {
  const logo = document.querySelector(".home-logo") as HTMLAnchorElement | null;
  logo?.addEventListener("click", (e) => {
    e.preventDefault();
  });
}

wireCreateCards();
wireSearch();
wireArchivedToggle();
wireLogo();
void reload();
})();
