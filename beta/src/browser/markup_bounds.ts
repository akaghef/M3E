/**
 * Bounding box of an SVG fragment, computed from its markup instead of asking the
 * browser (`getBBox` forces a synchronous layout of the whole scene).
 *
 * Only the element set the viewer itself emits is understood: rect, circle, ellipse,
 * line, path with absolute M/L/H/V/C/Q, text with tspans, foreignObject. Anything else
 * (a transform, a nested group, an unknown element or path command) answers `null`, and
 * the caller measures that fragment the old way. Text extents are an estimate from the
 * injected width function; the other shapes are exact up to curve sampling.
 */
export interface MarkupBox { x: number; y: number; width: number; height: number }

export type MeasureTextWidth = (text: string, fontSize: number, fontWeight: number) => number;

// What viewer.css gives the text classes the viewer emits: size (px, when not inline), weight,
// letter spacing (em) and upper-casing. Later rows win, as the later, more specific rules do.
interface TextClassRule { match: RegExp; size?: number; weight?: number; spacing?: number; upper?: boolean }
const TEXT_CLASS_RULES: TextClassRule[] = [
  { match: /\blabel-root\b/, size: 42, weight: 500 },
  { match: /\blabel-node\b/, size: 44, weight: 450 },
  { match: /\blabel-node\b.*\bselected\b|\bselected\b.*\blabel-node\b/, weight: 600 },
  { match: /\bscatter-label\b/, weight: 700 },
  { match: /\balias-badge\b/, size: 18, weight: 700, spacing: 0.04, upper: true },
  { match: /\bcollapsed-badge-count\b/, size: 16, weight: 700, spacing: 0.02 },
  { match: /\bconfidence-badge-text\b/, size: 13, weight: 700 },
  { match: /\bstatus-badge-text\b/, size: 12, weight: 700, spacing: 0.04, upper: true },
  { match: /\bedge-label\b/, size: 11, weight: 600 },
  { match: /\bgraph-link-label\b/, size: 12, weight: 700 },
  { match: /\bsurface-scope-title\b/, size: 22, weight: 700, spacing: 0.01 },
  { match: /\bflow-preview-node-label\b/, size: 18 },
  { match: /\bflow-preview-edge-label\b/, size: 10 },
];
const TEXT_ASCENT = 0.9;
const TEXT_DESCENT = 0.25;
const CURVE_STEPS = 24;

class Extent {
  minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
  add(x: number, y: number): boolean {
    if (!Number.isFinite(x + y)) return false;
    if (x < this.minX) this.minX = x;
    if (y < this.minY) this.minY = y;
    if (x > this.maxX) this.maxX = x;
    if (y > this.maxY) this.maxY = y;
    return true;
  }
  box(): MarkupBox | null {
    if (!Number.isFinite(this.minX + this.minY + this.maxX + this.maxY)) return null;
    return { x: this.minX, y: this.minY, width: this.maxX - this.minX, height: this.maxY - this.minY };
  }
}

function attr(attrs: string, name: string): string | null {
  const match = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs);
  return match ? match[1]! : null;
}

function num(attrs: string, name: string, fallback = NaN): number {
  const raw = attr(attrs, name);
  return raw === null ? fallback : Number.parseFloat(raw);
}

function unescapeXml(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|apos|#39);/g, (_all, name: string) =>
    name === "amp" ? "&" : name === "lt" ? "<" : name === "gt" ? ">" : name === "quot" ? "\"" : "'");
}

