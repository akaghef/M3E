import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { JSDOM, VirtualConsole } from "jsdom";
import { OT_NATIVE_FIXTURES } from "../../src/labs/ot/fixtures/ot_native_fixtures";
import { installOtSafeFetch } from "../../src/labs/ot/shared/safe_fetch";

const root = resolve(import.meta.dirname, "../..");
const otRoot = resolve(root, "src/labs/ot");
const read = (path: string) => readFileSync(resolve(otRoot, path), "utf8");

/** DOM execution only: layout/media/animation APIs are explicitly stubbed, not measured. */
async function mount(component: string) {
  const errors: string[] = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e: Error) => errors.push(e.message));
  const dom = new JSDOM(`<body data-view="deck">${read(`cut/${component}/markup.html`)}</body>`, {
    url: `http://ot-lab.invalid/${component}`, runScripts: "outside-only", virtualConsole: vc,
  });
  const w = dom.window;
  const restore = installOtSafeFetch();
  const safeFetch = globalThis.fetch;
  restore();
  Object.assign(w, {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/api/jserr')) errors.push(String(init?.body));
      return safeFetch(input, init);
    },
    OT_NATIVE_FIXTURES: structuredClone(OT_NATIVE_FIXTURES),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}, scrollTo() {},
    CSS: { escape: (s: string) => s.replaceAll('"', '\\"') },
    AGENTSTACK_DEMO: { portraitURL: () => 'data:image/png;base64,', assetURL: () => 'data:image/svg+xml,' },
  });
  w.addEventListener('error', (e: ErrorEvent) => errors.push(e.message));
  w.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => errors.push(String(e.reason)));
  try {
    w.eval(read(`cut/${component}/logic.js`));
    await new Promise(resolve => setTimeout(resolve, 0));
    return { w, errors, close: async () => { await new Promise(resolve => setTimeout(resolve, 0)); w.close(); } };
  } catch (error) { w.close(); throw error; }
}

describe("OT responsibility seams", () => {
  test("surface overview executes its closure: cards, history, graph, tuning/reset and selection", async () => {
    const { w, errors, close } = await mount('surface-overview');
    try {
      const doc = w.document;
      expect(doc.querySelectorAll('#wrap .bay').length).toBe(2);
      expect(doc.querySelector('#wrap')!.textContent).toContain('Ada Lovelace');
      doc.querySelector<HTMLButtonElement>('#history [data-history="all"]')!.click();
      await vi.waitFor(() => expect(doc.querySelectorAll('#wrap .bay').length).toBe(3));
      expect(doc.querySelector('#history [data-history="all"]')!.getAttribute('aria-checked')).toBe('true');
      w.eval("setView('net')");
      await vi.waitFor(() => expect(doc.querySelectorAll('#gsvg .node').length).toBe(3));
      expect(doc.querySelector('#netinfo')!.textContent).toContain('3 nodes · 1 links · 1 spawn');
      w.eval('step();paint()');
      expect(doc.querySelector('#gsvg .node')!.getAttribute('transform')).toMatch(/^translate\(-?\d+\.\d -?\d+\.\d\)$/);
      const slider = doc.querySelector<HTMLInputElement>('.nc-row[data-p="NSIZE"] input')!;
      slider.value = '25'; slider.dispatchEvent(new w.Event('input'));
      expect(JSON.parse(w.localStorage.getItem('agentdash.netparams')!).NSIZE).toBe(25);
      doc.querySelector<HTMLButtonElement>('#nc-reset')!.click();
      expect(slider.value).toBe('13');
      expect(JSON.parse(w.localStorage.getItem('agentdash.netparams')!).NSIZE).toBe(13);
      doc.querySelector<HTMLButtonElement>('#selToggle')!.click();
      w.eval("toggleSel('Ada Lovelace')");
      expect(doc.querySelectorAll('#gsvg .selnode').length).toBe(1);
      expect(doc.querySelector('#selbarNum')!.textContent).toBe('1');
      doc.querySelector<HTMLButtonElement>('#winall')!.click();
      await vi.waitFor(() => expect(doc.querySelectorAll('#gsvg .node').length).toBe(3));
      expect(doc.querySelector('#winlabel')!.textContent).toBe('ALL');
      w.eval("setView('deck')");
      expect(doc.querySelectorAll('#gsvg .selnode').length).toBe(0);
      expect(errors).toEqual([]);
    } finally { await close(); }
  });

  test("agent detail executes alone: identity, summary, sparkline, tabs, blocked writes and reopen", async () => {
    const { w, errors, close } = await mount('agent-detail');
    try {
      const doc = w.document;
      expect(doc.querySelector('#wrap')).toBeNull();
      expect(doc.querySelector('#gsvg')).toBeNull();
      expect(doc.querySelector('#term')!.classList.contains('on')).toBe(true);
      expect(doc.querySelector('#tm-nm')!.textContent).toBe('Ada Lovelace');
      expect(doc.querySelector('#tm-meta')!.textContent).toContain('fixture-model');
      expect(doc.querySelector('#tm-summary')!.textContent).toContain('Trace the signal path');
      expect(doc.querySelector('#tm-summary')!.textContent).toContain('28% used');
      expect(doc.querySelectorAll('#sp-svg .ev').length).toBe(3);
      expect(doc.querySelectorAll('#tm-hist .msg').length).toBe(2);
      doc.querySelector<HTMLButtonElement>('#tm-tabs [data-tab="deliv"]')!.click();
      await vi.waitFor(() => expect(doc.querySelector('#tm-deliv')!.textContent).toContain('Signal trace report'));
      doc.querySelector<HTMLButtonElement>('.an-chip[data-r="reviewer"]')!.click();
      expect(doc.querySelector<HTMLInputElement>('#an-role')!.value).toBe('reviewer');
      doc.querySelector<HTMLButtonElement>('#an-set')!.click();
      await vi.waitFor(() => expect(doc.querySelector('.an-cur')!.textContent).toBe('FAILED'));
      doc.querySelector<HTMLButtonElement>('#tm-open')!.click();
      await vi.waitFor(() => expect(doc.querySelector('#toast')!.textContent).toContain('OT fixture refuses live writes'));
      doc.querySelector<HTMLButtonElement>('#tm-x')!.click();
      expect(doc.querySelector('#term')!.getAttribute('aria-hidden')).toBe('true');
      doc.querySelector<HTMLButtonElement>('#ot-open-detail')!.click();
      expect(doc.querySelector('#tm-nm')!.textContent).toBe('Ada Lovelace');
      expect(doc.querySelector('#term')!.getAttribute('aria-hidden')).toBe('false');
      expect(errors).toEqual([]);
    } finally { await close(); }
  });
});

