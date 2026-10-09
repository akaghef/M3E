import { describe, expect, it } from "vitest";
import { hasPrimaryModifier, keyboardPlatform, nodeLabelEditAction, type KeyboardPlatform } from "../../src/browser/viewer_keyboard";

const key = (name: string, modifiers = {}) => ({ key:name,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,isComposing:false,...modifiers });

it("detects Mac separately from Windows/Linux", () => {
  expect(keyboardPlatform("MacIntel")).toBe("mac");
  expect(keyboardPlatform("Win32")).toBe("other");
  expect(keyboardPlatform("Linux x86_64")).toBe("other");
});

for (const platform of ["mac", "other"] as KeyboardPlatform[]) {
  describe(platform, () => {
    const primary = platform === "mac" ? {metaKey:true} : {ctrlKey:true};
    const secondary = platform === "mac" ? {ctrlKey:true} : {metaKey:true};
    it("uses only the OS command modifier", () => {
      expect(hasPrimaryModifier(key("c",primary),platform)).toBe(true);
      expect(hasPrimaryModifier(key("c",secondary),platform)).toBe(false);
      expect(hasPrimaryModifier(key("c",{ctrlKey:true,metaKey:true}),platform)).toBe(false);
      expect(nodeLabelEditAction(key("Enter",primary),platform)).toBe("next");
      expect(nodeLabelEditAction(key("Enter",secondary),platform)).toBe("none");
    });
    it("keeps edit transitions and native newline distinct", () => {
      expect(nodeLabelEditAction(key("Enter"),platform)).toBe("sibling");
      expect(nodeLabelEditAction(key("Tab"),platform)).toBe("child");
      expect(nodeLabelEditAction(key("Tab",{shiftKey:true}),platform)).toBe("child");
      expect(nodeLabelEditAction(key("Escape"),platform)).toBe("finish");
      expect(nodeLabelEditAction(key("Enter",{shiftKey:true}),platform)).toBe("none");
    });
    it("does not turn unassigned modified keys into node creation", () => {
      for (const name of ["Tab","Enter","Escape"]) {
        for (const modifiers of [{altKey:true},secondary,{ctrlKey:true,metaKey:true},{...primary,shiftKey:true}]) {
          expect(nodeLabelEditAction(key(name,modifiers),platform)).toBe("none");
        }
      }
      expect(nodeLabelEditAction(key("Tab",primary),platform)).toBe("none");
    });
    it("leaves IME and text shortcuts to the input", () => {
      for (const name of ["Enter","Tab","Escape"]) {
        expect(nodeLabelEditAction(key(name,{isComposing:true}),platform)).toBe("none");
      }
      for (const name of ["c","v","x","a","z","ArrowDown","Backspace","Delete"]) {
        expect(nodeLabelEditAction(key(name,primary),platform)).toBe("none");
      }
    });
  });
}
