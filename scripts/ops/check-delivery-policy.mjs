#!/usr/bin/env node
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const files = ['AGENTS.md','CLAUDE.md','docs/06_Operations/Director_Playbook.md','docs/06_Operations/Documentation_Rules.md','docs/06_Operations/Agent_Roles.md','docs/protocols/worker-minimal-instruction.md','docs/protocols/handoff-packet-protocol.md'];
const forbidden = [/Codex does not merge its own PR/i, /PRベースの統合フローを厳密に守る/, /Codex can never run Playwright/, /Codex opens a PR targeting/, /PR が `dev-beta` に作成されている/];
let bad = false;
for (const file of files) {
  const text = fs.readFileSync(file,'utf8').split('## 5. Improvement Log')[0];
  for (const re of forbidden) if (re.test(text)) {console.error(`Obsolete delivery rule: ${file}: ${re}`); bad = true;}
}
const skills = ['m3e-worker','devM3E','pr-beta','pr-review','beta-converse','daily-sync','nightly-autopilot','setrole','canvas-protocol'];
const result = spawnSync(process.execPath, ['tools/sync_agent_instructions.mjs','--check','--mirror=.claude/skills','--mirror=.agents/skills',...skills.map(x=>`--skill=${x}`)],{stdio:'inherit'});
if (result.status !== 0) bad = true;
if (bad) process.exit(1);
console.log('Delivery rules and tracked skill mirrors passed');
