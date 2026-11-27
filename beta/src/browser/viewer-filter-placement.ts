import { FrameInvalidation } from "../rendering/frame_invalidation";

/** Panel discovery follows DOM deltas; geometry reads are batched before writes. */
export function observeFilterPlacement(bar:HTMLElement): (()=>void)|undefined {
    const left = document.querySelector(".wb-brand"), right = document.querySelector(".wb-top-actions");
    const shell = bar.parentElement;
    if (!left || !right || !bar || !shell) return;
    const panels = new Set<Element>();
    const intersects = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const place = () => {
      const container = shell.getBoundingClientRect(), l = left.getBoundingClientRect(), r = right.getBoundingClientRect();
      const inspectorRects = Array.from(panels, panel => panel.getBoundingClientRect()).filter(rect => rect.width && rect.height);
      const rowLeft = container.left + 14;
      const rowRight = Math.min(container.right - 14, ...inspectorRects.map(rect => rect.left - 8));
      const size = bar.getBoundingClientRect(), centre = (l.right + r.left) / 2, top = Math.min(l.top, r.top);
      const candidate = new DOMRect(centre - size.width / 2, top, size.width, size.height);
      const fits = candidate.left >= l.right + 8 && candidate.right <= r.left - 8 && !inspectorRects.some(rect => intersects(candidate, rect));
      bar.style.maxWidth = `${Math.max(1, rowRight - rowLeft)}px`;
      bar.style.left = `${(fits ? centre : (rowLeft + rowRight) / 2) - container.left}px`;
      bar.style.top = `${(fits ? top : Math.max(l.bottom, r.bottom) + 8) - container.top}px`;
    };
    const frame = new FrameInvalidation(place);
    const schedule = () => frame.invalidate();
    const observer = new ResizeObserver(schedule);
    for (const element of [left, right, shell, bar]) observer.observe(element);
    const selector = '.wb-right-panel, .wb-panel-tab';
    const register = (panel:Element) => { if (!panels.has(panel)) {panels.add(panel);observer.observe(panel);} };
    shell.querySelectorAll(selector).forEach(register);
    const mutations = new MutationObserver(records => {
      let changed = false;
      for (const record of records) for (const node of record.addedNodes) {
        // Map edits cannot change the Workbench panel set or placement.
        if (!(node instanceof Element) || node.closest('#board')) continue;
        if (node.matches(selector)) {register(node);changed=true;}
        for (const panel of node.querySelectorAll(selector)) {register(panel);changed=true;}
      }
      for (const panel of panels) if (!panel.isConnected) {panels.delete(panel);observer.unobserve(panel);changed=true;}
      if(changed)schedule();
    });
    mutations.observe(shell, {childList:true,subtree:true});
    window.addEventListener('resize',schedule);schedule();
    return () => {frame.clear();observer.disconnect();mutations.disconnect();window.removeEventListener('resize',schedule);};
}
