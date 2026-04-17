import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const runtimeDir = __dirname;
const specPath = path.join(runtimeDir, "runtime_spec.json");
const apiBase = `http://127.0.0.1:${process.env.M3E_PORT || "4173"}`;
const workspaceId = process.env.M3E_WS || "ws_REMH1Z5TFA7S93R3HA0XK58JNR";

function sanitizeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "node";
}

function styleObject(fill, border, text) {
  const style = {};
  if (fill) style.fill = fill;
  if (border) style.border = border;
  if (text) style.text = text;
  return JSON.stringify(style);
}

function cloneAttributes(attributes = {}) {
  return { ...attributes };
}

function makeNode(id, text, parentId, extra = {}) {
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
    ...extra,
  };
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function loadSpec() {
  const raw = await fs.readFile(specPath, "utf8");
  return JSON.parse(raw);
}

async function ensureMapId(label) {
  const mapsPayload = await fetchJson(`${apiBase}/api/maps`);
  const existing = (mapsPayload.maps || []).find((map) => map.label === label);
  if (existing) {
    return existing.id;
  }
  const created = await fetchJson(`${apiBase}/api/maps/new`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({}),
  });
  const mapId = created.mapId || created.id;
  await fetchJson(`${apiBase}/api/maps/${encodeURIComponent(mapId)}/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ label }),
  });
  return mapId;
}

function taskStateStyle(state) {
  switch (state) {
    case "done":
      return styleObject("#d4edda", "#2d8c4e");
    case "doing":
      return styleObject("#fff3cd", "#d58900");
    case "ready":
      return styleObject("#e1ecff", "#5a8dff");
    case "review":
      return styleObject("#efe3ff", "#8b5cf6");
    case "blocked":
      return styleObject("#f8d7da", "#d94040");
    default:
      return styleObject("#ffffff", "#bbbbbb");
  }
}

function reviewImportanceFill(importance) {
  switch (importance) {
    case "high":
      return "#9ec5ff";
    case "medium":
      return "#e1ecff";
    default:
      return "#ffffff";
  }
}

function reviewUrgencyBorder(urgency) {
  switch (urgency) {
    case "high":
      return "#ff0000";
    case "medium":
      return "#ffb074";
    default:
      return "#bdbdbd";
  }
}

function optionConfidenceFill(confidence, selected) {
  if (selected) return "#d4edda";
  switch (confidence) {
    case "high":
      return "#d4edda";
    case "medium":
      return "#fff3cd";
    default:
      return "#ffffff";
  }
}

function buildFileDetails(relativePath) {
  const absolutePath = path.resolve(repoRoot, relativePath).replace(/\\/g, "/");
  return [
    `File: \`${relativePath}\``,
    "",
    `Absolute: \`${absolutePath}\``,
  ].join("\n");
}

function buildExternalMapDetails(mapId, label) {
  const viewerUrl = `./viewer.html?ws=${encodeURIComponent(workspaceId)}&map=${encodeURIComponent(mapId)}`;
  return [
    `External map: \`${label}\``,
    "",
    `Map ID: \`${mapId}\``,
    "",
    `Viewer: ${viewerUrl}`,
  ].join("\n");
}

