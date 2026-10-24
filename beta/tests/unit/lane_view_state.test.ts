import { expect, test } from "vitest";
import type { AppState } from "../../src/shared/types";
import { laneDirection, resolveLaneRoot, selectLaneSurface } from "../../src/shared/lane_view";
import { canonicalSurfaceViewName } from "../../src/shared/node_draw_port";
import { layout } from "../../src/shared/layout_port";
import fixture from "../fixtures/lane_view.json";
function state(): AppState {
  const state=structuredClone(fixture.state) as AppState;
  state.scopes={"scope:diagram":{id:"scope:diagram",label:"Project structure",rootNodeIds:["diagram"],relationIds:[],primarySurfaceId:"surface:diagram:tree"}};
  state.surfaces={"surface:diagram:tree":{id:"surface:diagram:tree",scopeId:"scope:diagram",kind:"tree",layout:"tree",surfaceView:{direction:"left",space:"tight"}}};
  return state;
}
test("Lane is a Surface View of the scope: its root is the scope root and preferences persist without topology writes",()=>{
  const data=state(),before=structuredClone(data),lane=selectLaneSurface(data,"diagram");
  expect(lane).toMatchObject({kind:"lane",layout:"lane",scopeId:"scope:diagram",surfaceView:{direction:"right",space:"normal"}});
  expect(lane).not.toHaveProperty("displayRootId");
  lane.surfaceView={direction:"down",space:"loose"};
  data.scopes!["scope:diagram"].primarySurfaceId="surface:diagram:tree";
  expect(selectLaneSurface(data,"diagram")).toEqual(lane);
  expect(resolveLaneRoot(data,"diagram")).toBe("diagram");
  expect(data.nodes).toEqual(before.nodes); expect(data.links).toEqual(before.links);
  expect(data.scopes!["scope:diagram"].rootNodeIds).toEqual(["diagram"]);
  expect(data.surfaces!["surface:diagram:tree"]).toEqual(before.surfaces!["surface:diagram:tree"]);
});
test("a root option from earlier saves is dropped, and a missing scope fails before mutation",()=>{
  const data=state();
  data.surfaces!["surface:diagram:lane"]={id:"surface:diagram:lane",scopeId:"scope:diagram",kind:"lane",layout:"lane",surfaceView:{direction:"down",space:"normal"},nodeViews:{},displayRootId:"reading"} as never;
  expect(selectLaneSurface(data,"diagram")).not.toHaveProperty("displayRootId");
  const before=structuredClone(data); expect(()=>selectLaneSurface(data,"missing")).toThrow(/scope|root/); expect(data).toEqual(before);
});
test("Lane has no silent Tree fallback and direction is right/down",()=>{
  expect(canonicalSurfaceViewName("lane")).toBe("Lane");
  expect(()=>layout({nodeIds:[],childrenOf:()=>[],graphLinks:[]},{},"Lane")).toThrow();
  expect(["up","left","left/right","up/down",undefined].map(laneDirection)).toEqual(["right","right","right","right","right"]);
  expect(laneDirection("down")).toBe("down");
});
