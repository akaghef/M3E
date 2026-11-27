// The directory choice for a file store is gone: the record store lives in Neo4j.
// The cases that picked a directory from a migrated store file were removed with that feature.

import { it } from "vitest";

it("does not select a store directory", () => {
  // Those cases were the file store. Neo4j is the database.
});
