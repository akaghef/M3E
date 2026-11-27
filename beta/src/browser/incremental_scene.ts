import morphdom from 'morphdom';
import { SvgViewport, type SvgBox } from '../rendering/svg_viewport';

function patchSvg(element: SVGGElement, markup: string): void {
  if (!element.firstChild) { element.innerHTML = markup; return; }
  const next = element.cloneNode(false) as SVGGElement; next.innerHTML = markup;
  morphdom(element, next, {childrenOnly: true, getNodeKey: node => {
    if (node.nodeType !== 1) return undefined;
    const el = node as Element, id = el.getAttribute('data-node-id');
    return el.id || (id && el.matches('.node-hit') ? `hit:${id}` : undefined);
  }});
}

/** Retain SVG fragments in canonical layer/order without reparsing unchanged nodes. */
export class RetainedSvgScene<T = unknown> {
  private parts = new Map<string, { element: SVGGElement; markup: string; source?: string; box?: T | null; order:number }>();
  private viewport: SvgViewport | null = null;
  private viewportSuspended = 0;
  private viewportBox?: SvgBox;
  materialize(): void { this.viewport?.materialize(); }
  refreshViewport(box?: SvgBox): void {
    if (box) this.viewportBox = box;
    if (!this.viewportSuspended) this.viewport?.refresh(this.viewportBox);
  }
  suspendViewport(): () => void {
    this.materialize(); this.viewportSuspended++;
    return () => { this.viewportSuspended--; this.refreshViewport(); };
  }
  virtualize(root: SVGSVGElement, box: SvgBox, bounds: (key:string)=>SvgBox|null|undefined): void {
    this.viewport = new SvgViewport(root, this.parts, bounds); this.refreshViewport(box);
  }
  update(root: SVGSVGElement, parts: Array<[string, string]>, reset = false): number {
    this.materialize(); this.viewport = null;
    if (reset) for (const part of this.parts.values()) part.markup = "\u0000";
    const live = new Set(parts.map(([key]) => key));
    this.parts.forEach((part, key) => {
      if (!live.has(key)) { part.element.remove(); this.parts.delete(key); }
    });
    let cursor = root.firstElementChild;
    let replaced = 0;
    let order = 0;
    for (const [key, markup] of parts) {
      let part = this.parts.get(key);
      if (!part) {
        const element = document.createElementNS("http://www.w3.org/2000/svg", "g");
        element.dataset.renderKey = key;
        part = { element, markup: "\u0000", order:0 };
        this.parts.set(key, part);
      }
      part.order = order++;
      if (part.markup !== markup) {
        patchSvg(part.element, markup);
        part.markup = markup;
        part.source = markup;
        part.box = undefined;
        replaced++;
      }
      if (cursor !== part.element) root.insertBefore(part.element, cursor);
      cursor = part.element.nextElementSibling;
    }
    return replaced;
  }
  element(key: string): SVGGElement | undefined { return this.parts.get(key)?.element; }
  /** Reorder a known contiguous interval without visiting its other siblings. */
  reorder(before: string[], after: string[]): void {
    if(!before.length)return;
    const ranks=before.map(key=>this.parts.get(key)!.order).sort((a,b)=>a-b);
    after.forEach((key,index)=>{this.parts.get(key)!.order=ranks[index]!;});
    if(this.viewport){this.refreshViewport();return;}
    const last=this.parts.get(before[before.length-1]!)!.element, parent=last.parentNode!, next=last.nextSibling;
    const fragment=document.createDocumentFragment();
    for(const key of after)fragment.append(this.parts.get(key)!.element);
    parent.insertBefore(fragment,next);
  }
  /** Selection can mutate classes outside render(). Do not reuse that markup. */
  invalidate(key: string): void {
    const part = this.parts.get(key);
    if (part) part.markup = "\u0000";
  }
  /** Update an existing fragment without visiting or reordering its siblings. */
  patch(key: string, markup: string): boolean {
    const part = this.parts.get(key);
    if (!part) return false;
    if (part.markup !== markup) {
      patchSvg(part.element, markup);
      part.markup = markup;
      part.source = markup;
      part.box = undefined;
    }
    this.viewport?.changed(key);
    return true;
  }
  /**
   * A value derived from a fragment's markup (its bounding box), computed once per markup.
   * `undefined` when there is no such fragment; whatever `derive` answered otherwise.
   */
  derived(key: string, derive: (markup: string) => T | null): T | null | undefined {
    const part = this.parts.get(key);
    if (!part || part.source === undefined) return undefined;
    if (part.box === undefined) part.box = derive(part.source);
    return part.box;
  }
  /** Keys of the retained fragments, in no particular order. */
  keys(): IterableIterator<string> { return this.parts.keys(); }
  *elements(): IterableIterator<SVGGElement> { for (const part of this.parts.values()) yield part.element; }
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

/** Bounded viewer-local cache: visiting another scope must not flush this scope. */
export class ScopeDerivedCache<T> {
  private entries = new Map<string, T>();
  constructor(private create: () => T, private capacity = 32) {}
  get(key: string): T {
    const value = this.entries.get(key) ?? this.create();
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value!);
    return value;
  }
}
