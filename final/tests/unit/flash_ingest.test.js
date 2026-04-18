const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseMarkdownToNodes,
  parsePlainTextToNodes,
  ingestSingle,
  ingestBatch,
  listDrafts,
  getDraft,
  deleteDraft,
  approveDraft,
  clearDrafts,
  _resetIdCounter,
  FLASH_ATTR,
} = require("../../dist/node/flash_ingest.js");

const { RapidMvpModel } = require("../../dist/node/rapid_mvp.js");

test.beforeEach(() => {
  clearDrafts();
  _resetIdCounter();
});

// ---------------------------------------------------------------------------
// parseMarkdownToNodes
// ---------------------------------------------------------------------------

test("parseMarkdownToNodes: single heading", () => {
  const nodes = parseMarkdownToNodes("# Hello World", "md:inline");
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].text, "Hello World");
  assert.equal(nodes[0].parentTempId, null);
  assert.equal(nodes[0].confidence, 0.7);
});

test("parseMarkdownToNodes: nested headings", () => {
  const md = `# Root
## Child A
### Grandchild
## Child B`;
  const nodes = parseMarkdownToNodes(md, "md:inline");
  assert.equal(nodes.length, 4);

  // Root
  assert.equal(nodes[0].text, "Root");
  assert.equal(nodes[0].parentTempId, null);

  // Child A -> parent is Root
  assert.equal(nodes[1].text, "Child A");
  assert.equal(nodes[1].parentTempId, nodes[0].tempId);

  // Grandchild -> parent is Child A
  assert.equal(nodes[2].text, "Grandchild");
  assert.equal(nodes[2].parentTempId, nodes[1].tempId);

  // Child B -> parent is Root (sibling of Child A)
  assert.equal(nodes[3].text, "Child B");
  assert.equal(nodes[3].parentTempId, nodes[0].tempId);
});

test("parseMarkdownToNodes: bullet items under heading", () => {
  const md = `# Topics
- Item A
- Item B
- Item C`;
  const nodes = parseMarkdownToNodes(md, "md:inline");
  assert.equal(nodes.length, 4);
  assert.equal(nodes[0].text, "Topics");
  assert.equal(nodes[1].text, "Item A");
  assert.equal(nodes[1].parentTempId, nodes[0].tempId);
  assert.equal(nodes[2].text, "Item B");
  assert.equal(nodes[3].text, "Item C");
});

test("parseMarkdownToNodes: plain text with no structure", () => {
  const nodes = parseMarkdownToNodes("Just some text here", "md:inline");
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].text, "Just some text here");
  assert.equal(nodes[0].parentTempId, null);
});

test("parseMarkdownToNodes: empty input", () => {
  const nodes = parseMarkdownToNodes("", "md:inline");
  assert.equal(nodes.length, 0);
});

test("parseMarkdownToNodes: respects maxDepth", () => {
  const md = `# Level 1
## Level 2
### Level 3
#### Level 4
##### Level 5`;
  const nodes = parseMarkdownToNodes(md, "md:inline", 3);
  // Levels 4 and 5 get clamped to level 3
  assert.equal(nodes.length, 5);
  // Level 4 (clamped to 3) becomes sibling of Level 3
  assert.equal(nodes[3].parentTempId, nodes[1].tempId);
});

test("parseMarkdownToNodes: asterisk bullets", () => {
  const md = `# List
* First
* Second`;
  const nodes = parseMarkdownToNodes(md, "md:inline");
  assert.equal(nodes.length, 3);
  assert.equal(nodes[1].text, "First");
  assert.equal(nodes[2].text, "Second");
});

// ---------------------------------------------------------------------------
// parsePlainTextToNodes
// ---------------------------------------------------------------------------

test("parsePlainTextToNodes: single line", () => {
  const nodes = parsePlainTextToNodes("Hello", "text:inline");
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].text, "Hello");
  assert.equal(nodes[0].parentTempId, null);
});

test("parsePlainTextToNodes: multiple lines", () => {
  const nodes = parsePlainTextToNodes("Title\nLine 2\nLine 3", "text:inline");
  assert.equal(nodes.length, 3);
  assert.equal(nodes[0].text, "Title");
  assert.equal(nodes[0].parentTempId, null);
  assert.equal(nodes[1].text, "Line 2");
  assert.equal(nodes[1].parentTempId, nodes[0].tempId);
  assert.equal(nodes[2].text, "Line 3");
  assert.equal(nodes[2].parentTempId, nodes[0].tempId);
});

test("parsePlainTextToNodes: empty input", () => {
  const nodes = parsePlainTextToNodes("", "text:inline");
  assert.equal(nodes.length, 0);
});

test("parsePlainTextToNodes: whitespace only", () => {
  const nodes = parsePlainTextToNodes("   \n  \n  ", "text:inline");
  assert.equal(nodes.length, 0);
});

