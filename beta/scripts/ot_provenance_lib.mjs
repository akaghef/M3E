import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
function sourceBytes(upstreamRoot, sourcePath) {
  const path = resolve(upstreamRoot, sourcePath);
  return existsSync(path) ? readFileSync(path) : null;
}
function lineRange(bytes, range) {
  if (!range) return null;
  return Buffer.from(bytes.toString("utf8").split("\n").slice(range[0] - 1, range[1]).join("\n"));
}
function checkFragment(root, upstreamRoot, fragment, errors) {
  const localPath = resolve(root, "src/labs/ot", fragment.path);
  if (!existsSync(localPath)) { errors.push(`missing fragment ${fragment.path}`); return; }
  const local = readFileSync(localPath);
  if (sha256(local) !== fragment.sha256) errors.push(`${fragment.path}: sha256 drift`);
  const upstream = sourceBytes(upstreamRoot, fragment.source_path);
  if (!upstream) { errors.push(`${fragment.path}: missing pinned source ${fragment.source_path}`); return; }
  if (upstream.indexOf(local) === -1) errors.push(`${fragment.path}: bytes are not a verbatim upstream substring`);
  const expectedRange = lineRange(upstream, fragment.source_range);
  if (!expectedRange || !expectedRange.equals(local)) errors.push(`${fragment.path}: bytes differ from recorded source range ${fragment.source_range.join("-")}`);
  const upstreamText = upstream.toString("utf8");
  for (const symbol of fragment.source_symbols || []) if (!upstreamText.includes(symbol)) errors.push(`${fragment.path}: source symbol ${symbol} absent`);
}
export function validateOtProvenance(root, upstreamRoot) {
  const manifest = JSON.parse(readFileSync(resolve(root, "src/labs/ot/provenance.json"), "utf8"));
  const errors = [];
  if (!existsSync(upstreamRoot)) return { ok: false, errors: [`missing pinned upstream root ${upstreamRoot}`] };
  for (const fragment of manifest.fragments || []) checkFragment(root, upstreamRoot, fragment, errors);
  for (const style of manifest.styles || []) checkFragment(root, upstreamRoot, style, errors);
  for (const asset of manifest.assets || []) {
    const localPath = resolve(root, "src/labs/ot", asset.path);
    const upstreamPath = resolve(upstreamRoot, asset.source_path);
    if (!existsSync(localPath)) { errors.push(`missing binary asset ${asset.path}`); continue; }
    if (!existsSync(upstreamPath)) { errors.push(`missing pinned binary ${asset.source_path}`); continue; }
    const local = readFileSync(localPath); const upstream = readFileSync(upstreamPath);
    if (sha256(local) !== asset.sha256) errors.push(`${asset.path}: recorded sha256 drift`);
    if (!local.equals(upstream)) errors.push(`${asset.path}: binary drift`);
  }
  return { ok: errors.length === 0, errors };
}
