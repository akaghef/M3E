#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataDirectory, runtimeConfig, validateRepository } from '../../plugins/m3e/scripts/runtime.mjs';

const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  if (!['--m3e-home', '--repo-root', '--api-url', '--node'].includes(key) || !process.argv[i + 1]) {
    process.stderr.write('Usage: node scripts/mcp/configure-plugin.mjs [--m3e-home <M3E-home>] [--repo-root <M3E>] [--api-url <loopback-url>] [--node <node-executable>]\n');
    process.exit(2);
  }
  options[key] = process.argv[i + 1];
}
try {
  const { root } = await validateRepository(options['--repo-root'] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
  const directory = path.resolve(options['--m3e-home'] || dataDirectory());
  // Configuration does not inherit a preview endpoint or a preview repository.
  const { apiUrl } = await runtimeConfig({ M3E_HOME: directory, M3E_API_URL: options['--api-url'] || 'http://127.0.0.1:4173' });
  const nodeExecutable = await fs.realpath(options['--node'] || process.execPath);
  await fs.access(nodeExecutable, fs.constants.X_OK);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'mcp-client.json');
  await fs.writeFile(file, `${JSON.stringify({ version: 1, repoRoot: root, apiUrl, nodeExecutable }, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(file, 0o600);
  process.stdout.write(`Configured M3E Beta at ${root}\nEndpoint: ${apiUrl}\nPlugin runtime: ${file}\n`);
} catch (error) {
  process.stderr.write(`M3E configuration failed: ${error.message}\n`);
  process.exitCode = 1;
}
