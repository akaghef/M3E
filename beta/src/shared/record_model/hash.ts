import { createHash } from "crypto";

/** Hash function used for deterministic ids: text in, lowercase hex out. */
export type HashFn = (input: string) => string;

export const sha256Hex: HashFn = (input) => createHash("sha256").update(input, "utf8").digest("hex");
