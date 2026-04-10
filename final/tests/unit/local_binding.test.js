import { test, expect } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  parseFrontmatter,
  parseSimpleYaml,
  extractWikilinks,
  parseMdContent,
  parseFolderMd,
} = require("../../dist/node/md_reader.js");

const {
  serializeToMd,
  serializeFolderMd,
} = require("../../dist/node/md_writer.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "m3e-test-"));
}

function writeMd(dir, filename, content) {
  const fp = path.join(dir, filename);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content, "utf-8");
  return fp;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// =========================================================================
// Phase 0: md_reader tests
// =========================================================================

test("parseFrontmatter: extracts m3e metadata from frontmatter", () => {
  const md = `---
m3e:
  nodeId: "n_1234_abc"
  nodeType: folder
  collapsed: false
  children-order:
    - n_child1
    - n_child2
tags:
  - hypothesis
  - biology
aliases:
  - "Hypothesis A"
---

# Hypothesis A

Some body text.
`;

  const { frontmatter, body } = parseFrontmatter(md);

  expect(frontmatter.m3e.nodeId).toBe("n_1234_abc");
  expect(frontmatter.m3e.nodeType).toBe("folder");
  expect(frontmatter.m3e.collapsed).toBe(false);
  expect(frontmatter.m3e["children-order"]).toEqual(["n_child1", "n_child2"]);
  expect(frontmatter.tags).toEqual(["hypothesis", "biology"]);
  expect(frontmatter.aliases).toEqual(["Hypothesis A"]);
  expect(body.includes("# Hypothesis A")).toBe(true);
  expect(body.includes("Some body text.")).toBe(true);
});

test("parseFrontmatter: returns empty frontmatter when no delimiters", () => {
  const md = "# Just a heading\n\nSome text.";
  const { frontmatter, body } = parseFrontmatter(md);

  expect(frontmatter).toEqual({});
  expect(body.includes("# Just a heading")).toBe(true);
});

test("parseFrontmatter: handles empty frontmatter block", () => {
  const md = `---
---

# Title
`;
  const { frontmatter, body } = parseFrontmatter(md);

  expect(frontmatter).toEqual({});
  expect(body.includes("# Title")).toBe(true);
});

test("parseSimpleYaml: parses scalar values", () => {
  const yaml = `name: test
count: 42
active: true
disabled: false`;

  const result = parseSimpleYaml(yaml);

  expect(result.name).toBe("test");
  expect(result.count).toBe(42);
  expect(result.active).toBe(true);
  expect(result.disabled).toBe(false);
});

test("parseSimpleYaml: parses quoted strings", () => {
  const yaml = `single: 'hello world'
double: "goodbye world"`;

  const result = parseSimpleYaml(yaml);
  expect(result.single).toBe("hello world");
  expect(result.double).toBe("goodbye world");
});

test("parseSimpleYaml: parses nested objects (m3e block)", () => {
  const yaml = `m3e:
  nodeId: n_123
  nodeType: folder
  collapsed: true`;

  const result = parseSimpleYaml(yaml);
  expect(result.m3e.nodeId).toBe("n_123");
  expect(result.m3e.nodeType).toBe("folder");
  expect(result.m3e.collapsed).toBe(true);
});

test("parseSimpleYaml: parses arrays", () => {
  const yaml = `tags:
  - alpha
  - beta
  - gamma`;

  const result = parseSimpleYaml(yaml);
  expect(result.tags).toEqual(["alpha", "beta", "gamma"]);
});

test("extractWikilinks: extracts simple wikilinks", () => {
  const body = `Some text with [[target-note]] and more.
And [[another|Custom Label]] here.`;

  const refs = extractWikilinks(body);
  expect(refs.length).toBe(2);

  expect(refs[0].target).toBe("target-note");
  expect(refs[0].label).toBeUndefined();
  expect(refs[0].embedded).toBe(false);

  expect(refs[1].target).toBe("another");
  expect(refs[1].label).toBe("Custom Label");
  expect(refs[1].embedded).toBe(false);
});

test("extractWikilinks: detects embedded wikilinks", () => {
  const body = "Check ![[embedded-note]] for details.";
  const refs = extractWikilinks(body);

  expect(refs.length).toBe(1);
  expect(refs[0].target).toBe("embedded-note");
  expect(refs[0].embedded).toBe(true);
});

