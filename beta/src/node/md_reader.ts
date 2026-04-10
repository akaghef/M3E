"use strict";

import type { TreeNode, NodeType, AliasAccess } from "../shared/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed result from a single .md file */
export interface MdParsedNode {
  /** The TreeNode extracted from the .md content */
  node: Partial<TreeNode> & { id: string; text: string };
  /** Wikilink references found in body: [[target]] or [[target|label]] */
  wikilinks: WikilinkRef[];
}

export interface WikilinkRef {
  /** Raw target string (filename without .md) */
  target: string;
  /** Display label if [[target|label]] syntax */
  label?: string;
  /** Whether this is an embed: ![[target]] */
  embedded: boolean;
}

/** M3E-specific frontmatter under the `m3e:` key */
export interface M3eFrontmatter {
  nodeId?: string;
  nodeType?: NodeType;
  collapsed?: boolean;
  "children-order"?: string[];
  note?: string;
  link?: string;
  "aliases-meta"?: Array<{ target: string; access?: AliasAccess }>;
}

/** Full frontmatter including both m3e and standard keys */
export interface ParsedFrontmatter {
  m3e?: M3eFrontmatter;
  tags?: string[];
  aliases?: string[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Frontmatter parser (minimal YAML subset)
// ---------------------------------------------------------------------------

/**
 * Parse YAML frontmatter delimited by `---`.
 * Returns the parsed object and the body after the closing `---`.
 */
export function parseFrontmatter(content: string): {
  frontmatter: ParsedFrontmatter;
  body: string;
} {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) {
    return { frontmatter: {}, body: content };
  }

  const endIdx = trimmed.indexOf("\n---", 3);
  if (endIdx === -1) {
    return { frontmatter: {}, body: content };
  }

  const yamlBlock = trimmed.slice(4, endIdx); // skip opening "---\n"
  const body = trimmed.slice(endIdx + 4).replace(/^\r?\n/, ""); // skip closing "---\n"

  const frontmatter = parseSimpleYaml(yamlBlock);
  return { frontmatter: frontmatter as ParsedFrontmatter, body };
}

/**
 * Minimal YAML parser supporting:
 * - key: value (string, number, boolean)
 * - key:\n  - item (arrays)
 * - key:\n  nested-key: value (one-level nesting, e.g. m3e:)
 *
 * This is NOT a full YAML parser. It handles the subset used by M3E frontmatter.
 */
export function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const topMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (!topMatch) {
      i++;
      continue;
    }

    const key = topMatch[1];
    const inlineValue = topMatch[2].trim();

    if (inlineValue) {
      // Inline scalar: key: value
      result[key] = parseScalar(inlineValue);
      i++;
    } else {
      // Block: could be array or nested object
      i++;
      const blockLines: string[] = [];
      while (i < lines.length && /^\s+/.test(lines[i])) {
        blockLines.push(lines[i]);
        i++;
      }

      if (blockLines.length === 0) {
        result[key] = "";
        continue;
      }

      // Determine if array or object
      const firstNonEmpty = blockLines.find((l) => l.trim().length > 0);
      if (firstNonEmpty && firstNonEmpty.trimStart().startsWith("- ")) {
        // Array of items
        result[key] = parseYamlArray(blockLines);
      } else {
        // Nested object (one level)
        result[key] = parseYamlObject(blockLines);
      }
    }
  }

  return result;
}

function parseScalar(value: string): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  // Strip quotes
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  const num = Number(value);
  if (!isNaN(num) && value.length > 0) return num;
  return value;
}

