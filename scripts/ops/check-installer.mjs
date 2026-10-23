#!/usr/bin/env node
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const read = file => fs.readFileSync(file, 'utf8');
// Tracked source only, just as in a clean CI checkout (exclude local dependencies).
const files = execFileSync('git', ['ls-files', '-z'], {encoding:'utf8'}).split('\0').filter(f => /\.(bat|cmd)$/.test(f) && fs.existsSync(f));
for (const file of files) {
  const lines = read(file).split(/\r?\n/);
  const eol = execFileSync('git', ['check-attr', 'eol', '--', file], {encoding:'utf8'}).trim().split(': ').at(-1);
  lines.forEach((line, i) => check(!/\^\s*$/.test(line) || eol === 'crlf', `${file}:${i+1}: ^ continuation without eol=crlf`));
  if (file.endsWith('.bat')) {
    const pushes = lines.filter(l => /^\s*pushd\b/i.test(l)).length;
    const pops = lines.filter(l => /^\s*popd\b/i.test(l)).length;
    check(pushes ? pops >= pushes : pops === 0, `${file}: pushd/popd imbalance (${pushes}/${pops})`);
  }
}
const attrs = read('.gitattributes');
for (const ext of ['bat','cmd','vbs','ps1']) check(new RegExp('^\\*\\.'+ext+'\\b.*eol=crlf','m').test(attrs), `.gitattributes missing eol=crlf for *.${ext}`);
const setup = read('install/setup.bat').split(/\r?\n/);
check(setup.some(l => /^\s*pause/.test(l)), 'install/setup.bat: missing pause');
const pathLine = setup.findIndex(l => l.includes('set "PATH=%NODE_DIR%'));
const npmLine = setup.findIndex(l => /call.*NPM_CMD.*(ci|install|build|start)/.test(l));
check(pathLine >= 0 && (npmLine < 0 || pathLine <= npmLine), 'install/setup.bat: portable Node PATH must precede npm');
for (const file of ['scripts/final/launch-hidden.vbs','scripts/final/launch.bat','scripts/final/migrate-from-beta.bat']) check(fs.existsSync(file), `Missing referenced file: ${file}`);
for (const file of ['install/setup.bat','scripts/final/migrate-from-beta.bat']) {
  const lines = read(file).split(/\r?\n/);
  lines.forEach((line,i) => { if (line.includes('exit /b 1')) check(lines.slice(Math.max(0,i-3),i+1).some(l => /^\s*pause/i.test(l)), `${file}:${i+1}: exit /b 1 without preceding pause`); });
}
const batVersion = read('install/setup.bat').match(/NODE_VERSION=([0-9]+\.[0-9]+\.[0-9]+)/)?.[1];
const shVersion = fs.existsSync('install/setup.sh') ? read('install/setup.sh').match(/NODE_VERSION="([0-9]+\.[0-9]+\.[0-9]+)"/)?.[1] : undefined;
check(Boolean(batVersion) && (!shVersion || batVersion === shVersion), 'Installer Node version missing or inconsistent');
for (const failure of failures) console.error('FAIL installer-lint: '+failure);
if (!failures.length) console.log('PASS installer-lint: line endings, pause, PATH, references, directory stack, error exits, Node version');
process.exitCode = failures.length ? 1 : 0;
