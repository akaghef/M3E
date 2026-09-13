import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (path) => existsSync(path) ? readFileSync(path) : null;
const lineRange = (bytes, range) => Buffer.from(bytes.toString("utf8").split("\n").slice(range[0] - 1, range[1]).join("\n"));
function checkFragment(root, upstreamRoot, fragment, errors) {
  const local = read(resolve(root, "src/labs/ot", fragment.path));
  if (!local) { errors.push(`missing fragment ${fragment.path}`); return; }
  if (sha256(local) !== fragment.sha256) errors.push(`${fragment.path}: sha256 drift`);
  const upstream = read(resolve(upstreamRoot, fragment.source_path));
  if (!upstream) { errors.push(`${fragment.path}: missing pinned source ${fragment.source_path}`); return; }
  const ranges = fragment.source_ranges || [fragment.source_range];
  if (!ranges.length || ranges.some(range => !Array.isArray(range) || range.length !== 2 || range[0] < 1 || range[1] < range[0])) {
    errors.push(`${fragment.path}: invalid source ranges`); return;
  }
  const regions = ranges.map(range => lineRange(upstream, range));
  let cursor = 0;
  for (let i = 0; i < regions.length; i++) {
    const offset = local.indexOf(regions[i], cursor);
    if (!regions[i].length || offset === -1) errors.push(`${fragment.path}: missing verbatim source region ${ranges[i].join('-')}`);
    else cursor = offset + regions[i].length;
  }
  // Adapted cuts may add bootstrap glue around the recorded verbatim regions.
  // They still have a digest and must declare why; 100% byte identity is not required.
  if (fragment.adapted) {
    if (!fragment.reason?.trim()) errors.push(`${fragment.path}: adapted cut has no reason`);
  } else if (!Buffer.concat(regions.flatMap((bytes, i) => i ? [Buffer.from('\n\n'), bytes] : [bytes])).equals(local)) {
    errors.push(`${fragment.path}: undeclared adaptation`);
  }
}
export function validateOtProvenance(root, upstreamRoot) {
  const manifest = JSON.parse(readFileSync(resolve(root, "src/labs/ot/provenance.json"), "utf8"));
  const errors = [];
  const source = read(resolve(upstreamRoot, manifest.source_root));
  if (!source) return { ok: false, errors: [`missing pinned upstream source ${upstreamRoot}`] };
  if (sha256(source) !== manifest.source_sha256) errors.push('pinned upstream source digest drift');
  const license = read(resolve(root, "src/labs/ot", manifest.license.file));
  if (!license?.includes(manifest.license.required_notice) || !license?.includes('PolyForm Perimeter License 1.0.1')) errors.push('missing PolyForm license/notice');
  for (const fragment of [...manifest.fragments, ...manifest.styles]) checkFragment(root, upstreamRoot, fragment, errors);
  for (const asset of manifest.assets) {
    const local = read(resolve(root, "src/labs/ot", asset.path));
    const upstream = read(resolve(upstreamRoot, asset.source_path));
    if (!local || !upstream) { errors.push(`missing asset/source ${asset.path}`); continue; }
    if (sha256(local) !== asset.sha256 || !local.equals(upstream)) errors.push(`${asset.path}: asset drift`);
  }
  return { ok: errors.length === 0, errors };
}
