#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const targetArg = process.argv[2] || "generated-vault";
const countArg = Number.parseInt(process.argv[3] || "1000", 10);
const outputDir = path.resolve(process.cwd(), targetArg);
const totalFileCount = Number.isFinite(countArg) && countArg > 0 ? countArg : 1000;
const noteCount = Math.max(1, totalFileCount - 1);

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const indexLinks = [];

for (let i = 0; i < noteCount; i += 1) {
  const bucket = `batch-${String(Math.floor(i / 100)).padStart(2, "0")}`;
  const noteName = `Note-${String(i).padStart(4, "0")}`;
  const noteDir = path.join(outputDir, bucket);
  fs.mkdirSync(noteDir, { recursive: true });

  const nextLink = i + 1 < noteCount
    ? `[[${bucketFor(i + 1)}/Note-${String(i + 1).padStart(4, "0")}]]`
    : "[[Index]]";
  const prevLink = i > 0
    ? `[[${bucketFor(i - 1)}/Note-${String(i - 1).padStart(4, "0")}]]`
    : "[[Index]]";

  const content = [
    "---",
    `tags: [generated, load-test, ${bucket}]`,
    `aliases: [${noteName}]`,
    "---",
    "",
    `# ${noteName}`,
    "",
    `Generated note ${i + 1} of ${noteCount}.`,
    "",
    `- Previous: ${prevLink}`,
    `- Next: ${nextLink}`,
    `- Bucket: ${bucket}`,
    "",
    "## Details",
    "",
    `This file exists to exercise import/export/watch throughput for ${noteName}.`,
    "",
  ].join("\n");

  fs.writeFileSync(path.join(noteDir, `${noteName}.md`), content, "utf8");
  indexLinks.push(`- [[${bucket}/${noteName}]]`);
}

fs.writeFileSync(
  path.join(outputDir, "Index.md"),
  [
    "---",
    "tags: [generated, index]",
    "aliases: [Home]",
    "---",
    "",
    "# Generated Vault",
    "",
    `This vault contains ${noteCount} generated notes plus Index.md (${totalFileCount} markdown files total).`,
    "",
    "## Notes",
    "",
    ...indexLinks,
    "",
  ].join("\n"),
  "utf8",
);

console.log(`Generated ${totalFileCount} markdown files in ${outputDir}`);

function bucketFor(index) {
  return `batch-${String(Math.floor(index / 100)).padStart(2, "0")}`;
}
