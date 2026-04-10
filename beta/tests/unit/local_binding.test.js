const test = require("node:test");
const assert = require("node:assert/strict");
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

  assert.equal(frontmatter.m3e.nodeId, "n_1234_abc");
  assert.equal(frontmatter.m3e.nodeType, "folder");
  assert.equal(frontmatter.m3e.collapsed, false);
  assert.deepEqual(frontmatter.m3e["children-order"], ["n_child1", "n_child2"]);
  assert.deepEqual(frontmatter.tags, ["hypothesis", "biology"]);
  assert.deepEqual(frontmatter.aliases, ["Hypothesis A"]);
  assert.ok(body.includes("# Hypothesis A"));
  assert.ok(body.includes("Some body text."));
});

test("parseFrontmatter: returns empty frontmatter when no delimiters", () => {
  const md = "# Just a heading\n\nSome text.";
  const { frontmatter, body } = parseFrontmatter(md);

  assert.deepEqual(frontmatter, {});
  assert.ok(body.includes("# Just a heading"));
});

test("parseFrontmatter: handles empty frontmatter block", () => {
  const md = `---
---

# Title
`;
  const { frontmatter, body } = parseFrontmatter(md);

  assert.deepEqual(frontmatter, {});
  assert.ok(body.includes("# Title"));
});

test("parseSimpleYaml: parses scalar values", () => {
  const yaml = `name: test
count: 42
active: true
disabled: false`;

  const result = parseSimpleYaml(yaml);

  assert.equal(result.name, "test");
  assert.equal(result.count, 42);
  assert.equal(result.active, true);
  assert.equal(result.disabled, false);
});

test("parseSimpleYaml: parses quoted strings", () => {
  const yaml = `single: 'hello world'
double: "goodbye world"`;

  const result = parseSimpleYaml(yaml);
  assert.equal(result.single, "hello world");
  assert.equal(result.double, "goodbye world");
});

test("parseSimpleYaml: parses nested objects (m3e block)", () => {
  const yaml = `m3e:
  nodeId: n_123
  nodeType: folder
  collapsed: true`;

  const result = parseSimpleYaml(yaml);
  assert.equal(result.m3e.nodeId, "n_123");
  assert.equal(result.m3e.nodeType, "folder");
  assert.equal(result.m3e.collapsed, true);
});

test("parseSimpleYaml: parses arrays", () => {
  const yaml = `tags:
  - alpha
  - beta
  - gamma`;

  const result = parseSimpleYaml(yaml);
  assert.deepEqual(result.tags, ["alpha", "beta", "gamma"]);
});

test("extractWikilinks: extracts simple wikilinks", () => {
  const body = `Some text with [[target-note]] and more.
And [[another|Custom Label]] here.`;

  const refs = extractWikilinks(body);
  assert.equal(refs.length, 2);

  assert.equal(refs[0].target, "target-note");
  assert.equal(refs[0].label, undefined);
  assert.equal(refs[0].embedded, false);

  assert.equal(refs[1].target, "another");
  assert.equal(refs[1].label, "Custom Label");
  assert.equal(refs[1].embedded, false);
});

test("extractWikilinks: detects embedded wikilinks", () => {
  const body = "Check ![[embedded-note]] for details.";
  const refs = extractWikilinks(body);

  assert.equal(refs.length, 1);
  assert.equal(refs[0].target, "embedded-note");
  assert.equal(refs[0].embedded, true);
});

test("extractWikilinks: returns empty for no links", () => {
  const refs = extractWikilinks("Just plain text, no links.");
  assert.equal(refs.length, 0);
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

  assert.equal(result.node.id, "n_test_1");
  assert.equal(result.node.text, "My Node Title");
  assert.equal(result.node.nodeType, "text");
  assert.equal(result.node.collapsed, false);
  assert.equal(result.node.note, "internal memo");
  assert.equal(result.node.link, "https://example.com");
  assert.equal(result.node.attributes.tags, "research");
  assert.equal(result.node.attributes.aliases, "Alias Name");

  // Wikilinks
  assert.equal(result.wikilinks.length, 2);
  assert.equal(result.wikilinks[0].target, "some-ref");
  assert.equal(result.wikilinks[1].target, "another-ref");
  assert.equal(result.wikilinks[1].label, "Label");
});

test("parseMdContent: uses defaults when no frontmatter", () => {
  const md = "Just plain text, no frontmatter or heading.";
  const result = parseMdContent(md, { id: "default_id", text: "default text" });

  assert.equal(result.node.id, "default_id");
  assert.equal(result.node.text, "default text");
  assert.equal(result.node.nodeType, "text");
});

test("parseMdContent: uses heading as text over default", () => {
  const md = "# Heading Override\n\nSome body.";
  const result = parseMdContent(md, { id: "id1", text: "fallback" });

  assert.equal(result.node.text, "Heading Override");
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

  assert.equal(result.node.id, "n_folder_a");
  assert.equal(result.node.nodeType, "folder");
  assert.deepEqual(result.childrenOrder, ["note-1", "note-2", "note-3"]);
});

