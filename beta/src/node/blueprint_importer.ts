"use strict";

import fs from "fs";
import path from "path";
import { RapidMvpModel } from "./rapid_mvp";
import { validateVaultPath } from "./vault_path";
import type {
  AppState,
  BlueprintImportedChapterSummary,
  BlueprintImportProgress,
  BlueprintImportRequest,
  BlueprintImportResult,
  GraphLink,
  TreeNode,
} from "../shared/types";

const STATEMENT_ENVIRONMENTS = ["definition", "lemma", "proposition", "theorem", "corollary"] as const;
const STATEMENT_ENVIRONMENT_PATTERN = STATEMENT_ENVIRONMENTS.join("|");
const DEFAULT_PROOF_RELATION_TYPE = "uses_in_proof";
const DEFAULT_LAYOUT_MODE = "chapter-tree";
const DEFAULT_DAG_SOURCE_GROUPING = "chapter";
const DEFAULT_DAG_FACET_LAYOUT = "mixed";

type StatementKind = typeof STATEMENT_ENVIRONMENTS[number];
type BlueprintLayoutMode = "chapter-tree" | "dag";
type DagSourceGroupingMode = "none" | "chapter";
type DagFacetLayoutMode = "mixed" | "scoped";

type BlueprintLayout = {
  sourceRoot: string;
  chaptersDir: string;
  webFile: string | null;
  mainFile: string | null;
};

type ParsedStatement = {
  kind: StatementKind;
  title: string;
  labels: string[];
  primaryLabel: string;
  uses: string[];
  proofUses: string[];
  leanDecl: string;
  leanStatus: "ok" | null;
  details: string;
  chapterTitle: string;
  relativePath: string;
  chapterKey: string;
};

type ParsedChapter = {
  filePath: string;
  relativePath: string;
  chapterTitle: string;
  chapterKey: string;
  statements: ParsedStatement[];
  warnings: string[];
};

type StatementRecord = {
  chapter: ParsedChapter;
  statement: ParsedStatement;
  nodeId: string;
  order: number;
};

type ResolvedDependency = {
  prerequisiteNodeId: string;
  prerequisiteLabel: string;
  dependentNodeId: string;
  dependentLabel: string;
};

function slugify(value: string, fallback: string): string {
  const slug = value
    .normalize("NFKC")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug || fallback;
}

function safeNodeToken(value: string, fallback: string): string {
  const normalized = value.normalize("NFKC");
  let token = "";
  for (const ch of normalized) {
    if (/[A-Za-z0-9_.-]/.test(ch)) {
      token += ch.toLowerCase();
      continue;
    }
    const hex = ch.codePointAt(0)?.toString(16).toLowerCase() ?? "0";
    token += `_x${hex}_`;
  }
  token = token.replace(/^_+|_+$/g, "");
  return token || fallback;
}

function normalizeDisplayText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildDefaultMapId(blueprintPath: string): string {
  return `blueprint-${slugify(path.basename(blueprintPath), "import")}`;
}

function replacePathParamName(message: string): string {
  return message.replace(/vaultPath/g, "blueprintPath");
}

function validateBlueprintPath(rawPath: string): string {
  try {
    return validateVaultPath(rawPath, { mustExist: true });
  } catch (err) {
    throw new Error(replacePathParamName((err as Error).message || "Invalid blueprintPath."));
  }
}

function resolveBlueprintLayout(blueprintPath: string): BlueprintLayout {
  const validated = validateBlueprintPath(blueprintPath);
  const nestedChapters = path.join(validated, "chapter");
  if (fs.existsSync(nestedChapters) && fs.statSync(nestedChapters).isDirectory()) {
    return {
      sourceRoot: validated,
      chaptersDir: nestedChapters,
      webFile: fs.existsSync(path.join(validated, "web.tex")) ? path.join(validated, "web.tex") : null,
      mainFile: fs.existsSync(path.join(nestedChapters, "main.tex")) ? path.join(nestedChapters, "main.tex") : null,
    };
  }

  return {
    sourceRoot: validated,
    chaptersDir: validated,
    webFile: fs.existsSync(path.join(validated, "web.tex")) ? path.join(validated, "web.tex") : null,
    mainFile: fs.existsSync(path.join(validated, "main.tex")) ? path.join(validated, "main.tex") : null,
  };
}

