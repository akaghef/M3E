/** Keyboard semantics are independent of SVG/WebGL and DOM focus. */
export type KeyboardPlatform = "mac" | "other";
export type ViewerKeyboardMode = "navigate" | "edit";
type Modifiers = Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey" | "shiftKey">;
type KeyInput = Modifiers & Pick<KeyboardEvent, "key" | "isComposing">;

export function keyboardPlatform(platform: string): KeyboardPlatform {
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? "mac" : "other";
}

/** Command on macOS, Control on Windows/Linux; never alias the other key. */
export function hasPrimaryModifier(event: Pick<Modifiers, "ctrlKey" | "metaKey">, platform: KeyboardPlatform): boolean {
  return platform === "mac" ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

export function nodeLabelEditAction(event: KeyInput, platform: KeyboardPlatform): "none" | "finish" | "next" | "child" | "sibling" {
  if (event.isComposing) return "none";
  if (hasPrimaryModifier(event, platform) && !event.altKey && !event.shiftKey && event.key === "Enter") return "next";
  // Unknown modified keys belong to the text editor / OS, not map commands.
  if (event.ctrlKey || event.metaKey || event.altKey) return "none";
  if (event.key === "Escape" && !event.shiftKey) return "finish";
  // Retain the existing Shift+Tab child-creation behavior explicitly.
  if (event.key === "Tab") return "child";
  if (event.key === "Enter" && !event.shiftKey) return "sibling";
  return "none";
}