/** Feeds the points along a path to `extent`; false when the path uses a command this module does not read. */
function addPath(extent: { add(x: number, y: number): boolean }, d: string): boolean {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g);
  if (!tokens || !tokens.length) return false;
  let index = 0, x = 0, y = 0, startX = 0, startY = 0, command = "";
  const next = (): number => Number.parseFloat(tokens[index++] ?? "NaN");
  while (index < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[index]!)) command = tokens[index++]!;
    else if (!command) return false;
    if (command === "M" || command === "L") {
      x = next(); y = next();
      if (command === "M") { startX = x; startY = y; command = "L"; }
      if (!extent.add(x, y)) return false;
    } else if (command === "H") {
      x = next();
      if (!extent.add(x, y)) return false;
    } else if (command === "V") {
      y = next();
      if (!extent.add(x, y)) return false;
    } else if (command === "C") {
      const x1 = next(), y1 = next(), x2 = next(), y2 = next(), x3 = next(), y3 = next();
      if (!Number.isFinite(x1 + y1 + x2 + y2 + x3 + y3)) return false;
      for (let step = 1; step <= CURVE_STEPS; step++) {
        const t = step / CURVE_STEPS, u = 1 - t;
        extent.add(u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3);
      }
      x = x3; y = y3;
    } else if (command === "Q") {
      const x1 = next(), y1 = next(), x2 = next(), y2 = next();
      if (!Number.isFinite(x1 + y1 + x2 + y2)) return false;
      for (let step = 1; step <= CURVE_STEPS; step++) {
        const t = step / CURVE_STEPS, u = 1 - t;
        extent.add(u * u * x + 2 * u * t * x1 + t * t * x2, u * u * y + 2 * u * t * y1 + t * t * y2);
      }
      x = x2; y = y2;
    } else if (command === "Z" || command === "z") {
      x = startX; y = startY;
    } else {
      return false;
    }
  }
  return true;
}

function textStyleOf(attrs: string): { size: number; weight: number; spacing: number; upper: boolean } | null {
  const classes = attr(attrs, "class") || "";
  const found: { size?: number; weight: number; spacing: number; upper: boolean } = { weight: 400, spacing: 0, upper: false };
  for (const rule of TEXT_CLASS_RULES) {
    if (!rule.match.test(classes)) continue;
    if (rule.size !== undefined) found.size = rule.size;
    if (rule.weight !== undefined) found.weight = rule.weight;
    if (rule.spacing !== undefined) found.spacing = rule.spacing;
    if (rule.upper !== undefined) found.upper = rule.upper;
  }
  const inline = /font-size:\s*([\d.]+)px/.exec(attr(attrs, "style") || "");
  const size = inline ? Number.parseFloat(inline[1]!) : found.size;
  return size === undefined || !Number.isFinite(size) ? null : { size, weight: found.weight, spacing: found.spacing, upper: found.upper };
}

function addText(extent: Extent, attrs: string, inner: string, measure: MeasureTextWidth): boolean {
  const style = textStyleOf(attrs);
  const x = num(attrs, "x"), y = num(attrs, "y");
  if (!style || !Number.isFinite(x + y)) return false;
  const font = style.size;
  const anchor = attr(attrs, "text-anchor") || "start";
  const middleBaseline = attr(attrs, "dominant-baseline") === "middle";
  const place = (raw: string, lineX: number, baseline: number): void => {
    // The browser reports an empty line at the origin of the user space, wherever the text is.
    if (!raw) { extent.add(0, 0); return; }
    const text = style.upper ? unescapeXml(raw).toUpperCase() : unescapeXml(raw);
    const width = measure(text, font, style.weight) + style.spacing * font * text.length;
    const left = anchor === "middle" ? lineX - width / 2 : anchor === "end" ? lineX - width : lineX;
    const top = middleBaseline ? baseline - font * 0.6 : baseline - font * TEXT_ASCENT;
    const bottom = middleBaseline ? baseline + font * 0.6 : baseline + font * TEXT_DESCENT;
    extent.add(left, top);
    extent.add(left + width, bottom);
  };
  if (!inner.includes("<")) {
    if (inner) place(inner, x, y);
    return true;
  }
  const spans = /<tspan([^>]*)>([^<]*)<\/tspan>/g;
  let baseline = y, consumed = 0, match: RegExpExecArray | null;
  while ((match = spans.exec(inner))) {
    if (inner.slice(consumed, match.index).trim()) return false;
    consumed = match.index + match[0].length;
    const dy = num(match[1]!, "dy", 0);
    const lineX = num(match[1]!, "x", x);
    if (!Number.isFinite(dy + lineX) || attr(match[1]!, "dx") !== null) return false;
    baseline += dy;
    place(match[2]!, lineX, baseline);
  }
  return !inner.slice(consumed).trim();
}

