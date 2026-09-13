export function mountHarness(title: string, ids: string[] = []): HTMLElement {
  const root = document.querySelector<HTMLElement>("#ot-lab-root");
  if (!root) throw new Error("OT lab root missing");
  root.innerHTML = `<section data-ot-harness><h1>${title}</h1><p data-ot-status>Loaded upstream cut; coupled dashboard globals may be absent.</p>${ids.map((id) => `<div id="${id}"></div>`).join("")}</section>`;
  return root;
}
export function loadVerbatimCut(url: URL): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url.href;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Unable to load upstream cut ${url.pathname}`));
    document.head.append(script);
  });
}