test("extractWikilinks: returns empty for no links", () => {
  const refs = extractWikilinks("Just plain text, no links.");
  expect(refs.length).toBe(0);
});

test("parseMdContent: full .md parsing", () => {
  const md = `---
m3e:
  nodeId: n_test_1
  nodeType: text
  collapsed: false
  note: internal memo
  link: "https://example.com"
tags:
  - research
aliases:
  - "Alias Name"
---

# My Node Title

Body paragraph one.

Body paragraph two with [[some-ref]].

- [[another-ref|Label]]
`;

  const result = parseMdContent(md, { id: "fallback_id", text: "fallback" });

  expect(result.node.id).toBe("n_test_1");
  expect(result.node.text).toBe("My Node Title");
  expect(result.node.nodeType).toBe("text");
  expect(result.node.collapsed).toBe(false);
  expect(result.node.note).toBe("internal memo");
  expect(result.node.link).toBe("https://example.com");
  expect(result.node.attributes.tags).toBe("research");
  expect(result.node.attributes.aliases).toBe("Alias Name");

  // Wikilinks
  expect(result.wikilinks.length).toBe(2);
  expect(result.wikilinks[0].target).toBe("some-ref");
  expect(result.wikilinks[1].target).toBe("another-ref");
  expect(result.wikilinks[1].label).toBe("Label");
});

test("parseMdContent: uses defaults when no frontmatter", () => {
  const md = "Just plain text, no frontmatter or heading.";
  const result = parseMdContent(md, { id: "default_id", text: "default text" });

  expect(result.node.id).toBe("default_id");
  expect(result.node.text).toBe("default text");
  expect(result.node.nodeType).toBe("text");
});

test("parseMdContent: uses heading as text over default", () => {
  const md = "# Heading Override\n\nSome body.";
  const result = parseMdContent(md, { id: "id1", text: "fallback" });

  expect(result.node.text).toBe("Heading Override");
});

test("parseFolderMd: parses _folder.md with children-order", () => {
  const md = `---
m3e:
  nodeId: n_folder_a
  nodeType: folder
  children-order:
    - note-1
    - note-2
    - note-3
---

Folder A description text
`;

  const result = parseFolderMd(md, { id: "fallback", text: "Folder A" });

  expect(result.node.id).toBe("n_folder_a");
  expect(result.node.nodeType).toBe("folder");
  expect(result.childrenOrder).toEqual(["note-1", "note-2", "note-3"]);
});

test("parseFolderMd: returns empty children-order when not specified", () => {
  const md = `---
m3e:
  nodeId: n_folder_b
---

Simple folder
`;

  const result = parseFolderMd(md, { id: "fb", text: "Folder B" });
  expect(result.childrenOrder).toEqual([]);
  expect(result.node.nodeType).toBe("folder");
});

// =========================================================================
// Phase 0: md_writer tests
// =========================================================================

test("serializeToMd: generates frontmatter with m3e metadata", () => {
  const node = {
    id: "n_write_1",
    text: "Test Node",
    nodeType: "folder",
    collapsed: true,
    details: "",
    note: "a note",
    link: "https://example.com",
    attributes: { tags: "alpha,beta" },
  };

  const md = serializeToMd(node, { childrenOrder: ["c1", "c2"] });

  expect(md.includes("---")).toBe(true);
  expect(md.includes("nodeId: n_write_1")).toBe(true);
  expect(md.includes("nodeType: folder")).toBe(true);
  expect(md.includes("collapsed: true")).toBe(true);
  expect(md.includes("note: a note")).toBe(true);
  expect(md.includes("link:")).toBe(true);
  expect(md.includes("# Test Node")).toBe(true);
  expect(md.includes("- c1")).toBe(true);
  expect(md.includes("- c2")).toBe(true);
  expect(md.includes("- alpha")).toBe(true);
  expect(md.includes("- beta")).toBe(true);
});

test("serializeToMd: omits empty frontmatter", () => {
  const node = {
    id: "n_simple",
    text: "Simple",
    collapsed: false,
    details: "",
    note: "",
    link: "",
    attributes: {},
  };

  const md = serializeToMd(node);

  expect(md.includes("# Simple")).toBe(true);
});

