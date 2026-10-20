type ViewerTheme = "light" | "dark";
const THEME_PREFS_KEY = "m3e:viewer-theme";
const normalizeTheme = (value: unknown): ViewerTheme => value === "dark" ? "dark" : "light";

/** Own the existing theme controls; surface colors remain defined by CSS. */
export function initializeViewerTheme(options: {
  redraw: () => void;
  setStatus: (message: string) => void;
}): void {
  const toggleButton = document.getElementById("theme-toggle");
  let theme: ViewerTheme = "light";
  try {
    theme = normalizeTheme(window.localStorage.getItem(THEME_PREFS_KEY));
  } catch {
    // Local storage may be unavailable in restricted browser contexts.
  }

  const apply = (next: ViewerTheme, persist = false, announce = false): void => {
    const changed = next !== theme;
    theme = next;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.body.dataset.theme = theme;
    if (toggleButton) {
      toggleButton.textContent = theme === "dark" ? "Light" : "Dark";
      toggleButton.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      toggleButton.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    }
    if (persist) {
      try {
        window.localStorage.setItem(THEME_PREFS_KEY, theme);
      } catch {
        // Keep theme switching usable when storage is unavailable.
      }
    }
    // A full surface redraw re-resolves computed SVG styles and replaces the
    // WebGL paint snapshot/tiles. Camera-only invalidation retains old colors.
    // Initial startup already renders the map after applying the stored theme.
    if (changed) options.redraw();
    window.dispatchEvent(new CustomEvent("m3e:theme-changed", { detail: { theme } }));
    if (announce) options.setStatus(theme === "dark" ? "Dark mode enabled." : "Light mode enabled.");
  };
  const toggle = (): void => apply(theme === "dark" ? "light" : "dark", true, true);
  apply(theme);
  toggleButton?.addEventListener("click", toggle);
  window.addEventListener("m3e:toggle-theme", toggle);
  window.addEventListener("m3e:set-theme", (event: Event) => {
    const detail = (event as CustomEvent<{ theme?: unknown; announce?: unknown }>).detail;
    apply(normalizeTheme(detail?.theme), true, Boolean(detail?.announce));
  });
}
