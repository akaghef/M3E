import { describe, expect, test } from "vitest";
import { resolveMarkdownFilePreviewTarget } from "../../src/shared/markdown_file_preview";

const root = "/Users/example/vault";

describe("Markdown file preview target resolution", () => {
  test("resolves a relative Markdown link under the preferred allowed root", () => {
    expect(resolveMarkdownFilePreviewTarget(
      { link: "notes/alpha.md" },
      { allowedRootPaths: [root] },
    )).toEqual({ rootPath: root, relativePath: "notes/alpha.md" });
  });

  test("resolves an absolute Markdown link only when it is inside an allowed root", () => {
    expect(resolveMarkdownFilePreviewTarget(
      { link: "/Users/example/vault/notes/alpha.markdown#section" },
      { allowedRootPaths: [root] },
    )).toEqual({ rootPath: root, relativePath: "notes/alpha.markdown" });
    expect(resolveMarkdownFilePreviewTarget(
      { link: "/Users/example/private/secret.md" },
      { allowedRootPaths: [root] },
    )).toBeNull();
  });

  test("uses local filesystem node metadata when its root is allowed", () => {
    expect(resolveMarkdownFilePreviewTarget({
      attributes: {
        "local-fs:root-path": root,
        "local-fs:relative-path": "docs/design.md",
      },
    }, { allowedRootPaths: [root] })).toEqual({
      rootPath: root,
      relativePath: "docs/design.md",
    });
  });

  test("uses vault file metadata under the active vault root", () => {
    expect(resolveMarkdownFilePreviewTarget({
      attributes: {
        "vault:kind": "file",
        "vault:path": "daily/2026-08-02.md",
      },
    }, { allowedRootPaths: [root] })).toEqual({
      rootPath: root,
      relativePath: "daily/2026-08-02.md",
    });
  });

  test("rejects traversal, non-Markdown files, and URL schemes", () => {
    expect(resolveMarkdownFilePreviewTarget({ link: "../secret.md" }, { allowedRootPaths: [root] })).toBeNull();
    expect(resolveMarkdownFilePreviewTarget({ link: "notes/image.png" }, { allowedRootPaths: [root] })).toBeNull();
    expect(resolveMarkdownFilePreviewTarget({ link: "https://example.com/readme.md" }, { allowedRootPaths: [root] })).toBeNull();
  });
});
