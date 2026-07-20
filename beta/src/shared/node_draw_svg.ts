import {
  nodeDrawConfidenceColor,
  type NodeDrawInput,
  type NodeDrawOutput,
  type NodeDrawStatus,
  type NodeDrawStyle,
} from "./node_draw_port";

const NODE_HIT_HEIGHT = 34;
const ROOT_INDICATOR_PAD = 28;
const NODE_INDICATOR_PAD = 18;
const NODE_RIGHT_PAD = 180;
const NODE_BOTTOM_PAD = 96;

const STATUS_COLORS: Record<NodeDrawStatus, string> = {
  placeholder: "#999",
  confirmed: "#2d8c4e",
  contested: "#d94040",
  frozen: "#4a7fb5",
  active: "#e89b1a",
  review: "#9b59b6",
};

export function renderNode(input: NodeDrawInput): NodeDrawOutput {
  const svg = input.surface.view === "Disperse" ? renderScatterNode(input) : renderStructuredNode(input);
  return {
    svg,
    bounds: {
      x: input.position.x,
      y: input.position.y - input.position.h / 2,
      w: input.position.w,
      h: input.position.h,
      maxX: input.position.x + input.position.w + NODE_RIGHT_PAD,
      maxY: input.position.y + input.position.h + NODE_BOTTOM_PAD,
    },
  };
}

function renderStructuredNode(input: NodeDrawInput): string {
  const p = input.position;
  const treatAsRoot = input.node.isRoot && !input.surface.rootless;
  const hitH = Math.max(NODE_HIT_HEIGHT, p.h);
  const hitX = treatAsRoot ? p.x : p.x - 8;
  const hitY = p.y - hitH / 2;
  const hitW = treatAsRoot ? p.w : p.w + 36;
  const hitRx = shapeRx(input.style, treatAsRoot);
  const classNames = nodeStateClasses(input, ["node-hit"]);
  const parts: string[] = [
    `<rect class="${classNames.join(" ")}" data-node-id="${escapeAttr(input.node.id)}" x="${fmt(hitX)}" y="${fmt(hitY)}" width="${fmt(hitW)}" height="${fmt(hitH)}" rx="${fmt(hitRx)}" />`,
  ];
  if (treatAsRoot) {
    parts.push(renderRootNode(input));
  } else {
    parts.push(renderNonRootNode(input));
  }
  if (input.view.collapsedCount !== undefined && input.view.collapsedCount > 0) {
    parts.push(renderCollapsedBadge(input, treatAsRoot));
  }
  return parts.join("");
}

function renderRootNode(input: NodeDrawInput): string {
  const p = input.position;
  const h = p.h;
  const y = p.y - h / 2;
  const rx = input.surface.structuredMode === "Tree" ? shapeRx(input.style, true) : Math.min(28, h / 2);
  const visualClasses = nodeStateClasses(input, ["root-box", "node-visual-box"]);
  const inline = visualStyle(input.style);
  const label = plainLabel(input);
  const font = label.fontSize ?? p.fontSize ?? 16;
  const lineHeight = lineHeightForFont(font);
  const startY = multilineTextStartY(p.y, label.labelLines.length, font, lineHeight);
  const labelStyle = labelStyleAttr(input.style, font);
  return [
    `<rect class="${visualClasses.join(" ")}" data-node-id="${escapeAttr(input.node.id)}" x="${fmt(p.x)}" y="${fmt(y)}" width="${fmt(p.w)}" height="${fmt(h)}" rx="${fmt(rx)}"${inline} />`,
    `<text class="label-root" data-node-id="${escapeAttr(input.node.id)}" x="${fmt(p.x + p.w / 2)}" y="${fmt(startY)}" text-anchor="middle" style="${labelStyle}">${multilineTspans(label.labelLines, p.x + p.w / 2, lineHeight)}</text>`,
  ].join("");
}

