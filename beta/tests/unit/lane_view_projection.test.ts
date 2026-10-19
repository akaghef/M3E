import { expect, test } from "vitest";
import { projectLane } from "../../src/shared/lane_view";
import fixture from "../fixtures/lane_view.json";

test("Lane reads only visible grandchildren and counts omitted links once", () => {
  const state = structuredClone(fixture.state), before = structuredClone(state);
  const projection = projectLane(state, "diagram", new Set());
  expect(projection.lanes.map(l => l.id)).toEqual(["research", "development", "operations"]);
  expect(projection.nodeIds).toHaveLength(7);
  expect(projection.hiddenCounts.reading).toBe(1);
  expect(projection.links).toHaveLength(5);
  expect(projection.omittedLinkCount).toBe(1);
  expect(state).toEqual(before);
  expect(projectLane(state, "diagram", new Set(["research"])).nodeIds).toHaveLength(5);
});
test("omitted links cover root, child, deeper and out-of-range endpoints without altering storage",()=>{
 const state=structuredClone(fixture.state);
 for(const [id,sourceNodeId,targetNodeId] of [["child","research","reading"],["deep","notes","reading"],["outside","missing","reading"]])state.links[id]={id,sourceNodeId,targetNodeId} as never;
 const before=structuredClone(state),projection=projectLane(state,"diagram",new Set());
 expect(projection.omittedLinkCount).toBe(4);expect(projection.links).toHaveLength(5);expect(state).toEqual(before);
 state.nodes.research.collapsed=true;expect(projectLane(state,"diagram",new Set()).nodeIds).not.toContain("reading");
});
