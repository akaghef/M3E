import { afterEach, test } from "vitest";
import { toSnapshot } from "../../src/shared/record_model/to_snapshot";
import { exerciseViewerFields } from "./viewer_field_lifecycle";
import { createTestStore, dropTestStores } from "./neo4j_test_store";

afterEach(dropTestStores);

test("every viewer field survives create, update and delete with viewer before values", async () => {
  const handle = await createTestStore(toSnapshot("fields", []));
  await exerciseViewerFields(handle.store, "remote");
});
