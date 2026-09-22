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
  gridStatus: "manifest-confirmed" | "dimension-confirmed" | "unconfirmed-static";
  frameCountStatus: "manifest-confirmed" | "inferred-static";
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

const OUTER_GAP = 8;
const INNER_PAD = 12;
const HEADER_FONT = 12;
const BODY_FONT = 11;
const META_FONT = 10;
const STACK_OFFSET = 5;

export function renderAgentCard(input: AgentCardRenderInput): AgentCardRenderOutput {
  const actorCount = input.actorCount ?? input.card.actorCount;
  const attention = input.attention ?? input.card.attention;
  const color = input.card.semanticColor ?? "unset";
  if (input.lod === "far") return renderFar(input.card, color, attention, actorCount, input.sprite);
  if (input.lod === "middle") return renderMiddle(input.card, input.width, color, attention, actorCount, input.sprite);

  const stackOffset = (actorCount - 1) * STACK_OFFSET;
  const cardWidth = Math.max(240, input.width);
  const cardHeight = Math.round(cardWidth / 2);
  const width = cardWidth + stackOffset;
  const height = cardHeight + stackOffset;
  const innerX = OUTER_GAP;
  const innerY = OUTER_GAP + stackOffset;
  const innerWidth = cardWidth - OUTER_GAP * 2;
  const innerHeight = cardHeight - OUTER_GAP * 2;
  const iconWidth = Math.round(innerWidth * .23);
  const iconX = innerX + INNER_PAD;
  const iconY = innerY + INNER_PAD;
  const iconHeight = innerHeight - INNER_PAD * 2;
  const textX = iconX + iconWidth + 16;
  const textRight = innerX + innerWidth - INNER_PAD;
  const textWidth = textRight - textX;
  const rowGap = (innerHeight - INNER_PAD * 2) / 4;
  const row1Y = innerY + INNER_PAD + 13;
  const row2Y = row1Y + rowGap;
  const row3Y = row2Y + rowGap;
  const row4Y = row3Y + rowGap;
  const header = [input.card.realm, input.card.role, input.card.name].filter(Boolean).join(" , ") || "—";
  const age = formatAgentCardAge(input.displayAt, input.card.lastActiveAt);
  const state = input.card.lifecycleState || "";
  const titleLines = wrapAgentCardText(input.card.title, Math.max(1, textWidth - 5), BODY_FONT);
  const messageLines = wrapAgentCardText(input.card.message, Math.max(1, textWidth - 5), BODY_FONT);
  const clipId = `agent-card-text-${safeToken(input.card.id)}`;
  const parts = [outerFrames(cardWidth, cardHeight, attention, actorCount, color)];
  parts.push(`<rect class="agent-card-surface" x="${innerX}" y="${innerY}" width="${innerWidth}" height="${innerHeight}" rx="16" />`);
  parts.push(renderSprite(input.card, input.sprite, iconX, iconY, iconWidth, iconHeight));
  parts.push(`<defs><clipPath id="${clipId}"><rect x="${textX}" y="${innerY}" width="${textWidth}" height="${innerHeight}" /></clipPath></defs>`);
  parts.push(`<g clip-path="url(#${clipId})">`);
  parts.push(`<text class="agent-card-header" x="${textX}" y="${row1Y}" font-size="${HEADER_FONT}">${escapeXml(header)}</text>`);
  parts.push(labeledRule("Title", input.card.title, textX, textRight, row2Y));
  parts.push(labeledRule("msg", input.card.message, textX, textRight, row3Y));
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
  const parts = [outerFrames(baseSize, baseSize, attention, actorCount, color)];
  parts.push(`<circle class="agent-card-semantic-dot" data-semantic-color="${color}" cx="54" cy="10" r="5" />`);
  parts.push(renderSprite(card, sprite, 10, 10 + stackOffset, 44, 44));
  return { svg: wrapGroup(parts.join(""), card.id, color, "far"), bounds: { w: size, h: size }, titleLines: [], messageLines: [] };
}