function toPosixRelative(rootPath: string, absolutePath: string): string {
  return path.relative(rootPath, absolutePath).split(path.sep).join("/");
}

function loadProjectLabel(layout: BlueprintLayout, request: BlueprintImportRequest): string {
  const explicit = request.label?.trim();
  if (explicit) return explicit;

  if (layout.webFile) {
    const content = fs.readFileSync(layout.webFile, "utf8");
    const titleMatch = content.match(/\\title\{([\s\S]*?)\}/);
    if (titleMatch) {
      const title = normalizeDisplayText(titleMatch[1] ?? "");
      if (title) return /\bBlueprint\b$/i.test(title) ? title : `${title} Blueprint`;
    }
  }

  const fallback = path.basename(layout.sourceRoot) || "Blueprint";
  return /\bBlueprint\b$/i.test(fallback) ? fallback : `${fallback} Blueprint`;
}

function loadChapterFiles(layout: BlueprintLayout): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  const append = (candidate: string): void => {
    const resolved = path.resolve(candidate);
    if (!fs.existsSync(resolved)) return;
    if (!resolved.toLowerCase().endsWith(".tex")) return;
    if (path.basename(resolved).toLowerCase() === "main.tex") return;
    if (seen.has(resolved)) return;
    seen.add(resolved);
    ordered.push(resolved);
  };

  if (layout.mainFile) {
    const mainContent = fs.readFileSync(layout.mainFile, "utf8");
    const inputPattern = /\\input\{([^}]+)\}/g;
    let match: RegExpExecArray | null;
    while ((match = inputPattern.exec(mainContent)) !== null) {
      const raw = (match[1] ?? "").trim();
      if (!raw) continue;
      const withExt = raw.endsWith(".tex") ? raw : `${raw}.tex`;
      append(path.resolve(layout.sourceRoot, withExt));
    }
  }

  const discovered = fs.readdirSync(layout.chaptersDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".tex") && entry.name.toLowerCase() !== "main.tex")
    .map((entry) => path.join(layout.chaptersDir, entry.name))
    .sort((a, b) => a.localeCompare(b));

  for (const filePath of discovered) {
    append(filePath);
  }

  return ordered;
}

function splitCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((entry) => normalizeDisplayText(entry))
    .filter(Boolean);
}

function extractMacroValues(body: string, macroName: string): string[] {
  const pattern = new RegExp(`\\\\${macroName}\\{([^}]*)\\}`, "g");
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    values.push(match[1] ?? "");
  }
  return values;
}

function extractLabels(body: string): string[] {
  return extractMacroValues(body, "label")
    .map((value) => normalizeDisplayText(value))
    .filter(Boolean);
}

function extractUses(body: string): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const raw of extractMacroValues(body, "uses")) {
    for (const label of splitCommaSeparated(raw)) {
      if (seen.has(label)) continue;
      seen.add(label);
      values.push(label);
    }
  }
  return values;
}

function extractLeanDecl(body: string): string {
  const parts: string[] = [];
  for (const raw of extractMacroValues(body, "lean")) {
    for (const decl of splitCommaSeparated(raw)) {
      if (!parts.includes(decl)) {
        parts.push(decl);
      }
    }
  }
  return parts.join(", ");
}

function stripControlMacros(body: string): string {
  return normalizeDisplayText(
    body
      .replace(/\\label\{[^}]*\}/g, " ")
      .replace(/\\lean\{[^}]*\}/g, " ")
      .replace(/\\leanok\b/g, " ")
      .replace(/\\uses\{[^}]*\}/g, " ")
      .replace(/\\proves\{[^}]*\}/g, " ")
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n"),
  );
}

function parseChapterTitle(content: string, fallback: string): string {
  const match = content.match(/\\chapter\{([\s\S]*?)\}/);
  const title = normalizeDisplayText(match?.[1] ?? "");
  return title || fallback;
}

