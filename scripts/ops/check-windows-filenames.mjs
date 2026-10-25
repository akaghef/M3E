#!/usr/bin/env node
// Reject tracked paths that Git for Windows cannot check out, so a clone on Windows never fails.
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export function windowsPathProblems(files) {
  const problems=[], seen=new Map();
  for(const file of files) {
    for(const part of file.split('/')) {
      if(/[<>:"|?*\\\x00-\x1f]/.test(part)) problems.push(`${JSON.stringify(file)}: reserved character in "${part}"`);
      else if(/[ .]$/.test(part)) problems.push(`${JSON.stringify(file)}: "${part}" ends with a space or dot`);
      else if(/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i.test(part)) problems.push(`${JSON.stringify(file)}: reserved device name "${part}"`);
    }
    const key=file.toLowerCase();
    if(seen.has(key)) problems.push(`${JSON.stringify(file)}: differs only in case from ${JSON.stringify(seen.get(key))}`);
    else seen.set(key,file);
  }
  return problems;
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
  const problems=windowsPathProblems(files);
  if(problems.length) {
    console.error(`Tracked paths that Windows cannot check out (${problems.length}):`);
    for(const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`Windows file name check: ${files.length} tracked paths OK`);
}
