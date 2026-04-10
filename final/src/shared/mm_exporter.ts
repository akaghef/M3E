import type { AppState, TreeNode } from "./types";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function richContent(type: string, text: string): string {
  const escaped = escapeXml(text);
  return `<richcontent TYPE="${type}"><html><body>${escaped}</body></html></richcontent>`;
}

function nodeToXml(node: TreeNode, state: AppState, indent: string): string {
  // Skip alias nodes
  if (node.nodeType === "alias") {
    return "";
  }

  const attrs: string[] = [];
  attrs.push(`TEXT="${escapeXml(node.text)}"`);
  if (node.collapsed) {
    attrs.push(`FOLDED="true"`);
  }
  if (node.link) {
    attrs.push(`LINK="${escapeXml(node.link)}"`);
  }

  const childParts: string[] = [];

  if (node.details) {
    childParts.push(`${indent}  ${richContent("DETAILS", node.details)}`);
  }
  if (node.note) {
    childParts.push(`${indent}  ${richContent("NOTE", node.note)}`);
  }

  const attrEntries = Object.entries(node.attributes || {});
  for (const [name, value] of attrEntries) {
    childParts.push(
      `${indent}  <attribute NAME="${escapeXml(name)}" VALUE="${escapeXml(value)}"/>`
    );
  }

  for (const childId of node.children) {
    const child = state.nodes[childId];
    if (child) {
      const xml = nodeToXml(child, state, indent + "  ");
      if (xml) {
        childParts.push(xml);
      }
    }
  }

  if (childParts.length === 0) {
    return `${indent}<node ${attrs.join(" ")}/>`;
  }

  return `${indent}<node ${attrs.join(" ")}>\n${childParts.join("\n")}\n${indent}</node>`;
}

/**
 * Convert an AppState tree to Freeplane/FreeMind .mm XML string.
 * GraphLinks and alias nodes are skipped in this initial implementation.
 */
export function treeToMm(state: AppState): string {
  const root = state.nodes[state.rootId];
  if (!root) {
    throw new Error("Root node not found");
  }

  const body = nodeToXml(root, state, "  ");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<map version="freeplane 1.7.0">\n${body}\n</map>\n`;
}