// ---------------------------------------------------------------------------
// ingestSingle
// ---------------------------------------------------------------------------

test("ingestSingle: creates draft from text", () => {
  const draft = ingestSingle({
    mapId: "test-map",
    sourceType: "text",
    content: "Quick note",
  });

  assert.ok(draft.id.startsWith("d_"));
  assert.equal(draft.mapId, "test-map");
  assert.equal(draft.sourceType, "text");
  assert.equal(draft.status, "pending");
  assert.equal(draft.structured.nodes.length, 1);
  assert.equal(draft.structured.nodes[0].text, "Quick note");
  assert.equal(draft.title, "Quick note");
});

test("ingestSingle: creates draft from markdown", () => {
  const draft = ingestSingle({
    mapId: "test-map",
    sourceType: "markdown",
    content: "# My Map\n## Section A\n- point 1\n- point 2",
  });

  assert.equal(draft.sourceType, "markdown");
  assert.equal(draft.title, "My Map");
  assert.equal(draft.structured.nodes.length, 4);
});

test("ingestSingle: throws on empty content", () => {
  assert.throws(
    () => ingestSingle({ mapId: "test", sourceType: "text", content: "" }),
    { message: "mapId and content are required." },
  );
});

test("ingestSingle: throws on unsupported sourceType", () => {
  assert.throws(
    () => ingestSingle({ mapId: "test", sourceType: "pdf", content: "data" }),
    /Unsupported sourceType/,
  );
});

test("ingestSingle: stores draft in memory", () => {
  const draft = ingestSingle({
    mapId: "test-map",
    sourceType: "text",
    content: "Test",
  });

  const retrieved = getDraft(draft.id);
  assert.ok(retrieved);
  assert.equal(retrieved.id, draft.id);
});

test("ingestSingle: uses targetNodeId as suggestedParentId", () => {
  const draft = ingestSingle({
    mapId: "test",
    sourceType: "text",
    content: "Note",
    options: { targetNodeId: "n_existing_123" },
  });

  assert.equal(draft.structured.suggestedParentId, "n_existing_123");
});

// ---------------------------------------------------------------------------
// ingestBatch
// ---------------------------------------------------------------------------

test("ingestBatch: creates multiple drafts", () => {
  const results = ingestBatch([
    { mapId: "map1", sourceType: "text", content: "First" },
    { mapId: "map1", sourceType: "text", content: "Second" },
    { mapId: "map2", sourceType: "markdown", content: "# Third" },
  ]);

  assert.equal(results.length, 3);
  assert.equal(results[0].title, "First");
  assert.equal(results[2].title, "Third");
});

test("ingestBatch: throws on empty array", () => {
  assert.throws(
    () => ingestBatch([]),
    /items array is required/,
  );
});

// ---------------------------------------------------------------------------
// listDrafts / getDraft / deleteDraft
// ---------------------------------------------------------------------------

test("listDrafts: returns all drafts", () => {
  ingestSingle({ mapId: "a", sourceType: "text", content: "One" });
  ingestSingle({ mapId: "b", sourceType: "text", content: "Two" });

  const all = listDrafts();
  assert.equal(all.length, 2);
});

test("listDrafts: filters by mapId", () => {
  ingestSingle({ mapId: "a", sourceType: "text", content: "One" });
  ingestSingle({ mapId: "b", sourceType: "text", content: "Two" });

  const filtered = listDrafts({ mapId: "a" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].mapId, "a");
});

test("deleteDraft: removes draft", () => {
  const draft = ingestSingle({ mapId: "a", sourceType: "text", content: "Del" });
  assert.ok(getDraft(draft.id));

  const result = deleteDraft(draft.id);
  assert.equal(result, true);
  assert.equal(getDraft(draft.id), undefined);
});

test("deleteDraft: returns false for nonexistent", () => {
  assert.equal(deleteDraft("nonexistent"), false);
});

// ---------------------------------------------------------------------------
// approveDraft
// ---------------------------------------------------------------------------

test("approveDraft: full approval adds nodes to model", () => {
  const draft = ingestSingle({
    mapId: "test-map",
    sourceType: "markdown",
    content: "# Topic\n- Point A\n- Point B",
  });

  const model = new RapidMvpModel("Root");
  const result = approveDraft(draft.id, { mode: "all" }, model);

  assert.equal(result.committedNodeIds.length, 3); // Topic + Point A + Point B
  assert.ok(result.parentId); // _inbox node id

  // Verify nodes exist in model
  for (const nodeId of result.committedNodeIds) {
    const node = model.state.nodes[nodeId];
    assert.ok(node, `Node ${nodeId} should exist in model`);
    assert.equal(node.attributes["m3e:band"], "flash");
    assert.equal(node.attributes["m3e:sourceType"], "markdown");
    assert.ok(node.attributes["m3e:confidence"]);
  }

  // Verify draft status updated
  const updatedDraft = getDraft(draft.id);
  assert.equal(updatedDraft.status, "approved");
});

