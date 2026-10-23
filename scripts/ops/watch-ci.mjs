#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
const run = (command, args) => execFileSync(command, args, {encoding:'utf8', timeout:60000, maxBuffer:32*1024*1024, stdio:['ignore','pipe','pipe']}).trim();
const seconds = (name, fallback) => {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive number`);
  return n * 1000;
};
try {
  if (process.argv.length > 3) throw new Error('Usage: watch-ci.sh [<sha>]');
  const sha = run('git', ['rev-parse','--verify',`${process.argv[2] || 'HEAD'}^{commit}`]);
  run('gh', ['auth','status']);
  const discovery = seconds('M3E_CI_DISCOVERY_SECONDS', 60);
  const registrationTimeout = seconds('M3E_CI_REGISTRATION_TIMEOUT_SECONDS', 180);
  const timeout = seconds('M3E_CI_TIMEOUT_SECONDS', 1800);
  const poll = seconds('M3E_CI_POLL_SECONDS', 10);
  if (registrationTimeout < discovery || timeout < registrationTimeout) throw new Error('CI timeouts must satisfy discovery <= registration <= overall');
  const started = Date.now();
  let changedAt = started, signature = '', discovered = false;
  const seen = new Map();
  console.log(`Waiting for push CI: ${sha} (discovery ${discovery/1000}s, timeout ${timeout/1000}s)`);
  while (true) {
    const runs = JSON.parse(run('gh', ['run','list','--commit',sha,'--event','push','--limit','1000','--json','databaseId,workflowName,status,conclusion,headSha,url']));
    if (runs.length >= 1000) throw new Error('Run list reached its limit; refusing an incomplete result');
    for (const item of runs) {
      if (item.headSha !== sha) throw new Error('GitHub returned a run for a different SHA');
      seen.set(item.databaseId, item);
    }
    const next = [...seen.keys()].sort().join(',');
    if (signature !== next) { signature = next; changedAt = Date.now(); console.log('Discovered: '+[...seen.values()].map(r=>r.workflowName).join(', ')); }
    const now = Date.now();
    // Wait a full quiet registration window even when the first runs finish fast.
    // Paths-filtered workflows have no run and are deliberately not synthesized.
    if (seen.size && now-changedAt >= discovery) discovered = true;
    if (!discovered && now-started >= registrationTimeout) throw new Error('Push workflow registration did not settle before its timeout (or no runs appeared)');
    if (discovered && now-changedAt >= discovery && [...seen.values()].every(r=>r.status === 'completed')) {
      let failed = false;
      for (const item of seen.values()) {
        console.log(`${item.workflowName}: ${item.conclusion} ${item.url}`);
        if (item.conclusion !== 'success') {
          failed = true;
          try {
            const lines = run('gh', ['run','view',String(item.databaseId),'--log-failed']).split('\n').filter(Boolean);
            const errors = lines.filter(line=> /##\[error\]|::error|FAIL|Error:|AssertionError|TS\d{4}/i.test(line));
            console.error((errors.length ? errors.slice(0,8) : lines.slice(-8)).join('\n') || 'No failed-step log is available for this conclusion.');
          } catch (error) { console.error('Failed-step log unavailable: '+(error.stderr?.toString().trim() || error.message)); }
        }
      }
      console.log('Workflows with no push run after the discovery window are outside this result (including paths filters).');
      process.exitCode = failed ? 1 : 0;
      break;
    }
    if (now-started >= timeout) throw new Error('CI completion timeout: '+[...seen.values()].filter(r=>r.status!=='completed').map(r=>r.workflowName).join(', '));
    await sleep(Math.min(poll, Math.max(1,timeout-(now-started))));
  }
} catch (error) {
  console.error('FAIL watch-ci: '+(error.stderr?.toString().trim() || error.message));
  process.exitCode = 1;
}
