/** Node certainty (Database_Spec 3.2, invariant 11). */

export const CERTAINTY_UNSET = -1;

export function isCertainty(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= -1 && value <= 100;
}

/**
 * The certainty a node record stores for a node of client state: -1 when the node gives none,
 * the value when it is an integer from -1 to 100. Any other value is refused.
 */
export function certaintyOfNode(id: string, value: unknown): number {
  if (value === undefined || value === null) return CERTAINTY_UNSET;
  if (isCertainty(value)) return value;
  throw new Error(`certainty of node ${id} must be an integer from -1 to 100, got ${JSON.stringify(value)}.`);
}

/**
 * The certainty a format 2 node takes in the one-time move to format 3: the `m3e:confidence`
 * attribute it may carry (0 to 1 from Flash ingest, or high / medium / low) becomes the value,
 * and the attribute is dropped. Anything else gives -1.
 */
export function certaintyFromConfidence(value: unknown): number {
  if (typeof value === "string") {
    const word = value.trim().toLowerCase();
    if (word === "high") return 80;
    if (word === "medium") return 50;
    if (word === "low") return 20;
    if (word === "") return CERTAINTY_UNSET;
    value = Number(word);
  }
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1) return Math.round(value * 100);
  return CERTAINTY_UNSET;
}

export const LEGACY_CONFIDENCE_ATTRIBUTE = "m3e:confidence";

/**
 * Moves a node record to format 3: drops `m3e:confidence` from its attributes and returns the
 * certainty to store. A valid certainty the record already has is kept.
 */
export function takeLegacyCertainty(record: { certainty?: unknown; attributes?: { [key: string]: unknown } }): number {
  const attributes = record.attributes;
  let fromAttribute = CERTAINTY_UNSET;
  if (attributes && Object.prototype.hasOwnProperty.call(attributes, LEGACY_CONFIDENCE_ATTRIBUTE)) {
    fromAttribute = certaintyFromConfidence(attributes[LEGACY_CONFIDENCE_ATTRIBUTE]);
    delete attributes[LEGACY_CONFIDENCE_ATTRIBUTE];
    if (Object.keys(attributes).length === 0) delete record.attributes;
  }
  return isCertainty(record.certainty) ? record.certainty : fromAttribute;
}