test("serializeToMd: includes body details", () => {
  const node = {
    id: "n_body",
    text: "With Body",
    collapsed: false,
    details: "Paragraph one.\n\nParagraph two.",
    note: "",
    link: "",
    attributes: {},
  };

  const md = serializeToMd(node);

  expect(md.includes("# With Body")).toBe(true);
  expect(md.includes("Paragraph one.")).toBe(true);
  expect(md.includes("Paragraph two.")).toBe(true);
});

test("serializeToMd: includes wikilinks section", () => {
  const node = {
    id: "n_links",
    text: "Links Node",
    collapsed: false,
    details: "",
    note: "",
    link: "",
    attributes: {},
  };

  const wikilinks = [
    { target: "target-a" },
    { target: "target-b", label: "Label B" },
    { target: "embed-c", embedded: true },
  ];

  const md = serializeToMd(node, { wikilinks });

  expect(md.includes("## Related")).toBe(true);
  expect(md.includes("- [[target-a]]")).toBe(true);
  expect(md.includes("- [[target-b|Label B]]")).toBe(true);
  expect(md.includes("- ![[embed-c]]")).toBe(true);
});

test("serializeFolderMd: generates _folder.md content", () => {
  const node = {
    id: "n_folder_x",
    text: "My Folder",
    collapsed: false,
    details: "Folder description",
    note: "",
    link: "",
    attributes: {},
  };

  const md = serializeFolderMd(node, ["child-1", "child-2"]);

  expect(md.includes("nodeType: folder")).toBe(true);
  expect(md.includes("- child-1")).toBe(true);
  expect(md.includes("- child-2")).toBe(true);
  expect(md.includes("# My Folder")).toBe(true);
  expect(md.includes("Folder description")).toBe(true);
});

// =========================================================================
// Phase 0: Round-trip tests (read -> write -> read)
// =========================================================================

test("round-trip: write then read produces same node data", () => {
  const original = {
    id: "n_roundtrip_1",
    text: "Round Trip Test",
    nodeType: "text",
    collapsed: false,
    details: "Some details here.",
    note: "internal note",
    link: "https://example.com",
    attributes: { tags: "a,b", aliases: "Alias1" },
  };

  const md = serializeToMd(original);
  const parsed = parseMdContent(md, { id: "unused", text: "unused" });

  expect(parsed.node.id).toBe(original.id);
  expect(parsed.node.text).toBe(original.text);
  expect(parsed.node.collapsed).toBe(original.collapsed);
  expect(parsed.node.note).toBe(original.note);
  expect(parsed.node.link).toBe(original.link);
  expect(parsed.node.attributes.tags).toBe(original.attributes.tags);
  expect(parsed.node.attributes.aliases).toBe(original.attributes.aliases);
});

test("round-trip: folder write then read preserves children-order", () => {
  const node = {
    id: "n_folder_rt",
    text: "Folder RT",
    collapsed: false,
    details: "",
    note: "",
    link: "",
    attributes: {},
  };

  const order = ["child-a", "child-b", "child-c"];
  const md = serializeFolderMd(node, order);
  const parsed = parseFolderMd(md, { id: "unused", text: "unused" });

  expect(parsed.node.id).toBe("n_folder_rt");
  expect(parsed.node.nodeType).toBe("folder");
  expect(parsed.childrenOrder).toEqual(order);
});

test("round-trip: wikilinks survive write then read", () => {
  const node = {
    id: "n_wl_rt",
    text: "Wikilink RT",
    collapsed: false,
    details: "",
    note: "",
    link: "",
    attributes: {},
  };

  const wikilinks = [
    { target: "note-a" },
    { target: "note-b", label: "Custom" },
    { target: "note-c", embedded: true },
  ];

  const md = serializeToMd(node, { wikilinks });
  const parsed = parseMdContent(md, { id: "unused", text: "unused" });

  expect(parsed.wikilinks.length).toBe(3);
  expect(parsed.wikilinks[0].target).toBe("note-a");
  expect(parsed.wikilinks[0].embedded).toBe(false);
  expect(parsed.wikilinks[1].target).toBe("note-b");
  expect(parsed.wikilinks[1].label).toBe("Custom");
  expect(parsed.wikilinks[2].target).toBe("note-c");
  expect(parsed.wikilinks[2].embedded).toBe(true);
});

