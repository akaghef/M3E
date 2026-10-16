import { expect, it } from "vitest";
import { treeGrabMove } from "../../src/shared/tree_grab";
import type { LayoutDirection } from "../../src/shared/layout_port";

const nodes = {
  root: { parentId: null, children: ["a", "b", "c"] },
  a: { parentId: "root", children: ["a1"] },
  b: { parentId: "root", children: [] }, c: { parentId: "root", children: [] },
  a1: { parentId: "a", children: [] },
};
const pos = { root: {x:0,y:100,w:80}, a:{x:200,y:0,w:80}, b:{x:200,y:100,w:80}, c:{x:200,y:200,w:80}, a1:{x:400,y:0,w:80} };

it("enters the previous sibling, with a next-sibling exception for the first", () => {
  expect(treeGrabMove(nodes,pos,"b","root","right","ArrowRight")).toEqual({parentId:"a",index:1});
  expect(treeGrabMove(nodes,pos,"a","root","right","ArrowRight")).toEqual({parentId:"b",index:0});
  expect(treeGrabMove(nodes,pos,"a1","root","right","ArrowRight")).toBeNull();
});
it("outdents immediately after the current parent and protects scope roots", () => {
  expect(treeGrabMove(nodes,pos,"a1","root","right","ArrowLeft")).toEqual({parentId:"root",index:1});
  expect(treeGrabMove(nodes,pos,"a1","a","right","ArrowLeft")).toBeNull();
  expect(treeGrabMove(nodes,pos,"a","a","right","ArrowLeft")).toBeNull();
  expect(treeGrabMove(nodes,pos,"root","root","right","ArrowDown")).toBeNull();
});
it("uses pre-removal insertion slots, including the final slot", () => {
  expect(treeGrabMove(nodes,pos,"b","root","right","ArrowDown")).toEqual({parentId:"root",index:3});
  expect(treeGrabMove(nodes,pos,"b","root","right","ArrowUp")).toEqual({parentId:"root",index:0});
  expect(treeGrabMove(nodes,pos,"a","root","right","ArrowUp")).toBeNull();
  expect(treeGrabMove(nodes,pos,"c","root","right","ArrowDown")).toBeNull();
});
for (const [direction,depth,breadth] of [
  ["right","ArrowRight","ArrowDown"], ["left","ArrowLeft","ArrowDown"],
  ["down","ArrowDown","ArrowRight"], ["up","ArrowUp","ArrowLeft"],
] as const) {
  it(`matches the rendered ${direction} orientation`, () => {
    const oriented = Object.fromEntries(Object.entries(pos).map(([id,p]) => [id,
      direction==="right" ? p : direction==="left" ? {...p,x:-p.x-p.w} :
      direction==="down" ? {...p,x:p.y,y:p.x} : {...p,x:-p.y,y:-p.x}]));
    expect(treeGrabMove(nodes,oriented,"b","root",direction,depth)).toEqual({parentId:direction==="up"?"c":"a",index:direction==="up"?0:1});
    expect(treeGrabMove(nodes,oriented,"b","root",direction,breadth)).toEqual({parentId:"root",index:3});
  });
}
for (const direction of ["left/right","up/down"] as LayoutDirection[]) {
  it(`keeps ${direction} movement on the displayed branch side`, () => {
    const split = {...pos,a:{x:-200,y:0,w:80},b:{x:-200,y:100,w:80}};
    const oriented = direction==="left/right" ? split : Object.fromEntries(Object.entries(split).map(([id,p])=>[id,{...p,x:p.y,y:p.x}]));
    expect(treeGrabMove(nodes,oriented,"b","root",direction,direction==="left/right"?"ArrowLeft":"ArrowUp")).toEqual({parentId:"a",index:1});
    expect(treeGrabMove(nodes,oriented,"b","root",direction,direction==="left/right"?"ArrowDown":"ArrowRight")).toBeNull();
  });
}
