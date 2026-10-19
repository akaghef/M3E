import type { NodeDrawInput } from "../shared/node_draw_port";
import type { LayoutResult } from "../shared/layout_port";

export function laneLinkParts(lane: boolean, visible: string, hit: string, front: boolean): Array<[string, string]> {
  if (!lane) return front ? [] : [["links", visible]];
  return front ? [["lane-visible-links", `<g class="lane-visible-links" pointer-events="none">${visible}</g>`]] : [["graph-link-hits", hit]];
}

export function laneFrames(layout: LayoutResult, escape: (text: string) => string): string {
  if (!layout.lane) return "";
  const down = layout.lane.direction === "down";
  return `<text class="lane-heading" x="64" y="82" pointer-events="none">${escape(layout.lane.rootLabel ?? "名称未設定")}</text>` +
    layout.lane.boundaries.map((b, index) => {
      const x = b.x + 16, y = b.y + 36;
      return `<rect class="surface-scope-box lane-boundary${index % 2 ? " lane-alternate" : ""}" data-lane-node-id="${escape(b.id)}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${down && (index === 0 || index === layout.lane!.boundaries.length - 1) ? 6 : 0}" pointer-events="none" />` +
        `<text class="lane-title" x="${x}" y="${y}" pointer-events="none">${escape(b.label)}</text>` +
        `<text class="lane-count" x="${down ? x : x + b.label.length * 18 + 12}" y="${down ? y + 28 : y}" pointer-events="none">${b.count} 個</text>`;
    }).join("") + `<text class="surface-scope-title lane-summary" x="64" y="${layout.totalHeight - 24}" pointer-events="none">表示しない GraphLink: ${layout.lane.omittedLinkCount}</text>`;
}

/** Supply existing node renderer inputs; no Lane shape or label drawing. */
export function laneNodeInput(input: NodeDrawInput, lane: boolean): NodeDrawInput {
  if (!lane) return input;
  const active = input.view.selected || input.view.multiSelected || input.view.linkSource || input.view.dragSource || input.view.dropTarget || input.view.reparentSource;
  return { ...input,
    style: { ...input.style, fill: input.style.fill ?? (active ? undefined : "#ffffff"), shape: input.style.shape ?? "rounded" },
    surface: { ...input.surface, structuredMode: "Lane" },
    content: input.content.kind === "plainLabel" ? { ...input.content, textAnchor: "middle" } : input.content,
  };
}