// =========================================================================
// Phase 1: Folder structure -> Tree structure
// =========================================================================

function buildTreeFromFolder(rootDir) {
  const nodes = {};
  const rootResult = readFolderNode(rootDir, null, nodes);
  return { rootId: rootResult.id, nodes };
}

function readFolderNode(dirPath, parentId, nodes) {
  const folderMdPath = path.join(dirPath, "_folder.md");
  const dirName = path.basename(dirPath);
  let folderNode;
  let childrenOrder = [];

  if (fs.existsSync(folderMdPath)) {
    const content = fs.readFileSync(folderMdPath, "utf-8");
    const parsed = parseFolderMd(content, {
      id: `folder_${dirName}`,
      text: dirName,
    });
    folderNode = {
      ...parsed.node,
      parentId,
      children: [],
    };
    childrenOrder = parsed.childrenOrder;
  } else {
    folderNode = {
      id: `folder_${dirName}`,
      text: dirName,
      nodeType: "folder",
      parentId,
      children: [],
      collapsed: false,
      details: "",
      note: "",
      attributes: {},
      link: "",
    };
  }

  nodes[folderNode.id] = folderNode;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const mdFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== "_folder.md")
    .map((e) => e.name);
  const subDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  const allChildNames = [
    ...mdFiles.map((f) => f.replace(/\.md$/, "")),
    ...subDirs,
  ];

  let orderedNames;
  if (childrenOrder.length > 0) {
    const remaining = allChildNames.filter((n) => !childrenOrder.includes(n));
    remaining.sort();
    orderedNames = [...childrenOrder.filter((n) => allChildNames.includes(n)), ...remaining];
  } else {
    orderedNames = [...allChildNames].sort();
  }

  for (const name of orderedNames) {
    const mdPath = path.join(dirPath, name + ".md");
    const subDirPath = path.join(dirPath, name);

    if (fs.existsSync(mdPath) && fs.statSync(mdPath).isFile()) {
      const content = fs.readFileSync(mdPath, "utf-8");
      const parsed = parseMdContent(content, { id: `file_${name}`, text: name });
      const childNode = {
        ...parsed.node,
        parentId: folderNode.id,
        children: [],
      };
      nodes[childNode.id] = childNode;
      folderNode.children.push(childNode.id);
    } else if (fs.existsSync(subDirPath) && fs.statSync(subDirPath).isDirectory()) {
      const subNode = readFolderNode(subDirPath, folderNode.id, nodes);
      folderNode.children.push(subNode.id);
    }
  }

  return folderNode;
}

test("folder->tree: flat folder with .md files", () => {
  const dir = tmpDir();
  try {
    writeMd(dir, "alpha.md", "---\nm3e:\n  nodeId: n_alpha\n---\n\n# Alpha\n\nAlpha body.");
    writeMd(dir, "beta.md", "---\nm3e:\n  nodeId: n_beta\n---\n\n# Beta\n\nBeta body.");

    const tree = buildTreeFromFolder(dir);

    const root = tree.nodes[tree.rootId];
    expect(root.nodeType).toBe("folder");
    expect(root.children.length).toBe(2);

    const child0 = tree.nodes[root.children[0]];
    const child1 = tree.nodes[root.children[1]];
    expect(child0.id).toBe("n_alpha");
    expect(child1.id).toBe("n_beta");
    expect(child0.parentId).toBe(root.id);
  } finally {
    cleanup(dir);
  }
});

test("folder->tree: _folder.md children-order is respected", () => {
  const dir = tmpDir();
  try {
    writeMd(dir, "_folder.md", `---
m3e:
  nodeId: n_root
  nodeType: folder
  children-order:
    - beta
    - alpha
---

Root folder
`);
    writeMd(dir, "alpha.md", "---\nm3e:\n  nodeId: n_alpha\n---\n\n# Alpha");
    writeMd(dir, "beta.md", "---\nm3e:\n  nodeId: n_beta\n---\n\n# Beta");

    const tree = buildTreeFromFolder(dir);
    const root = tree.nodes[tree.rootId];

    expect(root.id).toBe("n_root");
    expect(root.children.length).toBe(2);
    expect(tree.nodes[root.children[0]].id).toBe("n_beta");
    expect(tree.nodes[root.children[1]].id).toBe("n_alpha");
  } finally {
    cleanup(dir);
  }
});

