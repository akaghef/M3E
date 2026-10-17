import type { LayoutResult } from "../shared/layout_port";

export function laneLinkParts(lane: boolean, visible: string, hit: string, front: boolean): Array<[string, string]> {
  if (!lane) return front ? [] : [["links", visible]];
  return front ? [["lane-visible-links", `<g class="lane-visible-links" pointer-events="none">${visible}</g>`]] : [["graph-link-hits", hit]];
}

export function laneFrames(layout: LayoutResult, escape: (text: string) => string): string {
  if (!layout.lane) return "";
  return layout.lane.boundaries.map(b =>
    `<rect class="surface-scope-box lane-boundary" data-lane-node-id="${escape(b.id)}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="12" pointer-events="none" />` +
    `<text class="surface-scope-title lane-title" x="${b.x + 12}" y="${b.y + 24}" font-size="${b.fontSize ?? 14}" pointer-events="none">${(b.labelLines ?? [b.label]).map((line, i) => `<tspan x="${b.x + 12}" dy="${i ? (b.fontSize ?? 14) * 1.35 : 0}">${escape(line)}</tspan>`).join("")}</text>`,
  ).join("") + `<text class="surface-scope-title lane-summary" x="12" y="${layout.totalHeight - 4}" pointer-events="none">表示しない GraphLink: ${layout.lane.omittedLinkCount}</text>`;
}
