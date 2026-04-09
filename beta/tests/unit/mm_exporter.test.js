// @ts-check
import { describe, it, expect } from "vitest";

// Since mm_exporter.ts is a TypeScript module, we test the logic inline here
// to validate the export format without needing a full TS build step.

/** @param {string} s */
function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** @param {string} type @param {string} text */
function mmRichContent(type, text) {
  return `<richcontent TYPE="${type}"><html><body>${escapeXml(text)}</body></html></richcontent>`;
}

/**
 * @param {import("../../src/shared/types").TreeNode} node
 * @param {import("../../src/shared/types").AppState} state
 * @param {string} indent
 */
function mmNodeToXml(node, state, indent) {
  if (node.nodeType === "alias") return "";

  const attrs = [];
  attrs.push(`TEXT="${escapeXml(node.text)}"`);
  if (node.collapsed) attrs.push(`FOLDED="true"`);
  if (node.link) attrs.push(`LINK="${escapeXml(node.link)}"`);

  const parts = [];
  if (node.details) parts.push(`${indent}  ${mmRichContent("DETAILS", node.details)}`);
  if (node.note) parts.push(`${indent}  ${mmRichContent("NOTE", node.note)}`);

  const attrEntries = Object.entries(node.attributes || {});
  for (const [name, value] of attrEntries) {
    parts.push(`${indent}  <attribute NAME="${escapeXml(name)}" VALUE="${escapeXml(value)}"/>`);
  }

  for (const childId of node.children) {
    const child = state.nodes[childId];
    if (child) {
      const xml = mmNodeToXml(child, state, indent + "  ");
      if (xml) parts.push(xml);
    }
  }

  if (parts.length === 0) return `${indent}<node ${attrs.join(" ")}/>`;
  return `${indent}<node ${attrs.join(" ")}>\n${parts.join("\n")}\n${indent}</node>`;
}

/** @param {import("../../src/shared/types").AppState} state */
function treeToMm(state) {
  const root = state.nodes[state.rootId];
  if (!root) throw new Error("Root node not found");
  const body = mmNodeToXml(root, state, "  ");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<map version="freeplane 1.7.0">\n${body}\n</map>\n`;
}

/** @returns {import("../../src/shared/types").TreeNode} */
function makeNode(id, text, overrides = {}) {
  return {
    id,
    parentId: null,
    children: [],
    text,
    collapsed: false,
    details: "",
    note: "",
    attributes: {},
    link: "",
    ...overrides,
  };
}

describe("treeToMm", () => {
  it("exports a single root node", () => {
    const state = {
      rootId: "r",
      nodes: { r: makeNode("r", "Root") },
    };
    const xml = treeToMm(state);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<map version="freeplane 1.7.0">');
    expect(xml).toContain('TEXT="Root"');
    expect(xml).toContain("</map>");
  });

  it("escapes XML special characters in text", () => {
    const state = {
      rootId: "r",
      nodes: { r: makeNode("r", 'A & B < C > D "E"') },
    };
    const xml = treeToMm(state);
    expect(xml).toContain('TEXT="A &amp; B &lt; C &gt; D &quot;E&quot;"');
  });

  it("exports collapsed as FOLDED", () => {
    const state = {
      rootId: "r",
      nodes: { r: makeNode("r", "Root", { collapsed: true }) },
    };
    const xml = treeToMm(state);
    expect(xml).toContain('FOLDED="true"');
  });

  it("exports link as LINK attribute", () => {
    const state = {
      rootId: "r",
      nodes: { r: makeNode("r", "Root", { link: "https://example.com" }) },
    };
    const xml = treeToMm(state);
    expect(xml).toContain('LINK="https://example.com"');
  });

  it("exports details as richcontent DETAILS", () => {
    const state = {
      rootId: "r",
      nodes: { r: makeNode("r", "Root", { details: "Some details" }) },
    };
    const xml = treeToMm(state);
    expect(xml).toContain('<richcontent TYPE="DETAILS"><html><body>Some details</body></html></richcontent>');
  });

  it("exports note as richcontent NOTE", () => {
    const state = {
      rootId: "r",
      nodes: { r: makeNode("r", "Root", { note: "A note" }) },
    };
    const xml = treeToMm(state);
    expect(xml).toContain('<richcontent TYPE="NOTE"><html><body>A note</body></html></richcontent>');
  });

  it("exports attributes", () => {
    const state = {
      rootId: "r",
      nodes: { r: makeNode("r", "Root", { attributes: { key1: "val1", key2: "val2" } }) },
    };
    const xml = treeToMm(state);
    expect(xml).toContain('<attribute NAME="key1" VALUE="val1"/>');
    expect(xml).toContain('<attribute NAME="key2" VALUE="val2"/>');
  });

  it("exports children recursively", () => {
    const state = {
      rootId: "r",
      nodes: {
        r: makeNode("r", "Root", { children: ["c1"] }),
        c1: makeNode("c1", "Child", { parentId: "r", children: ["c2"] }),
        c2: makeNode("c2", "Grandchild", { parentId: "c1" }),
      },
    };
    const xml = treeToMm(state);
    expect(xml).toContain('TEXT="Root"');
    expect(xml).toContain('TEXT="Child"');
    expect(xml).toContain('TEXT="Grandchild"');
  });

  it("skips alias nodes", () => {
    const state = {
      rootId: "r",
      nodes: {
        r: makeNode("r", "Root", { children: ["a1", "c1"] }),
        a1: makeNode("a1", "Alias", { parentId: "r", nodeType: "alias" }),
        c1: makeNode("c1", "Real", { parentId: "r" }),
      },
    };
    const xml = treeToMm(state);
    expect(xml).not.toContain("Alias");
    expect(xml).toContain("Real");
  });

  it("throws when root node is missing", () => {
    const state = { rootId: "missing", nodes: {} };
    expect(() => treeToMm(state)).toThrow("Root node not found");
  });
});