function parseChapterFile(layout: BlueprintLayout, filePath: string): ParsedChapter {
  const content = fs.readFileSync(filePath, "utf8");
  const relativePath = toPosixRelative(layout.sourceRoot, filePath);
  const chapterKey = safeNodeToken(path.basename(filePath, ".tex"), "chapter");
  const chapterTitle = parseChapterTitle(content, path.basename(filePath, ".tex"));
  const warnings: string[] = [];
  const statements: ParsedStatement[] = [];
  const envPattern = new RegExp(
    `\\\\begin\\{(${STATEMENT_ENVIRONMENT_PATTERN}|proof)\\}(?:\\[([^\\]]*)\\])?([\\s\\S]*?)\\\\end\\{\\1\\}`,
    "g",
  );

  let autoSequence = 0;
  let currentStatement: ParsedStatement | null = null;
  let match: RegExpExecArray | null;
  while ((match = envPattern.exec(content)) !== null) {
    const envName = match[1] as StatementKind | "proof";
    const title = normalizeDisplayText(match[2] ?? "");
    const body = match[3] ?? "";

    if (envName === "proof") {
      if (!currentStatement) {
        warnings.push(`Skipping proof without preceding statement in ${relativePath}.`);
        continue;
      }
      const proofOwner = currentStatement;
      proofOwner.proofUses.push(...extractUses(body).filter((label) => !proofOwner.proofUses.includes(label)));
      const provedLabels = extractMacroValues(body, "proves").flatMap((value) => splitCommaSeparated(value));
      if (provedLabels.length > 0 && !proofOwner.labels.some((label) => provedLabels.includes(label))) {
        warnings.push(`Proof in ${relativePath} proves ${provedLabels.join(", ")} but follows ${proofOwner.primaryLabel}.`);
      }
      continue;
    }

    autoSequence += 1;
    const labels = extractLabels(body);
    const primaryLabel = labels[0] ?? `${chapterKey}-auto-${autoSequence}`;
    if (labels.length === 0) {
      warnings.push(`Statement without \\label{} in ${relativePath}; generated ${primaryLabel}.`);
    }

    currentStatement = {
      kind: envName,
      title,
      labels: labels.length > 0 ? labels : [primaryLabel],
      primaryLabel,
      uses: extractUses(body),
      proofUses: [],
      leanDecl: extractLeanDecl(body),
      leanStatus: /\\leanok\b/.test(body) ? "ok" : null,
      details: stripControlMacros(body),
      chapterTitle,
      relativePath,
      chapterKey,
    };
    statements.push(currentStatement);
  }

  return {
    filePath,
    relativePath,
    chapterTitle,
    chapterKey,
    statements,
    warnings,
  };
}

