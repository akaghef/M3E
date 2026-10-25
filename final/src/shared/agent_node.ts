export const AGENT_LIFECYCLE_STATES = [
  "starting", "thinking", "tool-running", "awaiting-user", "blocked",
  "idle", "completed", "failed", "disconnected", "unobservable",
] as const;

export type AgentLifecycleState = typeof AGENT_LIFECYCLE_STATES[number];
export type AgentSemanticColor = "normal" | "awaiting" | "stalled" | "done" | "error" | "archived" | "unset";
export type AgentCardLod = "far" | "middle" | "near";

export interface AgentCardData {
  id: string;
  agentKind: "ai" | "human";
  /** Stable Role-layer pet id. It is not a provider or session avatar. */
  icon: string;
  realm?: string;
  team?: string;
  role?: string;
  name?: string;
  title: string;
  message: string;
  model: string;
  lifecycleState?: AgentLifecycleState;
  semanticColor?: AgentSemanticColor;
  lastActiveAt: string;
  attention: boolean;
  actorCount: 1 | 2 | 3;
}

export interface AgentCardSprite {
  petId: string;
  imageUrl: string;
  sheetWidth: number;
  sheetHeight: number;
  frameWidth: number;
  frameHeight: number;
  row: number;
  frames: number;
  fps: number;
  animate: boolean;
  sourceFrames?: Array<{ x: number; y: number; width: number; height: number; offsetX: number; offsetY: number }>;
  gridStatus: "visually-verified-regions" | "manifest-confirmed" | "dimension-confirmed" | "unconfirmed-static";
  frameCountStatus: "visually-verified-regions" | "manifest-confirmed" | "inferred-static";
}

export interface AgentCardRenderInput {
  card: AgentCardData;
  width: number;
  lod: AgentCardLod;
  displayAt: string | number | Date;
  attention?: boolean;
  actorCount?: 1 | 2 | 3;
  sprite?: AgentCardSprite;
}

export interface AgentCardRenderOutput {
  svg: string;
  bounds: { w: number; h: number };
  titleLines: string[];
  messageLines: string[];
}

const OUTER_GAP = 0.75;
const INNER_PAD = 10;
const HEADER_FONT = 12;
const BODY_FONT = 11;
const META_FONT = 10;
const STACK_OFFSET = 5;

export function renderAgentCard(input: AgentCardRenderInput): AgentCardRenderOutput {
  const actorCount = input.actorCount ?? input.card.actorCount;
  const attention = input.attention ?? input.card.attention;
  const color = input.card.semanticColor ?? "unset";
  if (input.lod === "far") return renderFar(input.card, color, attention, actorCount, input.sprite);
  if (input.lod === "middle") return renderMiddle(input.card, input.width, color, attention, actorCount, input.displayAt, input.sprite);

  const stackOffset = (actorCount - 1) * STACK_OFFSET;
  const cardWidth = Math.max(240, input.width);
  const cardHeight = 128;
  const width = cardWidth + stackOffset;
  const height = cardHeight + stackOffset;
  const innerX = OUTER_GAP;
  const innerY = OUTER_GAP + stackOffset;
  const innerWidth = cardWidth - OUTER_GAP * 2;
  const innerHeight = cardHeight - OUTER_GAP * 2;
  const iconWidth = Math.max(48, Math.min(72, Math.round(innerWidth * .19)));
  const iconX = innerX + INNER_PAD;
  const iconY = innerY + 29;
  const iconHeight = 80;
  const textX = iconX + iconWidth + 10;
  const textRight = innerX + innerWidth - INNER_PAD;
  const textWidth = textRight - textX;
  const row1Y = innerY + 19;
  const row2Y = innerY + 42;
  const row3Y = innerY + 65;
  const row4Y = innerY + 113;
  const age = formatAgentCardAge(input.displayAt, input.card.lastActiveAt);
  const state = input.card.lifecycleState || "";
  const titleLines = wrapAgentCardText(input.card.title, Math.max(1, textWidth - 5), BODY_FONT);
  const messageLines = wrapAgentCardText(input.card.message, Math.max(1, textWidth - 5), BODY_FONT);
  const clipId = `agent-card-text-${safeToken(input.card.id)}`;
  const parts = [nodeSurfaces(cardWidth, cardHeight, attention, actorCount, color)];
  parts.push(renderSprite(input.card, input.sprite, iconX, iconY, iconWidth, iconHeight));
  parts.push(`<defs><clipPath id="${clipId}"><rect x="${textX}" y="${innerY}" width="${textWidth}" height="${innerHeight}" /></clipPath></defs>`);
  parts.push(`<g clip-path="url(#${clipId})">`);
  parts.push(identityRow(input.card, textX, textRight, row1Y));
  parts.push(contentLines(input.card.title, textX, row2Y, textWidth, 17, 1, "agent-card-header", "title"));
  parts.push(contentLines(input.card.message, textX, row3Y, textWidth, BODY_FONT, Math.max(1, Math.floor((row4Y - 20 - row3Y) / 15) + 1), "agent-card-field-value"));
  parts.push(`<line class="agent-node-content-rule" x1="${textX}" x2="${textRight}" y1="${row2Y + 7}" y2="${row2Y + 7}" />`);
  parts.push(`<line class="agent-node-content-rule" x1="${textX}" x2="${textRight}" y1="${row4Y - 13}" y2="${row4Y - 13}" />`);
  parts.push(metaRow(input.card.model, age, state, textX, textRight, row4Y));
  parts.push("</g>");
  return { svg: wrapGroup(parts.join(""), input.card.id, color, input.lod), bounds: { w: width, h: height }, titleLines, messageLines };
}

