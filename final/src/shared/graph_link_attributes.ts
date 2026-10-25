function isAttributeObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Write boundaries reject the entire value rather than silently dropping data. */
export function isGraphLinkAttributes(value: unknown): value is Record<string, string> | undefined {
  return value === undefined || (isAttributeObject(value)
    && Object.values(value).every((entry) => typeof entry === "string"));
}

/** Viewer/import reads preserve the string entries of otherwise malformed data. */
export function sanitizeGraphLinkAttributes(value: unknown): Record<string, string> | undefined {
  if (!isAttributeObject(value)) return undefined;
  return Object.fromEntries(Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ));
}
