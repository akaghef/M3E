import { describe, expect, it } from "vitest";
import { clonePanelFixtureState, createViewerPanelFixture } from "../../src/labs/viewer/viewer-panel-seam-lab-fixture";

describe("viewer panel seam lab fixture", () => {
  it("is reproducible from the same input", () => {
    const first = createViewerPanelFixture();
    const second = createViewerPanelFixture();

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("keeps remote conflict variants separate from local state", () => {
    const fixture = createViewerPanelFixture();
    const local = clonePanelFixtureState(fixture.localState);
    const remote = fixture.remoteStates.changed;

    expect(local.nodes["node-b"]?.text).toBe("Shared branch");
    expect(remote.nodes["node-b"]?.text).toBe("Remote branch");
    expect(local.nodes["node-b"]?.text).not.toBe(remote.nodes["node-b"]?.text);
  });
});
