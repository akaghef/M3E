export interface TableViewChild {
  id: string;
  text: string;
  details: string;
  attributes: Readonly<Record<string, string>>;
}

export interface TableViewParent {
  children: readonly string[];
}

export type TableViewNodeMap = Readonly<Record<string, TableViewChild | undefined>>;

export interface TableViewModel {
  children: readonly TableViewChild[];
  attributeColumns: readonly string[];
  includeDetails: boolean;
}

const TABLE_STATUS_CLASSES = new Set([
  "placeholder",
  "confirmed",
  "contested",
  "frozen",
  "active",
  "review",
]);

/** Resolve only the children named by the canonical parent-child edge list. */
export function directTableViewChildren(
  parent: TableViewParent,
  nodes: TableViewNodeMap,
): TableViewChild[] {
  return parent.children
    .map((childId) => Object.prototype.hasOwnProperty.call(nodes, childId) ? nodes[childId] : undefined)
    .filter((child): child is TableViewChild => Boolean(child));
}

/** Build metadata for a table without copying or mutating canonical child data. */
export function buildTableViewModel(children: readonly TableViewChild[]): TableViewModel {
  const attributeKeys = new Set<string>();
  for (const child of children) {
    for (const key of Object.keys(child.attributes)) {
      if (!key.startsWith("m3e:")) attributeKeys.add(key);
    }
  }

  return {
    children,
    attributeColumns: Array.from(attributeKeys).sort(),
    includeDetails: children.some((child) => Boolean(child.details)),
  };
}

export function normalizeTableStatus(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const status = raw.trim().toLowerCase();
  return TABLE_STATUS_CLASSES.has(status) ? status : null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function childValue(child: TableViewChild, key: string): string {
  return child.attributes[key] ?? "";
}

/** Render the table body as escaped HTML; the caller owns placement and sizing. */
export function renderTableViewHtml(model: TableViewModel): string {
  let html = '<table class="m3e-table-view" data-component-kind="tabular"><thead><tr><th>Name</th>';
  for (const key of model.attributeColumns) {
    html += `<th>${escapeHtml(key)}</th>`;
  }
  if (model.includeDetails) html += "<th>Details</th>";
  html += "</tr></thead><tbody>";

  const columnCount = model.attributeColumns.length + (model.includeDetails ? 1 : 0);
  if (model.children.length === 0) {
    html += `<tr class="m3e-table-empty-row"><td class="m3e-table-empty" colspan="${Math.max(1, columnCount + 1)}">No rows</td></tr>`;
  } else {
    for (const child of model.children) {
      const childId = escapeHtml(child.id);
      const status = normalizeTableStatus(child.attributes["m3e:status"]);
      html += `<tr data-node-id="${childId}"${status ? ` class="status-${status}"` : ""}>`;
      html += `<td class="m3e-table-name" data-node-id="${childId}">${escapeHtml(child.text || "(empty)")}</td>`;
      for (const key of model.attributeColumns) {
        html += `<td data-node-id="${childId}">${escapeHtml(childValue(child, key))}</td>`;
      }
      if (model.includeDetails) {
        html += `<td data-node-id="${childId}">${escapeHtml(child.details)}</td>`;
      }
      html += "</tr>";
    }
  }

  return `${html}</tbody></table>`;
}
