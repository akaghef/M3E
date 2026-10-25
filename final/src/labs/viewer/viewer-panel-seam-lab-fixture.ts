export type PanelSelectionKind = "node" | "graph-link" | "multiple" | "none";

export interface PanelFixtureNode {
  id: string;
  parentId: string | null;
  children: string[];
  nodeType: "text" | "folder" | "alias";
  text: string;
  details: string;
  note: string;
  attributes: Record<string, string>;
  aliasLabel?: string;
  targetNodeId?: string;
  access?: "read" | "write";
  isBroken?: boolean;
  targetSnapshotLabel?: string;
}
export interface PanelFixtureGraphLink {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: string;
  label: string;
}

export interface PanelFixtureState {
  rootId: string;
  nodes: Record<string, PanelFixtureNode>;
  links: Record<string, PanelFixtureGraphLink>;
  annotations: Record<string, unknown>;
}

export interface PanelFixtureFileEntry {
  name: string;
  relativePath: string;
  kind: "directory" | "file";
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
  hasChildren?: boolean;
}

export interface PanelFixtureFileTree {
  id: "workspace" | "empty" | "notes";
  rootPath: string;
  entriesByPath: Record<string, PanelFixtureFileEntry[]>;
  contents: Record<string, string>;
}

export interface PanelFixtureDraft {
  id: string;
  mapId: string;
  sourceType: string;
  sourceRef: string;
  title: string;
  nodeCount: number;
  status: "pending" | "applied" | "rejected";
  createdAt: string;
}

export interface PanelFixture {
  localState: PanelFixtureState;
  remoteStates: Record<"same" | "changed" | "added", PanelFixtureState>;
  fileTrees: Record<PanelFixtureFileTree["id"], PanelFixtureFileTree>;
  drafts: PanelFixtureDraft[];
  workspaceId: string;
  workspaceLabel: string;
  mapId: string;
  mapLabel: string;
  mapSlug: string;
  savedAt: string;
  presence: Record<string, Array<{ userId: string; color: string }>>;
  changedNodeIds: string[];
  scopeLocks: Record<string, { entityId: string; displayName: string; priority: number }>;
  vault: {
    path: string;
    sourceOfTruth: "vault-md";
    running: boolean;
    lastInboundAt: string | null;
    lastOutboundAt: string | null;
    lastError: string | null;
  };
}

const FIXTURE_SAVED_AT = "2026-08-27T09:00:00.000Z";
const FIXTURE_MODIFIED_AT = "2026-08-27T08:30:00.000Z";

function node(
  id: string,
  parentId: string | null,
  text: string,
  options: Partial<Omit<PanelFixtureNode, "id" | "parentId" | "text">> = {},
): PanelFixtureNode {
  return {
    id,
    parentId,
    children: [],
    nodeType: "text",
    text,
    details: "",
    note: "",
    attributes: {},
    ...options,
  };
}

function baseState(): PanelFixtureState {
  const root = node("root", null, "Viewer panel fixture", {
    nodeType: "folder",
    details: "Synthetic AppState for the viewer panel seam lab.",
    attributes: { "m3e:scope": "root" },
  });
  const scope = node("scope", root.id, "Scope State", {
    nodeType: "folder",
    details: "Folder nodes become scope entries in the entity list.",
  });
  const overview = node("overview", root.id, "Panel seams", {
    details: "# Panel seams\n\nThis is the selected node detail.\n\n- deterministic fixture\n- no server connection",
    note: "The Markdown preview reads details and note from the selected node.",
    attributes: {
      "m3e:sourceType": "fixture",
      "m3e:sourceUrl": "fixture://panel-seams",
      "secret:lock": "none",
    },
  });
  const nodeA = node("node-a", scope.id, "Local branch", {
    details: "Local branch details.",
    attributes: { "m3e:sourceType": "markdown", "vault:path": "notes/local-branch.md" },
  });
  const nodeB = node("node-b", scope.id, "Shared branch", {
    details: "Shared branch details.",
    note: "This node is marked as changed by the deterministic away-change fixture.",
  });
  const markdown = node("markdown", root.id, "Markdown source", {
    details: "## Markdown source\n\n**Selected node** supplies this body to the lifted preview.\n\n`renderMarkdownInto` is the current viewer renderer.",
    note: "A second paragraph comes from TreeNode.note.",
    attributes: {
      "m3e:sourceType": "markdown",
      "m3e:sourceUrl": "fixture://markdown-source",
      "vault:kind": "markdown",
      "vault:path": "notes/markdown-source.md",
      "secret:lock": "unlocked",
    },
  });
  const alias = node("alias", root.id, "Shared branch alias", {
    nodeType: "alias",
    targetNodeId: nodeB.id,
    access: "read",
  });
  root.children = [overview.id, scope.id, markdown.id, alias.id];
  scope.children = [nodeA.id, nodeB.id];

  return {
    rootId: root.id,
    nodes: { root, scope, overview, "node-a": nodeA, "node-b": nodeB, markdown, alias },
    links: {
      "link-related": {
        id: "link-related",
        sourceNodeId: overview.id,
        targetNodeId: markdown.id,
        relationType: "documents",
        label: "documents",
      },
    },
    annotations: {},
  };
}

