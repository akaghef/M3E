// Markdown renderer for node details/note preview.
//
// Scope: a minimal, dependency-free Markdown → HTML renderer that covers the
// 95% of author-written content we actually see in M3E notes (headings, lists,
// paragraphs, bold/italic, inline code, fenced code blocks, blockquotes, links).
// Mermaid code blocks (```mermaid) are rendered to SVG by lazy-loading the
// Mermaid UMD bundle from a CDN the first time one is encountered. Everything
// else is escaped as plain text; there is no raw-HTML pass-through, which is
// our primary XSS guard in lieu of pulling in DOMPurify.
//
// module: "none" — this file emits into the global browser scope. At the
// bottom we also expose the pure functions via CommonJS when a `module` global
// happens to exist, so Node-based unit tests can require the compiled file.

type MermaidLike = {
  initialize?: (config: Record<string, unknown>) => void;
  render: (id: string, src: string) => Promise<{ svg: string }> | { svg: string };
};

const MERMAID_CDN_URL = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";

function mdEscapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  // Reject javascript:, data:, vbscript: etc. Allow http(s), mailto, relative.
  if (/^\s*(javascript|data|vbscript):/i.test(trimmed)) return "#";
  return trimmed;
}

function renderInline(text: string): string {
  let out = mdEscapeHtml(text);

  // Inline code: `code`
  out = out.replace(/`([^`\n]+)`/g, (_m, code: string) => `<code>${code}</code>`);

  // Images: ![alt](url)
  out = out.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (_m, alt: string, url: string) =>
      `<img alt="${alt}" src="${mdEscapeHtml(sanitizeUrl(url))}" />`,
  );

  // Links: [text](url)
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (_m, label: string, url: string) =>
      `<a href="${mdEscapeHtml(sanitizeUrl(url))}" target="_blank" rel="noopener noreferrer">${label}</a>`,
  );

  // Bold **text** (before italic so ** doesn't get eaten by *)
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  // Italic *text*
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  return out;
}

interface MermaidBlock {
  placeholder: string;
  source: string;
}

/**
 * Render a markdown source string into an HTML string plus a list of Mermaid
 * blocks that must be post-processed asynchronously (since Mermaid ships as
 * an async module and we lazy-load it).
 */
function renderMarkdownToHtml(src: string): { html: string; mermaid: MermaidBlock[] } {
  const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
  const htmlParts: string[] = [];
  const mermaidBlocks: MermaidBlock[] = [];

  let i = 0;
  let listKind: "ul" | "ol" | null = null;
  let paragraphBuf: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuf.length === 0) return;
    htmlParts.push(`<p>${renderInline(paragraphBuf.join(" "))}</p>`);
    paragraphBuf = [];
  };
  const closeList = () => {
    if (listKind) {
      htmlParts.push(`</${listKind}>`);
      listKind = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block: ``` or ```lang
    const fenceMatch = /^```\s*([A-Za-z0-9_+-]*)\s*$/.exec(line);
    if (fenceMatch) {
      flushParagraph();
      closeList();
      const lang = fenceMatch[1] || "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing fence
      const codeSrc = codeLines.join("\n");

      if (lang.toLowerCase() === "mermaid") {
        const id = `m3e-mermaid-${mermaidBlocks.length}-${Date.now().toString(36)}`;
        mermaidBlocks.push({ placeholder: id, source: codeSrc });
        htmlParts.push(
          `<div class="markdown-mermaid" data-mermaid-id="${id}"><pre class="markdown-mermaid-source">${mdEscapeHtml(codeSrc)}</pre></div>`,
        );
      } else {
        const langAttr = lang ? ` data-lang="${mdEscapeHtml(lang)}"` : "";
        htmlParts.push(`<pre${langAttr}><code>${mdEscapeHtml(codeSrc)}</code></pre>`);
      }
      continue;
    }

    // Blank line
    if (/^\s*$/.test(line)) {
      flushParagraph();
      closeList();
      i++;
      continue;
    }

    // Heading: #..###### text
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = headingMatch[1].length;
      htmlParts.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      flushParagraph();
      closeList();
      htmlParts.push("<hr />");
      i++;
      continue;
    }

    // Blockquote
    const quoteMatch = /^>\s?(.*)$/.exec(line);
    if (quoteMatch) {
      flushParagraph();
      closeList();
      const qLines: string[] = [quoteMatch[1]];
      i++;
      while (i < lines.length) {
        const m = /^>\s?(.*)$/.exec(lines[i]);
        if (!m) break;
        qLines.push(m[1]);
        i++;
      }
      htmlParts.push(`<blockquote>${renderInline(qLines.join(" "))}</blockquote>`);
      continue;
    }

    // Unordered list
    const ulMatch = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (ulMatch) {
      flushParagraph();
      if (listKind !== "ul") {
        closeList();
        htmlParts.push("<ul>");
        listKind = "ul";
      }
      htmlParts.push(`<li>${renderInline(ulMatch[2])}</li>`);
      i++;
      continue;
    }

    // Ordered list
    const olMatch = /^(\s*)\d+\.\s+(.*)$/.exec(line);
    if (olMatch) {
      flushParagraph();
      if (listKind !== "ol") {
        closeList();
        htmlParts.push("<ol>");
        listKind = "ol";
      }
      htmlParts.push(`<li>${renderInline(olMatch[2])}</li>`);
      i++;
      continue;
    }

    // Default: paragraph line
    closeList();
    paragraphBuf.push(line.trim());
    i++;
  }

  flushParagraph();
  closeList();

  return { html: htmlParts.join("\n"), mermaid: mermaidBlocks };
}