export function wrapAgentCardText(text: string, maxWidth: number, fontSize = BODY_FONT): string[] {
  if (!text) return [];
  const lines: string[] = [];
  for (const sourceLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (!sourceLine) { lines.push(""); continue; }
    let line = "";
    let width = 0;
    for (const char of sourceLine) {
      const charWidth = agentCardCharacterWidth(char, fontSize);
      if (line && width + charWidth > maxWidth) {
        lines.push(line);
        line = "";
        width = 0;
      }
      line += char;
      width += charWidth;
    }
    lines.push(line);
  }
  return lines;
}

export function agentCardCharacterWidth(char: string, fontSize: number): number {
  if (/\s/.test(char)) return fontSize * .34;
  if (/^[\x20-\x7e]$/.test(char)) return fontSize * (/[MW@#%&]/.test(char) ? .78 : .56);
  return fontSize;
}

export function formatAgentCardAge(displayAt: string | number | Date, lastActiveAt: string | number | Date): string {
  const elapsedMs = Math.max(0, new Date(displayAt).getTime() - new Date(lastActiveAt).getTime());
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 168) return `${hours}h${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d${hours % 24}h`;
}

function renderFar(card: AgentCardData, color: AgentSemanticColor, attention: boolean, actorCount: 1 | 2 | 3, sprite?: AgentCardSprite): AgentCardRenderOutput {
  const stackOffset = (actorCount - 1) * STACK_OFFSET;
  const baseSize = 64;
  const size = baseSize + stackOffset;
  const parts = [nodeSurfaces(baseSize, baseSize, attention, actorCount, color)];
  parts.push(`<circle class="agent-card-semantic-dot" data-semantic-color="${color}" cx="54" cy="10" r="5" />`);
  parts.push(renderSprite(card, sprite, 10, 10 + stackOffset, 44, 44));
  return { svg: wrapGroup(parts.join(""), card.id, color, "far"), bounds: { w: size, h: size }, titleLines: [], messageLines: [] };
}

function renderMiddle(card: AgentCardData, requestedWidth: number, color: AgentSemanticColor, attention: boolean, actorCount: 1 | 2 | 3, displayAt: string | number | Date, sprite?: AgentCardSprite): AgentCardRenderOutput {
  const stackOffset = (actorCount - 1) * STACK_OFFSET;
  const cardWidth = Math.max(220, requestedWidth);
  const cardHeight = 60;
  const width = cardWidth + stackOffset;
  const height = cardHeight + stackOffset;
  const age = formatAgentCardAge(displayAt, card.lastActiveAt);
  const parts = [nodeSurfaces(cardWidth, cardHeight, attention, actorCount, color)];
  parts.push(renderSprite(card, sprite, 8, 8 + stackOffset, 48, 44));
  parts.push(`<text class="agent-card-middle-name" data-field="name" x="64" y="${21 + stackOffset}">${escapeXml(fitOneLine(card.name || "—", cardWidth - 134, 12))}</text>`);
  parts.push(`<text class="agent-card-meta" data-field="time" x="${cardWidth - 12}" y="${21 + stackOffset}" font-size="10" text-anchor="end">${escapeXml(age)}</text>`);
  parts.push(`<text class="agent-card-header" data-field="title" x="64" y="${44 + stackOffset}" font-size="14">${escapeXml(fitOneLine(card.title, cardWidth - 76, 14))}</text>`);
  return { svg: wrapGroup(parts.join(""), card.id, color, "middle"), bounds: { w: width, h: height }, titleLines: [card.title], messageLines: [] };
}

function nodeSurfaces(width: number, height: number, attention: boolean, actorCount: 1 | 2 | 3, color: AgentSemanticColor): string {
  const parts = [];
  for (let layer = actorCount - 1; layer >= 0; layer -= 1) {
    const offset = layer * STACK_OFFSET;
    parts.push(`<rect class="agent-card-surface${attention && layer === 0 ? " agent-card-attention" : ""}" data-actor-layer="${layer + 1}" data-semantic-color="${color}" x="${offset + .75}" y="${(actorCount - 1) * STACK_OFFSET - offset + .75}" width="${width - 1.5}" height="${height - 1.5}" rx="12" />`);
  }
  return parts.join("");
}

function renderSprite(card: AgentCardData, sprite: AgentCardSprite | undefined, x: number, y: number, width: number, height: number): string {
  if (!sprite) {
    return `<rect class="agent-card-pet-placeholder" x="${x}" y="${y}" width="${width}" height="${height}" rx="12" /><text class="agent-card-pet-placeholder-text" x="${x + width / 2}" y="${y + height / 2 + 4}" text-anchor="middle">${escapeXml(card.icon)}</text>`;
  }
  return renderPetSprite(sprite, x, y, width, height, card.id);
}

export function renderPetSprite(sprite: AgentCardSprite, x: number, y: number, width: number, height: number, instanceId: string): string {
  if (sprite.gridStatus !== "visually-verified-regions" || !sprite.sourceFrames?.length) {
    return `<g class="agent-card-pet-pending" data-pet-id="${escapeAttr(sprite.petId)}"><title>アイコン未取り込み</title><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="none" stroke="currentColor" stroke-dasharray="3 3"/><text x="${x + width / 2}" y="${y + height / 2 + 4}" text-anchor="middle" font-size="10">未取込</text></g>`;
  }
  if (sprite.sourceFrames?.length) {
    const frames = sprite.animate ? sprite.sourceFrames : sprite.sourceFrames.slice(0, 1);
    const count = frames.length;
    const times = Array.from({ length: count + 1 }, (_, step) => step / count).join(";");
    const parts = frames.map((frame, index) => {
      const values = Array.from({ length: count + 1 }, (_, step) => step % count === index ? 1 : 0).join(";");
      const animation = count > 1 ? `<animate attributeName="opacity" values="${values}" keyTimes="${times}" dur="${count / sprite.fps}s" calcMode="discrete" repeatCount="indefinite" />` : "";
      return `<g data-sprite-frame="${index}" opacity="${index === 0 ? 1 : 0}">${animation}<svg x="${frame.offsetX}" y="${frame.offsetY}" width="${frame.width}" height="${frame.height}" viewBox="${frame.x} ${frame.y} ${frame.width} ${frame.height}" overflow="hidden"><image href="${escapeAttr(sprite.imageUrl)}" width="${sprite.sheetWidth}" height="${sprite.sheetHeight}" preserveAspectRatio="none" /></svg></g>`;
    }).join("");
    return `<svg class="agent-card-pet" data-pet-id="${escapeAttr(sprite.petId)}" data-grid-status="${sprite.gridStatus}" data-frame-count-status="${sprite.frameCountStatus}" x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 ${sprite.frameWidth} ${sprite.frameHeight}" preserveAspectRatio="xMidYMid meet" overflow="hidden">${parts}</svg>`;
  }
  return "";
}

function contentLines(value: string, x: number, y: number, width: number, size: number, maxLines: number, cls: string, field?: string): string {
  const lines = wrapAgentCardText(value, Math.max(1, width - 4), size);
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines && visible.length) visible[visible.length - 1] = visible[visible.length - 1].slice(0, -1) + "…";
  return `<text class="${cls}"${field ? ` data-field="${field}"` : ""} font-size="${size}">${visible.map((line, i) => `<tspan x="${x}" y="${y + i * 15}">${escapeXml(line)}</tspan>`).join("")}</text>`;
}

