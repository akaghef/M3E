import fs from "fs";
import path from "path";
import { selectPorts, type EdgeBranchDirection, type EdgeRect } from "../shared/edge_port";
import { route, type EdgeRouteStyle } from "../shared/edge_route";

interface CaptureSample {
  schema_version: 1;
  sample_id: string;
  source?: Record<string, unknown>;
  input: {
    srcRect: EdgeRect;
    dstRect: EdgeRect;
    branchDirection: EdgeBranchDirection;
    routeStyle: EdgeRouteStyle;
  };
  expected: {
    ports: { sourceSide: string; targetSide: string };
    path?: unknown;
  };
}

function argValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  return process.argv[index + 1] || null;
}

function main(): void {
  const sampleId = argValue("--sample");
  const out = argValue("--out");
  if (!sampleId || !out) {
    throw new Error("Usage: npm run edge-port:capture -- --sample <sample_id> --out <path>");
  }
  const fixturePath = path.join(process.cwd(), "tests/fixtures/edge-port-golden/samples.json");
  const samples = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as CaptureSample[];
  const sample = samples.find((item) => item.sample_id === sampleId);
  if (!sample) throw new Error(`Unknown edge-port sample: ${sampleId}`);
  if (sample.input.branchDirection.view === "Tree" && sample.input.branchDirection.direction === "both" && !sample.input.branchDirection.branchSide) {
    throw new Error("Tree both capture requires LayoutResult.branchSide.");
  }
  const ports = selectPorts(sample.input.srcRect, sample.input.dstRect, sample.input.branchDirection);
  const pathResult = route(ports, sample.input.routeStyle);
  const captured = {
    ...sample,
    source: {
      ...(sample.source || {}),
      product_path: "parentChildEdgeAdapter",
      captured_at: new Date(0).toISOString(),
    },
    expected: {
      ...sample.expected,
      ports: {
        sourceSide: ports.source.side,
        targetSide: ports.target.side,
        source: ports.source,
        target: ports.target,
      },
      path: {
        d: pathResult.d,
        commands: pathResult.commands,
      },
    },
  };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(captured, null, 2)}\n`);
}

main();
