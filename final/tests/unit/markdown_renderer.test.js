"use strict";

import { describe, it, expect } from "vitest";
const path = require("node:path");
const fs = require("node:fs");

// Resolve the compiled browser bundle. The browser file is compiled with
// `tsconfig.browser.json` (module: "none"), but we appended a guarded CJS
// export block so we can require() it directly from Node-based unit tests.
const distPath = path.resolve(__dirname, "../../dist/browser/markdown_renderer.js");

function loadRenderer() {
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `markdown_renderer.js not built at ${distPath}. ` +
        `Run \`npx tsc -p tsconfig.browser.json\` first.`,
    );
  }
  // The browser bundle is a plain script that attaches its API to globalThis.
  // We read it as source and eval it in the current context so `globalThis`
  // and `window`-less guards both work.
  const src = fs.readFileSync(distPath, "utf8");
  // eslint-disable-next-line no-eval
  (0, eval)(src);
  const api = /** @type {any} */ (globalThis).__m3eMarkdownApi;
  if (!api) throw new Error("markdown_renderer did not attach __m3eMarkdownApi to globalThis.");
  return api;
}

describe("markdown_renderer", () => {
  const mod = loadRenderer();

  describe("escapeHtml", () => {
    it("escapes all five HTML-sensitive characters", () => {
      expect(mod.escapeHtml("<script>alert(\"x\")</script>")).toBe(
        "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
      );
      expect(mod.escapeHtml("a & b")).toBe("a &amp; b");
      expect(mod.escapeHtml("it's")).toBe("it&#39;s");
    });
  });

  describe("sanitizeUrl", () => {
    it("rejects javascript: urls", () => {
      expect(mod.sanitizeUrl("javascript:alert(1)")).toBe("#");
      expect(mod.sanitizeUrl("  JavaScript:alert(1)")).toBe("#");
    });
    it("rejects data: and vbscript: urls", () => {
      expect(mod.sanitizeUrl("data:text/html,<script>")).toBe("#");
      expect(mod.sanitizeUrl("vbscript:msgbox")).toBe("#");
    });
    it("passes through http/https/mailto/relative urls", () => {
      expect(mod.sanitizeUrl("https://example.com")).toBe("https://example.com");
      expect(mod.sanitizeUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
      expect(mod.sanitizeUrl("../other")).toBe("../other");
    });
  });

  describe("renderMarkdownToHtml", () => {
    it("renders headings", () => {
      const { html } = mod.renderMarkdownToHtml("# Title\n\n## Sub");
      expect(html).toContain("<h1>Title</h1>");
      expect(html).toContain("<h2>Sub</h2>");
    });

    it("renders paragraphs and inline formatting", () => {
      const { html } = mod.renderMarkdownToHtml("Hello **bold** and *em* and `code`.");
      expect(html).toContain("<strong>bold</strong>");
      expect(html).toContain("<em>em</em>");
      expect(html).toContain("<code>code</code>");
    });

    it("renders unordered and ordered lists", () => {
      const { html: ul } = mod.renderMarkdownToHtml("- a\n- b\n- c");
      expect(ul).toContain("<ul>");
      expect(ul).toContain("<li>a</li>");
      expect(ul).toContain("</ul>");

      const { html: ol } = mod.renderMarkdownToHtml("1. one\n2. two");
      expect(ol).toContain("<ol>");
      expect(ol).toContain("<li>one</li>");
    });

    it("renders blockquotes and horizontal rules", () => {
      const { html } = mod.renderMarkdownToHtml("> quoted line\n\n---");
      expect(html).toContain("<blockquote>quoted line</blockquote>");
      expect(html).toContain("<hr />");
    });

    it("renders fenced code blocks with language attribute", () => {
      const { html } = mod.renderMarkdownToHtml("```js\nconst x = 1;\n```");
      expect(html).toContain('data-lang="js"');
      expect(html).toContain("const x = 1;");
    });

    it("renders links and escapes dangerous urls", () => {
      const { html: safe } = mod.renderMarkdownToHtml("[link](https://example.com)");
      expect(safe).toContain('href="https://example.com"');
      expect(safe).toContain('target="_blank"');

      const { html: danger } = mod.renderMarkdownToHtml("[x](javascript:alert(1))");
      expect(danger).toContain('href="#"');
      expect(danger).not.toContain("javascript:");
    });

    it("escapes raw HTML in source markdown (no passthrough)", () => {
      const { html } = mod.renderMarkdownToHtml("hi <script>bad()</script>");
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("extracts mermaid code blocks separately", () => {
      const { html, mermaid } = mod.renderMarkdownToHtml(
        "Intro\n\n```mermaid\ngraph TD; A-->B;\n```\n\ntail",
      );
      expect(mermaid).toHaveLength(1);
      expect(mermaid[0].source).toBe("graph TD; A-->B;");
      expect(html).toContain('class="markdown-mermaid"');
      expect(html).toContain(mermaid[0].placeholder);
      // Source is still escaped into the placeholder for fallback display.
      expect(html).toContain("graph TD; A--&gt;B;");
    });

    it("handles empty / whitespace input without throwing", () => {
      expect(mod.renderMarkdownToHtml("").html).toBe("");
      expect(mod.renderMarkdownToHtml("   \n\n  \n").html).toBe("");
    });

    it("normalizes CRLF line endings", () => {
      const { html } = mod.renderMarkdownToHtml("# A\r\n\r\nPara");
      expect(html).toContain("<h1>A</h1>");
      expect(html).toContain("<p>Para</p>");
    });
  });
});