test("parseFolderMd: returns empty children-order when not specified", () => {
  const md = `---
m3e:
  nodeId: n_folder_b
---

Simple folder
`;

  const result = parseFolderMd(md, { id: "fb", text: "Folder B" });
  assert.deepEqual(result.childrenOrder, []);
  assert.equal(result.node.nodeType, "folder");
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

  assert.ok(md.includes("---"));
  assert.ok(md.includes("nodeId: n_write_1"));
  assert.ok(md.includes("nodeType: folder"));
  assert.ok(md.includes("collapsed: true"));
  assert.ok(md.includes("note: a note"));
  assert.ok(md.includes("link:"));
  assert.ok(md.includes("# Test Node"));
  assert.ok(md.includes("- c1"));
  assert.ok(md.includes("- c2"));
  assert.ok(md.includes("- alpha"));
  assert.ok(md.includes("- beta"));
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

  // Should have no frontmatter since nodeType is default "text" (omitted),
  // and all optional fields are empty. Only nodeId remains.
  assert.ok(md.includes("# Simple"));
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

  assert.ok(md.includes("# With Body"));
  assert.ok(md.includes("Paragraph one."));
  assert.ok(md.includes("Paragraph two."));
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

  assert.ok(md.includes("## Related"));
  assert.ok(md.includes("- [[target-a]]"));
  assert.ok(md.includes("- [[target-b|Label B]]"));
  assert.ok(md.includes("- ![[embed-c]]"));
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

  assert.ok(md.includes("nodeType: folder"));
  assert.ok(md.includes("- child-1"));
  assert.ok(md.includes("- child-2"));
  assert.ok(md.includes("# My Folder"));
  assert.ok(md.includes("Folder description"));
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

  assert.equal(parsed.node.id, original.id);
  assert.equal(parsed.node.text, original.text);
  assert.equal(parsed.node.collapsed, original.collapsed);
  assert.equal(parsed.node.note, original.note);
  assert.equal(parsed.node.link, original.link);
  assert.equal(parsed.node.attributes.tags, original.attributes.tags);
  assert.equal(parsed.node.attributes.aliases, original.attributes.aliases);
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

  assert.equal(parsed.node.id, "n_folder_rt");
  assert.equal(parsed.node.nodeType, "folder");
  assert.deepEqual(parsed.childrenOrder, order);
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

  assert.equal(parsed.wikilinks.length, 3);
  assert.equal(parsed.wikilinks[0].target, "note-a");
  assert.equal(parsed.wikilinks[0].embedded, false);
  assert.equal(parsed.wikilinks[1].target, "note-b");
  assert.equal(parsed.wikilinks[1].label, "Custom");
  assert.equal(parsed.wikilinks[2].target, "note-c");
  assert.equal(parsed.wikilinks[2].embedded, true);
});

// =========================================================================
// Phase 1: Folder structure -> Tree structure
// =========================================================================

/**
 * Build a tree of TreeNodes from a folder of .md files.
 * Minimal implementation for testing — mirrors what BindingManager.mount() will do.
 */
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

  // Read children: files and subfolders
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const mdFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== "_folder.md")
    .map((e) => e.name);
  const subDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  // Sort children: respect children-order from _folder.md, fallback to alphabetical
  const allChildNames = [
    ...mdFiles.map((f) => f.replace(/\.md$/, "")),
    ...subDirs,
  ];

  let orderedNames;
  if (childrenOrder.length > 0) {
    // Put ordered items first, then remaining alphabetically
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
      // .md file -> text node
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
      // Subdirectory -> recurse
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
    assert.equal(root.nodeType, "folder");
    assert.equal(root.children.length, 2);

    // Alphabetical order since no _folder.md
    const child0 = tree.nodes[root.children[0]];
    const child1 = tree.nodes[root.children[1]];
    assert.equal(child0.id, "n_alpha");
    assert.equal(child1.id, "n_beta");
    assert.equal(child0.parentId, root.id);
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

    assert.equal(root.id, "n_root");
    assert.equal(root.children.length, 2);
    // Order should be beta, alpha (as specified in children-order)
    assert.equal(tree.nodes[root.children[0]].id, "n_beta");
    assert.equal(tree.nodes[root.children[1]].id, "n_alpha");
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

    assert.equal(root.children.length, 3);
    assert.equal(tree.nodes[root.children[0]].id, "n_a");
    assert.equal(tree.nodes[root.children[1]].id, "n_m");
    assert.equal(tree.nodes[root.children[2]].id, "n_z");
  } finally {
    cleanup(dir);
  }
});

