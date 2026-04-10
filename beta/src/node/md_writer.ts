"use strict";

import type { TreeNode } from "../shared/types";
import type { M3eFrontmatter, ParsedFrontmatter } from "./md_reader";

// ---------------------------------------------------------------------------
// YAML serializer (minimal subset matching md_reader)
// ---------------------------------------------------------------------------

function serializeScalar(value: unknown): string {
  if (typeof value === "string") {
    // Quote strings that contain special YAML characters
    if (/[:#\[\]{},|>&*!?'"]/.test(value) || value.includes("\n")) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  return String(value);
}

function serializeYaml(
  obj: Record<string, unknown>,
  indent: number = 0
): string {
  const pad = " ".repeat(indent);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === "") continue;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${pad}${key}:`);
      for (const item of value) {
        if (typeof item === "object" && item !== null) {
          // Object array item
          const entries = Object.entries(item as Record<string, unknown>);
          if (entries.length > 0) {
            const [firstKey, firstVal] = entries[0];
            lines.push(
              `${pad}  - ${firstKey}: ${serializeScalar(firstVal)}`
            );
            for (let i = 1; i < entries.length; i++) {
              lines.push(
                `${pad}    ${entries[i][0]}: ${serializeScalar(entries[i][1])}`
              );
            }
          }
        } else {
          lines.push(`${pad}  - ${serializeScalar(item)}`);
        }
      }
    } else if (typeof value === "object" && value !== null) {
      lines.push(`${pad}${key}:`);
      lines.push(serializeYaml(value as Record<string, unknown>, indent + 2));
    } else {
      lines.push(`${pad}${key}: ${serializeScalar(value)}`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Frontmatter builder
// ---------------------------------------------------------------------------

function buildFrontmatter(node: Partial<TreeNode>, childrenOrder?: string[]): ParsedFrontmatter {
  const m3e: M3eFrontmatter = {};

  if (node.id) m3e.nodeId = node.id;
  if (node.nodeType && node.nodeType !== "text") m3e.nodeType = node.nodeType;
  if (node.collapsed) m3e.collapsed = true;
  if (childrenOrder && childrenOrder.length > 0) {
    m3e["children-order"] = childrenOrder;
  }
  if (node.note) m3e.note = node.note;
  if (node.link) m3e.link = node.link;

  const fm: ParsedFrontmatter = {};

  // Only add m3e block if it has content
  if (Object.keys(m3e).length > 0) {
    fm.m3e = m3e;
  }

  // Extract tags and aliases from attributes
  if (node.attributes) {
    if (node.attributes["tags"]) {
      fm.tags = node.attributes["tags"].split(",").map((t) => t.trim());
    }
    if (node.attributes["aliases"]) {
      fm.aliases = node.attributes["aliases"].split(",").map((a) => a.trim());
    }
  }

  return fm;
}

// ---------------------------------------------------------------------------
// Main serialize function
// ---------------------------------------------------------------------------

/**
 * Serialize a TreeNode to .md file content.
 *
 * @param node - The TreeNode to serialize
 * @param options - Additional options
 * @returns The .md file content string
 */
export function serializeToMd(
  node: Partial<TreeNode> & { id: string; text: string },
  options?: {
    /** Ordered children IDs for folder nodes */
    childrenOrder?: string[];
    /** Wikilink targets to embed in body */
    wikilinks?: Array<{ target: string; label?: string; embedded?: boolean }>;
  }
): string {
  const fm = buildFrontmatter(node, options?.childrenOrder);
  const parts: string[] = [];

  // Frontmatter
  const hasFrontmatter = Object.keys(fm).length > 0;
  if (hasFrontmatter) {
    parts.push("---");
    parts.push(serializeYaml(fm as Record<string, unknown>));
    parts.push("---");
    parts.push("");
  }

  // Heading
  parts.push(`# ${node.text}`);
  parts.push("");

  // Body (details)
  if (node.details) {
    parts.push(node.details);
    parts.push("");
  }

  // Wikilinks section
  if (options?.wikilinks && options.wikilinks.length > 0) {
    parts.push("## Related");
    parts.push("");
    for (const wl of options.wikilinks) {
      const prefix = wl.embedded ? "!" : "";
      if (wl.label) {
        parts.push(`- ${prefix}[[${wl.target}|${wl.label}]]`);
      } else {
        parts.push(`- ${prefix}[[${wl.target}]]`);
      }
    }
    parts.push("");
  }

  return parts.join("\n");
}

/**
 * Serialize a folder node to _folder.md content.
 */
export function serializeFolderMd(
  node: Partial<TreeNode> & { id: string; text: string },
  childrenOrder: string[]
): string {
  // Force folder nodeType
  const folderNode = { ...node, nodeType: "folder" as const };
  return serializeToMd(folderNode, { childrenOrder });
}
