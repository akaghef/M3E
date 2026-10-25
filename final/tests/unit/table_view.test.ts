import { describe, expect, it } from "vitest";
import {
  buildTableViewModel,
  directTableViewChildren,
  normalizeTableStatus,
  renderTableViewHtml,
  type TableViewChild,
} from "../../src/browser/table_view";

function child(
  id: string,
  text: string,
  attributes: Record<string, string> = {},
  details = "",
): TableViewChild {
  return { id, text, details, attributes };
}

describe("table view projection", () => {
  it("resolves direct children in canonical order and ignores missing or nested nodes", () => {
    const first = child("first", "First");
    const nested = child("nested", "Nested");
    const result = directTableViewChildren(
      { children: ["first", "missing"] },
      { first, nested },
    );

    expect(result).toEqual([first]);
    expect(result).not.toContain(nested);
  });

  it("derives deterministic union columns and excludes all m3e internal keys", () => {
    const model = buildTableViewModel([
      child("a", "A", { zeta: "z", "m3e:status": "active", alpha: "a" }),
      child("b", "B", { beta: "b", alpha: "a", "m3e:view-type": "table" }),
    ]);

    expect(model.attributeColumns).toEqual(["alpha", "beta", "zeta"]);
    expect(model.includeDetails).toBe(false);
  });

  it("includes one details column when any direct child has details", () => {
    const model = buildTableViewModel([
      child("a", "A", { owner: "one" }, "A detail"),
      child("b", "B", { owner: "two" }),
    ]);

    const html = renderTableViewHtml(model);
    expect(html).toContain("<th>owner</th><th>Details</th>");
    expect(html).toContain(">A detail</td>");
    expect(html).toContain("data-node-id=\"b\"");
  });

  it("escapes untrusted IDs, names, keys, values, and details", () => {
    const html = renderTableViewHtml(buildTableViewModel([
      child(
        'row" onmouseover="bad',
        "<script>alert(1)</script>",
        { '<img src=x onerror="bad">': "& <b>unsafe</b>" },
        "</td><script>bad()</script>",
      ),
    ]));

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("row&quot; onmouseover=&quot;bad");
    expect(html).toContain("&amp; &lt;b&gt;unsafe&lt;/b&gt;");
  });

  it("uses only allowlisted normalized status classes", () => {
    expect(normalizeTableStatus(" CONFIRMED ")).toBe("confirmed");
    expect(normalizeTableStatus('active" onmouseover="bad')).toBeNull();

    const html = renderTableViewHtml(buildTableViewModel([
      child("safe", "Safe", { "m3e:status": " CONFIRMED " }),
      child("unsafe", "Unsafe", { "m3e:status": 'active" onmouseover="bad' }),
    ]));
    expect(html).toContain('data-node-id="safe" class="status-confirmed"');
    expect(html).toContain('data-node-id="unsafe">');
    expect(html).not.toContain("status-active");
  });
});
