"use strict";

import { test, expect } from "vitest";

const { SupabaseTransport } = require("../../dist/node/cloud_sync.js");

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

function createMockTransport(mockData) {
  const transport = new SupabaseTransport("https://mock.supabase.co", "mock-key");

  function createQueryBuilder(resolveData, resolveError) {
    const builder = {
      select: () => builder,
      upsert: () => builder,
      insert: () => builder,
      eq: () => builder,
      single: () => Promise.resolve({ data: resolveData, error: resolveError }),
      maybeSingle: () => Promise.resolve({ data: resolveData, error: resolveError }),
    };
    return builder;
  }

  const mockClient = {
    from: (table) => {
      const entry = mockData[table] || {};
      return createQueryBuilder(entry.data ?? null, entry.error ?? null);
    },
  };

  transport.client = mockClient;
  return transport;
}

function createDetailedMockTransport(handlers) {
  const transport = new SupabaseTransport("https://mock.supabase.co", "mock-key");

  const mockClient = {
    from: (table) => {
      const builder = {
        _selectedColumns: null,
        _upsertData: null,
        select: function (cols) {
          this._selectedColumns = cols;
          return this;
        },
        upsert: function (data, opts) {
          this._upsertData = data;
          return this;
        },
        insert: function () { return this; },
        eq: function () { return this; },
        single: function () {
          if (this._upsertData && handlers.upsert) {
            return Promise.resolve(handlers.upsert(this._upsertData));
          }
          if (this._selectedColumns && handlers.select) {
            return Promise.resolve(handlers.select(this._selectedColumns));
          }
          return Promise.resolve({ data: null, error: null });
        },
        maybeSingle: function () {
          if (handlers.maybeSingle) {
            return Promise.resolve(handlers.maybeSingle(this._selectedColumns));
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
      return builder;
    },
  };

  transport.client = mockClient;
  return transport;
}

// ---------------------------------------------------------------------------
// Push tests
// ---------------------------------------------------------------------------

test("SupabaseTransport push succeeds when no conflict", async () => {
  const transport = createDetailedMockTransport({
    maybeSingle: () => ({ data: null, error: null }),
    upsert: () => ({ data: null, error: null }),
  });

  const map = {
    version: 1,
    savedAt: "2026-04-10T00:00:00.000Z",
    state: { rootId: "r1", nodes: {} },
  };

  const result = await transport.push("map1", map, null, false);
  expect(result.ok).toBe(true);
  expect(result.mapId).toBe("map1");
  expect(result.savedAt).toBe("2026-04-10T00:00:00.000Z");
});

test("SupabaseTransport push detects conflict when baseSavedAt differs", async () => {
  const transport = createDetailedMockTransport({
    maybeSingle: () => ({
      data: { saved_at: "2026-04-10T00:00:10.000Z" },
      error: null,
    }),
    upsert: () => ({ data: null, error: null }),
  });

  const map = {
    version: 1,
    savedAt: "2026-04-10T00:00:20.000Z",
    state: { rootId: "r1", nodes: {} },
  };

  const result = await transport.push("map1", map, "2026-04-10T00:00:00.000Z", false);
  expect(result.ok).toBe(false);
  expect(result.conflict).toBe(true);
  expect(result.cloudSavedAt).toBe("2026-04-10T00:00:10.000Z");
});

test("SupabaseTransport push skips conflict check when force=true", async () => {
  const transport = createDetailedMockTransport({
    maybeSingle: () => ({
      data: { saved_at: "2026-04-10T00:00:10.000Z" },
      error: null,
    }),
    upsert: () => ({ data: null, error: null }),
  });

  const map = {
    version: 1,
    savedAt: "2026-04-10T00:00:20.000Z",
    state: { rootId: "r1", nodes: {} },
  };

  const result = await transport.push("map1", map, "2026-04-10T00:00:00.000Z", true);
  expect(result.ok).toBe(true);
  expect(result.forced).toBe(true);
});

test("SupabaseTransport push skips conflict check when baseSavedAt is null", async () => {
  const transport = createDetailedMockTransport({
    maybeSingle: () => ({ data: null, error: null }),
    upsert: () => ({ data: null, error: null }),
  });

  const map = {
    version: 1,
    savedAt: "2026-04-10T00:00:00.000Z",
    state: { rootId: "r1", nodes: {} },
  };

  const result = await transport.push("map1", map, null, false);
  expect(result.ok).toBe(true);
});

test("SupabaseTransport push returns error on fetch failure", async () => {
  const transport = createDetailedMockTransport({
    maybeSingle: () => ({
      data: null,
      error: { message: "connection refused" },
    }),
  });

  const map = {
    version: 1,
    savedAt: "2026-04-10T00:00:00.000Z",
    state: { rootId: "r1", nodes: {} },
  };

  const result = await transport.push("map1", map, "2026-04-09T00:00:00.000Z", false);
  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/connection refused/);
});

test("SupabaseTransport push returns error on upsert failure", async () => {
  const transport = createDetailedMockTransport({
    maybeSingle: () => ({ data: null, error: null }),
    upsert: () => ({
      data: null,
      error: { message: "row too large" },
    }),
  });

  const map = {
    version: 1,
    savedAt: "2026-04-10T00:00:00.000Z",
    state: { rootId: "r1", nodes: {} },
  };

  const result = await transport.push("map1", map, null, false);
  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/row too large/);
});

test("SupabaseTransport push generates savedAt when map has none", async () => {
  const transport = createDetailedMockTransport({
    maybeSingle: () => ({ data: null, error: null }),
    upsert: () => ({ data: null, error: null }),
  });

  const map = {
    version: 1,
    savedAt: "",
    state: { rootId: "r1", nodes: {} },
  };

  const result = await transport.push("map1", map, null, false);
  expect(result.ok).toBe(true);
  expect(result.savedAt.length > 0).toBe(true);
});

// ---------------------------------------------------------------------------
// Pull tests
// ---------------------------------------------------------------------------

test("SupabaseTransport pull succeeds with existing map", async () => {
  const transport = createMockTransport({
    maps: {
      data: {
        id: "map1",
        version: 1,
        saved_at: "2026-04-10T00:00:00.000Z",
        state: { rootId: "r1", nodes: { r1: { id: "r1", text: "Root" } } },
      },
    },
  });

  const result = await transport.pull("map1");
  expect(result.ok).toBe(true);
  expect(result.version).toBe(1);
  expect(result.savedAt).toBe("2026-04-10T00:00:00.000Z");
  expect(result.state.rootId).toBe("r1");
  expect(result.mapId).toBe("map1");
});

test("SupabaseTransport pull returns error for missing map", async () => {
  const transport = createMockTransport({ maps: { data: null } });

  const result = await transport.pull("missing");
  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/not found/i);
  expect(result.mapId).toBe("missing");
});

