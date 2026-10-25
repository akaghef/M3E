import React, { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { VIEW_FILTER_AXES } from "../shared/view_filter_axes";
import { viewerFilter } from "./viewer-filter-controller";
import { closeOnOutsideClick } from "./viewer-filter-menu";
export const useViewerFilter = () => useSyncExternalStore(viewerFilter.subscribe, viewerFilter.getSnapshot);
export function ViewerFilterBar(): React.ReactElement {
  const { selection, open, result } = useViewerFilter();
  const root = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const close = (focus = true) => { if (focus && open) buttons.current.get(open)?.focus(); viewerFilter.openMenu(null); };
  useEffect(() => open && root.current ? closeOnOutsideClick(root.current, () => viewerFilter.openMenu(null)) : undefined, [open]);
  useLayoutEffect(() => { if (open) root.current?.querySelector<HTMLElement>('[role="menu"] button')?.focus(); }, [open]);
  // Use the measured gap only when the whole bar fits; otherwise reserve a row
  // below both groups, within the map area beside the Inspector.
  useLayoutEffect(() => {
    const left = document.querySelector(".wb-brand"), right = document.querySelector(".wb-top-actions");
    const bar = root.current, shell = bar?.parentElement;
    if (!left || !right || !bar || !shell) return;
    const panels = new Set<Element>();
    const intersects = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const place = () => {
      const container = shell.getBoundingClientRect(), l = left.getBoundingClientRect(), r = right.getBoundingClientRect();
      const inspectorRects = Array.from(panels, panel => panel.getBoundingClientRect()).filter(rect => rect.width && rect.height);
      const rowLeft = container.left + 14;
      const rowRight = Math.min(container.right - 14, ...inspectorRects.map(rect => rect.left - 8));
      bar.style.maxWidth = `${Math.max(1, rowRight - rowLeft)}px`;
      const size = bar.getBoundingClientRect(), centre = (l.right + r.left) / 2, top = Math.min(l.top, r.top);
      const candidate = new DOMRect(centre - size.width / 2, top, size.width, size.height);
      const fits = candidate.left >= l.right + 8 && candidate.right <= r.left - 8 && !inspectorRects.some(rect => intersects(candidate, rect));
      bar.style.left = `${(fits ? centre : (rowLeft + rowRight) / 2) - container.left}px`;
      bar.style.top = `${(fits ? top : Math.max(l.bottom, r.bottom) + 8) - container.top}px`;
    };
    const observer = new ResizeObserver(place);
    for (const element of [left, right, shell, bar]) observer.observe(element);
    const observePanels = () => {
      for (const panel of panels) observer.unobserve(panel);
      panels.clear();
      shell.querySelectorAll(".wb-right-panel, .wb-panel-tab").forEach(panel => { panels.add(panel); observer.observe(panel); });
      place();
    };
    // Includes late NETWORK mounting, changing top-bar labels, and Inspector toggles.
    const mutations = new MutationObserver(observePanels);
    mutations.observe(shell, { childList: true, subtree: true, characterData: true });
    observePanels();
    window.addEventListener("resize", place); place();
    return () => { observer.disconnect(); mutations.disconnect(); window.removeEventListener("resize", place); };
  }, []);
  return <div ref={root} className="viewer-filter-bar" role="toolbar" aria-label="フィルタ" onKeyDown={event => {
    event.stopPropagation();
    if (!open) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key === "Tab") { buttons.current.get(open)?.focus(); close(false); }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); event.stopPropagation();
      const items = Array.from(root.current!.querySelectorAll<HTMLButtonElement>('[role="menu"] button'));
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    }
  }}>
    <div className="viewer-filter-controls">
    {VIEW_FILTER_AXES.map(axis => {
      const state = result.axes[axis.id], value = selection[axis.id];
      const selected = typeof value === "string" ? [] : value;
      const label = typeof value === "string" ? axis.options.find(option => option.value === value)?.label : value.length ? value.join("、") : "すべて";
      const options = axis.kind === "multiple" ? [...new Set([...state.candidates, ...selected])] : [];
      const selectedIndex = axis.options.findIndex(option => option.value === value);
      return <div className="viewer-filter-axis" key={axis.id}>
        <button type="button" ref={button => { if (button) buttons.current.set(axis.id, button); }}
          className={state.active ? "is-active" : ""} disabled={!state.enabled} aria-haspopup="menu" aria-expanded={open === axis.id}
          aria-describedby={!state.enabled ? "viewer-filter-disabled-reason" : undefined}
          onClick={() => open === axis.id ? close() : viewerFilter.openMenu(axis.id)}>
          <span>{axis.label}</span><strong>{label}</strong><ChevronDown size={12} aria-hidden="true" />
        </button>
        {open === axis.id && <div role="menu" aria-label={axis.label} className="viewer-filter-menu">
          {axis.kind === "multiple" ? <>
            <button type="button" role="menuitemcheckbox" aria-checked={!selected.length} onClick={() => viewerFilter.select(axis.id, [])}>すべて</button>
            <hr />
            {options.map(name => <button type="button" role="menuitemcheckbox" aria-checked={selected.includes(name)} key={name}
              onClick={() => viewerFilter.select(axis.id, selected.includes(name) ? selected.filter(item => item !== name) : [...selected, name])}>
              <span aria-hidden="true">{selected.includes(name) ? "☑" : "☐"}</span>{name}
            </button>)}
            <button type="button" onClick={() => close()}>閉じる</button>
          </> : axis.options.map((option, index) => <button type="button" role="menuitemradio" key={option.value}
            aria-checked={value === option.value} onClick={() => { viewerFilter.select(axis.id, option.value); close(); }}>
            <span aria-hidden="true">{value === option.value ? "●" : "○"}</span>
            <span><strong>{option.label}</strong><small>{option.meaning}</small></span>{index < selectedIndex && <span>含む</span>}
          </button>)}
        </div>}
      </div>;
    })}
    <button type="button" onClick={() => viewerFilter.clear()}>解除</button>
    </div>
    {VIEW_FILTER_AXES.some(axis => !result.axes[axis.id].enabled) && <small id="viewer-filter-disabled-reason">この map には値がありません</small>}
  </div>;
}
export function ViewerFilterCount(): React.ReactElement | null {
  const { result } = useViewerFilter();
  return result.active ? <span className="viewer-filter-count" role="status">node {result.nodes.size}/{result.nodeCount} · GraphLink {result.links.size}/{result.linkCount}</span> : null;
}
