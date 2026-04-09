"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { SupabaseTransport } = require("../../dist/node/cloud_sync.js");

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

/**
 * Creates a mock SupabaseTransport with an injected fake client.
 * This avoids the dynamic import of @supabase/supabase-js.
 */
function createMockTransport(mockData) {
  const transport = new SupabaseTransport("https://mock.supabase.co", "mock-key");

  // Build a chainable query builder mock
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

  // Inject mock client directly
  transport.client = mockClient;
  return transport;
}

/**
 * Creates a mock transport with per-method control.
 */
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
    maybeSingle: () => ({ data: null, error: null }), // no existing doc
    upsert: () => ({ data: null, error: null }),
  });

  const doc = {
    version: 1,
    savedAt: "2026-04-10T00:00:00.000Z",
    state: { rootId: "r1", nodes: {} },
  };

  const result = await transport.push("doc1", doc, null, false);
  assert.equal(result.ok, true);
  assert.equal(result.documentId, "doc1");
  assert.equal(result.savedAt, "2026-04-10T00:00:00.000Z");
});

test("SupabaseTransport push detects conflict when baseSavedAt differs", async () => {
  const transport = createDetailedMockTransport({
    maybeSingle: () => ({
      data: { saved_at: "2026-04-10T00:00:10.000Z" },
      error: null,
    }),
    upsert: () => ({ data: null, error: null }),
  });

  const doc = {
    version: 1,
    savedAt: "2026-04-10T00:00:20.000Z",
    state: { rootId: "r1", nodes: {} },
  };

  const result = await transport.push("doc1", doc, "2026-04-10T00:00:00.000Z", false);
  assert.equal(result.ok, false);
  assert.equal(result.conflict, true);
  assert.equal(result.cloudSavedAt, "2026-04-10T00:00:10.000Z");
});

test("SupabaseTransport push skips conflict check when force=true", async () => {
  const transport = createDetailedMockTransport({
    maybeSingle: () => ({
      data: { saved_at: "2026-04-10T00:00:10.000Z" },
      error: null,
    }),
    upsert: () => ({ data: null, error: null }),
  });

  const doc = {
    version: 1,
    savedAt: "2026-04-10T00:00:20.000Z",
    state: { rootId: "r1", nodes: {} },
  };

  const result = await transport.push("doc1", doc, "2026-04-10T00:00:00.000Z", true);
  assert.equal(result.ok, true);
  assert.equal(result.forced, true);
});

test("SupabaseTransport push skips conflict check when baseSavedAt is null", async () => {
  const transport = createDetailedMockTransport({
    maybeSingle: () => ({ data: null, error: null }),
    upsert: () => ({ data: null, error: null }),
  });

  const doc = {
    version: 1,
    savedAt: "2026-04-10T00:00:00.000Z",
    state: { rootId: "r1", nodes: {} },
  };

  const result = await transport.push("doc1", doc, null, false);
  assert.equal(result.ok, true);
});

test("SupabaseTransport push returns error on fetch failure", async () => {
  const transport = createDetailedMockTransport({
    maybeSingle: () => ({
      data: null,
      error: { message: "connection refused" },
    }),
  });

  const doc = {
    version: 1,
    savedAt: "2026-04-10T00:00:00.000Z",
    state: { rootId: "r1", nodes: {} },
  };

  const result = await transport.push("doc1", doc, "2026-04-09T00:00:00.000Z", false);
  assert.equal(result.ok, false);
  assert.match(result.error, /connection refused/);
});

test("SupabaseTransport push returns error on upsert failure", async () => {
  const transport = createDetailedMockTransport({
    maybeSingle: () => ({ data: null, error: null }),
    upsert: () => ({
      data: null,
      error: { message: "row too large" },
    }),
  });

  const doc = {
    version: 1,
    savedAt: "2026-04-10T00:00:00.000Z",
    state: { rootId: "r1", nodes: {} },
  };

  const result = await transport.push("doc1", doc, null, false);
  assert.equal(result.ok, false);
  assert.match(result.error, /row too large/);
});

test("SupabaseTransport push generates savedAt when doc has none", async () => {
  const transport = createDetailedMockTransport({
    maybeSingle: () => ({ data: null, error: null }),
    upsert: () => ({ data: null, error: null }),
  });

  const doc = {
    version: 1,
    savedAt: "",
    state: { rootId: "r1", nodes: {} },
  };

  const result = await transport.push("doc1", doc, null, false);
  assert.equal(result.ok, true);
  assert.ok(result.savedAt.length > 0);
});

// ---------------------------------------------------------------------------
// Pull tests
// ---------------------------------------------------------------------------

test("SupabaseTransport pull succeeds with existing doc", async () => {
  const transport = createMockTransport({
    documents: {
      data: {
        id: "doc1",
        version: 1,
        saved_at: "2026-04-10T00:00:00.000Z",
        state: { rootId: "r1", nodes: { r1: { id: "r1", text: "Root" } } },
      },
    },
  });

  const result = await transport.pull("doc1");
  assert.equal(result.ok, true);
  assert.equal(result.version, 1);
  assert.equal(result.savedAt, "2026-04-10T00:00:00.000Z");
  assert.equal(result.state.rootId, "r1");
  assert.equal(result.documentId, "doc1");
});

test("SupabaseTransport pull returns error for missing doc", async () => {
  const transport = createMockTransport({ documents: { data: null } });

  const result = await transport.pull("missing");
  assert.equal(result.ok, false);
  assert.match(result.error, /not found/i);
  assert.equal(result.documentId, "missing");
});

test("SupabaseTransport pull returns error on fetch failure", async () => {
  const transport = createMockTransport({
    documents: {
      data: null,
      error: { message: "timeout" },
    },
  });

  const result = await transport.pull("doc1");
  assert.equal(result.ok, false);
  assert.match(result.error, /timeout/);
});

// ---------------------------------------------------------------------------
// Status tests
// ---------------------------------------------------------------------------

test("SupabaseTransport status returns exists=true with savedAt", async () => {
  const transport = createMockTransport({
    documents: {
      data: { saved_at: "2026-04-10T00:00:00.000Z" },
    },
  });

  const result = await transport.status("doc1");
  assert.equal(result.ok, true);
  assert.equal(result.enabled, true);
  assert.equal(result.mode, "supabase");
  assert.equal(result.exists, true);
  assert.equal(result.cloudSavedAt, "2026-04-10T00:00:00.000Z");
  assert.equal(result.documentId, "doc1");
});

test("SupabaseTransport status returns exists=false when no doc", async () => {
  const transport = createMockTransport({ documents: { data: null } });

  const result = await transport.status("missing");
  assert.equal(result.ok, true);
  assert.equal(result.exists, false);
  assert.equal(result.cloudSavedAt, null);
});

test("SupabaseTransport status returns ok=false on error", async () => {
  const transport = createMockTransport({
    documents: {
      data: null,
      error: { message: "network error" },
    },
  });

  const result = await transport.status("doc1");
  assert.equal(result.ok, false);
  assert.equal(result.exists, false);
});