function renderNonRootNode(input: NodeDrawInput): string {
  const p = input.position;
  const parts: string[] = [];
  const visualClasses = nodeStateClasses(input, ["node-visual-box"]);
  const labelClasses = nodeStateClasses(input, ["label-node"], {
    aliasLabel: true,
    status: true,
  });
  if (input.style.shape === "diamond" || input.style.fill || input.style.border || input.style.borderWidth !== undefined || visualClasses.length > 1) {
    parts.push(renderNodeShape(input, visualClasses));
  }
  if (input.node.isFolder) {
    parts.push(renderFolderFrame(input, visualClasses));
  }
  if (input.content.kind === "latexHtml") {
    const y = p.y - p.h / 2;
    parts.push(`<foreignObject data-node-id="${escapeAttr(input.node.id)}" x="${fmt(p.x)}" y="${fmt(y)}" width="${fmt(p.w)}" height="${fmt(p.h)}"><div xmlns="http://www.w3.org/1999/xhtml" class="latex-node-content">${input.content.html}</div></foreignObject>`);
  } else {
    const font = input.content.fontSize ?? p.fontSize ?? 14;
    const lineHeight = lineHeightForFont(font);
    const startY = multilineTextStartY(p.y, input.content.labelLines.length, font, lineHeight);
    const textAnchor = input.content.textAnchor ?? (input.surface.structuredMode === "Tree" ? "start" : "middle");
    const x = textAnchor === "middle" ? p.x + p.w / 2 : input.node.isScopePortal ? p.x + 12 : p.x;
    parts.push(`<text class="${labelClasses.join(" ")}" data-node-id="${escapeAttr(input.node.id)}" x="${fmt(x)}" y="${fmt(startY)}" text-anchor="${textAnchor}" style="${labelStyleAttr(input.style, font)}">${multilineTspans(input.content.labelLines, x, lineHeight)}</text>`);
  }
  parts.push(renderBadges(input));
  return parts.join("");
}

function renderScatterNode(input: NodeDrawInput): string {
  const p = input.position;
  const r = Math.max(8, Math.min(p.w, p.h) / 2);
  const cx = p.x + r;
  const cy = p.y;
  const circleClasses = nodeStateClasses(input, ["node-hit", "scatter-node-circle"]);
  circleClasses.push(input.node.isRoot ? "scatter-root" : input.node.isScatterGroup ? "scatter-group" : "scatter-branch");
  if (input.node.scatterRole) circleClasses.push(`scatter-role-${input.node.scatterRole}`);
  const inline = circleStyle(input.style);
  const label = plainLabel(input);
  const labelText = label.labelLines.join(" ");
  const font = label.fontSize ?? p.fontSize ?? scatterFontSizeFor(r);
  return [
    `<circle class="${circleClasses.join(" ")}" data-node-id="${escapeAttr(input.node.id)}" cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}"${inline} />`,
    `<text class="${input.node.isRoot ? "label-root" : "label-node"} scatter-label" data-node-id="${escapeAttr(input.node.id)}" x="${fmt(cx + r + 7)}" y="${fmt(cy)}" text-anchor="start" dominant-baseline="middle" style="${labelStyleAttr(input.style, font)}">${escapeXml(labelText)}</text>`,
  ].join("");
}

function renderNodeShape(input: NodeDrawInput, classes: string[]): string {
  const p = input.position;
  const hitH = Math.max(NODE_HIT_HEIGHT, p.h);
  const shapePadX = input.surface.structuredMode === "Tree" ? 14 : 0;
  const shapePadY = input.surface.structuredMode === "Tree" ? 6 : 0;
  const x = p.x - shapePadX;
  const y = p.y - hitH / 2 + shapePadY;
  const w = p.w + shapePadX * 2;
  const h = hitH - shapePadY * 2;
  const inline = visualStyle(input.style);
  if (input.style.shape === "diamond") {
    return `<path class="node-shape ${classes.join(" ")}" data-node-id="${escapeAttr(input.node.id)}" d="${diamondPath(p.x + p.w / 2, p.y, w, h)}"${inline} />`;
  }
  return `<path class="node-shape ${classes.join(" ")}" data-node-id="${escapeAttr(input.node.id)}" d="${rectPath(x, y, w, h, shapeRx(input.style, false))}"${inline} />`;
}

