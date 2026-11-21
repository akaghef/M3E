// Format 2 extensions: name shape, the canonical `extensions` list, extensionDef shape,
// and the schema-on-write checks of Database_Spec.md 10.2-10.4 and 10.7.
//
// `fields[].default` is filled when a Command attaches the extension (10.2).
// `fields[].ref` is checked for nodeRef values. A ref that is not an extension name is stored
// and not checked: the spec does not say what a ref such as "node" means.

import { compareStrings, type ExtensionDefRecord, type ExtensionField, type ExtensionTarget, type JsonValue } from "./types";

const EXTENSION_NAME = /^([^:@]+):(nodeType|parentEdge|relationEdge):([^:@]+)$/;
const EXTENSION_REF = /^([^:@]+):(nodeType|parentEdge|relationEdge):([^:@]+)@([1-9]\d*)$/;
const TIME_TEXT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/;
const SCALAR_TYPES = new Set(["string", "int", "float", "bool", "enum", "time", "timeExp", "nodeRef", "accountRef"]);
const TARGETS = new Set<ExtensionTarget>(["node", "parentEdge", "relationEdge"]);
const RENDER_SIZES = new Set(["text", "fixed", "attribute"]);

export function extensionTargetOfClass(className: string): ExtensionTarget | undefined {
  if (className === "nodeType") return "node";
  if (className === "parentEdge" || className === "relationEdge") return className;
  return undefined;
}

/** `name@version` → `{ name, version }`, or undefined when the text is not that shape. */
export function parseExtensionRef(value: string): { name: string; version: number; target: ExtensionTarget } | undefined {
  const match = EXTENSION_REF.exec(value);
  if (!match) return undefined;
  const target = extensionTargetOfClass(match[2]);
  if (target === undefined) return undefined;
  return { name: `${match[1]}:${match[2]}:${match[3]}`, version: Number(match[4]), target };
}

/**
 * Epoch milliseconds of a canonical time (`YYYY-MM-DDTHH:mm:ss.sssZ` that round-trips
 * through `Date`), or undefined when the text is not that form.
 */
export function canonicalTimeMs(value: string): number | undefined {
  if (!TIME_TEXT.test(value)) return undefined;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return undefined;
  if (new Date(ms).toISOString() !== value) return undefined;
  return ms;
}

function fieldTypeKnown(type: unknown): type is string {
  if (typeof type !== "string") return false;
  if (SCALAR_TYPES.has(type)) return true;
  const list = /^list<([^<>]+)>$/.exec(type);
  return list !== null && SCALAR_TYPES.has(list[1]);
}

/** Why `record` is not an extensionDef the store can commit. Undefined when the shape is acceptable. */
export function extensionDefShapeError(record: ExtensionDefRecord): string | undefined {
  if (typeof record.name !== "string" || !EXTENSION_NAME.test(record.name)) {
    return `extensionDef name ${JSON.stringify(record.name)} is not prefix:class:name.`;
  }
  if (!Number.isInteger(record.version) || record.version < 1) {
    return `extensionDef ${record.name} version must be a positive integer.`;
  }
  const target = extensionTargetOfClass(record.name.split(":")[1] ?? "");
  if (!TARGETS.has(record.target)) return `extensionDef ${record.name}@${record.version} has no target.`;
  if (record.target !== target) {
    return `extensionDef ${record.name}@${record.version} target ${record.target} does not match its class.`;
  }
  if (!Array.isArray(record.fields)) return `extensionDef ${record.name}@${record.version} fields must be a list.`;
  const names = new Set<string>();
  for (const field of record.fields) {
    if (typeof field?.name !== "string" || field.name === "" || field.name.includes("/") || field.name.includes("@")) {
      return `extensionDef ${record.name}@${record.version} has a field with an unusable name.`;
    }
    if (names.has(field.name)) return `extensionDef ${record.name}@${record.version} repeats field ${field.name}.`;
    names.add(field.name);
    if (!fieldTypeKnown(field.type)) {
      return `extensionDef ${record.name}@${record.version} field ${field.name} has an unknown type ${JSON.stringify(field.type)}.`;
    }
    if (field.type === "enum" || field.type === "list<enum>") {
      if (!Array.isArray(field.values) || field.values.length === 0 || field.values.some((item) => typeof item !== "string")) {
        return `extensionDef ${record.name}@${record.version} field ${field.name} needs enum values.`;
      }
    }
  }
  if (record.render !== undefined) {
    const render = record.render;
    if (!render || !Array.isArray(render.attributes) || render.attributes.some((item) => typeof item !== "string") || !RENDER_SIZES.has(render.size)) {
      return `extensionDef ${record.name}@${record.version} render is malformed.`;
    }
  }
  return undefined;
}

