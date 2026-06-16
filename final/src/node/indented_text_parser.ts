"use strict";

import type { AppState, TreeNode } from "../shared/types";

function normalizeNodeText(raw: string): string {
  const heading = raw.match(/^(#{1,6})\s+(.+)$/);
  if (heading) {
    return heading[2]!.trim();
  }
  return raw.replace(/^[-*+]\s+/, "").trim();
}

function lineDepth(rawLine: string): number {
  const trimmed = rawLine.trimStart();
  const heading = trimmed.match(/^(#{1,6})\s+/);
  if (heading) {
    return Math.max(0, heading[1]!.length - 1);
  }
  const leadingSpaces = rawLine.length - trimmed.length;
  return Math.max(0, Math.floor(leadingSpaces / 2));
}

export function parseIndentedTextToNodes(
  text: string,
  parentNodeId: string,
  generateId: () => string,
): TreeNode[] {
  const lines = text.split(/\r?\n/);
  const stack: Array<{ depth: number; node: TreeNode }> = [];
  const nodes: TreeNode[] = [];
  let lastNode: TreeNode | null = null;

  for (const rawLine of lines) {
    if (!rawLine.trim()) {
      continue;
    }

    const trimmed = rawLine.trim();
    if (/^details:\s*/i.test(trimmed)) {
      if (lastNode) {
        const detailText = trimmed.replace(/^details:\s*/i, "");
        lastNode.details = lastNode.details ? `${lastNode.details}\n${detailText}` : detailText;
      }
      continue;
    }

    const depth = lineDepth(rawLine);
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= depth) {
      stack.pop();
    }

    const parent = stack.length > 0 ? stack[stack.length - 1]!.node : null;
    const node: TreeNode = {
      id: generateId(),
      parentId: parent ? parent.id : parentNodeId,
      children: [],
      nodeType: "text",
      text: normalizeNodeText(trimmed),
      collapsed: false,
      details: "",
      note: "",
      attributes: {},
      link: "",
    };

    if (parent) {
      parent.children.push(node.id);
    }

    nodes.push(node);
    stack.push({ depth, node });
    lastNode = node;
  }

  return nodes;
}

function appendOutlineLines(
  state: AppState,
  nodeId: string,
  depth: number,
  lines: string[],
): void {
  const node = state.nodes[nodeId];
  if (!node || node.nodeType === "alias") {
    return;
  }
  lines.push(`${"  ".repeat(depth)}- ${node.text}`);
  if (node.details.trim()) {
    node.details.split(/\r?\n/).forEach((line) => {
      const detailLine = line.trim();
      if (!detailLine) {
        return;
      }
      lines.push(`${"  ".repeat(depth + 1)}details: ${detailLine}`);
    });
  }
  node.children.forEach((childId) => appendOutlineLines(state, childId, depth + 1, lines));
}

export function buildSubtreeOutline(state: AppState, parentNodeId: string): string {
  const parent = state.nodes[parentNodeId];
  if (!parent) {
    return "";
  }
  const lines: string[] = [];
  parent.children.forEach((childId) => appendOutlineLines(state, childId, 0, lines));
  return lines.join("\n").trim();
}
