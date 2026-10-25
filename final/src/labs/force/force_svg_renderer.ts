import type { CameraState, RenderSnapshot } from "../../rendering/webgl_projection";
const escape = (s: string): string => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Explicit comparison route only; never constructed behind WebGL or used as an automatic fallback. */
export function createForceSvgRenderer(svg: SVGSVGElement) {
  const scene = document.createElementNS("http://www.w3.org/2000/svg", "g"); svg.append(scene);
  let geometryUploads = 0, cameraUpdates = 0;
  return {
    setCamera(camera: CameraState) { cameraUpdates++; scene.setAttribute("transform", `translate(${camera.x} ${camera.y}) scale(${camera.zoom})`); },
    setSnapshot(s: RenderSnapshot) {
      geometryUploads++;
      const groups = s.groups.map(g => `<g><rect x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" rx="${g.radius || 0}" fill="${g.fill}" stroke="${g.stroke}" stroke-dasharray="${g.dash?.join(" ") || ""}"/><rect x="${g.x + 1}" y="${g.y + 1}" width="${g.width - 2}" height="${g.headerHeight}" rx="6" fill="${g.headerFill}"/></g>`).join("");
      const links = [...s.edges, ...s.graphLinks].map(e => `<polyline points="${e.points.map(p => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${e.color}" stroke-width="${e.width}" opacity="${e.opacity}" stroke-dasharray="${e.dash?.join(" ") || ""}"/>`).join("");
      const nodes = s.nodes.map(n => `<g><rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="${n.radius}" fill="${n.fill}" stroke="${n.stroke}" stroke-width="${n.strokeWidth}" stroke-dasharray="${n.strokeDash?.join(" ") || ""}"/>${n.labelLines.map((line, i) => `<text x="${n.x + n.width / 2}" y="${n.y + n.height / 2 + (i - (n.labelLines.length - 1) / 2) * 17 + 4}" text-anchor="middle" font-size="${n.fontSize}" fill="${n.textColor}">${escape(line)}</text>`).join("")}</g>`).join("");
      const labels = (s.labels || []).map(l => `<text x="${l.x + (l.align === "left" ? 2 : l.width / 2)}" y="${l.y + l.height / 2 + 4}" text-anchor="${l.align === "left" ? "start" : "middle"}" font-size="${l.fontSize}" fill="${l.color}">${escape(l.lines.join(" "))}</text>`).join("");
      scene.innerHTML = groups + links + nodes + labels;
    },
    getDebugState() { return { active: true, geometryUploads, cameraUpdates, labelAtlasUploads: 0 }; },
  };
}
