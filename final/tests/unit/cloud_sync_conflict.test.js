import { test, expect } from "vitest";

const { detectCloudConflict } = require("../../dist/node/cloud_sync.js");

test("detectCloudConflict returns false when force push is enabled", () => {
  expect(detectCloudConflict("2026-04-02T00:00:10.000Z", "2026-04-02T00:00:00.000Z", true)).toBe(false);
});

test("detectCloudConflict returns false when cloud map does not exist", () => {
  expect(detectCloudConflict(null, "2026-04-02T00:00:00.000Z", false)).toBe(false);
});

test("detectCloudConflict returns false when baseSavedAt is not provided", () => {
  expect(detectCloudConflict("2026-04-02T00:00:10.000Z", null, false)).toBe(false);
});

test("detectCloudConflict returns false when timestamps match", () => {
  expect(
    detectCloudConflict("2026-04-02T00:00:10.000Z", "2026-04-02T00:00:10.000Z", false),
  ).toBe(false);
});

test("detectCloudConflict returns true when timestamps differ and force is false", () => {
  expect(
    detectCloudConflict("2026-04-02T00:00:20.000Z", "2026-04-02T00:00:10.000Z", false),
  ).toBe(true);
});
