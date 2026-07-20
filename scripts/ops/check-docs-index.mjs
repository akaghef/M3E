#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const docsRoot = path.join(repoRoot, "docs");
const indexPath = path.join(docsRoot, "index.md");

const GROUP_LABELS = new Map([
  ["00_Home", "00_Home - entry and current state"],
  ["01_Vision", "01_Vision - principles, vision, strategy"],
  ["03_Spec", "03_Spec - functional specifications"],
  ["04_Architecture", "04_Architecture - implementation architecture"],
  ["06_Operations", "06_Operations - operation rules and handoff"],
  ["09_Decisions", "09_Decisions - ADR"],
  ["_generated", "_generated - generated projections"],
  ["competitive_research", "competitive_research - external tool research"],
  ["daily", "daily - chronological work logs"],
  ["for-akaghef", "for-akaghef - Akaghef-facing materials"],
  ["ideas", "ideas - raw ideas and stowed notes"],
  ["legacy", "legacy - historical designs"],
  ["research", "research - source research and extracts"],
  ["tasks", "tasks - handoffs and task notes"],
  ["root", "root - top-level docs files"],
]);

const TYPE_LABELS = new Map([
  [".base", "Obsidian Bases"],
  [".canvas", "Obsidian Canvas"],
  [".csv", "CSV"],
  [".html", "HTML"],
  [".jpg", "Image"],
  [".jpeg", "Image"],
  [".json", "JSON"],
  [".md", "Markdown"],
  [".mlx", "MATLAB Live Script"],
  [".png", "Image"],
  [".sql", "SQL"],
  [".txt", "Text"],
]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(abs));
    } else if (entry.isFile()) {
      files.push(abs);
    }
  }
  return files;
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function shouldIgnore(rel) {
  return rel.startsWith("docs/.obsidian/") || rel.endsWith("/.DS_Store") || rel === "docs/.DS_Store";
}

function docsFiles() {
  const rels = walk(docsRoot)
    .map((abs) => toPosix(path.relative(repoRoot, abs)))
    .filter((rel) => !shouldIgnore(rel))
  if (!rels.includes("docs/index.md")) {
    rels.push("docs/index.md");
  }
  return rels.sort((a, b) => a.localeCompare(b, "en"));
}

