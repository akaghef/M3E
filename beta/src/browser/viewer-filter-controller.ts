import { defaultFilterSelection, evaluateViewFilter, type FilterInput, type FilterSelection } from "../shared/view_filter";
import type { FilterValue } from "../shared/view_filter_axes";
/** One controller per viewer session; no persistence or layout dependency. */
export class ViewerFilterController {
  private mapId = "";
  private input: FilterInput = { nodes: [], links: [] };
  private listeners = new Set<() => void>();
  private selection: FilterSelection = defaultFilterSelection();
  private open: string | null = null;
  private snapshot = this.compute();
  private compute() { return { mapId: this.mapId, selection: this.selection, open: this.open, result: evaluateViewFilter(this.input, this.selection) }; }
  private publish() { this.snapshot = this.compute(); this.listeners.forEach(listener => listener()); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  enterMap(mapId: string) {
    if (mapId === this.mapId) return;
    this.mapId = mapId; this.selection = defaultFilterSelection(); this.open = null;
    this.input = { nodes: [], links: [] }; this.publish();
  }
  setScene(mapId: string, input: FilterInput): boolean {
    if (mapId !== this.mapId) return false;
    this.input = input;
    if (this.open && !evaluateViewFilter(input, this.selection).axes[this.open]?.enabled) this.open = null;
    this.publish(); return true;
  }
  select(axis: string, value: FilterValue) {
    this.selection = { ...this.selection, [axis]: Array.isArray(value) ? [...value] : value }; this.publish();
  }
  openMenu(axis: string | null) { this.open = axis; this.publish(); }
  clear() { this.selection = defaultFilterSelection(); this.open = null; this.publish(); }
}
export const viewerFilter = new ViewerFilterController();
