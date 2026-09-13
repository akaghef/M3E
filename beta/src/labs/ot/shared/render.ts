import { OT_NATIVE_FIXTURES } from "../fixtures/ot_native_fixtures";

type OtComponent = "deck" | "network" | "detail" | "edge" | "mail" | "replay" | "runtime";

const fixtureGlobals: Record<string, unknown> = {
  agents: OT_NATIVE_FIXTURES.agents,
  messages: OT_NATIVE_FIXTURES.messages,
  graph: OT_NATIVE_FIXTURES.graph,
  spawnPayload: OT_NATIVE_FIXTURES.spawnPayload,
  gmap: new Map(),
  gedges: [],
  gspawn: [],
  view: "deck",
  netSuspended: false,
  EMBED_MODE: false,
  lastData: OT_NATIVE_FIXTURES.agents,
  historyRange: "live",
  SHOW_DEFAULT: new Set(["agent", "finished"]),
  HISTORY_WIDER: { live: "30d", "7d": "30d", "30d": "all", all: null },
  HISTORY_WIDER_LABEL: { "30d": "SEARCH THE LAST 30 DAYS", all: "SEARCH ALL HISTORY" },
  CATLABEL: { agent: "AGENTS", finished: "FINISHED" },
  INITIAL_ROUTE: { history: "live", networkWindow: "1d" },
  selectedSet: new Set(),
  gEls: { node: new Map(), edge: [], badge: [] },
};

/** Mount the exact upstream markup bytes; this function deliberately does not normalize them. */
export function mountHarness(title: string, markup: string, component: OtComponent): HTMLElement {
  const root = document.querySelector<HTMLElement>("#ot-lab-root");
  if (!root) throw new Error("OT lab root missing");
  root.innerHTML = `<section data-ot-harness data-ot-component="${component}"><h1>${title}</h1><p data-ot-status>Mounting verbatim upstream cut…</p><p data-ot-error hidden></p>${markup}</section>`;
  for (const [name, value] of Object.entries(fixtureGlobals)) {
    (globalThis as Record<string, unknown>)[name] = value;
  }
  return root;
}

/** Execute exact upstream JS as a classic script after markup and fixture boundaries exist. */
export function executeVerbatimCut(logic: string, component: OtComponent, action: string): void {
  const root = document.querySelector<HTMLElement>("#ot-lab-root");
  const status = root?.querySelector<HTMLElement>("[data-ot-status]");
  const error = root?.querySelector<HTMLElement>("[data-ot-error]");
  const report = (caught: unknown, phase = "initialization") => {
    const detail = caught instanceof Error ? `${caught.name}: ${caught.message}` : String(caught);
    if (root) {
      root.dataset.otErrorName = caught instanceof Error ? caught.name : "Error";
      root.dataset.otErrorPhase = phase;
      if (caught instanceof SyntaxError) root.dataset.otSyntaxError = "true";
      root.dataset.otClassification = caught instanceof SyntaxError ? "failed" : "rendered-partial";
      if (phase === "invoked action" && !(caught instanceof SyntaxError)) {
        root.dataset.otActionEffect = "not-observed";
        root.dataset.otActionResult = "dependency-boundary";
        root.dataset.otClassification = "rendered-partial";
      }
    }
    if (status) status.textContent = `Verbatim upstream cut stopped during ${phase}.`;
    if (error) {
      error.hidden = false;
      error.textContent = `Missing upstream global or initialization dependency: ${detail}`;
    }
    console.error(`[OT ${component}] Missing upstream global or initialization dependency: ${detail}`);
  };
  const onWindowError = (event: ErrorEvent) => {
    report(event.error || event.message, "invoked action");
  };
  window.addEventListener("error", onWindowError, { once: true });
  try {
    const script = document.createElement("script");
    script.dataset.otCut = component;
    script.textContent = logic;
    document.head.append(script);
    if (status) status.textContent = "Verbatim upstream cut loaded; invoking upstream action…";
    void invokeOtAction(component, action, root).catch((caught) => report(caught, "invoked action"));
  } catch (caught) {
    window.removeEventListener("error", onWindowError);
    report(caught, "initialization");
  }
}

async function invokeOtAction(component: OtComponent, action: string, root: HTMLElement | null): Promise<void> {
  if (!root) throw new Error("OT lab root missing");
  root.dataset.otActionInvoked = action;
  let result: unknown;
  switch (component) {
    case "deck": result = (globalThis as any).render(); break;
    case "network": result = (globalThis as any).buildEls(); break;
    case "detail": result = (globalThis as any).openPanel("Ada Lovelace"); break;
    case "edge": result = (globalThis as any).openDrawer("Ada Lovelace", "Alan Turing"); break;
    case "mail": result = (globalThis as any).mailDrain(); break;
    case "replay": result = (globalThis as any).startReplay(["Ada Lovelace", "Alan Turing"]); break;
    case "runtime": result = (globalThis as any).openSpawnModal(); break;
  }
  if (result && typeof (result as Promise<unknown>).then === "function") await (result as Promise<unknown>);
  const effects: Record<OtComponent, boolean> = {
    deck: !!root.querySelector("#wrap > *"),
    network: !!root.querySelector("#gsvg > *"),
    detail: root.querySelector("#term")?.classList.contains("on") ?? false,
    edge: root.querySelector("#edrawer")?.classList.contains("on") ?? false,
    mail: !!root.querySelector(".mail-card, .mail-comet"),
    replay: root.querySelector("#replayBar")?.getAttribute("aria-hidden") === "false",
    runtime: root.querySelector("#spawnmd")?.classList.contains("on") ?? false,
  };
  root.dataset.otActionEffect = effects[component] ? "observed" : "not-observed";
  root.dataset.otActionResult = effects[component] ? "state-change-observed" : "dependency-boundary";
  root.dataset.otClassification = effects[component] ? "interactive" : "rendered-partial";
  if (statusFor(root)) statusFor(root)!.textContent = effects[component] ? "Upstream action invoked; DOM/state effect observed." : "Upstream action invoked; dependency boundary observed.";
}

function statusFor(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>("[data-ot-status]");
}