/** The list written on a record. Empty and absent both become absent. Order is string order; duplicates are kept for the invariant to reject. */
export function writtenExtensions(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const copy = value.slice() as string[];
  if (copy.every((item) => typeof item === "string")) copy.sort(compareStrings);
  return copy;
}

/** Undefined when `list` is a sorted set of `name@version` with one entry per name. */
export function extensionsListError(list: unknown): string | undefined {
  if (list === undefined) return undefined;
  if (!Array.isArray(list)) return "extensions is not a list.";
  if (list.length === 0) return "extensions is empty; an empty set is omitted.";
  const names = new Set<string>();
  for (let i = 0; i < list.length; i += 1) {
    const entry = list[i];
    if (typeof entry !== "string") return "extensions has a value that is not name@version.";
    const parsed = parseExtensionRef(entry);
    if (!parsed) return `extension ${JSON.stringify(entry)} is not name@version.`;
    if (names.has(parsed.name)) return `extension name ${parsed.name} appears more than once.`;
    names.add(parsed.name);
    if (i > 0 && compareStrings(list[i - 1] as string, entry) > 0) return "extensions is not in string order.";
  }
  return undefined;
}

function valueError(type: string, value: JsonValue, field: ExtensionField): string | undefined {
  const list = /^list<([^<>]+)>$/.exec(type);
  if (list) {
    if (!Array.isArray(value)) return `expected a list of ${list[1]}.`;
    for (const item of value) {
      const itemError = valueError(list[1], item, field);
      if (itemError !== undefined) return itemError;
    }
    return undefined;
  }
  switch (type) {
    case "string":
      return typeof value === "string" ? undefined : "expected a string.";
    case "int":
      return typeof value === "number" && Number.isSafeInteger(value) ? undefined : "expected an integer within 2^53-1.";
    case "float":
      return typeof value === "number" && Number.isFinite(value) ? undefined : "expected a finite number.";
    case "bool":
      return typeof value === "boolean" ? undefined : "expected a boolean.";
    case "enum":
      return typeof value === "string" && field.values?.includes(value) ? undefined : "expected one of the enum values.";
    case "time":
      return typeof value === "string" && canonicalTimeMs(value) !== undefined ? undefined : "expected a canonical time.";
    case "timeExp":
      return typeof value === "number" && Number.isSafeInteger(value) ? undefined : "expected an integer exponent.";
    case "nodeRef":
    case "accountRef":
      return typeof value === "string" ? undefined : `expected a ${type}.`;
    default:
      return `unknown type ${type}.`;
  }
}

export interface ExtensionViolation {
  message: string;
}

/** A node, as far as a `ref` check needs to see it. Absent means the node is missing. */
export interface ExtensionNode {
  extensions?: readonly string[] | undefined;
}

function containsNull(value: unknown): boolean {
  if (value === null) return true;
  if (Array.isArray(value)) return value.some((item) => containsNull(item));
  if (typeof value === "object" && value !== null) return Object.values(value).some((item) => containsNull(item));
  return false;
}

function extensionNames(list: unknown): Set<string> {
  const names = new Set<string>();
  if (!Array.isArray(list)) return names;
  for (const entry of list) if (typeof entry === "string") names.add(entry);
  return names;
}

/**
 * Attributes to store when `afterExtensions` newly attaches an extension whose required
 * field is missing and whose `default` is a snapshot value. Returns undefined when nothing
 * is filled. Does not overwrite a present value. Null defaults are skipped.
 */
