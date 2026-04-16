"use strict";

(function () {
interface MapSource {
  kind: "obsidian";
  path: string;
}

interface MapSummary {
  id: string;
  label: string;
  savedAt: string;
  nodeCount: number;
  charCount: number;
  tags: string[];
  archived: boolean;
  pinned: boolean;
  source?: MapSource;
}

interface MapListResponse {
  maps: MapSummary[];
}

const queryParams = new URLSearchParams(window.location.search);
const DEFAULT_WORKSPACE_ID = "ws_REMH1Z5TFA7S93R3HA0XK58JNR";
const workspaceId = normalizeId(queryParams.get("ws"), DEFAULT_WORKSPACE_ID);

let allMaps: MapSummary[] = [];
let searchQuery = "";
let archivedExpanded = false;

const pinnedSectionEl = document.getElementById("home-pinned-section") as HTMLElement;
const pinnedGridEl = document.getElementById("home-pinned-grid") as HTMLElement;
const mapListEl = document.getElementById("home-map-list") as HTMLElement;
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

function viewerHref(mapId: string): string {
  const params = new URLSearchParams({
    ws: workspaceId,
    map: mapId,
  });
  return `./viewer.html?${params.toString()}`;
}

function navigateToMap(mapId: string): void {
  window.location.href = viewerHref(mapId);
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

async function fetchMaps(): Promise<MapSummary[]> {
  const data = await apiJson<MapListResponse>("/api/maps?includeArchived=true");
  return Array.isArray(data.maps) ? data.maps : [];
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

async function setPinned(mapId: string, pinned: boolean): Promise<void> {
  await apiJson(`/api/maps/${encodeURIComponent(mapId)}/pin`, {
    method: "PATCH",
    body: JSON.stringify({ pinned }),
  });
}

async function renameMap(mapId: string, label: string): Promise<void> {
  await apiJson(`/api/maps/${encodeURIComponent(mapId)}/rename`, {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

async function duplicateMap(mapId: string): Promise<string> {
  const body = await apiJson<{ ok: true; id: string }>(
    `/api/maps/${encodeURIComponent(mapId)}/duplicate`,
    { method: "POST" },
  );
  return body.id;
}

async function archiveMap(mapId: string): Promise<void> {
  await apiJson(`/api/maps/${encodeURIComponent(mapId)}/archive`, { method: "POST" });
}

async function restoreMap(mapId: string): Promise<void> {
  await apiJson(`/api/maps/${encodeURIComponent(mapId)}/restore`, { method: "POST" });
}

async function deleteMap(mapId: string): Promise<void> {
  await apiJson(`/api/maps/${encodeURIComponent(mapId)}`, { method: "DELETE" });
}

async function bindVault(mapId: string, vaultPath: string): Promise<void> {
  await apiJson(`/api/maps/${encodeURIComponent(mapId)}/bind-vault`, {
    method: "POST",
    body: JSON.stringify({ vaultPath }),
  });
}

async function unbindVault(mapId: string): Promise<void> {
  await apiJson(`/api/maps/${encodeURIComponent(mapId)}/unbind-vault`, { method: "POST" });
}

function matchesSearch(map: MapSummary, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase().replace(/^#/, "");
  if (map.label.toLowerCase().includes(lower)) return true;
  for (const tag of map.tags) {
    if (tag.toLowerCase().includes(lower)) return true;
  }
  return false;
}

function sortByUpdatedDesc(maps: MapSummary[]): MapSummary[] {
  return maps.slice().sort((a, b) => {
    const ta = Date.parse(a.savedAt) || 0;
    const tb = Date.parse(b.savedAt) || 0;
    return tb - ta;
  });
}

function buildPinnedCard(map: MapSummary): HTMLElement {
  const card = document.createElement("div");
  card.className = "home-pinned-card";
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.setAttribute("aria-label", `Open ${map.label}`);

  const icon = map.source?.kind === "obsidian" ? "📘" : "🗺";
  card.innerHTML = `
    <div class="home-pinned-icon" aria-hidden="true">${icon}</div>
    <div class="home-pinned-label">${escapeHtml(map.label)}</div>
    <div class="home-pinned-meta">${map.nodeCount} nodes · ${escapeHtml(relTime(map.savedAt))}</div>
  `;

  const open = () => navigateToMap(map.id);
  card.addEventListener("click", open);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  });
  return card;
}

function buildMapRow(map: MapSummary): HTMLElement {
  const row = document.createElement("div");
  row.className = "home-map-row";
  if (map.archived) row.classList.add("is-archived");
  row.setAttribute("role", "listitem");
  row.dataset.mapId = map.id;

  const pinBtn = document.createElement("button");
  pinBtn.type = "button";
  pinBtn.className = "home-map-pin" + (map.pinned ? " is-pinned" : "");
  pinBtn.setAttribute("aria-label", map.pinned ? "Unpin map" : "Pin map");
  pinBtn.textContent = map.pinned ? "★" : "☆";
  pinBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await setPinned(map.id, !map.pinned);
      map.pinned = !map.pinned;
      render();
    } catch (err) {
      setStatus(`Pin failed: ${(err as Error).message}`);
    }
  });
  row.appendChild(pinBtn);

  const icon = document.createElement("span");
  icon.className = "home-map-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = map.source?.kind === "obsidian" ? "📘" : "🗺";
  row.appendChild(icon);

  const body = document.createElement("div");
  body.className = "home-map-body";

  const labelLink = document.createElement("a");
  labelLink.className = "home-map-label";
  labelLink.href = viewerHref(map.id);
  labelLink.textContent = map.label;
  body.appendChild(labelLink);

  const metaParts: string[] = [];
  metaParts.push(`${map.nodeCount} nodes`);
  metaParts.push(`updated ${relTime(map.savedAt)}`);
  if (map.tags.length > 0) metaParts.push(map.tags.map((t) => `#${t}`).join(" "));
  if (map.source?.kind === "obsidian") metaParts.push(`obsidian: ${map.source.path}`);
  const meta = document.createElement("div");
  meta.className = "home-map-meta";
  meta.textContent = metaParts.join(" · ");
  body.appendChild(meta);

  row.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "home-map-actions";

  if (map.archived) {
    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "home-map-action";
    restoreBtn.textContent = "restore";
    restoreBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await restoreMap(map.id);
        await reload();
        setStatus(`Restored: ${map.label}`);
      } catch (err) {
        setStatus(`Restore failed: ${(err as Error).message}`);
      }
    });
    actions.appendChild(restoreBtn);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "home-map-action danger";
    delBtn.textContent = "delete";
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!window.confirm(`Permanently delete "${map.label}"? This cannot be undone.`)) return;
      try {
        await deleteMap(map.id);
        await reload();
        setStatus(`Deleted: ${map.label}`);
      } catch (err) {
        setStatus(`Delete failed: ${(err as Error).message}`);
      }
    });
    actions.appendChild(delBtn);
  } else {
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "home-map-action primary";
    openBtn.textContent = "open";
    openBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigateToMap(map.id);
    });
    actions.appendChild(openBtn);

    const moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.className = "home-map-action";
    moreBtn.setAttribute("aria-label", "More actions");
    moreBtn.textContent = "⋯";
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openMenu(map, moreBtn);
    });
    actions.appendChild(moreBtn);
  }

  row.appendChild(actions);
  return row;
}