function titleCaseKind(kind: StatementKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function resolveLayoutMode(request: BlueprintImportRequest): BlueprintLayoutMode {
  return request.options?.layoutMode === "dag" ? "dag" : DEFAULT_LAYOUT_MODE;
}

function resolveDagSourceGroupingMode(request: BlueprintImportRequest): DagSourceGroupingMode {
  return request.options?.dagSourceGrouping === "none" ? "none" : DEFAULT_DAG_SOURCE_GROUPING;
}

function resolveDagFacetLayoutMode(request: BlueprintImportRequest): DagFacetLayoutMode {
  return request.options?.dagFacetLayout === "scoped" ? "scoped" : DEFAULT_DAG_FACET_LAYOUT;
}

function createChapterNode(id: string, parentId: string, text: string, relativePath: string): TreeNode {
  return {
    id,
    parentId,
    children: [],
    nodeType: "folder",
    text,
    collapsed: false,
    details: "",
    note: "",
    attributes: {
      "blueprint:path": relativePath,
      "blueprint:kind": "chapter",
    },
    link: "",
  };
}

function createDagSourceGroupNode(id: string, parentId: string, chapter: ParsedChapter): TreeNode {
  return {
    id,
    parentId,
    children: [],
    text: chapter.chapterTitle,
    collapsed: false,
    details: "",
    note: "Synthetic source-group anchor for DAG layout.",
    attributes: {
      "blueprint:path": chapter.relativePath,
      "blueprint:kind": "chapter-source-group",
      "dag:role": "source-group",
    },
    link: "",
  };
}

function createScopeFolderNode(id: string, parentId: string, text: string, kind: string): TreeNode {
  return {
    id,
    parentId,
    children: [],
    nodeType: "folder",
    text,
    collapsed: false,
    details: "",
    note: "",
    attributes: {
      "blueprint:kind": kind,
    },
    link: "",
  };
}

function createAliasNode(id: string, parentId: string, targetNodeId: string, text: string, chapter: ParsedChapter): TreeNode {
  return {
    id,
    parentId,
    children: [],
    nodeType: "alias",
    text,
    collapsed: false,
    details: "",
    note: "",
    attributes: {
      "blueprint:path": chapter.relativePath,
      "blueprint:kind": "chapter-alias",
    },
    link: "",
    targetNodeId,
    access: "read",
    isBroken: false,
  };
}

function createStatementNode(id: string, chapterId: string, statement: ParsedStatement): TreeNode {
  const displayTitle = statement.title || statement.primaryLabel;
  const attributes: Record<string, string> = {
    kind: statement.kind,
    blueprint_label: statement.primaryLabel,
    blueprint_chapter: statement.chapterTitle,
    "blueprint:path": statement.relativePath,
  };
  if (statement.labels.length > 1) {
    attributes.blueprint_labels = statement.labels.join(", ");
  }
  if (statement.leanDecl) {
    attributes.lean4_decl = statement.leanDecl;
  }
  if (statement.leanStatus) {
    attributes.lean_status = statement.leanStatus;
  }
  return {
    id,
    parentId: chapterId,
    children: [],
    text: `${titleCaseKind(statement.kind)}: ${displayTitle}`,
    collapsed: false,
    details: statement.details,
    note: "",
    attributes,
    link: "",
  };
}

function buildLinkId(sourceLabel: string, targetLabel: string, relationType: string): string {
  return `bplink_${safeNodeToken(sourceLabel, "source")}_${safeNodeToken(targetLabel, "target")}_${safeNodeToken(relationType, "rel")}`;
}

function addLink(
  links: Record<string, GraphLink>,
  dedupe: Set<string>,
  sourceNodeId: string,
  targetNodeId: string,
  sourceLabel: string,
  targetLabel: string,
  relationType: string,
): boolean {
  const key = `${sourceNodeId}|${targetNodeId}|${relationType}`;
  if (dedupe.has(key)) return false;
  dedupe.add(key);
  const linkId = buildLinkId(sourceLabel, targetLabel, relationType);
  links[linkId] = {
    id: linkId,
    sourceNodeId,
    targetNodeId,
    relationType,
    direction: "forward",
  };
  return true;
}

function chooseDagParent(
  record: StatementRecord,
  prerequisites: ResolvedDependency[],
  layerByNodeId: Map<string, number>,
  recordByNodeId: Map<string, StatementRecord>,
): string | null {
  if (prerequisites.length === 0) {
    return null;
  }

  const sorted = [...prerequisites].sort((left, right) => {
    const leftLayer = layerByNodeId.get(left.prerequisiteNodeId) ?? 0;
    const rightLayer = layerByNodeId.get(right.prerequisiteNodeId) ?? 0;
    if (leftLayer !== rightLayer) {
      return rightLayer - leftLayer;
    }

    const leftRecord = recordByNodeId.get(left.prerequisiteNodeId);
    const rightRecord = recordByNodeId.get(right.prerequisiteNodeId);
    const leftSameChapter = leftRecord?.statement.chapterKey === record.statement.chapterKey ? 1 : 0;
    const rightSameChapter = rightRecord?.statement.chapterKey === record.statement.chapterKey ? 1 : 0;
    if (leftSameChapter !== rightSameChapter) {
      return rightSameChapter - leftSameChapter;
    }

    const leftOrder = leftRecord?.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = rightRecord?.order ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });

  return sorted[0]?.prerequisiteNodeId ?? null;
}

function linkDirectionSource(dep: ResolvedDependency): string {
  return dep.prerequisiteNodeId;
}

function linkDirectionTarget(dep: ResolvedDependency): string {
  return dep.dependentNodeId;
}

export async function importBlueprintToAppState(
  request: BlueprintImportRequest,
  hooks?: { onProgress?: (progress: BlueprintImportProgress) => void },
): Promise<BlueprintImportResult> {
  const layout = resolveBlueprintLayout(request.blueprintPath);
  const layoutMode = resolveLayoutMode(request);
  const dagSourceGroupingMode = resolveDagSourceGroupingMode(request);
  const dagFacetLayoutMode = resolveDagFacetLayoutMode(request);
  const mapId = request.mapId?.trim() || buildDefaultMapId(layout.sourceRoot);
  const rootLabel = loadProjectLabel(layout, request);
  const chapterFiles = loadChapterFiles(layout);

  hooks?.onProgress?.({
    phase: "discovery",
    total: chapterFiles.length,
    message: `Found ${chapterFiles.length} chapter files.`,
  });

  const parsedChapters: ParsedChapter[] = [];
  const warnings: string[] = [];
  for (let index = 0; index < chapterFiles.length; index += 1) {
    const filePath = chapterFiles[index]!;
    const parsed = parseChapterFile(layout, filePath);
    parsedChapters.push(parsed);
    warnings.push(...parsed.warnings);
    hooks?.onProgress?.({
      phase: "parse",
      current: index + 1,
      total: chapterFiles.length,
      currentFile: parsed.relativePath,
      status: "ok",
    });
  }

  const rootId = "bp_root";
  const nodes: Record<string, TreeNode> = {
    [rootId]: {
      id: rootId,
      parentId: null,
      children: [],
      text: rootLabel,
      collapsed: false,
      details: "",
      note: "",
      attributes: {
        source: "leanblueprint",
        project: rootLabel.replace(/\s+Blueprint$/, ""),
        "blueprint:layout": layoutMode,
        "blueprint:facet-layout": dagFacetLayoutMode,
      },
      link: "",
    },
  };
  const links: Record<string, GraphLink> = {};
  const labelToNodeId = new Map<string, string>();
  const statementNodeIds = new Map<ParsedStatement, string>();
  const recordByNodeId = new Map<string, StatementRecord>();
  const statementRecords: StatementRecord[] = [];
  const chapterSummaries: BlueprintImportedChapterSummary[] = [];
  const proofRelationType = request.options?.proofUsesRelationType?.trim() || DEFAULT_PROOF_RELATION_TYPE;
  const chapterByKey = new Map<string, ParsedChapter>();
  let dependencyScopeId: string | null = null;
  let chapterScopeId: string | null = null;
  const chapterFacetFolderIdByKey = new Map<string, string>();

  if (layoutMode === "dag" && dagFacetLayoutMode === "scoped") {
    dependencyScopeId = "bp_scope_dependency";
    chapterScopeId = "bp_scope_chapter";
    nodes[dependencyScopeId] = createScopeFolderNode(dependencyScopeId, rootId, "Dependency", "dependency-scope");
    nodes[chapterScopeId] = createScopeFolderNode(chapterScopeId, rootId, "By Chapter", "chapter-scope");
    nodes[rootId]!.children.push(dependencyScopeId, chapterScopeId);
  }

  let statementOrder = 0;
  for (const chapter of parsedChapters) {
    chapterByKey.set(chapter.chapterKey, chapter);
    const chapterId = `bp_ch_${safeNodeToken(chapter.chapterKey, "chapter")}`;
    if (layoutMode === "chapter-tree") {
      const chapterNode = createChapterNode(chapterId, rootId, chapter.chapterTitle, chapter.relativePath);
      nodes[chapterId] = chapterNode;
      nodes[rootId]!.children.push(chapterId);
    } else if (layoutMode === "dag" && dagFacetLayoutMode === "scoped" && chapterScopeId) {
      const chapterFolderId = `bp_facet_ch_${safeNodeToken(chapter.chapterKey, "chapter")}`;
      const chapterFolder = createScopeFolderNode(chapterFolderId, chapterScopeId, chapter.chapterTitle, "chapter-facet");
      chapterFolder.attributes["blueprint:path"] = chapter.relativePath;
      nodes[chapterFolderId] = chapterFolder;
      nodes[chapterScopeId]!.children.push(chapterFolderId);
      chapterFacetFolderIdByKey.set(chapter.chapterKey, chapterFolderId);
    }

    for (const statement of chapter.statements) {
      const nodeId = `bp_${safeNodeToken(statement.primaryLabel, "statement")}`;
      if (nodes[nodeId]) {
        warnings.push(`Duplicate statement node id for label ${statement.primaryLabel}; keeping first occurrence.`);
        continue;
      }
      const parentId = layoutMode === "chapter-tree"
        ? chapterId
        : (dependencyScopeId ?? rootId);
      const node = createStatementNode(nodeId, parentId, statement);
      nodes[nodeId] = node;
      if (layoutMode === "chapter-tree") {
        nodes[chapterId]!.children.push(nodeId);
      }
      statementNodeIds.set(statement, nodeId);
      const record: StatementRecord = {
        chapter,
        statement,
        nodeId,
        order: statementOrder,
      };
      statementOrder += 1;
      statementRecords.push(record);
      recordByNodeId.set(nodeId, record);
      for (const label of statement.labels) {
        if (labelToNodeId.has(label) && labelToNodeId.get(label) !== nodeId) {
          warnings.push(`Duplicate blueprint label ${label}; latest occurrence in ${statement.relativePath} ignored for linking.`);
          continue;
        }
        labelToNodeId.set(label, nodeId);
      }

      if (layoutMode === "dag" && dagFacetLayoutMode === "scoped") {
        const chapterFolderId = chapterFacetFolderIdByKey.get(chapter.chapterKey);
        if (chapterFolderId) {
          const aliasId = `bp_alias_${safeNodeToken(chapter.chapterKey, "chapter")}_${safeNodeToken(statement.primaryLabel, "statement")}`;
          const aliasNode = createAliasNode(aliasId, chapterFolderId, nodeId, node.text, chapter);
          nodes[aliasId] = aliasNode;
          nodes[chapterFolderId]!.children.push(aliasId);
        }
      }
    }
  }

  const validUsesByDependent = new Map<string, ResolvedDependency[]>();
  const validProofUsesByDependent = new Map<string, ResolvedDependency[]>();
  const pushResolvedDependency = (
    store: Map<string, ResolvedDependency[]>,
    dependentNodeId: string,
    dependency: ResolvedDependency,
  ): void => {
    const existing = store.get(dependentNodeId);
    if (existing) {
      existing.push(dependency);
      return;
    }
    store.set(dependentNodeId, [dependency]);
  };

  for (const record of statementRecords) {
    const dependentNodeId = record.nodeId;
    const dependentLabel = record.statement.primaryLabel;
    const resolveTargets = (
      targets: string[],
      store: Map<string, ResolvedDependency[]>,
    ): void => {
      const seen = new Set<string>();
      for (const prerequisiteLabel of targets) {
        if (seen.has(prerequisiteLabel)) continue;
        seen.add(prerequisiteLabel);
        const prerequisiteNodeId = labelToNodeId.get(prerequisiteLabel);
        if (!prerequisiteNodeId) {
          warnings.push(`Skipping missing dependency ${prerequisiteLabel} referenced from ${dependentLabel}.`);
          continue;
        }
        if (prerequisiteNodeId === dependentNodeId) {
          warnings.push(`Skipping self dependency ${prerequisiteLabel} on ${dependentLabel}.`);
          continue;
        }
        pushResolvedDependency(store, dependentNodeId, {
          prerequisiteNodeId,
          prerequisiteLabel,
          dependentNodeId,
          dependentLabel,
        });
      }
    };

    resolveTargets(record.statement.uses, validUsesByDependent);
    if (!request.options?.skipProofUses) {
      resolveTargets(record.statement.proofUses, validProofUsesByDependent);
    }
  }

  let dagParentByNodeId = new Map<string, string | null>();
  if (layoutMode === "dag") {
    const indegree = new Map<string, number>();
    const outgoing = new Map<string, string[]>();
    const incomingUses = new Map<string, ResolvedDependency[]>();
    for (const record of statementRecords) {
      indegree.set(record.nodeId, 0);
      outgoing.set(record.nodeId, []);
      incomingUses.set(record.nodeId, validUsesByDependent.get(record.nodeId) ?? []);
    }

    for (const record of statementRecords) {
      const dependentNodeId = record.nodeId;
      const dependencies = validUsesByDependent.get(dependentNodeId) ?? [];
      indegree.set(dependentNodeId, dependencies.length);
      for (const dependency of dependencies) {
        const dependents = outgoing.get(dependency.prerequisiteNodeId);
        if (dependents) {
          dependents.push(dependentNodeId);
        }
      }
    }

    const topoOrder: string[] = [];
    const queue = statementRecords
      .filter((record) => (indegree.get(record.nodeId) ?? 0) === 0)
      .sort((a, b) => a.order - b.order)
      .map((record) => record.nodeId);

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      topoOrder.push(nodeId);
      const dependents = outgoing.get(nodeId) ?? [];
      dependents
        .sort((left, right) => (recordByNodeId.get(left)?.order ?? 0) - (recordByNodeId.get(right)?.order ?? 0))
        .forEach((dependentId) => {
          const next = (indegree.get(dependentId) ?? 0) - 1;
          indegree.set(dependentId, next);
          if (next === 0) {
            queue.push(dependentId);
            queue.sort((left, right) => (recordByNodeId.get(left)?.order ?? 0) - (recordByNodeId.get(right)?.order ?? 0));
          }
        });
    }

    if (topoOrder.length !== statementRecords.length) {
      const remaining = statementRecords
        .map((record) => record.nodeId)
        .filter((nodeId) => !topoOrder.includes(nodeId));
      warnings.push(`Dependency cycle or ordering conflict detected for ${remaining.length} statements; attaching remaining nodes by source order.`);
      remaining
        .sort((left, right) => (recordByNodeId.get(left)?.order ?? 0) - (recordByNodeId.get(right)?.order ?? 0))
        .forEach((nodeId) => topoOrder.push(nodeId));
    }

    const layerByNodeId = new Map<string, number>();
    for (const nodeId of topoOrder) {
      const prerequisites = incomingUses.get(nodeId) ?? [];
      const nextLayer = prerequisites.length === 0
        ? 0
        : Math.max(...prerequisites.map((dependency) => (layerByNodeId.get(dependency.prerequisiteNodeId) ?? 0) + 1));
      layerByNodeId.set(nodeId, nextLayer);
    }

    if (dagFacetLayoutMode !== "scoped") {
      nodes[rootId]!.children = [];
    }
    if (dependencyScopeId) {
      nodes[dependencyScopeId]!.children = [];
    }
    for (const record of statementRecords) {
      nodes[record.nodeId]!.children = [];
    }
    const sourceGroupIdByChapterKey = new Map<string, string>();
    const ensureSourceGroup = (chapterKey: string): string | null => {
      if (dagFacetLayoutMode === "scoped" || dagSourceGroupingMode !== "chapter") {
        return null;
      }
      const existing = sourceGroupIdByChapterKey.get(chapterKey);
      if (existing) {
        return existing;
      }
      const chapter = chapterByKey.get(chapterKey);
      if (!chapter) {
        return null;
      }
      const groupId = `bp_srcgrp_${safeNodeToken(chapter.chapterKey, "chapter")}`;
      const groupNode = createDagSourceGroupNode(groupId, rootId, chapter);
      nodes[groupId] = groupNode;
      nodes[rootId]!.children.push(groupId);
      sourceGroupIdByChapterKey.set(chapterKey, groupId);
      return groupId;
    };
    for (const nodeId of topoOrder) {
      const record = recordByNodeId.get(nodeId);
      if (!record) continue;
      const parentId = chooseDagParent(record, incomingUses.get(nodeId) ?? [], layerByNodeId, recordByNodeId);
      dagParentByNodeId.set(nodeId, parentId);
      const node = nodes[nodeId]!;
      const structuralParentId = parentId ?? ensureSourceGroup(record.statement.chapterKey) ?? dependencyScopeId ?? rootId;
      node.parentId = structuralParentId;
      node.attributes["dag:layer"] = String(layerByNodeId.get(nodeId) ?? 0);
      node.attributes["dag:role"] = parentId ? "derived" : "root";
      if (!parentId && structuralParentId !== rootId && structuralParentId !== dependencyScopeId) {
        node.attributes["dag:source-group"] = structuralParentId;
      }
      if (structuralParentId) {
        nodes[structuralParentId]!.children.push(nodeId);
      } else {
        nodes[rootId]!.children.push(nodeId);
      }
    }
  }

  let linkCount = 0;
  const dedupe = new Set<string>();
  for (const chapter of parsedChapters) {
    let chapterLinkCount = 0;
    for (const statement of chapter.statements) {
      const dependentNodeId = statementNodeIds.get(statement);
      if (!dependentNodeId) continue;

      const attachResolved = (dependencies: ResolvedDependency[], relationType: string, skipParentLink: boolean): void => {
        for (const dependency of dependencies) {
          if (skipParentLink && dagParentByNodeId.get(dependentNodeId) === dependency.prerequisiteNodeId) {
            continue;
          }
          if (addLink(
            links,
            dedupe,
            linkDirectionSource(dependency),
            linkDirectionTarget(dependency),
            dependency.prerequisiteLabel,
            dependency.dependentLabel,
            relationType,
          )) {
            linkCount += 1;
            chapterLinkCount += 1;
          }
        }
      };

      attachResolved(validUsesByDependent.get(dependentNodeId) ?? [], "uses", layoutMode === "dag");
      if (!request.options?.skipProofUses) {
        attachResolved(validProofUsesByDependent.get(dependentNodeId) ?? [], proofRelationType, false);
      }
    }

    const chapterId = `bp_ch_${safeNodeToken(chapter.chapterKey, "chapter")}`;
    const chapterSummaryId = layoutMode === "chapter-tree"
      ? chapterId
      : (dagFacetLayoutMode === "scoped"
        ? (chapterFacetFolderIdByKey.get(chapter.chapterKey) || "")
        : "");
    chapterSummaries.push({
      relativePath: chapter.relativePath,
      chapterNodeId: chapterSummaryId,
      statementCount: chapter.statements.length,
      linkCount: chapterLinkCount,
    });
  }

  hooks?.onProgress?.({
    phase: "links",
    total: linkCount,
    message: `Resolved ${linkCount} graph links.`,
  });

  const state: AppState = {
    rootId,
    nodes,
    links,
  };

  const model = RapidMvpModel.fromJSON(state);
  const errors = model.validate();
  if (errors.length > 0) {
    throw new Error(`Invalid imported blueprint model: ${errors.join(" | ")}`);
  }

  hooks?.onProgress?.({
    phase: "persist",
    total: Object.keys(nodes).length,
    message: `Persisting imported blueprint as ${mapId}.`,
  });

  return {
    ok: true,
    mapId,
    savedAt: "",
    chapterCount: parsedChapters.length,
    statementCount: parsedChapters.reduce((sum, chapter) => sum + chapter.statements.length, 0),
    nodeCount: Object.keys(nodes).length,
    linkCount,
    warnings,
    chapters: chapterSummaries,
    state,
  };
}

export async function importBlueprintToSqlite(
  dbPath: string,
  request: BlueprintImportRequest,
  hooks?: { onProgress?: (progress: BlueprintImportProgress) => void },
): Promise<BlueprintImportResult> {
  const result = await importBlueprintToAppState(request, hooks);
  const model = RapidMvpModel.fromJSON(result.state);
  model.saveToSqlite(dbPath, result.mapId);
  return {
    ...result,
    savedAt: new Date().toISOString(),
  };
}