function readStart(abs, limit = 65536) {
  const fd = fs.openSync(abs, "r");
  try {
    const size = fs.statSync(abs).size;
    const buffer = Buffer.alloc(Math.min(size, limit));
    fs.readSync(fd, buffer, 0, buffer.length, 0);
    return buffer.toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

function cleanText(value) {
  return value
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function truncate(value, max = 120) {
  const cleaned = cleanText(value);
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 3)}...`;
}

function fallbackTitle(rel) {
  return path.basename(rel, path.extname(rel)).replace(/[_-]+/g, " ");
}

function markdownTitleAndSummary(abs, rel) {
  const text = readStart(abs);
  const lines = text.split(/\n/);
  const titleLine = lines.find((line) => /^#\s+/.test(line));
  const title = titleLine ? titleLine.replace(/^#\s+/, "").trim() : fallbackTitle(rel);
  let inFence = false;
  let inFrontmatter = false;
  let seenFrontmatterStart = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "---" && !seenFrontmatterStart) {
      inFrontmatter = true;
      seenFrontmatterStart = true;
      continue;
    }
    if (line === "---" && inFrontmatter) {
      inFrontmatter = false;
      continue;
    }
    if (inFrontmatter) continue;
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (!line || line.startsWith("#") || line.startsWith("|") || line.startsWith("![")) continue;
    if (/^[-*]\s+/.test(line)) continue;
    return { title, summary: truncate(line) };
  }
  return { title, summary: title };
}

function titleAndSummary(rel) {
  const abs = path.join(repoRoot, rel);
  if (path.basename(rel) === "index.md" && groupFor(rel) === "root") {
    return { title: "M3E Documents Index", summary: "Generated content-oriented index for docs/." };
  }
  if (!fs.existsSync(abs)) {
    return { title: fallbackTitle(rel), summary: "File is expected in docs/." };
  }
  const ext = path.extname(rel).toLowerCase();
  if (ext === ".md") return markdownTitleAndSummary(abs, rel);
  if (ext === ".sql" || ext === ".txt" || ext === ".csv") {
    const firstLine = readStart(abs, 8192)
      .split(/\n/)
      .map((line) => line.trim())
      .find(Boolean);
    return { title: fallbackTitle(rel), summary: truncate(firstLine || fallbackTitle(rel)) };
  }
  return { title: fallbackTitle(rel), summary: TYPE_LABELS.get(ext) || "File" };
}

function groupFor(rel) {
  const withoutDocs = rel.slice("docs/".length);
  const first = withoutDocs.split("/")[0];
  return withoutDocs.includes("/") ? first : "root";
}

function typeFor(rel) {
  return TYPE_LABELS.get(path.extname(rel).toLowerCase()) || "File";
}

function linkFor(rel) {
  const label = rel.slice("docs/".length);
  return `[${cleanText(label)}](<./${label}>)`;
}

function renderIndex() {
  const files = docsFiles();
  const groups = new Map();
  for (const rel of files) {
    const group = groupFor(rel);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(rel);
  }

  const lines = [];
  lines.push("# M3E Documents Index");
  lines.push("");
  lines.push("This file is the content-oriented index for `docs/`. It is generated from the current file tree and maintained as the navigation layer described in `06_Operations/LLM_Wiki_Schema.md`.");
  lines.push("");
  lines.push("- Regenerate: `node scripts/ops/check-docs-index.mjs --write`");
  lines.push("- Check: `node scripts/ops/check-docs-index.mjs --check`");
  lines.push("- Coverage: all files under `docs/`, excluding `docs/.obsidian/` and `.DS_Store`");
  lines.push(`- Indexed files: ${files.length}`);
  lines.push("");
  lines.push("## Reading Routes");
  lines.push("");
  lines.push("- Session bootstrap: `00_Home/Agent_Brief.md`, `00_Home/Current_Status.md`, `00_Home/Glossary.md`");
  lines.push("- Current product direction: `00_Home/Home.md`, `00_Home/Objective.md`, `01_Vision/Strategy.md`");
  lines.push("- Feature meaning: `03_Spec/` first, then `04_Architecture/`");
  lines.push("- Operations and handoff: `06_Operations/`, then `tasks/`");
  lines.push("- Raw ideas and research: `ideas/`, `research/`, `competitive_research/`, `legacy/`");
  lines.push("");
  lines.push("## Directory Catalog");
  lines.push("");

  const orderedGroups = [...groups.keys()].sort((a, b) => {
    const ai = [...GROUP_LABELS.keys()].indexOf(a);
    const bi = [...GROUP_LABELS.keys()].indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.localeCompare(b, "en");
  });

  for (const group of orderedGroups) {
    const label = GROUP_LABELS.get(group) || group;
    const rels = groups.get(group);
    lines.push(`### ${label}`);
    lines.push("");
    lines.push("| File | Type | Title | Summary |");
    lines.push("|---|---:|---|---|");
    for (const rel of rels) {
      const { title, summary } = titleAndSummary(rel);
      lines.push(`| ${linkFor(rel)} | ${typeFor(rel)} | ${truncate(title, 80)} | ${summary} |`);
    }
    lines.push("");
  }

  while (lines.at(-1) === "") {
    lines.pop();
  }
  return `${lines.join("\n")}\n`;
}

const mode = process.argv[2] || "--check";
const expected = renderIndex();

if (mode === "--write") {
  fs.writeFileSync(indexPath, expected);
  console.log(`wrote ${path.relative(repoRoot, indexPath)}`);
} else if (mode === "--check") {
  const actual = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";
  if (actual !== expected) {
    console.error("docs/index.md is stale. Run: node scripts/ops/check-docs-index.mjs --write");
    process.exit(1);
  }
  console.log("docs/index.md is current");
} else {
  console.error("usage: node scripts/ops/check-docs-index.mjs [--check|--write]");
  process.exit(2);
}