function renderFolderFrame(input: NodeDrawInput, classes: string[]): string {
  const p = input.position;
  const frameInsetY = input.surface.structuredMode === "Tree" ? 12 : 0;
  const framePadX = input.surface.structuredMode === "Tree" ? 14 : 0;
  const frameH = Math.max(NODE_HIT_HEIGHT, p.h) - frameInsetY;
  const x = p.x - framePadX;
  const y = p.y - frameH / 2;
  const w = p.w + framePadX * 2;
  const h = frameH;
  const inline = visualStyle(input.style);
  const parts: string[] = [];
  if (input.node.isScopePortal) {
    const leftX = x + 2;
    const rightX = x + w - 2;
    const arm = 12;
    parts.push(`<path class="portal-bracket ${classes.join(" ")}" data-node-id="${escapeAttr(input.node.id)}" d="M ${fmt(leftX + arm)} ${fmt(y)} H ${fmt(leftX)} V ${fmt(y + h)} H ${fmt(leftX + arm)}"${inline} />`);
    parts.push(`<path class="portal-bracket ${classes.join(" ")}" data-node-id="${escapeAttr(input.node.id)}" d="M ${fmt(rightX - arm)} ${fmt(y)} H ${fmt(rightX)} V ${fmt(y + h)} H ${fmt(rightX - arm)}"${inline} />`);
  } else if (input.style.shape === "diamond") {
    parts.push(`<path class="folder-box ${classes.join(" ")}" data-node-id="${escapeAttr(input.node.id)}" d="${diamondPath(p.x + p.w / 2, p.y, w, h)}"${inline} />`);
  } else {
    parts.push(`<rect class="folder-box ${classes.join(" ")}" data-node-id="${escapeAttr(input.node.id)}" x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="${input.surface.structuredMode === "Tree" ? 8 : 4}"${inline} />`);
  }
  if (input.view.lockedBy !== "none") {
    const lockClass = input.view.lockedBy === "self" ? "lock-icon" : "lock-icon lock-icon-other";
    parts.push(`<text class="${lockClass}" x="${fmt(x + w - 14)}" y="${fmt(y + 14)}" text-anchor="middle" dominant-baseline="middle">&#128274;</text>`);
  }
  return parts.join("");
}

function renderBadges(input: NodeDrawInput): string {
  const parts: string[] = [];
  const p = input.position;
  const badge = input.node.badge || "";
  if (badge) {
    parts.push(`<text class="alias-badge alias-badge-${escapeAttr(badge)}" x="${fmt(p.x + p.w + 18)}" y="${fmt(p.y)}" dominant-baseline="middle">${escapeXml(badge)}</text>`);
  }
  if (input.style.confidence !== undefined) {
    const cColor = nodeDrawConfidenceColor(input.style.confidence);
    const cLabel = `${(input.style.confidence * 100).toFixed(0)}%`;
    const cX = p.x + p.w + (badge ? 60 : 18);
    parts.push(`<rect class="confidence-badge" x="${fmt(cX)}" y="${fmt(p.y - 12)}" width="42" height="22" rx="11" style="fill:${cColor}" />`);
    parts.push(`<text class="confidence-badge-text" x="${fmt(cX + 21)}" y="${fmt(p.y + 1)}" text-anchor="middle" dominant-baseline="middle">${escapeXml(cLabel)}</text>`);
  }
  if (input.style.status) {
    const sX = p.x + p.w + (badge ? 60 : 18) + (input.style.confidence !== undefined ? 56 : 0);
    const width = input.style.status.length * 8 + 12;
    parts.push(`<rect class="status-badge" x="${fmt(sX)}" y="${fmt(p.y - 12)}" width="${fmt(width)}" height="22" rx="11" style="fill:${STATUS_COLORS[input.style.status]}" />`);
    parts.push(`<text class="status-badge-text" x="${fmt(sX + input.style.status.length * 4 + 6)}" y="${fmt(p.y + 1)}" text-anchor="middle" dominant-baseline="middle">${escapeXml(input.style.status)}</text>`);
  }
  return parts.join("");
}