/** The box `getBBox` would report for a group holding this markup, or `null` when it cannot be told from the text. */
export function markupBounds(markup: string, measure: MeasureTextWidth): MarkupBox | null {
  const extent = new Extent();
  const tags = /<([a-zA-Z][\w:-]*)((?:"[^"]*"|[^">])*?)(\/?)>/g;
  let match: RegExpExecArray | null;
  while ((match = tags.exec(markup))) {
    const tag = match[1]!, attrs = match[2]!;
    if (/(?:^|\s)transform=/.test(attrs)) return null;
    if (tag === "rect" || tag === "foreignObject") {
      const x = num(attrs, "x", 0), y = num(attrs, "y", 0), w = num(attrs, "width"), h = num(attrs, "height");
      if (!extent.add(x, y) || !extent.add(x + w, y + h)) return null;
      if (tag === "foreignObject" && !match[3]) {
        const close = markup.indexOf("</foreignObject>", tags.lastIndex);
        if (close < 0) return null;
        tags.lastIndex = close + "</foreignObject>".length;
      }
    } else if (tag === "circle") {
      const cx = num(attrs, "cx", 0), cy = num(attrs, "cy", 0), r = num(attrs, "r");
      if (!extent.add(cx - r, cy - r) || !extent.add(cx + r, cy + r)) return null;
    } else if (tag === "ellipse") {
      const cx = num(attrs, "cx", 0), cy = num(attrs, "cy", 0), rx = num(attrs, "rx"), ry = num(attrs, "ry");
      if (!extent.add(cx - rx, cy - ry) || !extent.add(cx + rx, cy + ry)) return null;
    } else if (tag === "line") {
      if (!extent.add(num(attrs, "x1", 0), num(attrs, "y1", 0)) || !extent.add(num(attrs, "x2", 0), num(attrs, "y2", 0))) return null;
    } else if (tag === "path") {
      if (!addPath(extent, attr(attrs, "d") || "")) return null;
    } else if (tag === "text") {
      if (match[3]) continue;
      const close = markup.indexOf("</text>", tags.lastIndex);
      if (close < 0 || !addText(extent, attrs, markup.slice(tags.lastIndex, close), measure)) return null;
      tags.lastIndex = close + "</text>".length;
    } else {
      return null;
    }
  }
  return extent.box();
}

/**
 * The point half way along a path by length, as `getPointAtLength(getTotalLength() / 2)`
 * reports it, or `null` when the path uses a command this module does not read.
 */
export function pathMidpoint(d: string): { x: number; y: number } | null {
  const points: Array<{ x: number; y: number }> = [];
  if (!addPath({ add: (x, y) => Number.isFinite(x + y) && points.push({ x, y }) > 0 }, d) || !points.length) return null;
  let total = 0;
  const lengths = [0];
  for (let index = 1; index < points.length; index++) {
    total += Math.hypot(points[index]!.x - points[index - 1]!.x, points[index]!.y - points[index - 1]!.y);
    lengths.push(total);
  }
  if (!(total > 0)) return { ...points[0]! };
  const half = total / 2;
  let index = 1;
  while (index < lengths.length - 1 && lengths[index]! < half) index++;
  const from = points[index - 1]!, to = points[index]!;
  const span = lengths[index]! - lengths[index - 1]!;
  const t = span > 0 ? (half - lengths[index - 1]!) / span : 0;
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}