function parseYamlArray(lines: string[]): unknown[] {
  const items: unknown[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimStart();
    if (line.startsWith("- ")) {
      const itemValue = line.slice(2).trim();

      // Check if it's an inline object: - key: val
      if (itemValue.match(/^\w[\w-]*:\s/)) {
        // Collect sub-object lines
        const objLines = [lines[i]];
        i++;
        // Gather continuation lines (more indented than the "- " line)
        const dashIndent = lines[i - 1].search(/\S/);
        while (i < lines.length) {
          const nextIndent = lines[i].search(/\S/);
          if (nextIndent > dashIndent && !lines[i].trimStart().startsWith("- ")) {
            objLines.push(lines[i]);
            i++;
          } else {
            break;
          }
        }
        // Parse inline object
        const obj: Record<string, unknown> = {};
        for (const ol of objLines) {
          const stripped = ol.trimStart().replace(/^-\s*/, "");
          const m = stripped.match(/^(\w[\w-]*):\s*(.*)/);
          if (m) {
            obj[m[1]] = parseScalar(m[2].trim());
          }
        }
        items.push(obj);
      } else {
        items.push(parseScalar(itemValue));
        i++;
      }
    } else {
      i++;
    }
  }

  return items;
}

function parseYamlObject(lines: string[]): Record<string, unknown> {
  // Strip common indent
  const minIndent = Math.min(
    ...lines.filter((l) => l.trim().length > 0).map((l) => l.search(/\S/))
  );
  const stripped = lines.map((l) => l.slice(minIndent));
  return parseSimpleYaml(stripped.join("\n"));
}

// ---------------------------------------------------------------------------
// Wikilink extraction
// ---------------------------------------------------------------------------

/**
 * Extract [[wikilink]] and ![[wikilink]] references from Markdown body.
 */
export function extractWikilinks(body: string): WikilinkRef[] {
  const refs: WikilinkRef[] = [];
  const re = /(!?)\[\[([^\]]+)\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(body)) !== null) {
    const embedded = match[1] === "!";
    const inner = match[2];
    const pipeIdx = inner.indexOf("|");
    if (pipeIdx !== -1) {
      refs.push({
        target: inner.slice(0, pipeIdx).trim(),
        label: inner.slice(pipeIdx + 1).trim(),
        embedded,
      });
    } else {
      refs.push({ target: inner.trim(), embedded });
    }
  }

  return refs;
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

/**
 * Parse a .md file content into an MdParsedNode.
 *
 * @param content - Raw .md file content
 * @param defaults - Default values (e.g., id from filename, text from filename)
 */
export function parseMdContent(
  content: string,
  defaults: { id: string; text: string }
): MdParsedNode {
  const { frontmatter, body } = parseFrontmatter(content);
  const m3e = (frontmatter.m3e || {}) as M3eFrontmatter;
  const wikilinks = extractWikilinks(body);

  // Extract main text from body: first heading or first non-empty line
  let text = defaults.text;
  const headingMatch = body.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    text = headingMatch[1].trim();
  }

  // Build attributes from frontmatter top-level keys (tags, aliases, etc.)
  const attributes: Record<string, string> = {};
  if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
    attributes["tags"] = (frontmatter.tags as string[]).join(",");
  }
  if (frontmatter.aliases && Array.isArray(frontmatter.aliases)) {
    attributes["aliases"] = (frontmatter.aliases as string[]).join(",");
  }

  // Body text without heading
  const bodyText = body
    .replace(/^#\s+.+$/m, "")
    .trim();

  const node: Partial<TreeNode> & { id: string; text: string } = {
    id: m3e.nodeId || defaults.id,
    text,
    nodeType: m3e.nodeType || "text",
    collapsed: m3e.collapsed ?? false,
    details: bodyText,
    note: m3e.note || "",
    attributes,
    link: m3e.link || "",
    parentId: null,
    children: [],
  };

  return { node, wikilinks };
}

/**
 * Parse a _folder.md file. Returns folder metadata including children-order.
 */
export function parseFolderMd(content: string, defaults: { id: string; text: string }): {
  node: Partial<TreeNode> & { id: string; text: string };
  childrenOrder: string[];
  wikilinks: WikilinkRef[];
} {
  const result = parseMdContent(content, defaults);
  const { frontmatter } = parseFrontmatter(content);
  const m3e = (frontmatter.m3e || {}) as M3eFrontmatter;

  // Force nodeType to folder
  result.node.nodeType = "folder";

  const childrenOrder = m3e["children-order"] || [];

  return {
    node: result.node,
    childrenOrder: childrenOrder.map(String),
    wikilinks: result.wikilinks,
  };
}