function renderCollapsedBadge(input: NodeDrawInput, treatAsRoot: boolean): string {
  const p = input.position;
  const indicatorX = treatAsRoot ? p.x + p.w + ROOT_INDICATOR_PAD : p.x + p.w + NODE_INDICATOR_PAD;
  const label = String(Math.max(1, input.view.collapsedCount ?? 1));
  const width = Math.max(26, label.length * 14 + 14);
  const height = 24;
  const x = indicatorX - width / 2;
  const y = p.y - height / 2;
  return [
    `<rect class="collapsed-badge" data-collapse-node-id="${escapeAttr(input.node.id)}" x="${fmt(x)}" y="${fmt(y)}" width="${fmt(width)}" height="${fmt(height)}" rx="12" />`,
    `<circle class="collapsed-badge-node" data-collapse-node-id="${escapeAttr(input.node.id)}" cx="${fmt(x - 8)}" cy="${fmt(p.y)}" r="8" />`,
    `<text class="collapsed-badge-count" data-collapse-node-id="${escapeAttr(input.node.id)}" x="${fmt(indicatorX)}" y="${fmt(p.y)}" text-anchor="middle" dominant-baseline="middle">${escapeXml(label)}</text>`,
  ].join("");
}

function nodeStateClasses(input: NodeDrawInput, base: string[], opts: { aliasLabel?: boolean; status?: boolean } = {}): string[] {
  const classes = [...base];
  if (input.view.selected) classes.push("selected");
  if (input.view.multiSelected) classes.push("multi-selected");
  if (input.view.primarySelected) classes.push("primary-selected");
  if (input.node.alias !== "none") {
    classes.push(opts.aliasLabel ? "alias-label" : "alias");
    classes.push(aliasClass(input.node.alias, Boolean(opts.aliasLabel)));
  }
  if (opts.status && input.style.status) classes.push(`status-${input.style.status}`);
  if (!opts.status && input.style.status) classes.push(`status-${input.style.status}`);
  if (input.view.reparentSource) classes.push("reparent-source");
  if (input.view.linkSource) classes.push("link-source");
  if (input.view.cutPending) classes.push("cut-pending");
  if (input.view.dropTarget) classes.push("drop-target");
  if (input.view.dragSource) classes.push("drag-source");
  if (input.view.lockedBy !== "none") {
    classes.push("scope-locked");
    if (input.view.lockedBy === "other") classes.push("scope-locked-by-other");
  }
  return classes;
}

function aliasClass(alias: string, label: boolean): string {
  const suffix = label ? "-label" : "";
  if (alias === "broken") return `alias-broken${suffix}`;
  if (alias === "write") return `alias-write${suffix}`;
  return `alias-read${suffix}`;
}

function plainLabel(input: NodeDrawInput): Extract<NodeDrawInput["content"], { kind: "plainLabel" }> {
  return input.content.kind === "plainLabel"
    ? input.content
    : { kind: "plainLabel", labelLines: [input.node.label || input.node.id], fontSize: input.position.fontSize };
}

function visualStyle(style: NodeDrawStyle): string {
  const parts = baseShapeStyles(style);
  if (style.band === "flash") {
    parts.push("opacity:0.6");
    if (!style.borderStyle) parts.push("stroke-dasharray:6 4");
  } else if (style.band === "deep") {
    if (style.borderWidth === undefined) parts.push("stroke-width:4px");
    if (!style.border) parts.push("stroke:#333");
  }
  if (style.status && !style.fill && !style.border) {
    if (style.status === "placeholder") parts.push("stroke:#999;stroke-dasharray:4 4;stroke-width:3px");
    if (style.status === "confirmed") parts.push("stroke:#2d8c4e;stroke-width:6px");
    if (style.status === "contested") parts.push("stroke:#d94040;stroke-width:6px");
    if (style.status === "frozen") parts.push("stroke:#4a7fb5;stroke-width:4.5px;stroke-dasharray:2 3");
    if (style.status === "active") parts.push("stroke:#e89b1a;stroke-width:7.5px");
    if (style.status === "review") parts.push("stroke:#9b59b6;stroke-width:6px;stroke-dasharray:6 3");
  }
  return parts.length ? ` style="${parts.join(";")}"` : "";
}