function renderMiddle(card: AgentCardData, requestedWidth: number, color: AgentSemanticColor, attention: boolean, actorCount: 1 | 2 | 3, sprite?: AgentCardSprite): AgentCardRenderOutput {
  const stackOffset = (actorCount - 1) * STACK_OFFSET;
  const cardWidth = Math.max(220, requestedWidth);
  const cardHeight = Math.round(cardWidth * .34);
  const width = cardWidth + stackOffset;
  const height = cardHeight + stackOffset;
  const state = card.lifecycleState || "";
  const parts = [outerFrames(cardWidth, cardHeight, attention, actorCount, color)];
  parts.push(`<rect class="agent-card-surface" x="8" y="${8 + stackOffset}" width="${cardWidth - 16}" height="${cardHeight - 16}" rx="14" />`);
  parts.push(`<circle class="agent-card-semantic-dot" data-semantic-color="${color}" cx="${cardWidth - 16}" cy="16" r="5" />`);
  parts.push(renderSprite(card, sprite, 18, 16 + stackOffset, Math.round(cardWidth * .18), cardHeight - 32));
  parts.push(`<text class="agent-card-middle-name" x="${Math.round(cardWidth * .25)}" y="${Math.round(cardHeight * .46) + stackOffset}">${escapeXml(card.name || "—")}</text>`);
  parts.push(`<text class="agent-card-middle-state" x="${Math.round(cardWidth * .25)}" y="${Math.round(cardHeight * .66) + stackOffset}">${escapeXml(state)}</text>`);
  return { svg: wrapGroup(parts.join(""), card.id, color, "middle"), bounds: { w: width, h: height }, titleLines: [], messageLines: [] };
}

function outerFrames(width: number, height: number, attention: boolean, actorCount: 1 | 2 | 3, color: AgentSemanticColor): string {
  const parts = [];
  for (let layer = actorCount - 1; layer >= 0; layer -= 1) {
    const offset = layer * STACK_OFFSET;
    parts.push(`<rect class="agent-card-outer${attention ? " agent-card-attention" : ""}" data-actor-layer="${layer + 1}" data-semantic-color="${color}" x="${offset + .75}" y="${(actorCount - 1) * STACK_OFFSET - offset + .75}" width="${width - 1.5}" height="${height - 1.5}" rx="20" />`);
  }
  return parts.join("");
}

function renderSprite(card: AgentCardData, sprite: AgentCardSprite | undefined, x: number, y: number, width: number, height: number): string {
  if (!sprite) {
    return `<rect class="agent-card-pet-placeholder" x="${x}" y="${y}" width="${width}" height="${height}" rx="12" /><text class="agent-card-pet-placeholder-text" x="${x + width / 2}" y="${y + height / 2 + 4}" text-anchor="middle">${escapeXml(card.icon)}</text>`;
  }
  const frameXValues = Array.from({ length: sprite.frames }, (_, index) => String(-index * sprite.frameWidth));
  const frameY = -sprite.row * sprite.frameHeight;
  const animation = sprite.animate && sprite.frames > 1
    ? `<animate attributeName="x" values="${frameXValues.join(";")}" dur="${sprite.frames / sprite.fps}s" calcMode="discrete" repeatCount="indefinite" />`
    : "";
  return `<svg class="agent-card-pet" data-pet-id="${escapeAttr(sprite.petId)}" data-grid-status="${sprite.gridStatus}" data-frame-count-status="${sprite.frameCountStatus}" x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 ${sprite.frameWidth} ${sprite.frameHeight}" preserveAspectRatio="xMidYMid meet" overflow="hidden"><image href="${escapeAttr(sprite.imageUrl)}" x="0" y="${frameY}" width="${sprite.sheetWidth}" height="${sprite.sheetHeight}" preserveAspectRatio="none">${animation}</image></svg>`;
}

function labeledRule(label: string, value: string, x: number, right: number, y: number): string {
  const ruleStart = x;
  return `<line class="agent-card-rule" x1="${ruleStart}" y1="${y + 3}" x2="${right}" y2="${y + 3}" /><text class="agent-card-field-value" x="${ruleStart + 5}" y="${y}" font-size="${BODY_FONT}">${escapeXml(value)}</text>`;
}

function metaRow(model: string, age: string, state: string, x: number, right: number, y: number): string {
  const width = right - x;
  return `<text class="agent-card-meta" x="${x}" y="${y}" font-size="${META_FONT}">${escapeXml(model)}</text><text class="agent-card-meta" x="${x + width * .58}" y="${y}" font-size="${META_FONT}" text-anchor="middle">${escapeXml(age)}</text><text class="agent-card-state" x="${right}" y="${y}" font-size="${META_FONT}" text-anchor="end">${escapeXml(state)}</text>`;
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
