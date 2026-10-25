// @vitest-environment jsdom
// @ts-check
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseMmText, treeToMm } from "../../src/shared/mm_exporter";

const realFreeplaneFixture = readFileSync(
  "tests/fixtures/freeplane-attributes.mm",
  "utf8"
);

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

describe(".mm I/O", () => {
  it("preserves the current exporter bytes", () => {
    const state = {
      rootId: "r",
      nodes: {
        r: makeNode("r", 'Root & < > " 日本語', {
          collapsed: true,
          details: "詳細 & <details>",
          note: '注記 "引用"',
          link: "https://example.com?a=1&b=2",
          attributes: {
            "key&": '値 < & "',
            empty: "",
          },
          children: ["c", "alias"],
        }),
        c: makeNode("c", "子", { parentId: "r" }),
        alias: makeNode("alias", "Alias", { parentId: "r", nodeType: "alias" }),
      },
    };

    expect(treeToMm(state)).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<map version="freeplane 1.7.0">\n' +
      '  <node TEXT="Root &amp; &lt; &gt; &quot; 日本語" FOLDED="true" LINK="https://example.com?a=1&amp;b=2">\n' +
      '    <richcontent TYPE="DETAILS"><html><body>詳細 &amp; &lt;details&gt;</body></html></richcontent>\n' +
      '    <richcontent TYPE="NOTE"><html><body>注記 &quot;引用&quot;</body></html></richcontent>\n' +
      '    <attribute NAME="key&amp;" VALUE="値 &lt; &amp; &quot;"/>\n' +
      '    <attribute NAME="empty" VALUE=""/>\n' +
      '    <node TEXT="子"/>\n' +
      '  </node>\n' +
      '</map>\n'
    );
  });

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
    expect(treeToMm(state)).toContain('FOLDED="true"');
  });

  it("exports link as LINK attribute", () => {
    const state = {
      rootId: "r",
      nodes: { r: makeNode("r", "Root", { link: "https://example.com" }) },
    };
    expect(treeToMm(state)).toContain('LINK="https://example.com"');
  });

  it("exports details as richcontent DETAILS", () => {
    const state = {
      rootId: "r",
      nodes: { r: makeNode("r", "Root", { details: "Some details" }) },
    };
    expect(treeToMm(state)).toContain(
      '<richcontent TYPE="DETAILS"><html><body>Some details</body></html></richcontent>'
    );
  });

  it("exports note as richcontent NOTE", () => {
    const state = {
      rootId: "r",
      nodes: { r: makeNode("r", "Root", { note: "A note" }) },
    };
    expect(treeToMm(state)).toContain(
      '<richcontent TYPE="NOTE"><html><body>A note</body></html></richcontent>'
    );
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

  it("round-trips attributes with XML-sensitive, Japanese, and empty values", () => {
    const attributes = {
      ampersand: "A & B",
      lessThan: "<value>",
      greaterThan: ">",
      doubleQuote: '"quoted"',
      apostrophe: "'quoted'",
      japanese: "日本語の属性値",
      empty: "",
    };
    const state = {
      rootId: "r",
      nodes: {
        r: makeNode("r", "ルート", { attributes, children: ["c"] }),
        c: makeNode("c", "子", {
          parentId: "r",
          attributes: { "子キー": "子の値 & < > \" '" },
        }),
      },
    };

    const imported = parseMmText(treeToMm(state));
    const importedRoot = imported.state.nodes[imported.state.rootId];
    const importedChild = imported.state.nodes[importedRoot.children[0]];
    expect(importedRoot.attributes).toEqual(attributes);
    expect(importedRoot.text).toBe("ルート");
    expect(importedChild.attributes).toEqual({ "子キー": "子の値 & < > \" '" });
  });

  it("imports direct-child attributes from a real Freeplane-shaped fixture", () => {
    const imported = parseMmText(realFreeplaneFixture);
    const root = imported.state.nodes[imported.state.rootId];

    expect(root.attributes).toEqual({ Name: "John", email: "john@gmail.com" });
    expect(root.children).toHaveLength(1);
    expect(imported.state.nodes[root.children[0]].text).toBe("子ノード");
  });

  it("keeps importing the legacy attributes wrapper", () => {
    const imported = parseMmText(`
      <map version="freeplane 1.7.0">
        <node TEXT="Legacy">
          <attributes>
            <attribute NAME="owner" VALUE="Akaghef"/>
            <attribute NAME="empty" VALUE=""/>
          </attributes>
        </node>
      </map>
    `);
    const root = imported.state.nodes[imported.state.rootId];

    expect(root.attributes).toEqual({ owner: "Akaghef", empty: "" });
  });

  it("processes direct attributes in document order and lets later duplicates win", () => {
    const imported = parseMmText(`
      <map version="freeplane 1.7.0">
        <node TEXT="Ordered">
          <attribute NAME="first" VALUE="1"/>
          <attribute NAME="duplicate" VALUE="early"/>
          <attribute_layout NAME_WIDTH="34" VALUE_WIDTH="92"/>
          <attribute NAME="second" VALUE="2"/>
          <attribute NAME="duplicate" VALUE="late"/>
        </node>
      </map>
    `);
    const root = imported.state.nodes[imported.state.rootId];

    expect(Object.keys(root.attributes)).toEqual(["first", "duplicate", "second"]);
    expect(root.attributes.duplicate).toBe("late");
  });
});
