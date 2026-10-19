import { expect, test } from "vitest";
import type { AppState } from "../../src/shared/types";
import { laneDirection, resolveLaneRoot, selectLaneSurface } from "../../src/shared/lane_view";
import { canonicalSurfaceViewName } from "../../src/shared/node_draw_port";
import { layout } from "../../src/shared/layout_port";
import fixture from "../fixtures/lane_view.json";
function state(): AppState {
  const state=structuredClone(fixture.state) as AppState;
  state.scopes={"scope:workspace":{id:"scope:workspace",label:"Workspace",rootNodeIds:["workspace"],relationIds:[],primarySurfaceId:"surface:workspace:tree"}};
  state.surfaces={"surface:workspace:tree":{id:"surface:workspace:tree",scopeId:"scope:workspace",kind:"tree",layout:"tree",surfaceView:{direction:"left",space:"tight"}}};
  return state;
}
test("non-scope root and independent Lane preferences persist without topology writes",()=>{
  const data=state(),before=structuredClone(data),lane=selectLaneSurface(data,"workspace","diagram");
  expect(lane).toMatchObject({kind:"lane",layout:"lane",displayRootId:"diagram",surfaceView:{direction:"right",space:"normal"}});
  lane.surfaceView={direction:"down",space:"loose"};
  data.scopes!["scope:workspace"].primarySurfaceId="surface:workspace:tree";
  expect(selectLaneSurface(data,"workspace")).toEqual(lane);
  expect(resolveLaneRoot(data,"workspace",lane)).toBe("diagram");
  expect(data.nodes).toEqual(before.nodes); expect(data.links).toEqual(before.links);
  expect(data.scopes!["scope:workspace"].rootNodeIds).toEqual(["workspace"]);
  expect(data.surfaces!["surface:workspace:tree"]).toEqual(before.surfaces!["surface:workspace:tree"]);
});
test("missing roots and cross-scope references fail before mutation",()=>{
  const data=state(); data.nodes.research.nodeType="folder";
  for(const root of ["missing","reading"]){ const before=structuredClone(data); expect(()=>selectLaneSurface(data,"workspace",root)).toThrow(/scope|root/); expect(data).toEqual(before); }
});
test("Lane has no silent Tree fallback and direction is right/down",()=>{
  expect(canonicalSurfaceViewName("lane")).toBe("Lane");
  expect(()=>layout({nodeIds:[],childrenOf:()=>[],graphLinks:[]},{},"Lane")).toThrow();
  expect(["up","left","left/right","up/down",undefined].map(laneDirection)).toEqual(["right","right","right","right","right"]);
  expect(laneDirection("down")).toBe("down");
});