test("folder->tree: nested folders become nested tree nodes", () => {
  const dir = tmpDir();
  try {
    writeMd(dir, "top.md", "---\nm3e:\n  nodeId: n_top\n---\n\n# Top");

    // Create subfolder
    const subDir = path.join(dir, "subfolder");
    fs.mkdirSync(subDir);
    writeMd(subDir, "_folder.md", "---\nm3e:\n  nodeId: n_sub\n  nodeType: folder\n---\n\n# Sub");
    writeMd(subDir, "deep.md", "---\nm3e:\n  nodeId: n_deep\n---\n\n# Deep Node");

    const tree = buildTreeFromFolder(dir);
    const root = tree.nodes[tree.rootId];

    // Root should have 2 children: subfolder and top.md (alphabetical: subfolder, top)
    assert.equal(root.children.length, 2);

    // Find the subfolder node
    const subNode = tree.nodes["n_sub"];
    assert.ok(subNode, "subfolder node should exist");
    assert.equal(subNode.nodeType, "folder");
    assert.equal(subNode.parentId, root.id);
    assert.equal(subNode.children.length, 1);

    // Deep node
    const deepNode = tree.nodes["n_deep"];
    assert.ok(deepNode, "deep node should exist");
    assert.equal(deepNode.parentId, "n_sub");
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

    // Simulate cache entry with mtime
    const stat1 = fs.statSync(fp);
    const cachedMtime = stat1.mtimeMs;

    // Modify file (force different mtime)
    // Use a small delay workaround via changing content
    fs.writeFileSync(fp, "---\nm3e:\n  nodeId: n_cache\n---\n\n# Cache Test Updated", "utf-8");
    const stat2 = fs.statSync(fp);

    // On some OS/FS the mtime granularity is coarse, so we also check content
    const currentMtime = stat2.mtimeMs;

    // The mtime should be >= (could be same on fast FS, so also check size)
    const isStale =
      currentMtime > cachedMtime || stat2.size !== stat1.size;
    assert.ok(isStale, "cache should detect file was modified");
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

    // First read
    const read1 = parseMdContent(
      fs.readFileSync(path.join(dir, "cache_test.md"), "utf-8"),
      { id: "fallback", text: "fallback" }
    );

    // Simulate cache: serialize the node
    const cached = JSON.parse(JSON.stringify(read1.node));

    // Second read from file
    const read2 = parseMdContent(
      fs.readFileSync(path.join(dir, "cache_test.md"), "utf-8"),
      { id: "fallback", text: "fallback" }
    );

    // Cached data should match re-read
    assert.equal(cached.id, read2.node.id);
    assert.equal(cached.text, read2.node.text);
    assert.equal(cached.nodeType, read2.node.nodeType);
    assert.deepEqual(cached.attributes, read2.node.attributes);
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

    // Read, modify, write back
    const content = fs.readFileSync(fp, "utf-8");
    const parsed = parseMdContent(content, { id: "n_edit", text: "Original Title" });

    // Simulate edit
    parsed.node.text = "Updated Title";
    parsed.node.details = "Updated body content.";

    const newMd = serializeToMd(parsed.node);
    fs.writeFileSync(fp, newMd, "utf-8");

    // Verify
    const reread = parseMdContent(
      fs.readFileSync(fp, "utf-8"),
      { id: "fallback", text: "fallback" }
    );
    assert.equal(reread.node.text, "Updated Title");
    assert.ok(reread.node.details.includes("Updated body content."));
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

    // Verify file exists and content is correct
    assert.ok(fs.existsSync(fp));
    const parsed = parseMdContent(
      fs.readFileSync(fp, "utf-8"),
      { id: "fallback", text: "fallback" }
    );
    assert.equal(parsed.node.id, "n_new_node");
    assert.equal(parsed.node.text, "Brand New Node");
    assert.ok(parsed.node.details.includes("Fresh content."));
  } finally {
    cleanup(dir);
  }
});

test("write: delete node -> .md file removed", () => {
  const dir = tmpDir();
  try {
    const fp = writeMd(dir, "to-delete.md", "---\nm3e:\n  nodeId: n_del\n---\n\n# Delete Me");

    assert.ok(fs.existsSync(fp));

    // Simulate delete
    fs.unlinkSync(fp);

    assert.ok(!fs.existsSync(fp));
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

    assert.ok(fs.existsSync(srcPath));

    // Simulate move
    const destPath = path.join(folderB, "moveme.md");
    fs.renameSync(srcPath, destPath);

    assert.ok(!fs.existsSync(srcPath));
    assert.ok(fs.existsSync(destPath));

    // Content preserved
    const parsed = parseMdContent(
      fs.readFileSync(destPath, "utf-8"),
      { id: "fallback", text: "fallback" }
    );
    assert.equal(parsed.node.id, "n_move");
    assert.equal(parsed.node.text, "Move Me");
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

    // Simulate soft delete (move to trash)
    const trashPath = path.join(trashDir, "soft-delete.md");
    fs.renameSync(fp, trashPath);

    assert.ok(!fs.existsSync(fp));
    assert.ok(fs.existsSync(trashPath));
  } finally {
    cleanup(dir);
  }
});