export function clonePanelFixtureState(state: PanelFixtureState): PanelFixtureState {
  return JSON.parse(JSON.stringify(state)) as PanelFixtureState;
}

function remoteVariant(kind: "same" | "changed" | "added", local: PanelFixtureState): PanelFixtureState {
  const remote = clonePanelFixtureState(local);
  if (kind === "changed") {
    remote.nodes["node-b"]!.text = "Remote branch";
    remote.nodes["node-b"]!.details = "Remote branch details changed outside this tab.";
  }
  if (kind === "added") {
    const remoteOnly = node("remote-only", "scope", "Remote-only node", {
      details: "Added by the remote fixture.",
    });
    remote.nodes[remoteOnly.id] = remoteOnly;
    remote.nodes.scope!.children.push(remoteOnly.id);
  }
  return remote;
}

function fileTree(
  id: PanelFixtureFileTree["id"],
  rootPath: string,
  entriesByPath: Record<string, PanelFixtureFileEntry[]>,
  contents: Record<string, string>,
): PanelFixtureFileTree {
  return { id, rootPath, entriesByPath, contents };
}

function fileEntry(
  name: string,
  relativePath: string,
  kind: PanelFixtureFileEntry["kind"],
  extension: string,
  sizeBytes: number,
  hasChildren = false,
): PanelFixtureFileEntry {
  return {
    name,
    relativePath,
    kind,
    extension,
    sizeBytes,
    modifiedAt: FIXTURE_MODIFIED_AT,
    ...(kind === "directory" ? { hasChildren } : {}),
  };
}

export function createViewerPanelFixture(): PanelFixture {
  const localState = baseState();
  const workspace = fileTree(
    "workspace",
    "C:\\m3e\\fixture\\workspace",
    {
      "": [
        fileEntry("docs", "docs", "directory", "", 0, true),
        fileEntry("README.md", "README.md", "file", ".md", 428),
        fileEntry("map.json", "map.json", "file", ".json", 2180),
      ],
      docs: [
        fileEntry("overview.md", "docs/overview.md", "file", ".md", 712),
        fileEntry("notes", "docs/notes", "directory", "", 0, true),
      ],
      "docs/notes": [fileEntry("panel-contract.md", "docs/notes/panel-contract.md", "file", ".md", 990)],
    },
    {
      "README.md": "# Fixture workspace\n\nA deterministic local filesystem panel input.",
      "map.json": JSON.stringify({ version: 1, state: { rootId: "root" } }, null, 2),
      "docs/overview.md": "## Overview\n\nThe file list is supplied without /api/local-fs.",
      "docs/notes/panel-contract.md": "# Panel contract\n\nRead-only fixture content.",
    },
  );
  const empty = fileTree("empty", "C:\\m3e\\fixture\\empty", { "": [] }, {});
  const notes = fileTree(
    "notes",
    "C:\\m3e\\fixture\\notes",
    { "": [fileEntry("meeting.md", "meeting.md", "file", ".md", 240)] },
    { "meeting.md": "# Meeting notes\n\nA second deterministic file list." },
  );

  return {
    localState,
    remoteStates: {
      same: remoteVariant("same", localState),
      changed: remoteVariant("changed", localState),
      added: remoteVariant("added", localState),
    },
    fileTrees: { workspace, empty, notes },
    drafts: [
      {
        id: "draft-fixture-pending",
        mapId: "map_fixture_viewer_panels",
        sourceType: "markdown",
        sourceRef: "fixture://pending-draft",
        title: "Pending panel notes",
        nodeCount: 3,
        status: "pending",
        createdAt: FIXTURE_SAVED_AT,
      },
      {
        id: "draft-fixture-applied",
        mapId: "map_fixture_viewer_panels",
        sourceType: "text",
        sourceRef: "fixture://applied-draft",
        title: "Applied sample",
        nodeCount: 2,
        status: "applied",
        createdAt: "2026-08-26T12:00:00.000Z",
      },
    ],
    workspaceId: "ws_fixture_viewer_panels",
    workspaceLabel: "Fixture workspace",
    mapId: "map_fixture_viewer_panels",
    mapLabel: "Viewer panel fixtures",
    mapSlug: "viewer-panel-fixtures",
    savedAt: FIXTURE_SAVED_AT,
    presence: {
      "node-b": [
        { userId: "team-alice", color: "#e64980" },
        { userId: "team-bob", color: "#2f9e44" },
      ],
    },
    changedNodeIds: ["node-b"],
    scopeLocks: {
      scope: { entityId: "team-alice", displayName: "Alice", priority: 10 },
    },
    vault: {
      path: "C:\\m3e\\fixture\\vault",
      sourceOfTruth: "vault-md",
      running: false,
      lastInboundAt: null,
      lastOutboundAt: null,
      lastError: null,
    },
  };
}
