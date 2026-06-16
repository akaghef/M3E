import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const specPath = path.join(__dirname, "runtime_spec.json");
const pidPath = path.join(__dirname, "sync_runtime_state.pid");
const apiBase = `http://127.0.0.1:${process.env.M3E_PORT || "4173"}`;
const watchMode = process.argv.includes("--watch");
const watchIntervalMs = 5000;

function styleObject(fill, border, text) {
  const style = {};
  if (fill) style.fill = fill;
  if (border) style.border = border;
  if (text) style.text = text;
  return JSON.stringify(style);
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
      return styleObject("#ffffff", "#bdbdbd");
  }
}

function reviewStyle(status, importance, urgency) {
  let fill = "#ffffff";
  if (status === "decided") fill = "#d4edda";
  else if (status === "rejected") fill = "#f8d7da";
  else if (importance === "high") fill = "#9ec5ff";
  else if (importance === "medium") fill = "#e1ecff";

  let border = "#bdbdbd";
  if (status === "decided") border = "#2d8c4e";
  else if (status === "rejected") border = "#d94040";
  else if (urgency === "high") border = "#ff0000";
  else if (urgency === "medium") border = "#ffb074";

  return styleObject(fill, border);
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

async function findMapId(label) {
  const mapsPayload = await fetchJson(`${apiBase}/api/maps`);
  const found = (mapsPayload.maps || []).find((map) => map.label === label);
  if (!found) {
    throw new Error(`Map not found for label: ${label}`);
  }
  return found.id;
}

function parseCsv(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function updateNodeField(node, key, nextValue) {
  if (node[key] === nextValue) return false;
  node[key] = nextValue;
  return true;
}

function updateAttr(node, key, nextValue) {
  const current = node.attributes?.[key];
  if (current === nextValue) return false;
  node.attributes = node.attributes || {};
  if (nextValue == null || nextValue === "") {
    delete node.attributes[key];
  } else {
    node.attributes[key] = nextValue;
  }
  return true;
}

function computeTaskStates(state) {
  const tasks = {};
  const reviews = {};

  for (const node of Object.values(state.nodes)) {
    if (node.attributes?.["runtime:kind"] === "task") {
      tasks[node.attributes["runtime:id"]] = node;
    }
    if (node.attributes?.["runtime:kind"] === "review-question") {
      reviews[node.attributes["runtime:id"]] = node;
    }
  }

  const memo = new Map();

  function resolve(taskId) {
    if (memo.has(taskId)) return memo.get(taskId);
    const node = tasks[taskId];
    if (!node) {
      memo.set(taskId, "blocked");
      return "blocked";
    }

    const baseState = node.attributes["runtime:base-state"] || "ready";
    const deps = parseCsv(node.attributes["runtime:deps"]);
    const reviewRefs = parseCsv(node.attributes["runtime:review-refs"]);

    if (baseState === "done") {
      memo.set(taskId, "done");
      return "done";
    }
    if (baseState === "doing") {
      memo.set(taskId, "doing");
      return "doing";
    }

    const depStates = deps.map(resolve);
    if (depStates.some((value) => value !== "done")) {
      memo.set(taskId, "blocked");
      return "blocked";
    }

    const unresolvedReviews = reviewRefs.some((reviewId) => reviews[reviewId]?.attributes?.status !== "decided");
    if (unresolvedReviews) {
      memo.set(taskId, "review");
      return "review";
    }

    if (baseState === "gate") {
      memo.set(taskId, "ready");
      return "ready";
    }

    memo.set(taskId, baseState);
    return baseState;
  }

  for (const taskId of Object.keys(tasks)) {
    resolve(taskId);
  }

  return { tasks, reviews, states: memo };
}

function findTaskNodeText(state, taskId) {
  for (const node of Object.values(state.nodes)) {
    if (node.attributes?.["runtime:kind"] === "task" && node.attributes["runtime:id"] === taskId) {
      return node.text;
    }
  }
  return taskId;
}

function applySync(spec, state) {
  let changed = false;
  const { tasks, reviews, states } = computeTaskStates(state);

  const counts = {
    done: 0,
    doing: 0,
    ready: 0,
    review: 0,
    blocked: 0,
  };

  for (const [taskId, node] of Object.entries(tasks)) {
    const resolved = states.get(taskId);
    counts[resolved] = (counts[resolved] || 0) + 1;
    changed = updateAttr(node, "runtime:state", resolved) || changed;
    changed = updateAttr(node, "status", resolved) || changed;
    changed = updateAttr(node, "m3e:style", taskStateStyle(resolved)) || changed;
    changed = updateNodeField(node, "note", `${resolved} | phase=${node.attributes["runtime:phase"]}`) || changed;
  }

  let openReviews = 0;
  for (const review of Object.values(reviews)) {
    const status = review.attributes?.status || "open";
    if (status !== "decided") openReviews += 1;
    changed = updateAttr(
      review,
      "m3e:style",
      reviewStyle(status, review.attributes?.importance || "low", review.attributes?.urgency || "low"),
    ) || changed;
    changed = updateNodeField(
      review,
      "note",
      `${status} | importance=${review.attributes?.importance || "low"} | urgency=${review.attributes?.urgency || "low"}`,
    ) || changed;
  }

  const readyTasks = Object.entries(tasks)
    .filter(([taskId]) => states.get(taskId) === "ready")
    .map(([taskId]) => findTaskNodeText(state, taskId));
  const reviewTasks = Object.entries(tasks)
    .filter(([taskId]) => states.get(taskId) === "review")
    .map(([taskId]) => findTaskNodeText(state, taskId));
  const blockedTasks = Object.entries(tasks)
    .filter(([taskId]) => states.get(taskId) === "blocked")
    .map(([taskId]) => findTaskNodeText(state, taskId));

  const phaseNode = state.nodes.meta_phase;
  if (phaseNode) {
    const details = [
      spec.currentPhase,
      "",
      `Open reviews: ${openReviews}`,
      `Ready tasks: ${readyTasks.length ? readyTasks.join(", ") : "none"}`,
      `Review tasks: ${reviewTasks.length ? reviewTasks.join(", ") : "none"}`,
    ].join("\n");
    changed = updateNodeField(phaseNode, "details", details) || changed;
    changed = updateNodeField(phaseNode, "note", spec.currentPhase) || changed;
  }

  const countsNode = state.nodes.meta_counts;
  if (countsNode) {
    const details = [
      `done: ${counts.done}`,
      `doing: ${counts.doing}`,
      `ready: ${counts.ready}`,
      `review: ${counts.review}`,
      `blocked: ${counts.blocked}`,
      `open reviews: ${openReviews}`,
    ].join("\n");
    changed = updateNodeField(countsNode, "details", details) || changed;
    changed = updateNodeField(countsNode, "note", `${counts.ready} ready / ${counts.review} review / ${counts.blocked} blocked`) || changed;
  }

  const gateNode = state.nodes.meta_gate;
  if (gateNode) {
    const humanGateReady = states.get("human_phase_gate") === "ready";
    const details = [
      spec.nextGate,
      "",
      `Gate task state: ${states.get("human_phase_gate") || "unknown"}`,
      `Blocked tasks: ${blockedTasks.length ? blockedTasks.join(", ") : "none"}`,
      `Review tasks: ${reviewTasks.length ? reviewTasks.join(", ") : "none"}`,
    ].join("\n");
    changed = updateNodeField(gateNode, "details", details) || changed;
    changed = updateNodeField(gateNode, "note", humanGateReady ? "ready for human gate" : "not ready") || changed;
    changed = updateAttr(gateNode, "m3e:style", humanGateReady ? styleObject("#d4edda", "#2d8c4e") : styleObject("#fff3cd", "#d58900")) || changed;
  }

  return {
    changed,
    counts,
    openReviews,
    savedState: state,
  };
}

async function saveState(mapId, state, baseSavedAt) {
  const response = await fetch(`${apiBase}/api/maps/${encodeURIComponent(mapId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      state,
      baseSavedAt,
    }),
  });

  if (response.status === 409) {
    return { ok: false, conflict: true };
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(payload)}`);
  }
  return { ok: true, savedAt: payload.savedAt };
}

async function syncOnce(mapId, spec, docPayload) {
  const payload = docPayload || await fetchJson(`${apiBase}/api/maps/${encodeURIComponent(mapId)}`);
  const state = payload.state;
  const result = applySync(spec, state);
  if (!result.changed) {
    return {
      mapId,
      changed: false,
      savedAt: payload.savedAt,
      counts: result.counts,
      openReviews: result.openReviews,
    };
  }

  const saveResult = await saveState(mapId, result.savedState, payload.savedAt);
  if (!saveResult.ok && saveResult.conflict) {
    return {
      mapId,
      changed: false,
      conflict: true,
      savedAt: payload.savedAt,
      counts: result.counts,
      openReviews: result.openReviews,
    };
  }

  return {
    mapId,
    changed: true,
    savedAt: saveResult.savedAt,
    counts: result.counts,
    openReviews: result.openReviews,
  };
}

async function writePidFile() {
  await fs.writeFile(pidPath, `${process.pid}\n`, "utf8");
}

async function removePidFile() {
  await fs.rm(pidPath, { force: true });
}

async function runWatch(mapId, spec, initialSavedAt) {
  let lastSeenSavedAt = initialSavedAt;
  await writePidFile();
  const cleanup = async () => {
    await removePidFile();
    process.exit(0);
  };
  process.on("SIGINT", () => {
    void cleanup();
  });
  process.on("SIGTERM", () => {
    void cleanup();
  });

  for (;;) {
    try {
      const doc = await fetchJson(`${apiBase}/api/maps/${encodeURIComponent(mapId)}`);
      if (doc.savedAt !== lastSeenSavedAt) {
        const syncResult = await syncOnce(mapId, spec, doc);
        lastSeenSavedAt = syncResult.savedAt;
        console.log(JSON.stringify(syncResult));
      }
    } catch (error) {
      console.error(error instanceof Error ? error.stack : String(error));
    }
    await new Promise((resolve) => setTimeout(resolve, watchIntervalMs));
  }
}

async function main() {
  const spec = await loadSpec();
  const mapId = await findMapId(spec.mapLabel);
  const result = await syncOnce(mapId, spec);
  console.log(JSON.stringify(result, null, 2));
  if (watchMode) {
    await runWatch(mapId, spec, result.savedAt);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
