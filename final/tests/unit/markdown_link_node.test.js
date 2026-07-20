import { describe, expect, test } from "vitest";

const {
  applyMarkdownLinkNodeInput,
  editInputForMarkdownLinkNode,
  formatMarkdownLinkNodeInput,
  isMarkdownLinkSubtype,
  localPathLinkToOpen,
  parseMarkdownLinkNodeInput,
  safeExternalLinkToOpen,
} = require("../../dist/shared/markdown_link_node.js");

describe("Markdown hyperlink node helpers", () => {
  test("parses Markdown link input into text, link, and subtype marker", () => {
    expect(parseMarkdownLinkNodeInput("[Obsidian](obsidian://open?vault=X)")).toEqual({
      text: "Obsidian",
      link: "obsidian://open?vault=X",
      isMarkdownLink: true,
    });
  });

  test("leaves bare URLs as plain node text", () => {
    expect(parseMarkdownLinkNodeInput("https://example.com")).toEqual({
      text: "https://example.com",
      link: "",
      isMarkdownLink: false,
    });
  });

  test("formats a hyperlink node as Markdown link edit input", () => {
    expect(formatMarkdownLinkNodeInput({ text: "Obsidian", link: "obsidian://open?vault=X" }))
      .toBe("[Obsidian](obsidian://open?vault=X)");
  });

  test("does not format plain text nodes as Markdown links", () => {
    expect(formatMarkdownLinkNodeInput({ text: "Plain", link: "" })).toBe("Plain");
  });

  test("recognizes the compatibility subtype attribute", () => {
    expect(isMarkdownLinkSubtype({ "m3e:subtype": "hyperlink" })).toBe(true);
    expect(isMarkdownLinkSubtype({ "m3e:subtype": "tabular" })).toBe(false);
  });

  test("uses Markdown link syntax when editing a text node with a stored link", () => {
    expect(editInputForMarkdownLinkNode({
      text: "Obsidian",
      link: "obsidian://open?vault=X",
      attributes: {},
    })).toBe("[Obsidian](obsidian://open?vault=X)");
  });

  test("commit stores Markdown link label, URL, and compatibility subtype", () => {
    expect(applyMarkdownLinkNodeInput({
      text: "Old",
      link: "",
      attributes: {},
    }, "[Obsidian](obsidian://open?vault=X)")).toEqual({
      text: "Obsidian",
      link: "obsidian://open?vault=X",
      attributes: { "m3e:subtype": "hyperlink" },
      isMarkdownLink: true,
    });
  });

  test("plain-text edit of an existing hyperlink clears link and subtype", () => {
    expect(applyMarkdownLinkNodeInput({
      text: "Obsidian",
      link: "obsidian://open?vault=X",
      attributes: { "m3e:subtype": "hyperlink", keep: "yes" },
    }, "Plain")).toEqual({
      text: "Plain",
      link: "",
      attributes: { keep: "yes" },
      isMarkdownLink: false,
    });
  });

  test("allows http, https, and obsidian URLs for external opening", () => {
    expect(safeExternalLinkToOpen("http://example.com")).toBe("http://example.com/");
    expect(safeExternalLinkToOpen("https://example.com/path?q=1")).toBe("https://example.com/path?q=1");
    expect(safeExternalLinkToOpen("obsidian://open?vault=X")).toBe("obsidian://open?vault=X");
  });

  test("rejects blank, malformed, file, javascript, data, and vbscript URLs", () => {
    expect(safeExternalLinkToOpen("")).toBeNull();
    expect(safeExternalLinkToOpen("not a url")).toBeNull();
    expect(safeExternalLinkToOpen("file:///Users/example/note.md")).toBeNull();
    expect(safeExternalLinkToOpen("javascript:alert(1)")).toBeNull();
    expect(safeExternalLinkToOpen("data:text/html,<h1>x</h1>")).toBeNull();
    expect(safeExternalLinkToOpen("vbscript:msgbox(1)")).toBeNull();
  });

  test("recognizes local filesystem paths separately from external URLs", () => {
    expect(localPathLinkToOpen("/Users/example/note.md")).toBe("/Users/example/note.md");
    expect(localPathLinkToOpen("~/vault/note.md")).toBe("~/vault/note.md");
    expect(localPathLinkToOpen("C:\\Users\\example\\note.md")).toBe("C:\\Users\\example\\note.md");
  });

  test("rejects URL schemes and unsafe local path strings for local opening", () => {
    expect(localPathLinkToOpen("obsidian://open?vault=X")).toBeNull();
    expect(localPathLinkToOpen("https://example.com")).toBeNull();
    expect(localPathLinkToOpen("javascript:alert(1)")).toBeNull();
    expect(localPathLinkToOpen("relative/path.md")).toBeNull();
    expect(localPathLinkToOpen("/tmp/a\u0000b")).toBeNull();
  });
});
