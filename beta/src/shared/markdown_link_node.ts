export const MARKDOWN_LINK_NODE_SUBTYPE_ATTR = "m3e:subtype";
export const MARKDOWN_LINK_NODE_SUBTYPE_VALUE = "hyperlink";

export interface MarkdownLinkNodeFields {
  text: string;
  link?: string;
  attributes?: Record<string, string>;
}

export interface ParsedMarkdownLinkNodeInput {
  text: string;
  link: string;
  isMarkdownLink: boolean;
}

export interface AppliedMarkdownLinkNodeInput extends ParsedMarkdownLinkNodeInput {
  attributes: Record<string, string>;
}

const SAFE_EXTERNAL_LINK_PROTOCOLS = new Set(["http:", "https:", "obsidian:"]);

export function parseMarkdownLinkNodeInput(raw: string): ParsedMarkdownLinkNodeInput {
  const input = String(raw || "").trim();
  const match = /^\[([^\]\n]+)\]\(([^()\s]+)\)$/.exec(input);
  if (!match) {
    return { text: input, link: "", isMarkdownLink: false };
  }
  return {
    text: match[1].trim(),
    link: match[2].trim(),
    isMarkdownLink: true,
  };
}

export function formatMarkdownLinkNodeInput(node: MarkdownLinkNodeFields): string {
  const text = String(node.text || "").trim();
  const link = String(node.link || "").trim();
  if (!link) {
    return text;
  }
  return `[${text}](${link})`;
}

export function isMarkdownLinkSubtype(attributes: Record<string, string> | undefined): boolean {
  return (attributes?.[MARKDOWN_LINK_NODE_SUBTYPE_ATTR] || "").trim() === MARKDOWN_LINK_NODE_SUBTYPE_VALUE;
}

export function editInputForMarkdownLinkNode(node: MarkdownLinkNodeFields): string {
  return formatMarkdownLinkNodeInput(node);
}

export function applyMarkdownLinkNodeInput(
  current: MarkdownLinkNodeFields,
  raw: string,
): AppliedMarkdownLinkNodeInput {
  const parsed = parseMarkdownLinkNodeInput(raw);
  const attributes = { ...(current.attributes || {}) };
  if (parsed.isMarkdownLink) {
    attributes[MARKDOWN_LINK_NODE_SUBTYPE_ATTR] = MARKDOWN_LINK_NODE_SUBTYPE_VALUE;
    return { ...parsed, attributes };
  }

  if (String(current.link || "").trim() || isMarkdownLinkSubtype(attributes)) {
    delete attributes[MARKDOWN_LINK_NODE_SUBTYPE_ATTR];
    return { ...parsed, link: "", attributes };
  }

  return { ...parsed, link: String(current.link || ""), attributes };
}

export function safeExternalLinkToOpen(raw: string | null | undefined): string | null {
  const input = String(raw || "").trim();
  if (!input) {
    return null;
  }
  try {
    const url = new URL(input);
    return SAFE_EXTERNAL_LINK_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
