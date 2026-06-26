import samplesJson from "../../../tests/fixtures/edge-port-golden/samples.json";
import type { EdgeBranchDirection, EdgePortSide, EdgeRect } from "../../shared/edge_port";
import type { EdgeRouteStyle } from "../../shared/edge_route";

export interface EdgePortLabSample {
  schema_version: 1;
  sample_id: string;
  source: { product_path: string; surface_view: string };
  input: {
    relation: { kind: "parent-child"; parentNodeId: string; childNodeId: string };
    srcRect: EdgeRect;
    dstRect: EdgeRect;
    branchDirection: EdgeBranchDirection;
    routeStyle: EdgeRouteStyle;
  };
  expected: {
    ports: { sourceSide: EdgePortSide; targetSide: EdgePortSide };
    checks: { noWrongSide: true; noThroughNode: true; noWrongTarget: true };
  };
}

export const edgePortSamples = samplesJson as EdgePortLabSample[];
export type EdgePortSampleId = typeof edgePortSamples[number]["sample_id"];