function circleStyle(style: NodeDrawStyle): string {
  const parts = baseShapeStyles(style);
  return parts.length ? ` style="${parts.join(";")}"` : "";
}

function baseShapeStyles(style: NodeDrawStyle): string[] {
  const parts: string[] = [];
  if (style.fill) parts.push(`fill:${style.fill}`);
  if (style.border) parts.push(`stroke:${style.border}`);
  if (style.borderWidth !== undefined) parts.push(`stroke-width:${style.borderWidth}px`);
  if (style.borderStyle === "dashed") parts.push("stroke-dasharray:8 5");
  if (style.borderStyle === "dotted") parts.push("stroke-dasharray:3 3");
  if (style.borderStyle === "none") parts.push("stroke:none");
  return parts;
}

function labelStyleAttr(style: NodeDrawStyle, fontSize: number): string {
  const parts = [`font-size:${fontSize}px`];
  if (style.text) parts.push(`fill:${style.text}`);
  return parts.join(";");
}

function shapeRx(style: NodeDrawStyle, isRoot: boolean): number {
  if (!style.shape) return isRoot ? 60 : 12;
  if (style.shape === "rect") return isRoot ? 8 : 2;
  if (style.shape === "rounded") return isRoot ? 24 : 12;
  if (style.shape === "pill") return 999;
  return 0;
}

function rectPath(x: number, y: number, w: number, h: number, rx: number): string {
  if (rx <= 0) return `M ${fmt(x)} ${fmt(y)} H ${fmt(x + w)} V ${fmt(y + h)} H ${fmt(x)} Z`;
  const r = Math.min(rx, w / 2, h / 2);
  return [
    `M ${fmt(x + r)} ${fmt(y)}`,
    `H ${fmt(x + w - r)}`,
    `Q ${fmt(x + w)} ${fmt(y)} ${fmt(x + w)} ${fmt(y + r)}`,
    `V ${fmt(y + h - r)}`,
    `Q ${fmt(x + w)} ${fmt(y + h)} ${fmt(x + w - r)} ${fmt(y + h)}`,
    `H ${fmt(x + r)}`,
    `Q ${fmt(x)} ${fmt(y + h)} ${fmt(x)} ${fmt(y + h - r)}`,
    `V ${fmt(y + r)}`,
    `Q ${fmt(x)} ${fmt(y)} ${fmt(x + r)} ${fmt(y)}`,
    "Z",
  ].join(" ");
}

function diamondPath(cx: number, cy: number, w: number, h: number): string {
  return `M ${fmt(cx)} ${fmt(cy - h / 2)} L ${fmt(cx + w / 2)} ${fmt(cy)} L ${fmt(cx)} ${fmt(cy + h / 2)} L ${fmt(cx - w / 2)} ${fmt(cy)} Z`;
}

function multilineTextStartY(centerY: number, lines: number, fontSize: number, lineHeight: number): number {
  if (lines <= 1) return centerY + fontSize * 0.35;
  return centerY - ((lines - 1) * lineHeight) / 2 + fontSize * 0.35;
}

function multilineTspans(lines: string[], x: number, lineHeight: number): string {
  return lines.map((line, index) => (
    index === 0
      ? `<tspan x="${fmt(x)}">${escapeXml(line)}</tspan>`
      : `<tspan x="${fmt(x)}" dy="${fmt(lineHeight)}">${escapeXml(line)}</tspan>`
  )).join("");
}

function lineHeightForFont(fontSize: number): number {
  return Math.max(14, Math.round(fontSize * 1.25));
}

function scatterFontSizeFor(radius: number): number {
  if (radius <= 22) return 10;
  if (radius <= 30) return 11;
  return 12;
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, "");
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeXml(value).replace(/"/g, "&quot;");
}
