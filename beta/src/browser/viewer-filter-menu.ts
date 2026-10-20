/** Shared small DOM behaviours used by the existing menus and the filter bar. */
export function toggleDropdown(menu: HTMLElement | null, button: HTMLElement | null): void {
  if (!menu || !button) return;
  const open = menu.hidden;
  menu.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
}
export function closeOnOutsideClick(element: HTMLElement, close: () => void): () => void {
  const listener = (event: MouseEvent) => {
    if (!element.contains(event.target as Node)) { close(); cleanup(); }
  };
  const timer = setTimeout(() => document.addEventListener("click", listener, true), 0);
  const cleanup = () => { clearTimeout(timer); document.removeEventListener("click", listener, true); };
  return cleanup;
}