/**
 * Lazy-load Mermaid from CDN. Returns the mermaid API or null if loading
 * failed (offline, blocked CSP, etc). Subsequent calls return the cached
 * promise so we only fetch once per session.
 */
function loadMermaid(): Promise<MermaidLike | null> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(null);
  }
  const g: any = globalThis as any;
  if (g.mermaid) return Promise.resolve(g.mermaid as MermaidLike);
  if (g.__m3eMermaidLoadPromise) return g.__m3eMermaidLoadPromise as Promise<MermaidLike | null>;

  g.__m3eMermaidLoadPromise = new Promise<MermaidLike | null>((resolve) => {
    const script = document.createElement("script");
    script.src = MERMAID_CDN_URL;
    script.async = true;
    script.onload = () => {
      const api: MermaidLike | undefined = g.mermaid;
      if (api && typeof api.initialize === "function") {
        try {
          api.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default" });
        } catch {
          /* ignore */
        }
      }
      resolve(api || null);
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return g.__m3eMermaidLoadPromise as Promise<MermaidLike | null>;
}

/**
 * Render markdown into a target container element. Mermaid blocks are swapped
 * in asynchronously once the library loads. Returns a promise that resolves
 * when all Mermaid diagrams have been rendered (or skipped on failure).
 */
async function renderMarkdownInto(target: HTMLElement, src: string): Promise<void> {
  const { html, mermaid } = renderMarkdownToHtml(src);
  target.innerHTML = html;
  if (mermaid.length === 0) return;

  const api = await loadMermaid();
  if (!api) {
    // Leave the source block visible with a subtle marker so the user still
    // sees their content when the diagram library is unavailable.
    target.querySelectorAll(".markdown-mermaid").forEach((el) => {
      el.classList.add("markdown-mermaid-fallback");
    });
    return;
  }

  for (let idx = 0; idx < mermaid.length; idx++) {
    const block = mermaid[idx];
    const host = target.querySelector(
      `.markdown-mermaid[data-mermaid-id="${block.placeholder}"]`,
    ) as HTMLElement | null;
    if (!host) continue;
    try {
      const renderId = `mmd-${block.placeholder}`;
      const result = await Promise.resolve(api.render(renderId, block.source));
      host.innerHTML = result.svg;
    } catch (err) {
      host.classList.add("markdown-mermaid-error");
      host.innerHTML = `<pre class="markdown-mermaid-source">${mdEscapeHtml(block.source)}</pre><div class="markdown-mermaid-error-msg">Mermaid render failed: ${mdEscapeHtml(String((err as Error)?.message || err))}</div>`;
    }
  }
}

// Expose for CommonJS test runners without breaking the browser global build.
// `module` is not declared globally in tsconfig.browser.json; we use a guarded
// runtime check that TypeScript accepts because we reference it via `any`.
// Attach to globalThis so both the browser (where the file runs at top level
// and `globalThis.renderMarkdownInto` is picked up by viewer.ts) and Node
// unit tests (which dynamically require and read these off the global) can
// reach the API without relying on module systems.
(function exposeOnGlobal() {
  const g: any = typeof globalThis !== "undefined" ? (globalThis as any) : {};
  g.renderMarkdownToHtml = renderMarkdownToHtml;
  g.renderMarkdownInto = renderMarkdownInto;
  g.__m3eMarkdownApi = {
    escapeHtml: mdEscapeHtml,
    sanitizeUrl,
    renderInline,
    renderMarkdownToHtml,
    renderMarkdownInto,
    loadMermaid,
  };
})();