function buildState(spec, mapId) {
  const nodes = {};
  const links = {};

  function addNode(node) {
    if (nodes[node.id]) {
      throw new Error(`Duplicate node id: ${node.id}`);
    }
    nodes[node.id] = node;
    if (node.parentId) {
      if (!nodes[node.parentId]) {
        throw new Error(`Missing parent for ${node.id}: ${node.parentId}`);
      }
      nodes[node.parentId].children.push(node.id);
    }
    return node.id;
  }

  const rootId = "pj02_runtime_root";
  const progressScopeId = "scope_progress";
  const reviewScopeId = "scope_review";
  const workspaceScopeId = "scope_workspace";
  const progressMetaId = "progress_meta";
  const progressDagId = "progress_dag";

  addNode(makeNode(rootId, spec.rootLabel, null, {
    nodeType: "folder",
    details: [
      "# PJ02 Runtime",
      "",
      "This master map is meant to be opened as three scope windows:",
      "",
      `- Progress Board: ./viewer.html?ws=${workspaceId}&map=${mapId}&scope=${progressScopeId}`,
      `- Review: ./viewer.html?ws=${workspaceId}&map=${mapId}&scope=${reviewScopeId}`,
      `- Active Workspace: ./viewer.html?ws=${workspaceId}&map=${mapId}&scope=${workspaceScopeId}`,
    ].join("\n"),
    attributes: {
      "m3e:style": styleObject("#ffffff", "#9ec5ff"),
      "runtime:kind": "runtime-root",
    },
  }));

  addNode(makeNode(progressScopeId, "Progress Board", rootId, {
    nodeType: "folder",
    attributes: {
      "m3e:style": styleObject("#ffffff", "#5a8dff"),
      "m3e:facet": "task-management",
      "m3e:display-role": "scope",
      "runtime:kind": "scope",
    },
    details: [
      "PJ progress DAG.",
      "",
      "Use this scope to judge:",
      "- current phase",
      "- blocker / review / ready state",
      "- which task depends on which other task",
    ].join("\n"),
  }));

  addNode(makeNode(reviewScopeId, "Review", rootId, {
    nodeType: "folder",
    attributes: {
      "m3e:style": styleObject("#ffffff", "#8b5cf6"),
      "m3e:facet": "reviews",
      "m3e:display-role": "scope",
      "runtime:kind": "scope",
    },
    details: [
      "Review queue for PJ02 runtime.",
      "",
      "Review Mode itself is owned by another team; this scope is still the queue of truth.",
    ].join("\n"),
  }));

  addNode(makeNode(workspaceScopeId, "Active Workspace", rootId, {
    nodeType: "folder",
    attributes: {
      "m3e:style": styleObject("#ffffff", "#2d8c4e"),
      "m3e:facet": "document",
      "m3e:display-role": "scope",
      "runtime:kind": "scope",
    },
    details: [
      "Drill-down surface.",
      "",
      "Each workspace node traces back to the actual files or external maps that justify board state.",
    ].join("\n"),
  }));

  addNode(makeNode(progressMetaId, "Meta", progressScopeId, {
    nodeType: "folder",
    attributes: {
      "m3e:style": styleObject("#f5f5f5", "#9ec5ff"),
      "m3e:synthetic": "anchor",
      "runtime:kind": "meta-anchor",
    },
  }));

  addNode(makeNode(progressDagId, "Task DAG", progressScopeId, {
    nodeType: "folder",
    attributes: {
      "m3e:style": styleObject("#ffffff", "#5a8dff"),
      "runtime:kind": "task-dag",
    },
    details: "Dependency-oriented progress board for PJ02.",
  }));

  addNode(makeNode("meta_phase", "Current Phase", progressMetaId, {
    details: spec.currentPhase,
    note: spec.currentPhase,
    attributes: {
      "m3e:style": styleObject("#ffffff", "#5a8dff"),
      "runtime:kind": "meta",
    },
  }));

  addNode(makeNode("meta_gate", "Next Gate", progressMetaId, {
    details: spec.nextGate,
    note: "human gate",
    attributes: {
      "m3e:style": styleObject("#fff3cd", "#d58900"),
      "runtime:kind": "meta",
    },
  }));

  addNode(makeNode("meta_handshake", "Chat Handshake", progressMetaId, {
    details: spec.manualHandshake,
    note: "manual only",
    attributes: {
      "m3e:style": styleObject("#ffffff", "#bdbdbd"),
      "runtime:kind": "meta",
    },
  }));

  addNode(makeNode("meta_counts", "Board Summary", progressMetaId, {
    details: "Counts will be updated by sync_runtime_state.mjs.",
    note: "pending sync",
    attributes: {
      "m3e:style": styleObject("#ffffff", "#9ec5ff"),
      "runtime:kind": "meta",
    },
  }));

  addNode(makeNode("meta_views", "Open These Views", progressMetaId, {
    details: [
      `Progress Board: ./viewer.html?ws=${workspaceId}&map=${mapId}&scope=${progressScopeId}`,
      `Review: ./viewer.html?ws=${workspaceId}&map=${mapId}&scope=${reviewScopeId}`,
      `Active Workspace: ./viewer.html?ws=${workspaceId}&map=${mapId}&scope=${workspaceScopeId}`,
    ].join("\n\n"),
    note: "3-window runtime",
    attributes: {
      "m3e:style": styleObject("#ffffff", "#2d8c4e"),
      "runtime:kind": "meta",
    },
  }));

  const workspaceNodeIds = {};
  for (const workspace of spec.workspaces || []) {
    const workspaceNodeId = `ws_${sanitizeId(workspace.id)}`;
    workspaceNodeIds[workspace.id] = workspaceNodeId;
    addNode(makeNode(workspaceNodeId, workspace.title, workspaceScopeId, {
      nodeType: "folder",
      details: workspace.summary,
      note: workspace.id,
      attributes: {
        "m3e:style": styleObject("#ffffff", "#2d8c4e"),
        "runtime:kind": "workspace",
        "runtime:id": workspace.id,
      },
    }));

    addNode(makeNode(`${workspaceNodeId}_summary`, "Summary", workspaceNodeId, {
      details: workspace.summary,
      note: "workspace summary",
      attributes: {
        "m3e:style": styleObject("#ffffff", "#bdbdbd"),
        "runtime:kind": "workspace-summary",
      },
    }));

    for (const relativePath of workspace.files || []) {
      addNode(makeNode(`${workspaceNodeId}_file_${sanitizeId(relativePath)}`, path.basename(relativePath), workspaceNodeId, {
        details: buildFileDetails(relativePath),
        note: relativePath,
        attributes: {
          "m3e:style": styleObject("#ffffff", "#9ec5ff"),
          "runtime:kind": "workspace-file",
          "runtime:path": relativePath,
        },
      }));
    }

    for (const externalMap of workspace.externalMaps || []) {
      addNode(makeNode(`${workspaceNodeId}_ext_${sanitizeId(externalMap.mapId)}`, externalMap.label, workspaceNodeId, {
        details: buildExternalMapDetails(externalMap.mapId, externalMap.label),
        note: externalMap.mapId,
        attributes: {
          "m3e:style": styleObject("#ffffff", "#8b5cf6"),
          "runtime:kind": "workspace-external-map",
          "runtime:map-id": externalMap.mapId,
        },
      }));
    }
  }

  const reviewNodeIds = {};
  const reviewAnchorIds = {};
  for (const review of spec.reviews || []) {
    const anchorKey = sanitizeId(review.anchor);
    let anchorId = reviewAnchorIds[anchorKey];
    if (!anchorId) {
      anchorId = `review_anchor_${anchorKey}`;
      reviewAnchorIds[anchorKey] = anchorId;
      addNode(makeNode(anchorId, review.anchor, reviewScopeId, {
        nodeType: "folder",
        attributes: {
          "m3e:style": styleObject("#ffffff", "#8b5cf6"),
          "m3e:synthetic": "anchor",
          "runtime:kind": "review-anchor",
        },
      }));
    }

    const reviewNodeId = `review_${sanitizeId(review.id)}`;
    reviewNodeIds[review.id] = reviewNodeId;
    addNode(makeNode(reviewNodeId, review.question, anchorId, {
      nodeType: "folder",
      note: `${review.status} | importance=${review.importance} | urgency=${review.urgency}`,
      details: [
        `Status: \`${review.status}\``,
        `Importance: \`${review.importance}\``,
        `Urgency: \`${review.urgency}\``,
      ].join("\n\n"),
      attributes: {
        status: review.status,
        importance: review.importance,
        urgency: review.urgency,
        "m3e:style": styleObject(
          reviewImportanceFill(review.importance),
          reviewUrgencyBorder(review.urgency),
        ),
        "runtime:kind": "review-question",
        "runtime:id": review.id,
      },
    }));

    for (const workspaceRef of review.workspaceRefs || []) {
      const workspaceTarget = workspaceNodeIds[workspaceRef];
      if (!workspaceTarget) continue;
      addNode(makeNode(`${reviewNodeId}_alias_ws_${sanitizeId(workspaceRef)}`, nodes[workspaceTarget].text, reviewNodeId, {
        nodeType: "alias",
        aliasLabel: `Workspace: ${nodes[workspaceTarget].text}`,
        targetNodeId: workspaceTarget,
        access: "read",
        attributes: {
          "m3e:style": styleObject("#ffffff", "#2d8c4e"),
          "runtime:kind": "review-workspace-alias",
        },
      }));
    }

    for (const option of review.options || []) {
      const optionNodeId = `${reviewNodeId}_option_${sanitizeId(option.id)}`;
      addNode(makeNode(optionNodeId, option.text, reviewNodeId, {
        nodeType: "folder",
        note: `confidence=${option.confidence}${option.selected ? " | selected=yes" : ""}`,
        attributes: {
          confidence: option.confidence,
          ...(option.selected ? { selected: "yes" } : {}),
          "m3e:style": styleObject(
            optionConfidenceFill(option.confidence, option.selected),
            option.selected ? "#2d8c4e" : "#bdbdbd",
          ),
          "runtime:kind": "review-option",
        },
      }));

      for (const pro of option.pros || []) {
        addNode(makeNode(`${optionNodeId}_pro_${sanitizeId(pro)}`, `Pro: ${pro}`, optionNodeId, {
          attributes: {
            "m3e:style": styleObject("#ffffff", "#2d8c4e"),
            "runtime:kind": "review-pro",
          },
        }));
      }
      for (const con of option.cons || []) {
        addNode(makeNode(`${optionNodeId}_con_${sanitizeId(con)}`, `Con: ${con}`, optionNodeId, {
          attributes: {
            "m3e:style": styleObject("#ffffff", "#d94040"),
            "runtime:kind": "review-con",
          },
        }));
      }
    }
  }

  const taskNodeIds = {};
  const taskLinkPairs = new Set();
  const sortedTasks = [...(spec.tasks || [])];
  for (const task of sortedTasks) {
    const taskNodeId = `task_${sanitizeId(task.id)}`;
    taskNodeIds[task.id] = taskNodeId;
    const parentTaskId = (task.dependsOn || []).length > 0 ? task.dependsOn[task.dependsOn.length - 1] : null;
    const parentId = parentTaskId ? taskNodeIds[parentTaskId] : progressDagId;
    addNode(makeNode(taskNodeId, task.title, parentId, {
      nodeType: "folder",
      note: `${task.baseState} | phase=${task.phase}`,
      details: [
        task.summary,
        "",
        `Base state: \`${task.baseState}\``,
        `Phase: \`${task.phase}\``,
      ].join("\n"),
      attributes: {
        status: task.baseState,
        "m3e:style": taskStateStyle(task.baseState === "gate" ? "review" : task.baseState),
        "runtime:kind": "task",
        "runtime:id": task.id,
        "runtime:phase": task.phase,
        "runtime:base-state": task.baseState,
        "runtime:deps": (task.dependsOn || []).join(","),
        "runtime:review-refs": (task.reviewRefs || []).join(","),
        "runtime:workspace-refs": (task.workspaceRefs || []).join(","),
      },
    }));

    for (const workspaceRef of task.workspaceRefs || []) {
      const workspaceTarget = workspaceNodeIds[workspaceRef];
      if (!workspaceTarget) continue;
      addNode(makeNode(`${taskNodeId}_alias_ws_${sanitizeId(workspaceRef)}`, nodes[workspaceTarget].text, taskNodeId, {
        nodeType: "alias",
        aliasLabel: `Workspace: ${nodes[workspaceTarget].text}`,
        targetNodeId: workspaceTarget,
        access: "read",
        attributes: {
          "m3e:style": styleObject("#ffffff", "#2d8c4e"),
          "runtime:kind": "task-workspace-alias",
        },
      }));
    }

    for (const reviewRef of task.reviewRefs || []) {
      const reviewTarget = reviewNodeIds[reviewRef];
      if (!reviewTarget) continue;
      addNode(makeNode(`${taskNodeId}_alias_review_${sanitizeId(reviewRef)}`, nodes[reviewTarget].text, taskNodeId, {
        nodeType: "alias",
        aliasLabel: "Review dependency",
        targetNodeId: reviewTarget,
        access: "read",
        attributes: {
          "m3e:style": styleObject("#ffffff", "#8b5cf6"),
          "runtime:kind": "task-review-alias",
        },
      }));
    }

    const extraDeps = (task.dependsOn || []).slice(0, -1);
    for (const depId of extraDeps) {
      const sourceTaskNodeId = taskNodeIds[depId];
      if (!sourceTaskNodeId) continue;
      const pairKey = `${sourceTaskNodeId}->${taskNodeId}`;
      if (taskLinkPairs.has(pairKey)) continue;
      taskLinkPairs.add(pairKey);
      links[`link_${sanitizeId(depId)}__${sanitizeId(task.id)}`] = {
        id: `link_${sanitizeId(depId)}__${sanitizeId(task.id)}`,
        sourceNodeId: sourceTaskNodeId,
        targetNodeId: taskNodeId,
        relationType: "depends-on",
        direction: "forward",
        style: "emphasis",
      };
    }
  }

  return {
    rootId,
    nodes,
    links,
  };
}

async function main() {
  const spec = await loadSpec();
  const mapId = await ensureMapId(spec.mapLabel);
  const state = buildState(spec, mapId);
  const payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    state,
    force: true,
  };
  const saved = await fetchJson(`${apiBase}/api/maps/${encodeURIComponent(mapId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });

  const urls = {
    progress: `./viewer.html?ws=${workspaceId}&map=${mapId}&scope=scope_progress`,
    review: `./viewer.html?ws=${workspaceId}&map=${mapId}&scope=scope_review`,
    workspace: `./viewer.html?ws=${workspaceId}&map=${mapId}&scope=scope_workspace`,
  };

  console.log(JSON.stringify({
    ok: true,
    mapId,
    savedAt: saved.savedAt,
    urls,
    nodeCount: Object.keys(state.nodes).length,
    linkCount: Object.keys(state.links || {}).length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
