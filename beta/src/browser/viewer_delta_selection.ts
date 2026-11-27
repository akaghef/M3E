import { refKey, type Presented, type Ref, type Point } from '../shared/edge_graphlink_selection';

/** Index the renderer's accepted records once. A transition resolves only its
 * requested identities; CSS coordinates are derived only for those records. */
export class SelectionRecords {
  private refs = new Map<string, Presented>();
  private links = new Map<string, Presented>();
  private incident = new Map<string, Map<string, Presented>>();
  reset(records: readonly Presented[]): void {
    this.refs.clear(); this.links.clear(); this.incident.clear();
    for (const item of records) this.add(item);
  }
  add(item: Presented, previous?: Presented): void {
    if (previous) {
      const oldKey = refKey(previous.ref); this.refs.delete(oldKey);
      for (const id of [previous.source.renderedNodeId, previous.target.renderedNodeId]) this.incident.get(id)?.delete(oldKey);
    }
    const key = refKey(item.ref); this.refs.set(key, item);
    if (item.ref.kind === 'graph-link') for (const id of item.ref.linkIds) this.links.set(id, item);
    for (const id of new Set([item.source.renderedNodeId, item.target.renderedNodeId])) {
      const list = this.incident.get(id) ?? new Map<string, Presented>();
      list.set(key, item); this.incident.set(id, list);
    }
  }
  presented(ref: Ref): Presented | undefined { return this.refs.get(refKey(ref)); }
  link(id: string): Presented | undefined { return this.links.get(id); }
  at(id: string): readonly Presented[] { return [...(this.incident.get(id)?.values() ?? [])]; }
}

/** Geometry is lazy as well: checking an identity or highlighting endpoints
 * must not ask the browser to flush layout. */
export function screenPresentation(item: Presented, point: (p: Point) => Point): Presented {
  return {
    ref: item.ref,
    get source() { return { ...item.source, get center() { return point(item.source.center); } }; },
    get target() { return { ...item.target, get center() { return point(item.target.center); } }; },
    get presentation() { return { ...item.presentation, get labelAnchor() { return point(item.presentation.labelAnchor); } }; },
  };
}

/** Avoid native focus's style/layout synchronization when focus is already here. */
export function focusBoard(board: HTMLElement): void {
  if (board.ownerDocument.activeElement !== board) board.focus({ preventScroll: true });
}

const modalOwners = new WeakMap<Document, () => boolean>();
/** Modal ownership changes independently of the map. Observe its mutations,
 * including same-task changes, instead of scanning all SVG elements per key. */
export function modalInputOwner(document: Document): () => boolean {
  const existing = modalOwners.get(document); if (existing) return existing;
  const selector = '.wb-progressive-nav.is-open, [role="dialog"][aria-modal="true"]';
  const active = new Set<Element>(document.querySelectorAll(selector));
  const update = (element: Element) => {
    if (element.isConnected && element.matches(selector)) active.add(element); else active.delete(element);
  };
  const apply = (records: MutationRecord[]) => {
    for (const record of records) {
      if (record.type === 'attributes') update(record.target as Element);
      else {
        for (const node of record.addedNodes) if (node instanceof Element && node.isConnected) {
          update(node); for (const element of node.querySelectorAll(selector)) active.add(element);
        }
        if (record.removedNodes.length) for (const element of active) if (!element.isConnected) active.delete(element);
      }
    }
  };
  const observer = new MutationObserver(apply);
  observer.observe(document, {subtree:true, childList:true, attributes:true, attributeFilter:['class','role','aria-modal']});
  const owns = () => { apply(observer.takeRecords()); return active.size > 0; };
  modalOwners.set(document, owns); return owns;
}
