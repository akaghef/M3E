import type { AppState, SavedMap, TreeNode } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function newMmNodeId(): string {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createMmNodeRecord(id: string, parentId: string | null, text = ""): TreeNode {
  return {
    id,
    parentId,
    children: [],
    nodeType: "text",
    text,
    collapsed: false,
    details: "",
    note: "",
    attributes: {},
    link: "",
  };
}

function richContentText(element: Element, type: string): string {
  const richNodes = Array.from(element.children).filter((child) => {
    return child.tagName === "richcontent" && (child.getAttribute("TYPE") || "").toUpperCase() === type;
  });
  return richNodes
    .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function applyMmAttribute(record: TreeNode, attribute: Element): void {
  const key = attribute.getAttribute("NAME");
  if (!key) {
    return;
  }

  // Freeplane TYPE is not represented in M3E state, so intentionally ignore it.
  record.attributes[key] = attribute.getAttribute("VALUE") || "";
}

function readMmAttributes(mmNode: Element, record: TreeNode): void {
  for (const child of Array.from(mmNode.children)) {
    const tagName = child.tagName.toLowerCase();
    if (tagName === "attribute") {
      applyMmAttribute(record, child);
      continue;
    }

    if (tagName === "attributes") {
      for (const attribute of Array.from(child.children)) {
        if (attribute.tagName.toLowerCase() === "attribute") {
          applyMmAttribute(record, attribute);
        }
      }
    }
    // `attribute_layout` is a sibling layout hint, not an attribute container.
  }
}

/**
 * Parse Freeplane/FreeMind .mm XML into an M3E SavedMap.
 * Direct-child attributes are canonical; the legacy wrapper remains readable.
 */
export function parseMmText(xmlText: string): SavedMap {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");
  const parserError = xml.querySelector("parsererror");
  if (parserError) {
    throw new Error("Invalid .mm XML");
  }

  const mapNode = xml.querySelector("map > node");
  if (!mapNode) {
    throw new Error("No root node found in .mm file");
  }

  const state: AppState = {
    rootId: "",
    nodes: {},
  };

  function convertNode(mmNode: Element, parentId: string | null = null): string {
    const id = newMmNodeId();
    const text =
      mmNode.getAttribute("TEXT") ||
      richContentText(mmNode, "NODE") ||
      "(empty)";
    const record = createMmNodeRecord(id, parentId, text);
    record.collapsed = (mmNode.getAttribute("FOLDED") || "").toLowerCase() === "true";
    record.link = mmNode.getAttribute("LINK") || "";
    record.details = richContentText(mmNode, "DETAILS");
    record.note = richContentText(mmNode, "NOTE");
    readMmAttributes(mmNode, record);

    state.nodes[id] = record;
    if (!state.rootId) {
      state.rootId = id;
    }

    Array.from(mmNode.children)
      .filter((child) => child.tagName.toLowerCase() === "node")
      .forEach((childNode) => {
        const childId = convertNode(childNode, id);
        record.children.push(childId);
      });

    return id;
  }

  convertNode(mapNode, null);

  return {
    version: 1,
    savedAt: nowIso(),
    state,
  };
}

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

function mmNodeToXml(node: TreeNode, state: AppState, indent: string): string {
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
      const xml = mmNodeToXml(child, state, indent + "  ");
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

  const body = mmNodeToXml(root, state, "  ");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<map version="freeplane 1.7.0">\n${body}\n</map>\n`;
}
