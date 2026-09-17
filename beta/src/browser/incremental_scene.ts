/** Retain SVG fragments in canonical layer/order without reparsing unchanged nodes. */
export class RetainedSvgScene {
  private parts = new Map<string, { element: SVGGElement; markup: string }>();
  update(root: SVGSVGElement, parts: Array<[string, string]>, reset = false): number {
    if (reset) { root.replaceChildren(); this.parts.clear(); }
    const live = new Set(parts.map(([key]) => key));
    this.parts.forEach((part, key) => {
      if (!live.has(key)) { part.element.remove(); this.parts.delete(key); }
    });
    let cursor = root.firstElementChild;
    let replaced = 0;
    for (const [key, markup] of parts) {
      let part = this.parts.get(key);
      if (!part) {
        const element = document.createElementNS("http://www.w3.org/2000/svg", "g");
        element.dataset.renderKey = key;
        part = { element, markup: "\u0000" };
        this.parts.set(key, part);
      }
      if (part.markup !== markup) {
        part.element.innerHTML = markup;
        part.markup = markup;
        replaced++;
      }
      if (cursor !== part.element) root.insertBefore(part.element, cursor);
      cursor = part.element.nextElementSibling;
    }
    return replaced;
  }
  /** Selection can mutate classes outside render(). Do not reuse that markup. */
  invalidate(key: string): void {
    const part = this.parts.get(key);
    if (part) part.markup = "\u0000";
  }
}

/** Per-node derivation cache, owned by one viewer; never a persistent map field. */
export class DerivedNodeCache<T> {
  private values = new Map<string, { key: string; value: T }>();
  computed = 0;
  begin(reset = false): void { this.computed = 0; if (reset) this.values.clear(); }
  get(id: string, key: string, compute: () => T): T {
    const previous = this.values.get(id);
    if (previous?.key === key) return previous.value;
    const value = compute();
    this.values.set(id, { key, value });
    this.computed++;
    return value;
  }
  retain(ids: Set<string>): void {
    this.values.forEach((_value, id) => { if (!ids.has(id)) this.values.delete(id); });
  }
}
