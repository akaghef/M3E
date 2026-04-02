const test = require("node:test");
const assert = require("node:assert/strict");

const { detectCloudConflict } = require("../../dist/node/cloud_sync.js");

test("detectCloudConflict returns false when force push is enabled", () => {
  assert.equal(detectCloudConflict("2026-04-02T00:00:10.000Z", "2026-04-02T00:00:00.000Z", true), false);
});

test("detectCloudConflict returns false when cloud doc does not exist", () => {
  assert.equal(detectCloudConflict(null, "2026-04-02T00:00:00.000Z", false), false);
});

test("detectCloudConflict returns false when baseSavedAt is not provided", () => {
  assert.equal(detectCloudConflict("2026-04-02T00:00:10.000Z", null, false), false);
});

test("detectCloudConflict returns false when timestamps match", () => {
  assert.equal(
    detectCloudConflict("2026-04-02T00:00:10.000Z", "2026-04-02T00:00:10.000Z", false),
    false,
  );
});

test("detectCloudConflict returns true when timestamps differ and force is false", () => {
  assert.equal(
    detectCloudConflict("2026-04-02T00:00:20.000Z", "2026-04-02T00:00:10.000Z", false),
    true,
  );
});
