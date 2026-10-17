// @vitest-environment jsdom
import { expect, test } from "vitest";
import { RetainedSvgScene } from "../../src/browser/incremental_scene";
import { laneLinkParts } from "../../src/browser/lane_scene";
test("retained scene puts Lane visible links above nodes, hits below, and restores original parts",()=>{
 const root=document.createElementNS("http://www.w3.org/2000/svg","svg"),scene=new RetainedSvgScene();
 const visible='<path class="graph-link"/><text class="graph-link-label">Relation</text>',hit='<path class="graph-link-hit"/>';
 const parts=(lane:boolean):Array<[string,string]>=>[...laneLinkParts(lane,visible+(!lane?hit:""),hit,false),["node:middle",'<rect class="node-hit"/>'],...laneLinkParts(lane,visible,hit,true)];
 scene.update(root,parts(true));
 expect(Array.from(root.children).map(el=>el.getAttribute("data-render-key"))).toEqual(["graph-link-hits","node:middle","lane-visible-links"]);
 expect(root.querySelector(".lane-visible-links")?.getAttribute("pointer-events")).toBe("none");expect(root.querySelector(".lane-visible-links .graph-link-hit")).toBeNull();
 for(const view of ["Tree","Logic Chart","Axial","System","Disperse"]){scene.update(root,parts(false));expect(Array.from(root.children).map(el=>el.getAttribute("data-render-key")),view).toEqual(["links","node:middle"]);expect(root.querySelectorAll(".graph-link-hit")).toHaveLength(1);}
});
