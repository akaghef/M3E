import { afterEach, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { initializeViewerTheme } from "../../src/browser/viewer_theme";

afterEach(() => vi.unstubAllGlobals());

it("applies a stored theme before startup rendering and refreshes both live directions", () => {
  const dom = new JSDOM('<button id="theme-toggle"></button>', { url: "http://localhost" });
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("CustomEvent", dom.window.CustomEvent);
  window.localStorage.setItem("m3e:viewer-theme", "dark");
  const observed: string[] = [];
  const redraw = vi.fn(() => observed.push(document.documentElement.dataset.theme!));
  initializeViewerTheme({ redraw, setStatus: vi.fn() });
  expect(document.body.dataset.theme).toBe("dark");
  expect(redraw).not.toHaveBeenCalled();
  document.getElementById("theme-toggle")!.click();
  document.getElementById("theme-toggle")!.click();
  expect(observed).toEqual(["light", "dark"]);
  expect(window.localStorage.getItem("m3e:viewer-theme")).toBe("dark");

  // Workbench uses these events, whereas the legacy toolbar uses the button.
  window.dispatchEvent(new CustomEvent("m3e:set-theme", { detail: { theme: "light" } }));
  window.dispatchEvent(new CustomEvent("m3e:toggle-theme"));
  expect(observed).toEqual(["light", "dark", "light", "dark"]);
  window.dispatchEvent(new CustomEvent("m3e:set-theme", { detail: { theme: "dark" } }));
  expect(redraw).toHaveBeenCalledTimes(4);
  dom.window.close();
});
