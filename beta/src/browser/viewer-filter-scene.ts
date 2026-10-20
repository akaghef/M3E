import { axisMatches, edgeMatches, type FilterInput, type FilterLink, type FilterNode, type FilterResult, type FilterSelection } from "../shared/view_filter";
import { VIEW_FILTER_AXES } from "../shared/view_filter_axes";
const primitives = "path,rect,circle,ellipse,line,polygon,polyline,text,image,foreignObject";
/** Reads the authoritative rendered bodies and representative GraphLink endpoints. */
export function filterSceneInput(root: SVGSVGElement, nodes: Record<string, FilterNode>, links: Record<string, FilterLink>): FilterInput {
  const ids = new Set(Array.from(root.querySelectorAll(".node-hit[data-node-id],circle.scatter-node-circle[data-node-id]"), element => element.getAttribute("data-node-id")!));
  const drawn = new Map<string, FilterLink>();
  root.querySelectorAll(".graph-link[data-link-id]").forEach(element => {
    const id = element.getAttribute("data-link-id")!;
    if (links[id]) drawn.set(id, { ...links[id], sourceNodeId: element.getAttribute("data-source-node-id")!, targetNodeId: element.getAttribute("data-target-node-id")! });
  });
  return { nodes: [...ids].flatMap(id => nodes[id] ? [nodes[id]] : []), links: [...drawn.values()] };
}
/** Retained elements keep their unfiltered inline opacity; replacements start fresh. */
export class ViewerFilterScene {
  nodeOpacity(id: string): number { return this.dimmedNodes.has(id) ? 0.18 : 1; }
  private dimmedNodes = new Set<string>();
  private originals = new WeakMap<SVGElement, { value: string; priority: string }>();
  apply(root: SVGSVGElement, result: FilterResult, selection: FilterSelection, nodes: Record<string, FilterNode & { parentId?: string | null }>): void {
    this.dimmedNodes = new Set(result.active ? Object.keys(nodes).filter(id => !result.nodes.has(id)) : []);
    const elements = Array.from(root.querySelectorAll<SVGElement>(primitives)).filter(element =>
      !element.closest("defs,marker,clipPath,mask,.link-port-controls") && !element.matches(".node-hit,.graph-link-hit"));
    // Restore first: computed styles can depend on selection and inherited styles.
    for (const element of elements) {
      const original = this.originals.get(element);
      if (original) {
        if (original.value) element.style.setProperty("opacity", original.value, original.priority);
        else element.style.removeProperty("opacity");
        if (!element.getAttribute("style")) element.removeAttribute("style");
      }
    }
    const edgeByChild = new Map<string, boolean>();
    root.querySelectorAll(".edge[data-source-node-id],.scatter-guide[data-parent-node-id]").forEach(element => {
      const source = element.getAttribute("data-source-node-id") || element.getAttribute("data-parent-node-id")!;
      const target = element.getAttribute("data-target-node-id") || element.getAttribute("data-child-node-id")!;
      edgeByChild.set(target, edgeMatches(result, source, target));
    });
    const paints = elements.map(element => {
      const linkId = element.getAttribute("data-link-id");
      const source = element.getAttribute("data-source-node-id") || element.getAttribute("data-parent-node-id");
      const target = element.getAttribute("data-target-node-id") || element.getAttribute("data-child-node-id");
      const fragment = element.closest<SVGElement>("[data-render-key^='node:']");
      const id = element.getAttribute("data-node-id") || element.closest("[data-agent-node-id]")?.getAttribute("data-agent-node-id") || fragment?.dataset.renderKey?.slice(5);
      let matched = true;
      if (linkId) matched = result.links.has(linkId);
      else if (source && target) matched = edgeMatches(result, source, target);
      else if (id && element.classList.contains("timeline-stem")) matched = edgeMatches(result, nodes[id]?.parentId || "", id);
      else if (id && element.classList.contains("edge-label")) matched = edgeByChild.get(id) ?? true;
      else if (id && element.hasAttribute("data-lane-header")) matched = !!nodes[id] && VIEW_FILTER_AXES.every(axis =>
        !result.axes[axis.id].active || (axis.target === "node" && axisMatches(nodes[id], axis, selection[axis.id])));
      else if (id) matched = result.nodes.has(id);
      return { element, dim: result.active && !matched, opacity: Number(getComputedStyle(element).opacity || 1) };
    });
    for (const { element, dim, opacity } of paints) {
      if (!dim) continue;
      if (!this.originals.has(element)) this.originals.set(element, { value: element.style.getPropertyValue("opacity"), priority: element.style.getPropertyPriority("opacity") });
      // Inline primitive paint changes invalidate existing capture keys/tile paint.
      element.style.setProperty("opacity", String(opacity * 0.18));
    }
  }
}
