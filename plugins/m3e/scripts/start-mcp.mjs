#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { runtimeConfig, resolveRepository } from './runtime.mjs';

try {
  const config = await runtimeConfig();
  const { root, entry } = await resolveRepository(config);
  const child = spawn(config.nodeExecutable, [entry, ...process.argv.slice(2)], {
    cwd: root,
    env: { ...process.env, M3E_API_URL: config.apiUrl },
    stdio: 'inherit',
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('error', () => { process.stderr.write('M3E MCP could not start the configured Beta build.\n'); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