export function fillRequiredDefaults(
  beforeExtensions: unknown,
  afterExtensions: unknown,
  attributes: { [key: string]: JsonValue } | undefined,
  defs: ReadonlyMap<string, ExtensionDefRecord>,
): { [key: string]: JsonValue } | undefined {
  if (!Array.isArray(afterExtensions)) return undefined;
  const before = extensionNames(beforeExtensions);
  let filled: { [key: string]: JsonValue } | undefined;
  for (const entry of afterExtensions) {
    if (typeof entry !== "string" || before.has(entry)) continue;
    const parsed = parseExtensionRef(entry);
    const def = defs.get(entry);
    if (!parsed || def === undefined) continue;
    for (const field of def.fields) {
      if (field.required !== true) continue;
      if (field.default === undefined || field.default === null || containsNull(field.default)) continue;
      const key = `${parsed.name}/${field.name}`;
      const present = (filled ?? attributes) !== undefined && Object.prototype.hasOwnProperty.call(filled ?? attributes, key);
      const current = (filled ?? attributes)?.[key];
      if (present && current !== undefined) continue;
      filled ??= { ...(attributes ?? {}) };
      filled[key] = JSON.parse(JSON.stringify(field.default)) as JsonValue;
    }
  }
  return filled;
}

/** True when `extensions` carries `ref` (`name@version` exact, or `prefix:class:name` at any version). */
function carriesExtension(extensions: readonly string[] | undefined, ref: string): boolean {
  if (!extensions) return false;
  const versioned = parseExtensionRef(ref);
  if (versioned) return extensions.includes(ref);
  if (!EXTENSION_NAME.test(ref)) return true; // not a shape the spec defines; the caller skips it
  return extensions.some((entry) => entry === ref || entry.startsWith(`${ref}@`));
}

function refIsCheckable(ref: string): boolean {
  return parseExtensionRef(ref) !== undefined || EXTENSION_NAME.test(ref);
}

/**
 * Rule 10 for one record. `defs` is keyed by `name@version`. An extension whose definition
 * is absent is kept and not checked. A present field is the attribute `<name>/<field>`.
 */
export function extensionValueErrors(
  extensions: unknown,
  attributes: { [key: string]: JsonValue } | undefined,
  carrier: ExtensionTarget,
  defs: ReadonlyMap<string, ExtensionDefRecord>,
  nodes?: (id: string) => ExtensionNode | undefined,
): ExtensionViolation[] {
  const listError = extensionsListError(extensions);
  if (listError !== undefined) return [{ message: listError }];
  if (extensions === undefined) return [];
  const problems: ExtensionViolation[] = [];
  for (const entry of extensions as string[]) {
    const parsed = parseExtensionRef(entry);
    if (!parsed) continue;
    const def = defs.get(entry);
    if (def === undefined) continue;
    if (parsed.target !== carrier || def.target !== carrier) {
      problems.push({ message: `extension ${entry} does not attach to a ${carrier}.` });
      continue;
    }
    for (const field of def.fields) {
      const key = `${parsed.name}/${field.name}`;
      const present = attributes !== undefined && Object.prototype.hasOwnProperty.call(attributes, key) && attributes[key] !== undefined;
      if (!present) {
        if (field.required === true) problems.push({ message: `extension ${entry} is missing required field ${field.name}.` });
        continue;
      }
      const error = valueError(field.type, attributes![key], field);
      if (error !== undefined) {
        problems.push({ message: `extension ${entry} field ${field.name} ${error}` });
        continue;
      }
      if (nodes && field.ref !== undefined && refIsCheckable(field.ref) && (field.type === "nodeRef" || field.type === "list<nodeRef>")) {
        const ids = field.type === "nodeRef" ? [attributes![key] as string] : (attributes![key] as string[]);
        for (const id of ids) {
          if (typeof id !== "string") continue;
          const node = nodes(id);
          if (node === undefined) continue;
          if (!carriesExtension(node.extensions, field.ref)) {
            problems.push({ message: `extension ${entry} field ${field.name} references node ${id} which lacks extension ${field.ref}.` });
          }
        }
      }
    }
  }
  return problems;
}