function render(): void {
  const visible = allMaps
    .filter((d) => !d.archived)
    .filter((d) => matchesSearch(d, searchQuery));
  const sorted = sortByUpdatedDesc(visible);

  const pinned = sorted.filter((d) => d.pinned);
  pinnedGridEl.replaceChildren();
  if (pinned.length === 0) {
    pinnedSectionEl.hidden = true;
  } else {
    pinnedSectionEl.hidden = false;
    for (const map of pinned) {
      pinnedGridEl.appendChild(buildPinnedCard(map));
    }
  }

  mapListEl.replaceChildren();
  if (sorted.length === 0) {
    emptyEl.hidden = false;
  } else {
    emptyEl.hidden = true;
    for (const map of sorted) {
      mapListEl.appendChild(buildMapRow(map));
    }
  }

  const archived = sortByUpdatedDesc(allMaps.filter((d) => d.archived));
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
      for (const map of archived) {
        archivedListEl.appendChild(buildMapRow(map));
      }
    }
  }
}

async function reload(): Promise<void> {
  try {
    allMaps = await fetchMaps();
  } catch (err) {
    setStatus(`Could not load maps: ${(err as Error).message}`);
    allMaps = [];
  }
  render();
}

interface MenuItem {
  label: string;
  danger?: boolean;
  onSelect: () => Promise<void> | void;
}

function openMenu(map: MapSummary, anchor: HTMLElement): void {
  const items: MenuItem[] = [
    {
      label: "rename",
      onSelect: async () => {
        const next = window.prompt("New label", map.label);
        if (next === null) return;
        const trimmed = next.trim();
        if (trimmed.length === 0 || trimmed === map.label) return;
        try {
          await renameMap(map.id, trimmed);
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
          const newId = await duplicateMap(map.id);
          await reload();
          setStatus(`Duplicated as ${newId}`);
        } catch (err) {
          setStatus(`Duplicate failed: ${(err as Error).message}`);
        }
      },
    },
  ];

  if (map.source?.kind === "obsidian") {
    items.push({
      label: "unbind from vault",
      onSelect: async () => {
        if (!window.confirm(`Unbind "${map.label}" from vault ${map.source!.path}?`)) return;
        try {
          await unbindVault(map.id);
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
          await bindVault(map.id, p.trim());
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
        await archiveMap(map.id);
        await reload();
        setStatus(`Archived: ${map.label}`);
      } catch (err) {
        setStatus(`Archive failed: ${(err as Error).message}`);
      }
    },
  });

  items.push({
    label: "delete",
    danger: true,
    onSelect: async () => {
      if (!window.confirm(`Delete "${map.label}"? It will be archived first if necessary.`)) return;
      try {
        try {
          await archiveMap(map.id);
        } catch {
        }
        await deleteMap(map.id);
        await reload();
        setStatus(`Deleted: ${map.label}`);
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
      navigateToMap(id);
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
      navigateToMap(id);
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
      navigateToMap(id);
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
