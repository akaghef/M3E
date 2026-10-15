import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RapidMvpModel } from "../../src/node/rapid_mvp";
import { M3eMcpService, mcpRequestAllowed } from "../../src/node/mcp_service";

// These isolated service tests are diagnostic evidence, not cold-start agent acceptance.
describe("M3E MCP semantic service", () => {
  const mapId = "mcp-service-test";
  let dir: string;
  let dbPath: string;
  let feedbackDir: string;
  let model: RapidMvpModel;
  let service: M3eMcpService;
  let onSaved: ReturnType<typeof vi.fn>;

  const mapUri = () => `m3e://maps/${mapId}`;
  const nodeUri = (id: string) => `${mapUri()}/nodes/${id}`;
  const scopeUri = (id: string) => `${mapUri()}/scopes/${id}`;
  const saved = () => RapidMvpModel.loadSavedMapFromSqlite(dbPath, mapId);
  const loaded = () => RapidMvpModel.loadFromSqlite(dbPath, mapId);
  const enter = (target = mapUri()) => {
    const result = service.call("m3e_context", { action: "enter", target });
    expect(result.ok).toBe(true);
    expect(result.context_id).toEqual(expect.any(String));
    return result;
  };
  const externalEdit = (edit: (other: RapidMvpModel) => void, notify = true) => {
    const other = loaded();
    edit(other);
    other.saveToSqlite(dbPath, mapId);
    if (notify) service.notifyMapChanged(mapId);
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-mcp-service-"));
    dbPath = path.join(dir, "data.sqlite");
    feedbackDir = path.join(dir, "feedback");
    model = new RapidMvpModel("MCP verification");
    model.saveToSqlite(dbPath, mapId);
    onSaved = vi.fn();
    service = new M3eMcpService({ dbPath: () => dbPath, feedbackDir: () => feedbackDir, onSaved });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("the MCP endpoint accepts loopback requests with a local Host", () => {
    for (const [remoteAddress, host] of [["127.0.0.1", "localhost:4173"], ["::1", "[::1]:4173"]]) {
      const request = { socket: { remoteAddress }, headers: { host, origin: `http://${host}` } } as Parameters<typeof mcpRequestAllowed>[0];
      expect(mcpRequestAllowed(request)).toBe(true);
    }
  });

  test("the MCP endpoint rejects remote clients, cross-site origins and DNS-rebinding Hosts", () => {
    const rejected = [
      { socket: { remoteAddress: "192.0.2.10" }, headers: { host: "localhost:4173" } },
      { socket: { remoteAddress: "127.0.0.1" }, headers: { host: "localhost:4173", origin: "https://external.example" } },
      { socket: { remoteAddress: "127.0.0.1" }, headers: { host: "attacker.example:4173" } },
    ];
    for (const request of rejected) expect(mcpRequestAllowed(request as Parameters<typeof mcpRequestAllowed>[0])).toBe(false);
  });

  test("imports a 67-node MF-H tree with one complete save and no implicit scope boundaries", () => {
    const root = model.state.rootId;
    const existing = model.addNode(root, "Preserve existing content");
    model.state.nodes[existing].attributes = { color: "#123456", owner: "human" };
    model.saveToSqlite(dbPath, mapId);
    const before = loaded().toJSON();
    const rawBefore = saved().state;
    const context = enter();
    const headings = ["# 生物"];
    for (let kingdom = 1; kingdom <= 6; kingdom++) {
      headings.push(`## 界 ${kingdom}`);
      for (let phylum = 1; phylum <= 10; phylum++) headings.push(`### 門 ${kingdom}-${phylum}`);
    }
    const observedCounts: number[] = [];
    onSaved.mockImplementation(() => observedCounts.push(Object.keys(saved().state.nodes).length));

    const result = service.call("m3e_create", {
      context_id: context.context_id,
      kind: "import_mfh",
      mfh: headings.join("\n"),
    });

    expect(result.ok).toBe(true);
    expect(result.changed.created).toBe(67);
    expect(result.created).toHaveLength(67);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(observedCounts).toEqual([69]);
    const after = loaded();
    const rawAfter = saved().state;
    expect(rawAfter.nodes[existing]).toEqual(rawBefore.nodes[existing]);
    expect(rawAfter.nodes[root]).toEqual({ ...rawBefore.nodes[root], children: rawAfter.nodes[root].children });
    expect(after.validate()).toEqual([]);
    expect(after.state.nodes[existing]).toEqual(before.nodes[existing]);
    expect(after.state.nodes[root].children[0]).toBe(existing);
    expect(after.state.nodes[root].children).toHaveLength(2);
    const taxonomy = after.state.nodes[after.state.nodes[root].children[1]];
    expect(taxonomy.text).toBe("生物");
    expect(taxonomy.children).toHaveLength(6);
    for (const kingdom of taxonomy.children) expect(after.state.nodes[kingdom].children).toHaveLength(10);
    for (const node of Object.values(after.state.nodes)) {
      if (!(node.id in before.nodes)) expect(node.nodeType).not.toBe("folder");
    }

    // The successful write refreshes this context: no compensating read is needed.
    const next = service.call("m3e_create", {
      kind: "node", context_id: context.context_id, text: "Next operation",
    });
    expect(next.ok).toBe(true);
    expect(onSaved).toHaveBeenCalledTimes(2);
  });

  test.each(["", "not an MF-H heading", "# Valid root\n### Skipped parent"])(
    "invalid MF-H leaves the entire persisted map unchanged: %j",
    (mfh) => {
      const context = enter();
      const before = saved();
      const result = service.call("m3e_create", { kind: "import_mfh", context_id: context.context_id, mfh });
      expect(result.ok).toBe(false);
      expect(saved()).toEqual(before);
      expect(onSaved).not.toHaveBeenCalled();
    },
  );

  test("copies full subtree metadata, internal GraphLinks and alias targets without changing source or siblings", () => {
    const root = model.state.rootId;
    const source = model.addNode(root, "A");
    const destination = model.addNode(root, "B");
    const untouched = model.addNode(root, "Untouched");
    const destinationChild = model.addNode(destination, "Existing B child");
    const first = model.addNode(source, "A first");
    const nestedScope = model.addNode(source, "Nested scope");
    const last = model.addNode(nestedScope, "A deep descendant");
    model.state.nodes[nestedScope].nodeType = "folder";
    model.state.nodes[first].attributes = { color: "#fedcba", custom: "preserve me" };
    model.state.nodes[first].details = "Detailed text\nsecond line";
    model.state.nodes[first].note = "Private note";
    model.state.nodes[first].link = "https://example.test/source";
    model.state.nodes[first].collapsed = true;
    const internalAlias = model.addAlias(source, last, { aliasLabel: "Internal reference", access: "write" });
    const externalAlias = model.addAlias(source, untouched, { aliasLabel: "External reference" });
    const internalLink = model.addLink(first, last, {
      relationType: "supports", label: "Evidence", direction: "forward", style: "dashed",
    });
    model.state.links![internalLink].color = "#445566";
    model.addLink(last, untouched, { relationType: "reference", label: "Existing external relation" });
    model.saveToSqlite(dbPath, mapId);
    const before = loaded().toJSON();
    const rawBefore = saved().state;
    const context = enter();

    const result = service.call("m3e_create", {
      kind: "copy", context_id: context.context_id, source: nodeUri(source), target: nodeUri(destination),
    });
    expect(result.ok).toBe(true);
    expect(onSaved).toHaveBeenCalledTimes(1);
    const after = loaded();
    const rawAfter = saved().state;
    for (const [id, node] of Object.entries(rawBefore.nodes)) {
      if (id !== destination) expect(rawAfter.nodes[id]).toEqual(node);
    }
    expect(rawAfter.nodes[destination]).toEqual({ ...rawBefore.nodes[destination], children: rawAfter.nodes[destination].children });
    expect(after.validate()).toEqual([]);
    expect(after.state.nodes[root]).toEqual(before.nodes[root]);
    expect(after.state.nodes[destination].children[0]).toBe(destinationChild);
    expect(after.state.nodes[destination].children).toHaveLength(2);
    for (const [id, node] of Object.entries(before.nodes)) {
      if (id !== destination) expect(after.state.nodes[id]).toEqual(node);
    }
    const clonedRoot = after.state.nodes[destination].children[1];
    const remap = new Map<string, string>();
    const visit = (original: string, cloned: string) => {
      remap.set(original, cloned);
      const a = before.nodes[original];
      const b = after.state.nodes[cloned];
      expect(cloned).not.toBe(original);
      expect(b.children).toHaveLength(a.children.length);
      a.children.forEach((child, i) => visit(child, b.children[i]));
    };
    visit(source, clonedRoot);
    expect(result.changed.created).toBe(remap.size);
    for (const [original, cloned] of remap) {
      const expected = {
        ...before.nodes[original],
        id: cloned,
        parentId: original === source ? destination : remap.get(before.nodes[original].parentId!),
        children: before.nodes[original].children.map((id) => remap.get(id)),
      };
      if (expected.targetNodeId) expected.targetNodeId = remap.get(expected.targetNodeId) ?? expected.targetNodeId;
      expect(after.state.nodes[cloned]).toEqual(expected);
    }
    expect(after.state.nodes[remap.get(internalAlias)!].targetNodeId).toBe(remap.get(last));
    expect(after.state.nodes[remap.get(externalAlias)!].targetNodeId).toBe(untouched);
    const newLinks = Object.values(after.state.links!).filter((link) => !(link.id in before.links!));
    expect(newLinks).toHaveLength(1);
    expect(newLinks[0]).toEqual({
      ...before.links![internalLink], id: newLinks[0].id,
      sourceNodeId: remap.get(first), targetNodeId: remap.get(last),
    });
    for (const [id, link] of Object.entries(before.links!)) expect(after.state.links![id]).toEqual(link);
  });

  test.each([false, true])("copies scope-owned notes, annotations and surfaces with all references remapped (cross-map: %s)", (crossMap) => {
    const a = model.addNode(model.state.rootId, "Payload A");
    const leaf = model.addNode(a, "A leaf");
    const nested = model.addNode(a, "Nested scope");
    const deep = model.addNode(nested, "Nested leaf");
    const outside = model.addNode(model.state.rootId, "Outside scope");
    for (const id of [a, nested, outside]) model.state.nodes[id].nodeType = "folder";
    const relation = model.addLink(leaf, deep, { label: "Internal relation", relationType: "reference" });
    const outsideRelation = model.addLink(leaf, outside, { label: "Original cross-boundary relation" });
    const aScope = `scope:${a}`;
    const nestedScope = `scope:${nested}`;
    const outsideScope = `scope:${outside}`;
    const textAnnotation = (id: string, text: string, scopeId?: string) => ({
      id, kind: "text" as const, ...(scopeId ? { scopeId } : {}), text, x: 12, y: 34, fill: "#123456", fontSize: 17, fontWeight: 500,
    });
    model.state.linearNotesByScope = { [a]: "A linear note", [nested]: "Nested linear note", [outside]: "Outside linear note" };
    model.state.annotations = {
      "source-a-note": textAnnotation("source-a-note", "A annotation", a),
      "source-nested-ink": { id: "source-nested-ink", kind: "pen", scopeId: nested, d: "M 1 2 L 3 4", points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], stroke: "#abcdef", strokeWidth: 3, opacity: 0.6 },
      "source-outside-note": textAnnotation("source-outside-note", "Outside annotation", outside),
      "global-note": textAnnotation("global-note", "Source global annotation"),
    };
    model.state.scopes = {
      [aScope]: { id: aScope, label: "A scope model", rootNodeIds: [leaf, nested], relationIds: [relation, outsideRelation], primarySurfaceId: "custom-a-surface" },
      [nestedScope]: { id: nestedScope, label: "Nested scope model", rootNodeIds: [deep], relationIds: [], primarySurfaceId: "custom-nested-surface" },
      [outsideScope]: { id: outsideScope, label: "Outside scope model", rootNodeIds: [outside], relationIds: [], primarySurfaceId: "outside-surface" },
    };
    model.state.surfaces = {
      "custom-a-surface": { id: "custom-a-surface", scopeId: aScope, kind: "system", layout: "flow-lr", nodeViews: { [leaf]: { x: 14, y: 25, shape: "diamond" }, [nested]: { flowCol: 2, flowRow: 1 } } },
      "custom-nested-surface": { id: "custom-nested-surface", scopeId: nestedScope, kind: "scatter", layout: "scatter", nodeViews: { [deep]: { x: 45, y: 67, shape: "rounded" } } },
      "outside-surface": { id: "outside-surface", scopeId: outsideScope, kind: "tree", layout: "tree", nodeViews: { [outside]: { x: 99, y: 88 } } },
    };
    model.state.linearTextFontScale = 1.3;
    model.state.linearPanelWidth = 400;

    const destinationMapId = crossMap ? "copy-payload-destination" : mapId;
    const destinationModel = crossMap ? new RapidMvpModel("Copy destination") : model;
    const destination = destinationModel.addNode(destinationModel.state.rootId, "Destination B");
    const existingChild = destinationModel.addNode(destination, "Existing destination child");
    destinationModel.state.nodes[destination].nodeType = "folder";
    const destinationScope = `scope:${destination}`;
    destinationModel.state.linearNotesByScope = { ...destinationModel.state.linearNotesByScope, [destination]: "Keep B note" };
    destinationModel.state.annotations = {
      ...destinationModel.state.annotations,
      "destination-note": textAnnotation("destination-note", "Keep B annotation", destination),
      ...(crossMap ? { "global-note": textAnnotation("global-note", "Destination global annotation") } : {}),
    };
    destinationModel.state.scopes = {
      ...destinationModel.state.scopes,
      [destinationScope]: { id: destinationScope, label: "B scope model", rootNodeIds: [existingChild], relationIds: [], primarySurfaceId: "destination-surface" },
    };
    destinationModel.state.surfaces = {
      ...destinationModel.state.surfaces,
      "destination-surface": { id: "destination-surface", scopeId: destinationScope, kind: "tree", layout: "tree", nodeViews: { [existingChild]: { x: 71, y: 82 } } },
    };
    destinationModel.state.linearTextFontScale = 1.8;
    destinationModel.state.linearPanelWidth = 550;
    model.saveToSqlite(dbPath, mapId);
    if (crossMap) destinationModel.saveToSqlite(dbPath, destinationMapId);
    const sourceBefore = saved();
    const destinationBefore = RapidMvpModel.loadSavedMapFromSqlite(dbPath, destinationMapId).state;
    const context = enter(`m3e://maps/${destinationMapId}`);
    const result = service.call("m3e_create", {
      kind: "copy", context_id: context.context_id, source: scopeUri(a), target: `m3e://maps/${destinationMapId}/scopes/${destination}`,
    });
    expect(result.ok).toBe(true);
    expect(result.changed.created).toBe(4);
    expect(onSaved).toHaveBeenCalledTimes(1);
    const after = RapidMvpModel.loadSavedMapFromSqlite(dbPath, destinationMapId).state;
    expect(RapidMvpModel.fromJSON(after).validate()).toEqual([]);
    expect(after.nodes[destination].children).toHaveLength(2);
    expect(after.nodes[destination].children[0]).toBe(existingChild);
    const copiedA = after.nodes[destination].children[1];
    const [copiedLeaf, copiedNested] = after.nodes[copiedA].children;
    const copiedDeep = after.nodes[copiedNested].children[0];
    const remap = new Map([[a, copiedA], [leaf, copiedLeaf], [nested, copiedNested], [deep, copiedDeep]]);
    const copiedRelation = Object.values(after.links!).find((link) => link.sourceNodeId === copiedLeaf && link.targetNodeId === copiedDeep)!;
    expect(copiedRelation).toBeDefined();
    expect(copiedRelation.id).not.toBe(relation);
    expect(Object.keys(after.links!).length - Object.keys(destinationBefore.links!).length).toBe(1);
    const newKeys = (key: "linearNotesByScope" | "annotations" | "scopes" | "surfaces") => Object.keys(after[key] ?? {}).filter((id) => !(id in (destinationBefore[key] ?? {})));
    for (const key of ["linearNotesByScope", "annotations", "scopes", "surfaces"] as const) {
      expect(newKeys(key)).toHaveLength(2);
      for (const [id, value] of Object.entries(destinationBefore[key] ?? {})) expect(after[key]![id]).toEqual(value);
    }
    for (const original of [a, nested]) {
      const copied = remap.get(original)!;
      expect(after.linearNotesByScope![copied]).toBe(sourceBefore.state.linearNotesByScope![original]);
      const originalScope = sourceBefore.state.scopes![`scope:${original}`];
      const copiedScope = after.scopes![`scope:${copied}`];
      expect(copiedScope).toBeDefined();
      expect(copiedScope).toEqual({
        ...originalScope, id: `scope:${copied}`, rootNodeIds: originalScope.rootNodeIds.map((id) => remap.get(id)),
        relationIds: originalScope.relationIds.filter((id) => id === relation).map(() => copiedRelation.id), primarySurfaceId: copiedScope.primarySurfaceId,
      });
      expect(copiedScope.primarySurfaceId).not.toBe(originalScope.primarySurfaceId);
      const originalSurface = sourceBefore.state.surfaces![originalScope.primarySurfaceId!];
      const copiedSurface = after.surfaces![copiedScope.primarySurfaceId!];
      expect(copiedSurface).toEqual({
        ...originalSurface, id: copiedScope.primarySurfaceId, scopeId: `scope:${copied}`,
        nodeViews: Object.fromEntries(Object.entries(originalSurface.nodeViews!).map(([id, view]) => [remap.get(id), view])),
      });
      const originalAnnotation = Object.values(sourceBefore.state.annotations!).find((annotation) => annotation.scopeId === original)!;
      const copiedAnnotations = newKeys("annotations").map((id) => after.annotations![id]).filter((annotation) => annotation.scopeId === copied);
      expect(copiedAnnotations).toHaveLength(1);
      expect(copiedAnnotations[0].id).not.toBe(originalAnnotation.id);
      expect(copiedAnnotations[0]).toEqual({ ...originalAnnotation, id: copiedAnnotations[0].id, scopeId: copied });
    }
    for (const [id, node] of Object.entries(destinationBefore.nodes)) {
      if (id !== destination) expect(after.nodes[id]).toEqual(node);
    }
    for (const [id, link] of Object.entries(destinationBefore.links!)) expect(after.links![id]).toEqual(link);
    expect(after.linearTextFontScale).toBe(destinationBefore.linearTextFontScale);
    expect(after.linearPanelWidth).toBe(destinationBefore.linearPanelWidth);
    if (crossMap) expect(saved()).toEqual(sourceBefore);
  });

  test("copy rejects scope root ownership outside the subtree without saving a partial copy", () => {
    const a = model.addNode(model.state.rootId, "A");
    const inside = model.addNode(a, "Inside");
    const outside = model.addNode(model.state.rootId, "Outside");
    const destination = model.addNode(model.state.rootId, "Destination");
    model.state.nodes[a].nodeType = "folder";
    const scope = `scope:${a}`;
    model.state.scopes = { [scope]: { id: scope, label: "A scope", rootNodeIds: [inside, outside], relationIds: [], primarySurfaceId: "a-surface" } };
    model.state.surfaces = { "a-surface": { id: "a-surface", scopeId: scope, kind: "tree", layout: "tree", nodeViews: { [inside]: { x: 10 } } } };
    model.saveToSqlite(dbPath, mapId);
    const before = saved();
    const context = enter();
    const result = service.call("m3e_create", { kind: "copy", context_id: context.context_id, source: scopeUri(a), target: nodeUri(destination) });
    expect(result.ok).toBe(false);
    expect(saved()).toEqual(before);
    expect(onSaved).not.toHaveBeenCalled();
  });

  test("copy filters normal outside surface view cache while preserving the source surface", () => {
    const a = model.addNode(model.state.rootId, "A");
    const inside = model.addNode(a, "Inside");
    const outside = model.addNode(model.state.rootId, "Outside");
    const destination = model.addNode(model.state.rootId, "Destination");
    model.state.nodes[a].nodeType = "folder";
    const scope = `scope:${a}`;
    model.state.scopes = { [scope]: { id: scope, label: "A scope", rootNodeIds: [inside], relationIds: [], primarySurfaceId: "a-surface" } };
    model.state.surfaces = { "a-surface": { id: "a-surface", scopeId: scope, kind: "scatter", layout: "scatter", nodeViews: { [inside]: { x: 10 }, [outside]: { x: 999 } } } };
    model.saveToSqlite(dbPath, mapId);
    const before = saved().state;
    const context = enter();
    const result = service.call("m3e_create", { kind: "copy", context_id: context.context_id, source: scopeUri(a), target: nodeUri(destination) });
    expect(result.ok).toBe(true);
    const after = saved().state;
    const copiedA = after.nodes[destination].children[0];
    const copiedInside = after.nodes[copiedA].children[0];
    const copiedScope = after.scopes![`scope:${copiedA}`];
    const copiedSurface = after.surfaces![copiedScope.primarySurfaceId!];
    expect(copiedSurface.id).not.toBe("a-surface");
    expect(copiedSurface.scopeId).toBe(`scope:${copiedA}`);
    expect(copiedSurface.nodeViews).toEqual({ [copiedInside]: { x: 10 } });
    expect(after.surfaces!["a-surface"]).toEqual(before.surfaces!["a-surface"]);
    expect(after.nodes[outside]).toEqual(before.nodes[outside]);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test.each([false, true])("copying an intrinsic map root preserves its scope boundary and owned payload (cross-map: %s)", (crossMap) => {
    const root = model.state.rootId;
    const child = model.addNode(root, "Root content");
    const rootScope = `scope:${root}`;
    model.state.nodes[root].nodeType = "text";
    model.state.nodes[child].scopeId = rootScope;
    model.state.linearNotesByScope = { [root]: "Intrinsic root scope note" };
    model.state.annotations = { "root-note": { id: "root-note", kind: "text", scopeId: root, text: "Root annotation", x: 1, y: 2, fill: "#000000", fontSize: 14 } };
    model.state.scopes = { [rootScope]: { id: rootScope, label: "Intrinsic root", rootNodeIds: [child], relationIds: [], primarySurfaceId: "root-custom-surface" } };
    model.state.surfaces = { "root-custom-surface": { id: "root-custom-surface", scopeId: rootScope, kind: "scatter", layout: "scatter", nodeViews: { [child]: { x: 11, y: 22 } } } };
    const destinationMapId = crossMap ? "root-copy-destination" : mapId;
    const destinationModel = crossMap ? new RapidMvpModel("Root copy destination") : model;
    const destination = destinationModel.addNode(destinationModel.state.rootId, "Destination");
    model.saveToSqlite(dbPath, mapId);
    if (crossMap) destinationModel.saveToSqlite(dbPath, destinationMapId);
    const sourceBefore = saved();
    const context = enter(`m3e://maps/${destinationMapId}`);
    const result = service.call("m3e_create", { kind: "copy", context_id: context.context_id, source: mapUri(), target: `m3e://maps/${destinationMapId}/nodes/${destination}` });
    expect(result.ok).toBe(true);
    expect(result.changed.created).toBe(Object.keys(sourceBefore.state.nodes).length);
    const after = RapidMvpModel.loadSavedMapFromSqlite(dbPath, destinationMapId).state;
    expect(RapidMvpModel.fromJSON(after).validate()).toEqual([]);
    const copiedRoot = after.nodes[destination].children[0];
    const copiedChild = after.nodes[copiedRoot].children.find((id) => after.nodes[id].text === "Root content")!;
    expect(after.nodes[copiedRoot].nodeType).toBe("folder");
    expect(after.nodes[copiedRoot].parentId).toBe(destination);
    expect(after.nodes[copiedChild].scopeId).toBe(`scope:${copiedRoot}`);
    expect(after.linearNotesByScope![copiedRoot]).toBe("Intrinsic root scope note");
    const annotation = Object.values(after.annotations!).find((item) => item.scopeId === copiedRoot)!;
    expect(annotation).toEqual({ ...sourceBefore.state.annotations!["root-note"], id: annotation.id, scopeId: copiedRoot });
    expect(annotation.id).not.toBe("root-note");
    const copiedScope = after.scopes![`scope:${copiedRoot}`];
    expect(copiedScope.rootNodeIds).toEqual([copiedChild]);
    expect(copiedScope.primarySurfaceId).not.toBe("root-custom-surface");
    expect(after.surfaces![copiedScope.primarySurfaceId!]).toEqual({
      ...sourceBefore.state.surfaces!["root-custom-surface"], id: copiedScope.primarySurfaceId,
      scopeId: `scope:${copiedRoot}`, nodeViews: { [copiedChild]: { x: 11, y: 22 } },
    });
    if (crossMap) expect(saved()).toEqual(sourceBefore);
    else {
      expect(after.nodes[root]).toEqual(sourceBefore.state.nodes[root]);
      expect(after.nodes[root].nodeType).toBe("text");
      expect(after.scopes![rootScope]).toEqual(sourceBefore.state.scopes![rootScope]);
      expect(after.surfaces!["root-custom-surface"]).toEqual(sourceBefore.state.surfaces!["root-custom-surface"]);
      expect(after.annotations!["root-note"]).toEqual(sourceBefore.state.annotations!["root-note"]);
    }
  });

  test("a deleted focus retreats to its nearest surviving ancestor and needs explicit focus acknowledgment", () => {
    const outer = model.addNode(model.state.rootId, "Outer scope");
    const inner = model.addNode(outer, "Inner scope");
    model.state.nodes[outer].nodeType = "folder";
    model.state.nodes[inner].nodeType = "folder";
    model.saveToSqlite(dbPath, mapId);
    const context = enter(scopeUri(inner));
    const listener = vi.fn();
    const unsubscribe = service.listen(context.context_id, listener);

    externalEdit((other) => other.deleteNode(inner));
    expect(listener).toHaveBeenCalled();
    const notifications = service.events(context.context_id);
    expect(notifications.ok).toBe(true);
    expect(notifications.requires_refocus).toBe(true);
    expect(notifications.focus.uri).toBe(scopeUri(outer));
    expect(notifications.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "focus_invalidated", requires_refocus: true, focus: expect.objectContaining({ uri: scopeUri(outer) }) }),
    ]));
    expect(service.events(context.context_id, notifications.event_cursor).events).toEqual([]);
    const before = saved();
    const blocked = service.call("m3e_create", { kind: "node", context_id: context.context_id, text: "Must not land elsewhere" });
    expect(blocked.ok).toBe(false);
    expect(blocked.error.code).toBe("FOCUS_INVALIDATED");
    expect(saved()).toEqual(before);
    // Reading new state alone is not a decision to resume on a changed focus.
    expect(service.call("m3e_get", { kind: "state", context_id: context.context_id }).ok).toBe(true);
    expect(service.call("m3e_create", { kind: "node", context_id: context.context_id, text: "Still blocked" }).error.code)
      .toBe("FOCUS_INVALIDATED");
    const focused = service.call("m3e_context", { action: "focus", context_id: context.context_id, target: scopeUri(outer) });
    expect(focused.ok).toBe(true);
    expect(focused.focus.uri).toBe(scopeUri(outer));
    const resumed = service.call("m3e_create", { kind: "node", context_id: context.context_id, text: "Reconsidered operation" });
    expect(resumed.ok).toBe(true);
    expect(loaded().state.nodes[outer].children.map((id) => loaded().state.nodes[id].text)).toEqual(["Reconsidered operation"]);
    const calls = listener.mock.calls.length;
    unsubscribe();
    externalEdit((other) => other.addNode(outer, "No listener delivery"));
    expect(listener).toHaveBeenCalledTimes(calls);
  });

  test.each([true, false])("rejects stale context after external edits (notification delivered: %s)", (notify) => {
    const context = enter();
    externalEdit((other) => other.addNode(other.state.rootId, "Other actor's change"), notify);
    const before = saved();
    const result = service.call("m3e_create", { kind: "node", context_id: context.context_id, text: "Stale operation" });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("REVISION_CONFLICT");
    expect(saved()).toEqual(before);
    expect(onSaved).not.toHaveBeenCalled();
    const acknowledged = service.call("m3e_context", { action: "focus", context_id: context.context_id, target: mapUri() });
    expect(acknowledged.ok).toBe(true);
    expect(acknowledged.revision).not.toBe(context.revision);
    const staleExplicit = service.call("m3e_create", {
      kind: "node", context_id: context.context_id, text: "Explicit stale revision", expected_revision: context.revision,
    });
    expect(staleExplicit.error.code).toBe("REVISION_CONFLICT");
    expect(service.call("m3e_create", { kind: "node", context_id: context.context_id, text: "Current operation" }).ok).toBe(true);
  });

  test("a missed deletion notification still blocks the write and retreats past deleted ancestors", () => {
    const outer = model.addNode(model.state.rootId, "Outer");
    const inner = model.addNode(outer, "Inner");
    model.state.nodes[outer].nodeType = "folder";
    model.state.nodes[inner].nodeType = "folder";
    model.saveToSqlite(dbPath, mapId);
    const context = enter(scopeUri(inner));
    externalEdit((other) => other.deleteNode(outer), false);
    const before = saved();
    const result = service.call("m3e_create", { context_id: context.context_id, kind: "node", text: "Stale destination" });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("FOCUS_INVALIDATED");
    expect(saved()).toEqual(before);
    expect(onSaved).not.toHaveBeenCalled();
    const events = service.events(context.context_id);
    expect(events.requires_refocus).toBe(true);
    expect(events.focus.uri).toBe(mapUri());
  });

  test("focus retreat follows refreshed ancestors after an unchanged subtree is moved indirectly", () => {
    const a = model.addNode(model.state.rootId, "Scope A");
    const b = model.addNode(model.state.rootId, "Scope B");
    const focused = model.addNode(a, "Focused scope");
    for (const id of [a, b, focused]) model.state.nodes[id].nodeType = "folder";
    model.saveToSqlite(dbPath, mapId);
    const context = enter(scopeUri(focused));
    externalEdit((other) => other.reparentNode(a, b));
    expect(service.events(context.context_id).events).toEqual([]);
    externalEdit((other) => other.deleteNode(a));
    const events = service.events(context.context_id);
    expect(events.requires_refocus).toBe(true);
    expect(events.focus.uri).toBe(scopeUri(b));
    expect(events.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "focus_invalidated", focus: expect.objectContaining({ uri: scopeUri(b) }) }),
    ]));
    const before = saved();
    const result = service.call("m3e_create", { kind: "node", context_id: context.context_id, text: "Must reconsider moved ancestor" });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("FOCUS_INVALIDATED");
    expect(saved()).toEqual(before);
  });

  test("subscribing and reading after a missed focus deletion cannot acknowledge the vanished boundary", () => {
    const a = model.addNode(model.state.rootId, "Scope A");
    const b = model.addNode(model.state.rootId, "Scope B");
    model.state.nodes[a].nodeType = "folder";
    model.state.nodes[b].nodeType = "folder";
    model.saveToSqlite(dbPath, mapId);
    const context = enter(scopeUri(a));
    externalEdit((other) => other.deleteNode(a), false);
    const before = saved();
    const subscribed = service.call("m3e_context", { action: "subscribe", context_id: context.context_id, target: mapUri() });
    expect(subscribed.ok).toBe(true);
    expect(subscribed.requires_refocus).toBe(true);
    expect(subscribed.focus.uri).toBe(mapUri());
    expect(service.call("m3e_get", { kind: "state", context_id: context.context_id, target: mapUri() }).ok).toBe(true);
    const result = service.call("m3e_create", { kind: "node", context_id: context.context_id, target: scopeUri(b), text: "Explicit target is not refocus" });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("FOCUS_INVALIDATED");
    expect(saved()).toEqual(before);
    expect(onSaved).not.toHaveBeenCalled();
  });

  test("a folder entered through a node URI still invalidates when its scope boundary is removed", () => {
    const folder = model.addNode(model.state.rootId, "Scope through node URI");
    model.state.nodes[folder].nodeType = "folder";
    model.saveToSqlite(dbPath, mapId);
    const context = enter(nodeUri(folder));
    expect(context.focus).toMatchObject({ kind: "scope", uri: scopeUri(folder) });
    externalEdit((other) => other.setScopeBoundary(folder, false));
    expect(service.call("m3e_get", { kind: "state", context_id: context.context_id }).ok).toBe(true);
    const before = saved();
    const result = service.call("m3e_create", { kind: "node", context_id: context.context_id, text: "Must reconsider boundary" });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("FOCUS_INVALIDATED");
    expect(saved()).toEqual(before);
  });

  test.each(["delete", "unscopen"])("the caller's own %s invalidates a vanished focused boundary", (operation) => {
    const outer = model.addNode(model.state.rootId, "Outer");
    const inner = model.addNode(outer, "Inner");
    model.state.nodes[outer].nodeType = "folder";
    model.state.nodes[inner].nodeType = "folder";
    model.saveToSqlite(dbPath, mapId);
    const context = enter(scopeUri(inner));
    const result = operation === "delete"
      ? service.call("m3e_delete", { context_id: context.context_id })
      : service.call("m3e_update", { context_id: context.context_id, kind: "unscopen" });
    expect(result.ok).toBe(true);
    expect(result.requires_refocus).toBe(true);
    expect(result.focus.uri).toBe(scopeUri(outer));
    expect(service.call("m3e_create", { context_id: context.context_id, kind: "node", text: "Unreviewed follow-up" }).error.code)
      .toBe("FOCUS_INVALIDATED");
    expect(service.events(context.context_id).events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "focus_invalidated", focus: expect.objectContaining({ uri: scopeUri(outer) }) }),
    ]));
  });

  test("a competing write between validation and commit cannot be overwritten", () => {
    const context = enter();
    const commit = RapidMvpModel.prototype.saveToSqliteIfUnchanged;
    const race = vi.spyOn(RapidMvpModel.prototype, "saveToSqliteIfUnchanged").mockImplementationOnce(function (...args) {
      const competitor = loaded();
      competitor.addNode(competitor.state.rootId, "Concurrent actor won the write lock");
      competitor.saveToSqlite(dbPath, mapId);
      return commit.apply(this, args);
    });
    const result = service.call("m3e_create", { kind: "node", context_id: context.context_id, text: "Losing stale update" });
    expect(race).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("REVISION_CONFLICT");
    const after = loaded();
    expect(after.state.nodes[after.state.rootId].children.map((id) => after.state.nodes[id].text))
      .toEqual(["Concurrent actor won the write lock"]);
    expect(onSaved).not.toHaveBeenCalled();
  });

  test("separate contexts retain their own focus and revisions while one context writes repeatedly", () => {
    const a = model.addNode(model.state.rootId, "Scope A");
    const b = model.addNode(model.state.rootId, "Scope B");
    model.state.nodes[a].nodeType = "folder";
    model.state.nodes[b].nodeType = "folder";
    model.saveToSqlite(dbPath, mapId);
    const first = enter(scopeUri(a));
    const second = enter(scopeUri(b));
    expect(first.context_id).not.toBe(second.context_id);
    for (const text of ["One", "Two"]) {
      expect(service.call("m3e_create", { kind: "node", context_id: first.context_id, text }).ok).toBe(true);
    }
    // Scope B is unchanged, so it can continue without a compensating read/refocus.
    expect(service.call("m3e_create", { kind: "node", context_id: second.context_id, text: "Only B" }).ok).toBe(true);
    const after = loaded();
    expect(after.state.nodes[a].children.map((id) => after.state.nodes[id].text)).toEqual(["One", "Two"]);
    expect(after.state.nodes[b].children.map((id) => after.state.nodes[id].text)).toEqual(["Only B"]);
    expect(service.call("m3e_context", { action: "leave", context_id: first.context_id }).ok).toBe(true);
    expect(service.call("m3e_get", { kind: "state", context_id: first.context_id }).ok).toBe(false);
    expect(service.call("m3e_get", { kind: "state", context_id: second.context_id }).ok).toBe(true);
  });

  test("unrelated scope edits are silent while relevant edits emit bounded changes and reject stale writes", () => {
    const a = model.addNode(model.state.rootId, "A");
    const b = model.addNode(model.state.rootId, "B");
    model.state.nodes[a].nodeType = "folder";
    model.state.nodes[b].nodeType = "folder";
    const aChild = model.addNode(a, "A original");
    const bChild = model.addNode(b, "B original");
    model.saveToSqlite(dbPath, mapId);
    const context = enter(scopeUri(a));
    externalEdit((other) => other.editNode(bChild, "B changed externally"));
    expect(service.events(context.context_id).events).toEqual([]);
    expect(service.call("m3e_create", { kind: "node", context_id: context.context_id, text: "Continue A" }).ok).toBe(true);
    externalEdit((other) => other.editNode(aChild, "A changed externally"));
    const events = service.events(context.context_id).events;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "map_changed", changed_count: 1, links_changed: false, requires_read: false,
      changed_nodes: [expect.objectContaining({ uri: nodeUri(aChild), change: "updated", text: "A changed externally" })],
    });
    const before = saved();
    const rejected = service.call("m3e_create", { kind: "node", context_id: context.context_id, text: "Needs reconsideration" });
    expect(rejected.ok).toBe(false);
    expect(rejected.error.code).toBe("REVISION_CONFLICT");
    expect(saved()).toEqual(before);
  });

  test("scope payload edits respect ownership, require rereading changed content and exclude outside surface views", () => {
    const a = model.addNode(model.state.rootId, "A");
    const b = model.addNode(model.state.rootId, "B");
    for (const id of [a, b]) model.state.nodes[id].nodeType = "folder";
    const inside = model.addNode(a, "Inside A");
    const outside = model.addNode(b, "Inside B");
    const aScope = `scope:${a}`;
    model.state.linearNotesByScope = { [a]: "Original A memo", [b]: "Original B memo" };
    model.state.scopes = { [aScope]: { id: aScope, label: "A", rootNodeIds: [inside], relationIds: [], primarySurfaceId: "a-surface" } };
    model.state.surfaces = { "a-surface": { id: "a-surface", scopeId: aScope, kind: "scatter", layout: "scatter", nodeViews: { [inside]: { x: 10 }, [outside]: { x: 20 } } } };
    model.saveToSqlite(dbPath, mapId);
    const context = enter(scopeUri(a));
    externalEdit((other) => {
      other.state.linearNotesByScope![b] = "Changed outside memo";
      other.state.surfaces!["a-surface"].nodeViews![outside] = { x: 900 };
    });
    expect(service.events(context.context_id).events).toEqual([]);
    expect(service.call("m3e_create", { kind: "node", context_id: context.context_id, text: "Continue unchanged A" }).ok).toBe(true);
    externalEdit((other) => { other.state.linearNotesByScope![a] = "Updated A memo"; });
    const events = service.events(context.context_id).events;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "map_changed", scope_payload_changed: true, requires_read: true });
    const before = saved();
    expect(service.call("m3e_create", { kind: "node", context_id: context.context_id, text: "Stale payload understanding" }).error.code)
      .toBe("REVISION_CONFLICT");
    expect(saved()).toEqual(before);
    const read = service.call("m3e_get", { kind: "state", context_id: context.context_id });
    expect(read.ok).toBe(true);
    expect(read.scope_payload).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "linear_note", key: a, value: "Updated A memo", content_truncated: false }),
      expect.objectContaining({ kind: "surface", key: "a-surface", value: expect.objectContaining({ nodeViews: { [inside]: { x: 10 } } }) }),
    ]));
    expect(read.scope_payload.some((entry: { key: string }) => entry.key === b)).toBe(false);
    expect(service.call("m3e_create", { kind: "node", context_id: context.context_id, text: "Reviewed payload" }).ok).toBe(true);
  });

  test("scope payload has independent pagination and explicitly marks an oversized note as truncated", () => {
    const a = model.addNode(model.state.rootId, "A");
    model.state.nodes[a].nodeType = "folder";
    const scope = `scope:${a}`;
    model.state.scopes = { [scope]: { id: scope, label: "A", rootNodeIds: [a], relationIds: [] } };
    model.state.linearNotesByScope = { [a]: "n".repeat(25_000) };
    model.saveToSqlite(dbPath, mapId);
    const first = service.call("m3e_get", { kind: "state", target: scopeUri(a), limit: 1 });
    expect(first.ok).toBe(true);
    expect(first.next_offset).toBeNull();
    expect(first.payload_total).toBe(2);
    expect(first.scope_payload).toHaveLength(1);
    expect(first.next_payload_offset).toBe(1);
    const second = service.call("m3e_get", { kind: "state", target: scopeUri(a), limit: 1, payload_offset: first.next_payload_offset });
    expect(second.ok).toBe(true);
    expect(second.next_payload_offset).toBeNull();
    expect(second.scope_payload).toHaveLength(1);
    const entries = [...first.scope_payload, ...second.scope_payload];
    expect(new Set(entries.map((entry) => entry.key)).size).toBe(2);
    const note = entries.find((entry) => entry.kind === "linear_note");
    expect(note.content_truncated).toBe(true);
    expect(note.value).toBeUndefined();
    expect(note.value_preview.length).toBeGreaterThan(0);
    expect(note.value_preview.length).toBeLessThan(25_000);
  });

  test("subscription changes leave focus in place and unsubscribe stops other-map delivery", () => {
    const otherMapId = "subscription-test";
    const otherUri = `m3e://maps/${otherMapId}`;
    const other = new RapidMvpModel("Subscription target");
    other.saveToSqlite(dbPath, otherMapId);
    const context = enter();
    const listener = vi.fn();
    const unsubscribeListener = service.listen(context.context_id, listener);
    const subscribed = service.call("m3e_context", { action: "subscribe", context_id: context.context_id, target: otherUri });
    expect(subscribed.ok).toBe(true);
    expect(subscribed.focus.uri).toBe(context.focus.uri);
    other.addNode(other.state.rootId, "First change");
    other.saveToSqlite(dbPath, otherMapId);
    service.notifyMapChanged(otherMapId);
    expect(listener).toHaveBeenCalled();
    const events = service.events(context.context_id);
    expect(events.events).toEqual(expect.arrayContaining([expect.objectContaining({ map_uri: otherUri, type: "map_changed" })]));
    const removed = service.call("m3e_context", { action: "unsubscribe", context_id: context.context_id, target: otherUri });
    expect(removed.ok).toBe(true);
    expect(removed.focus.uri).toBe(context.focus.uri);
    const delivered = listener.mock.calls.length;
    other.addNode(other.state.rootId, "Second change");
    other.saveToSqlite(dbPath, otherMapId);
    service.notifyMapChanged(otherMapId);
    expect(listener).toHaveBeenCalledTimes(delivered);
    unsubscribeListener();
  });

  test("bounded event retention signals a missing history window and accepts a retained cursor", () => {
    const context = enter();
    for (let i = 0; i < 300; i++) {
      model.editNode(model.state.rootId, `External change ${i}`);
      model.saveToSqlite(dbPath, mapId);
      service.notifyMapChanged(mapId);
    }
    const oldCursor = service.events(context.context_id, 0);
    expect(oldCursor.ok).toBe(true);
    expect(oldCursor.resync_required).toBe(true);
    expect(oldCursor.events.length).toBeGreaterThan(0);
    expect(oldCursor.events.length).toBeLessThan(300);
    expect(oldCursor.event_cursor).toBe(300);
    const earliestRetained = oldCursor.events[0].cursor;
    expect(earliestRetained).toBeGreaterThan(1);
    expect(service.events(context.context_id, earliestRetained - 1).resync_required).toBe(false);
    const current = service.events(context.context_id, oldCursor.event_cursor);
    expect(current.resync_required).toBe(false);
    expect(current.events).toEqual([]);
    expect(service.call("m3e_create", { kind: "node", context_id: context.context_id, text: "Cursor alone is not acknowledgment" }).error.code)
      .toBe("REVISION_CONFLICT");
  });

  test.each([
    ["omitted details", { details: "Full details require a read" }],
    ["truncated text", { text: "x".repeat(2500) }],
    ["too many attributes", { attributes: Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`key${i}`, `value${i}`])) }],
    ["truncated attribute value", { attributes: { long: "x".repeat(600) } }],
    ["truncated attribute key", { attributes: { ["key".repeat(40)]: "value" } }],
  ])("an incomplete event delta requires a read: %s", (_case, patch) => {
    const child = model.addNode(model.state.rootId, "Original");
    model.saveToSqlite(dbPath, mapId);
    const context = enter();
    externalEdit((other) => { Object.assign(other.state.nodes[child], patch); });
    const events = service.events(context.context_id).events;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "map_changed", changed_count: 1, requires_read: true });
  });

  test("content, move, scopen, unscopen and delete reuse the retained context", () => {
    const a = model.addNode(model.state.rootId, "A");
    const b = model.addNode(model.state.rootId, "B");
    const child = model.addNode(a, "Descendant");
    model.saveToSqlite(dbPath, mapId);
    const context = enter();
    const update = (kind: string, args: Record<string, unknown> = {}) => {
      const result = service.call("m3e_update", { context_id: context.context_id, target: nodeUri(a), kind, ...args });
      expect(result.ok).toBe(true);
    };
    update("content", { text: "Renamed A" });
    update("move", { parent: nodeUri(b) });
    update("scopen");
    expect(loaded().state.nodes[a].nodeType).toBe("folder");
    update("unscopen");
    const beforeDelete = loaded();
    expect(beforeDelete.state.nodes[a].nodeType).not.toBe("folder");
    expect(beforeDelete.state.nodes[a].text).toBe("Renamed A");
    expect(beforeDelete.state.nodes[b].children).toEqual([a]);
    expect(beforeDelete.state.nodes[a].children).toEqual([child]);
    expect(beforeDelete.state.nodes[child].parentId).toBe(a);
    expect(service.call("m3e_delete", { context_id: context.context_id, target: nodeUri(a) }).ok).toBe(true);
    const after = loaded();
    expect(after.validate()).toEqual([]);
    expect(after.state.nodes[a]).toBeUndefined();
    expect(after.state.nodes[child]).toBeUndefined();
    expect(after.state.nodes[b].children).toEqual([]);
    expect(onSaved).toHaveBeenCalledTimes(5);
  });

  test("attribute patches merge and remove explicit keys while preserving unrelated metadata", () => {
    const node = model.addNode(model.state.rootId, "Retain this title");
    Object.assign(model.state.nodes[node], {
      details: "Retain details", note: "Retain note", link: "https://example.test/retained", collapsed: true,
      attributes: { color: "#456789", retained: "unchanged", replaced: "before", removed: "delete me" },
    });
    model.saveToSqlite(dbPath, mapId);
    const before = loaded().state.nodes[node];
    const context = enter();
    const result = service.call("m3e_update", {
      kind: "content", context_id: context.context_id, target: nodeUri(node),
      attributes: { replaced: "after", removed: null, added: "new value" },
    });
    expect(result.ok).toBe(true);
    expect(loaded().state.nodes[node]).toEqual({
      ...before, attributes: { color: "#456789", retained: "unchanged", replaced: "after", added: "new value" },
    });
    const after = saved();
    const invalid = service.call("m3e_update", {
      kind: "content", context_id: context.context_id, target: nodeUri(node),
      text: "Must not save partial edit", attributes: { invalid: 7 },
    });
    expect(invalid.ok).toBe(false);
    expect(saved()).toEqual(after);
    expect(onSaved).toHaveBeenCalledTimes(1);
    const created = service.call("m3e_create", {
      kind: "node", context_id: context.context_id, text: "Created with metadata", attributes: { owner: "human", color: "#112233" },
    });
    expect(created.ok).toBe(true);
    expect(Object.values(loaded().state.nodes).find((item) => item.text === "Created with metadata")?.attributes)
      .toEqual({ owner: "human", color: "#112233" });
  });

  test("a blocked storage owner rejects writes before saving while reads remain available", () => {
    service = new M3eMcpService({
      dbPath: () => dbPath, feedbackDir: () => feedbackDir, onSaved,
      canWrite: () => "The active storage owner does not support atomic MCP writes.",
    });
    const context = enter();
    const before = saved();
    expect(service.call("m3e_get", { kind: "state", context_id: context.context_id }).ok).toBe(true);
    const result = service.call("m3e_create", { kind: "node", context_id: context.context_id, text: "Blocked mutation" });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("WRITE_UNAVAILABLE");
    expect(saved()).toEqual(before);
    expect(onSaved).not.toHaveBeenCalled();
  });

  test("a failing post-save observer does not falsely report that an already committed write failed", () => {
    onSaved.mockImplementation(() => { throw new Error("Observer delivery unavailable"); });
    const context = enter();
    const result = service.call("m3e_create", { kind: "node", context_id: context.context_id, text: "Committed exactly once" });
    expect(result.ok).toBe(true);
    expect(result.changed.created).toBe(1);
    const after = loaded();
    expect(after.state.nodes[after.state.rootId].children.map((id) => after.state.nodes[id].text)).toEqual(["Committed exactly once"]);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test("state and search pagination cover every result once without implicit context entry", () => {
    for (let i = 0; i < 9; i++) model.addNode(model.state.rootId, `Match ${i}`);
    model.saveToSqlite(dbPath, mapId);
    const expected = new Set(Object.keys(loaded().state.nodes).map((id) => id === model.state.rootId ? mapUri() : nodeUri(id)));
    const seen = new Set<string>();
    let offset = 0;
    do {
      const page = service.call("m3e_get", { kind: "state", target: mapUri(), offset, limit: 3 });
      expect(page.ok).toBe(true);
      expect(page.total).toBe(10);
      expect(page.context_id).toBeUndefined();
      expect(page.nodes.length).toBeLessThanOrEqual(3);
      for (const node of page.nodes) {
        expect(seen.has(node.uri)).toBe(false);
        seen.add(node.uri);
      }
      offset = page.next_offset;
    } while (offset != null);
    expect(seen).toEqual(expected);
    const search = service.call("m3e_get", { kind: "search", target: mapUri(), query: "Match", offset: 2, limit: 3 });
    expect(search.ok).toBe(true);
    expect(search.total).toBe(9);
    expect(search.items).toHaveLength(3);
    expect(search.next_offset).toBe(5);
  });

  test("search respects an explicit subtree and the retained focus instead of crossing into other scopes or maps", () => {
    const scope = model.addNode(model.state.rootId, "Focused scope");
    model.state.nodes[scope].nodeType = "folder";
    const inside = model.addNode(scope, "Needle inside focus");
    model.addNode(model.state.rootId, "Needle outside focus");
    model.saveToSqlite(dbPath, mapId);
    const other = new RapidMvpModel("Other map");
    other.addNode(other.state.rootId, "Needle in another map");
    other.saveToSqlite(dbPath, "other-search-map");
    const context = enter(scopeUri(scope));
    for (const args of [{ target: scopeUri(scope) }, { context_id: context.context_id }]) {
      const result = service.call("m3e_get", { kind: "search", query: "Needle", ...args });
      expect(result.ok).toBe(true);
      expect(result.total).toBe(1);
      expect(result.items).toEqual([expect.objectContaining({ uri: nodeUri(inside), name: "Needle inside focus" })]);
    }
    expect(service.call("m3e_get", { kind: "search", query: "Needle" }).total).toBe(3);
    expect(service.call("m3e_get", { kind: "search", query: "Needle", target: "m3e://maps/missing" }).ok).toBe(false);
  });

  test("feedback preserves 5W1H on disk across fresh service instances", () => {
    const context = enter();
    const feedback = {
      context_id: context.context_id, what: "Copy preserved all descendants", why: "Verify continuity",
      where: mapUri(), when: "2026-10-15T01:02:03+09:00", who: "Verification agent", how: "Independent persisted-state readback",
    };
    expect(service.call("m3e_feedback", feedback).ok).toBe(true);
    const files = () => fs.readdirSync(feedbackDir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(entry.parentPath, entry.name));
    const firstFiles = files();
    expect(firstFiles.length).toBeGreaterThan(0);
    const firstBytes = firstFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
    for (const [key, value] of Object.entries(feedback)) {
      if (key !== "context_id") expect(firstBytes).toContain(value);
    }
    const fresh = new M3eMcpService({ dbPath: () => dbPath, feedbackDir: () => feedbackDir });
    expect(fresh.call("m3e_feedback", { what: "New session reproduction", how: "Read prior feedback" }).ok).toBe(true);
    const finalBytes = files().map((file) => fs.readFileSync(file, "utf8")).join("\n");
    expect(finalBytes).toContain("Copy preserved all descendants");
    expect(finalBytes).toContain("New session reproduction");
    expect(onSaved).not.toHaveBeenCalled();
  });
});