test("approveDraft: partial approval with ancestor auto-include", () => {
  const draft = ingestSingle({
    mapId: "test-map",
    sourceType: "markdown",
    content: "# Root Topic\n## Sub Topic\n- Detail",
  });

  // Select only the leaf node "Detail" -- should auto-include ancestors
  const detailNode = draft.structured.nodes.find((n) => n.text === "Detail");
  assert.ok(detailNode);

  const model = new RapidMvpModel("Root");
  const result = approveDraft(
    draft.id,
    { mode: "partial", selectedNodeIds: [detailNode.tempId] },
    model,
  );

  // Should include Detail + Sub Topic + Root Topic (ancestors)
  assert.equal(result.committedNodeIds.length, 3);

  const updatedDraft = getDraft(draft.id);
  assert.equal(updatedDraft.status, "partial");
});

test("approveDraft: with edits adjusts text and confidence", () => {
  const draft = ingestSingle({
    mapId: "test-map",
    sourceType: "text",
    content: "Original text",
  });

  const tempId = draft.structured.nodes[0].tempId;
  const model = new RapidMvpModel("Root");
  const result = approveDraft(
    draft.id,
    {
      mode: "all",
      edits: { [tempId]: { text: "Edited text" } },
    },
    model,
  );

  const nodeId = result.committedNodeIds[0];
  const node = model.state.nodes[nodeId];
  assert.equal(node.text, "Edited text");
  assert.equal(node.attributes["m3e:confidence"], "0.8"); // edited -> 0.8
});

test("approveDraft: throws for non-pending draft", () => {
  const draft = ingestSingle({
    mapId: "test-map",
    sourceType: "text",
    content: "Test",
  });

  const model = new RapidMvpModel("Root");
  approveDraft(draft.id, { mode: "all" }, model);

  // Try to approve again
  assert.throws(
    () => approveDraft(draft.id, { mode: "all" }, model),
    /not pending/,
  );
});

test("approveDraft: throws for nonexistent draft", () => {
  const model = new RapidMvpModel("Root");
  assert.throws(
    () => approveDraft("fake_id", { mode: "all" }, model),
    /Draft not found/,
  );
});

test("approveDraft: _inbox node is created once and reused", () => {
  const draft1 = ingestSingle({
    mapId: "test-map",
    sourceType: "text",
    content: "First",
  });
  const draft2 = ingestSingle({
    mapId: "test-map",
    sourceType: "text",
    content: "Second",
  });

  const model = new RapidMvpModel("Root");
  const result1 = approveDraft(draft1.id, { mode: "all" }, model);
  const result2 = approveDraft(draft2.id, { mode: "all" }, model);

  // Both should use the same _inbox parent
  assert.equal(result1.parentId, result2.parentId);

  // The _inbox node should be a child of root
  const root = model.state.nodes[model.state.rootId];
  const inboxChildren = root.children.filter((id) => {
    const n = model.state.nodes[id];
    return n && n.text === "_inbox";
  });
  assert.equal(inboxChildren.length, 1);
});

test("approveDraft: confidence is 0.7 for manual input", () => {
  const draft = ingestSingle({
    mapId: "test-map",
    sourceType: "text",
    content: "Manual note",
  });

  const model = new RapidMvpModel("Root");
  const result = approveDraft(draft.id, { mode: "all" }, model);

  const node = model.state.nodes[result.committedNodeIds[0]];
  assert.equal(node.attributes["m3e:confidence"], "0.7");
});

// ---------------------------------------------------------------------------
// Flash API integration (via createAppServer)
// ---------------------------------------------------------------------------

test("Flash API: POST /api/flash/ingest returns 202", async () => {
  const { createAppServer } = require("../../dist/node/start_viewer.js");
  const server = createAppServer();

  const body = JSON.stringify({
    mapId: "api-test",
    sourceType: "text",
    content: "API test content",
  });

  const response = await new Promise((resolve) => {
    const req = {
      url: "/api/flash/ingest",
      method: "POST",
      headers: {},
      on(event, cb) {
        if (event === "data") cb(Buffer.from(body));
        if (event === "end") cb();
      },
    };

    const res = {
      statusCode: 0,
      headers: {},
      body: "",
      setHeader(k, v) { this.headers[k] = v; },
      end(data) {
        this.body = data;
        resolve(this);
      },
    };

    // Emit the request event
    server.emit("request", req, res);
  });

  assert.equal(response.statusCode, 202);
  const data = JSON.parse(response.body);
  assert.equal(data.ok, true);
  assert.ok(data.draftId);

  server.close();
  clearDrafts();
});