describe("OT boundaries and provenance", () => {
  const components = ['surface-overview', 'agent-detail'];
  const manifest = JSON.parse(read('provenance.json'));

  test("only working responsibility routes are listed and built; harness contains no OT algorithms", () => {
    expect(Object.keys(manifest.labs)).toEqual(components);
    const hub = readFileSync(resolve(root, 'src/labs/index.html'), 'utf8');
    const config = readFileSync(resolve(root, 'vite.config.mjs'), 'utf8');
    expect((hub.match(/src\/labs\/ot\/routes\//g) || []).length).toBe(2);
    for (const name of components) {
      const route = `/src/labs/ot/routes/${name}.html`;
      expect(manifest.labs[name].route).toBe(route);
      expect(hub).toContain(route);
      expect(config).toContain(route.slice(1));
      expect(read(`routes/${name}.html`)).toContain(`entries/${name}.ts`);
      expect(read(`routes/${name}.html`)).not.toMatch(/iframe/i);
      expect(read(`routes/${name}.html`)).toContain('<body id="ot-lab-root"');
      expect(read(`entries/${name}.ts`)).toContain('mountHarness');
      expect(() => execFileSync(process.execPath, ['--check', resolve(otRoot, `cut/${name}/logic.js`)], { stdio: 'pipe' })).not.toThrow();
    }
    expect(read('shared/render.ts')).not.toMatch(/gmap|buildEls|openPanel|render\(|setInterval|simulation|dependency-boundary|rendered-partial/);
  });

  test("fixture GETs work offline; Request methods and all writes are blocked without forwarding", async () => {
    const original = globalThis.fetch;
    const live = vi.fn(() => { throw new Error('must never reach a live backend'); });
    globalThis.fetch = live;
    const restore = installOtSafeFetch();
    try {
      const agents = await (await fetch('/api/agents?days=all')).json();
      expect(agents.agents).toEqual(OT_NATIVE_FIXTURES.agents);
      const graph = await (await fetch('/api/graph?all=1')).json();
      expect(graph.nodes[0]).toMatchObject({ name: 'Ada Lovelace', act_state: 'work' });
      expect(graph.edges[0]).toMatchObject({ source: 'Ada Lovelace', target: 'Alan Turing' });
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        const response = await fetch(new Request('http://ot-lab.invalid/api/spawn', { method }));
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ code: 'OT_LAB_WRITE_ATTEMPT' });
      }
      expect((await fetch('/api/spawn', { method: 'POST' })).status).toBe(403);
      expect((await fetch(new Request('http://ot-lab.invalid/api/spawn'), { method: 'DELETE' })).status).toBe(403);
      expect(await (await fetch('/api/agents', { method: 'HEAD' })).text()).toBe('');
      expect((await fetch('https://example.invalid/unmocked')).status).toBe(404);
      expect(live).not.toHaveBeenCalled();
    } finally { restore(); globalThis.fetch = original; }
  });

  test("pinned source regions and declared adaptations validate; altered upstream logic is rejected", async () => {
    const { validateOtProvenance } = await import('../../scripts/ot_provenance_lib.mjs');
    expect(manifest.source_commit).toBe('22ffe6483530e643c8fc1af486319990e0181de4');
    expect(manifest.license.required_notice).toBe('Copyright (c) 2026 gyroid');
    expect(read('upstream/LICENSE')).toContain(manifest.license.required_notice);
    const checked = validateOtProvenance(root, '/tmp/orrery-telemetry-inspect');
    expect(checked.errors).toEqual([]);
    expect(checked.ok).toBe(true);
    const temp = mkdtempSync(resolve(tmpdir(), 'ot-seam-provenance-'));
    try {
      cpSync(otRoot, resolve(temp, 'src/labs/ot'), { recursive: true });
      const path = resolve(temp, 'src/labs/ot/cut/surface-overview/logic.js');
      writeFileSync(path, readFileSync(path, 'utf8').replace('function buildEls(){', 'function brokenBuildEls(){'));
      const checked = validateOtProvenance(temp, '/tmp/orrery-telemetry-inspect');
      expect(checked.ok).toBe(false);
      expect(checked.errors.join('\n')).toContain('missing verbatim source region');
    } finally { rmSync(temp, { recursive: true, force: true }); }
  });
});
