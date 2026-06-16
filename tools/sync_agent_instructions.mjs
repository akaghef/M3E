#!/usr/bin/env node
/* Proposed script skeleton: sync canonical skill source to tool mirrors. */
import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const check = args.has('--check');
const write = args.has('--write') || !check;

const root = process.cwd();
const sourceRoot = path.join(root, 'agent_instructions', 'skills_canonical');
const mirrorRoots = [
  path.join(root, '.codex', 'skills'),
  path.join(root, '.claude', 'skills'),
  path.join(root, '.agents', 'skills'), // compatibility during migration
];
const GENERATED_MARKER = 'generated from agent_instructions/skills_canonical/';

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function ensureDir(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function stripGeneratedHeader(content) {
  const patterns = [
    /^<!-- generated from agent_instructions\/skills_canonical\/[^;]+; do not edit mirror directly -->\r?\n\r?\n/,
    /^\/\/ generated from agent_instructions\/skills_canonical\/[^;]+; do not edit mirror directly\r?\n\r?\n/,
    /^# generated from agent_instructions\/skills_canonical\/[^;]+; do not edit mirror directly\r?\n\r?\n/,
  ];
  for (const pattern of patterns) {
    if (pattern.test(content)) return content.replace(pattern, '');
  }
  return content;
}

function withGeneratedHeader(rel, content) {
  content = stripGeneratedHeader(content);
  const source = `agent_instructions/skills_canonical/${rel}`;
  const ext = path.extname(rel).toLowerCase();
  const mdHeader = `<!-- generated from ${source}; do not edit mirror directly -->`;
  if (ext === '.md' && content.startsWith('---')) {
    const end = content.indexOf('\n---', 3);
    if (end !== -1) {
      const closeEnd = content.indexOf('\n', end + 1);
      const split = closeEnd === -1 ? content.length : closeEnd + 1;
      return `${content.slice(0, split)}\n${mdHeader}\n\n${content.slice(split)}`;
    }
  }
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    return `// generated from ${source}; do not edit mirror directly\n\n${content}`;
  }
  if (ext === '.yaml' || ext === '.yml') {
    return `# generated from ${source}; do not edit mirror directly\n\n${content}`;
  }
  return `${mdHeader}\n\n${content}`;
}

let changed = false;

for (const src of walk(sourceRoot)) {
  const rel = path.relative(sourceRoot, src);
  const content = fs.readFileSync(src, 'utf8');
  const generated = withGeneratedHeader(rel, content);

  for (const mirrorRoot of mirrorRoots) {
    const dest = path.join(mirrorRoot, rel);
    const old = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
    if (old !== generated) {
      changed = true;
      if (write) {
        ensureDir(dest);
        fs.writeFileSync(dest, generated);
        console.log(`updated ${path.relative(root, dest)}`);
      } else {
        console.error(`out of sync: ${path.relative(root, dest)}`);
      }
    }
  }
}

if (check && changed) process.exit(1);