test("folder->tree: fallback to alphabetical when no _folder.md", () => {
  const dir = tmpDir();
  try {
    writeMd(dir, "zebra.md", "---\nm3e:\n  nodeId: n_z\n---\n\n# Zebra");
    writeMd(dir, "apple.md", "---\nm3e:\n  nodeId: n_a\n---\n\n# Apple");
    writeMd(dir, "mango.md", "---\nm3e:\n  nodeId: n_m\n---\n\n# Mango");

    const tree = buildTreeFromFolder(dir);
    const root = tree.nodes[tree.rootId];

    expect(root.children.length).toBe(3);
    expect(tree.nodes[root.children[0]].id).toBe("n_a");
    expect(tree.nodes[root.children[1]].id).toBe("n_m");
    expect(tree.nodes[root.children[2]].id).toBe("n_z");
  } finally {
    cleanup(dir);
  }
});

test("folder->tree: nested folders become nested tree nodes", () => {
  const dir = tmpDir();
  try {
    writeMd(dir, "top.md", "---\nm3e:\n  nodeId: n_top\n---\n\n# Top");

    const subDir = path.join(dir, "subfolder");
    fs.mkdirSync(subDir);
    writeMd(subDir, "_folder.md", "---\nm3e:\n  nodeId: n_sub\n  nodeType: folder\n---\n\n# Sub");
    writeMd(subDir, "deep.md", "---\nm3e:\n  nodeId: n_deep\n---\n\n# Deep Node");

    const tree = buildTreeFromFolder(dir);
    const root = tree.nodes[tree.rootId];

    expect(root.children.length).toBe(2);

    const subNode = tree.nodes["n_sub"];
    expect(subNode).toBeTruthy();
    expect(subNode.nodeType).toBe("folder");
    expect(subNode.parentId).toBe(root.id);
    expect(subNode.children.length).toBe(1);

    const deepNode = tree.nodes["n_deep"];
    expect(deepNode).toBeTruthy();
    expect(deepNode.parentId).toBe("n_sub");
  } finally {
    cleanup(dir);
  }
});

// =========================================================================
// Phase 1: Cache consistency (mtime-based)
// =========================================================================

test("cache: mtime comparison detects stale cache", () => {
  const dir = tmpDir();
  try {
    const fp = writeMd(dir, "test.md", "---\nm3e:\n  nodeId: n_cache\n---\n\n# Cache Test");

    const stat1 = fs.statSync(fp);
    const cachedMtime = stat1.mtimeMs;

    fs.writeFileSync(fp, "---\nm3e:\n  nodeId: n_cache\n---\n\n# Cache Test Updated", "utf-8");
    const stat2 = fs.statSync(fp);

    const currentMtime = stat2.mtimeMs;

    const isStale =
      currentMtime > cachedMtime || stat2.size !== stat1.size;
    expect(isStale).toBe(true);
  } finally {
    cleanup(dir);
  }
});

test("cache: read -> write-to-cache -> re-read produces consistent data", () => {
  const dir = tmpDir();
  try {
    const md = `---
m3e:
  nodeId: n_cache_rt
  nodeType: text
tags:
  - test
---

# Cache Round Trip

Body text for cache test.
`;
    writeMd(dir, "cache_test.md", md);

    const read1 = parseMdContent(
      fs.readFileSync(path.join(dir, "cache_test.md"), "utf-8"),
      { id: "fallback", text: "fallback" }
    );

    const cached = JSON.parse(JSON.stringify(read1.node));

    const read2 = parseMdContent(
      fs.readFileSync(path.join(dir, "cache_test.md"), "utf-8"),
      { id: "fallback", text: "fallback" }
    );

    expect(cached.id).toBe(read2.node.id);
    expect(cached.text).toBe(read2.node.text);
    expect(cached.nodeType).toBe(read2.node.nodeType);
    expect(cached.attributes).toEqual(read2.node.attributes);
  } finally {
    cleanup(dir);
  }
});