function fitOneLine(value: string, width: number, size: number): string {
  const lines = wrapAgentCardText(value, width, size);
  return lines.length > 1 ? (lines[0] || "").slice(0, -1) + "…" : value;
}

function identityRow(card: AgentCardData, x: number, right: number, y: number): string {
  const width = right - x;
  const fields = [card.realm || "—", card.team || card.role || "—", card.name || "—"];
  const sizes = [.24, .22, .42];
  let cursor = x;
  return fields.map((value, i) => {
    const text = fitOneLine(value, width * sizes[i], HEADER_FONT);
    const at = cursor;
    cursor += Array.from(text).reduce((sum, char) => sum + agentCardCharacterWidth(char, HEADER_FONT), 0) + 13;
    return `<text class="agent-card-header" data-field="${["realm", card.team ? "team" : "role", "name"][i]}" x="${at}" y="${y}" font-size="${HEADER_FONT}"><title>${escapeXml(value)}</title>${escapeXml(text)}</text>`;
  }).join("");
}

function metaRow(model: string, age: string, state: string, x: number, right: number, y: number): string {
  const width = right - x;
  const size = width < 180 ? 8 : META_FONT;
  return `<text class="agent-card-meta" data-field="model" x="${x}" y="${y}" font-size="${size}">${escapeXml(fitOneLine(model, width * .44, size))}</text><text class="agent-card-meta" data-field="time" x="${x + width * .53}" y="${y}" font-size="${size}" text-anchor="middle">${escapeXml(age)}</text><text class="agent-card-state" data-field="state" x="${right}" y="${y}" font-size="${size}" text-anchor="end">${escapeXml(fitOneLine(state, width * .38, size))}</text>`;
}

function wrapGroup(svg: string, id: string, color: AgentSemanticColor, lod: AgentCardLod): string {
  return `<g class="agent-card agent-semantic-${color}" data-agent-card-id="${escapeAttr(id)}" data-lod="${lod}">${svg}</g>`;
}

function safeToken(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "-");
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeXml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