test("SupabaseTransport pull returns error on fetch failure", async () => {
  const transport = createMockTransport({
    maps: {
      data: null,
      error: { message: "timeout" },
    },
  });

  const result = await transport.pull("map1");
  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/timeout/);
});

// ---------------------------------------------------------------------------
// Status tests
// ---------------------------------------------------------------------------

test("SupabaseTransport status returns exists=true with savedAt", async () => {
  const transport = createMockTransport({
    maps: {
      data: { saved_at: "2026-04-10T00:00:00.000Z" },
    },
  });

  const result = await transport.status("map1");
  expect(result.ok).toBe(true);
  expect(result.enabled).toBe(true);
  expect(result.mode).toBe("supabase");
  expect(result.exists).toBe(true);
  expect(result.cloudSavedAt).toBe("2026-04-10T00:00:00.000Z");
  expect(result.mapId).toBe("map1");
});

test("SupabaseTransport status returns exists=false when no map", async () => {
  const transport = createMockTransport({ maps: { data: null } });

  const result = await transport.status("missing");
  expect(result.ok).toBe(true);
  expect(result.exists).toBe(false);
  expect(result.cloudSavedAt).toBe(null);
});

test("SupabaseTransport status returns ok=false on error", async () => {
  const transport = createMockTransport({
    maps: {
      data: null,
      error: { message: "network error" },
    },
  });

  const result = await transport.status("map1");
  expect(result.ok).toBe(false);
  expect(result.exists).toBe(false);
});