// =========================================================================
// Phase 2: TreeNode changes -> .md write
// =========================================================================

test("write: edit node text -> .md file updated", () => {
  const dir = tmpDir();
  try {
    const fp = writeMd(dir, "editable.md", `---
m3e:
  nodeId: n_edit
---

# Original Title

Original body.
`);

    const content = fs.readFileSync(fp, "utf-8");
    const parsed = parseMdContent(content, { id: "n_edit", text: "Original Title" });

    parsed.node.text = "Updated Title";
    parsed.node.details = "Updated body content.";

    const newMd = serializeToMd(parsed.node);
    fs.writeFileSync(fp, newMd, "utf-8");

    const reread = parseMdContent(
      fs.readFileSync(fp, "utf-8"),
      { id: "fallback", text: "fallback" }
    );
    expect(reread.node.text).toBe("Updated Title");
    expect(reread.node.details.includes("Updated body content.")).toBe(true);
  } finally {
    cleanup(dir);
  }
});

test("write: add node -> new .md file created", () => {
  const dir = tmpDir();
  try {
    const newNode = {
      id: "n_new_node",
      text: "Brand New Node",
      nodeType: "text",
      collapsed: false,
      details: "Fresh content.",
      note: "",
      link: "",
      attributes: { tags: "new" },
    };

    const md = serializeToMd(newNode);
    const fp = path.join(dir, "brand-new-node.md");
    fs.writeFileSync(fp, md, "utf-8");

    expect(fs.existsSync(fp)).toBe(true);
    const parsed = parseMdContent(
      fs.readFileSync(fp, "utf-8"),
      { id: "fallback", text: "fallback" }
    );
    expect(parsed.node.id).toBe("n_new_node");
    expect(parsed.node.text).toBe("Brand New Node");
    expect(parsed.node.details.includes("Fresh content.")).toBe(true);
  } finally {
    cleanup(dir);
  }
});

test("write: delete node -> .md file removed", () => {
  const dir = tmpDir();
  try {
    const fp = writeMd(dir, "to-delete.md", "---\nm3e:\n  nodeId: n_del\n---\n\n# Delete Me");

    expect(fs.existsSync(fp)).toBe(true);

    fs.unlinkSync(fp);

    expect(fs.existsSync(fp)).toBe(false);
  } finally {
    cleanup(dir);
  }
});

test("write: move node between folders -> file moves", () => {
  const dir = tmpDir();
  try {
    const folderA = path.join(dir, "folder-a");
    const folderB = path.join(dir, "folder-b");
    fs.mkdirSync(folderA);
    fs.mkdirSync(folderB);

    const srcPath = path.join(folderA, "moveme.md");
    fs.writeFileSync(srcPath, "---\nm3e:\n  nodeId: n_move\n---\n\n# Move Me", "utf-8");

    expect(fs.existsSync(srcPath)).toBe(true);

    const destPath = path.join(folderB, "moveme.md");
    fs.renameSync(srcPath, destPath);

    expect(fs.existsSync(srcPath)).toBe(false);
    expect(fs.existsSync(destPath)).toBe(true);

    const parsed = parseMdContent(
      fs.readFileSync(destPath, "utf-8"),
      { id: "fallback", text: "fallback" }
    );
    expect(parsed.node.id).toBe("n_move");
    expect(parsed.node.text).toBe("Move Me");
  } finally {
    cleanup(dir);
  }
});

test("write: node deletion to trash (rename to _trash folder)", () => {
  const dir = tmpDir();
  try {
    const trashDir = path.join(dir, "_trash");
    fs.mkdirSync(trashDir);

    const fp = writeMd(dir, "soft-delete.md", "---\nm3e:\n  nodeId: n_soft\n---\n\n# Soft Delete");

    const trashPath = path.join(trashDir, "soft-delete.md");
    fs.renameSync(fp, trashPath);

    expect(fs.existsSync(fp)).toBe(false);
    expect(fs.existsSync(trashPath)).toBe(true);
  } finally {
    cleanup(dir);
  }
});
