interface LocalSyncStatus {
  mode: "local";
  remote: { state: "ok" | "unreachable" | "refused" };
  unsent: number;
  conflicts: number;
}

const connectionText = { ok: "Online", unreachable: "Remote unreachable", refused: "Sync refused" };
// One line on the header: connection state, then the unsent and conflict counts (sync-requirements R1.1).

export async function addLocalSyncToolbar(toolbar: HTMLElement, prepare: () => Promise<boolean>): Promise<void> {
  const statusUrl = "/api/sync/local/status";
  async function readStatus(): Promise<LocalSyncStatus | null> {
    const response = await fetch(statusUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("Sync status unavailable");
    const status = await response.json() as LocalSyncStatus | { mode: "remote" };
    return status.mode === "local" ? status : null;
  }

  const initial = await readStatus().catch(() => null);
  if (!initial) return;

  const group = document.createElement("span");
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Workspace sync");
  const state = document.createElement("span");
  state.setAttribute("aria-live", "polite");
  const push = document.createElement("button");
  const pull = document.createElement("button");
  push.type = pull.type = "button";
  push.textContent = "Push";
  pull.textContent = "Pull";
  group.className = "wb-local-sync";
  state.className = "wb-status-chip";
  push.className = pull.className = "wb-pill";
  group.append(state, push, pull);
  // The workbench header has a slot for it (as for the NETWORK control); the legacy toolbar otherwise.
  const mount = (): void => { (document.getElementById("local-sync-control-slot") ?? toolbar).append(group); };
  window.addEventListener("m3e:orrery-control-slot-ready", mount);
  mount();

  let busy = false;
  let refreshing = false;
  let latest = initial;
  const render = (message = "") => {
    state.textContent = `${connectionText[latest.remote.state]} · ${latest.unsent} unsent · ${latest.conflicts} conflicts${message}`;
  };
  const refresh = async (message = "") => {
    if (refreshing) return;
    refreshing = true;
    try {
      latest = await readStatus() ?? latest;
      render(message);
    } catch {
      render(" · Status unavailable");
    } finally {
      refreshing = false;
    }
  };
  const run = async (action: "push" | "pull") => {
    if (busy) return;
    busy = push.disabled = pull.disabled = true;
    let message = "";
    try {
      if (!await prepare()) {
        message = " · Save pending edits first";
        return;
      }
      const res = await fetch(`/api/sync/local/${action}`, { method: "POST" });
      if (!res.ok) message = " · Sync failed";
    } catch {
      message = " · Sync failed";
    } finally {
      busy = push.disabled = pull.disabled = false;
      await refresh(message);
    }
  };
  push.addEventListener("click", () => void run("push"));
  pull.addEventListener("click", () => void run("pull"));
  render();
  const timer = window.setInterval(() => {
    if (!busy && !document.hidden) void refresh();
  }, 3000);
  window.addEventListener("pagehide", () => window.clearInterval(timer), { once: true });
}
