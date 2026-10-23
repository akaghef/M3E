import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const launch=fs.readFileSync(new URL('../beta/launch.sh',import.meta.url),'utf8');
function fixture({job=true,mismatch=false,port='4173',listener='987654',ready=true,platform='Darwin',symlink=false,label,attempts='3'}={}) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'m3e-launch-'));
 try {
  const log=path.join(root,'calls');
  for(const dir of ['scripts/beta','beta/dist/node','beta/node_modules/dotenv','other checkout']) fs.mkdirSync(path.join(root,dir),{recursive:true});
  fs.writeFileSync(path.join(root,'scripts/beta/launch.sh'),launch);
  for(const file of ['beta/dist/node/start_viewer.js','beta/node_modules/dotenv/config.js']) fs.writeFileSync(path.join(root,file),'');
  if(symlink) fs.symlinkSync(path.join(root,'beta'),path.join(root,'linked beta'));
  const jobDir=path.join(root,mismatch?'other checkout':symlink?'linked beta':'beta');
  const scripts={
   uname:`echo ${platform}`,
   node:'echo "node $*" >> "$CALLS"',
   npm:'echo "npm $*" >> "$CALLS"',
   launchctl:`echo "launchctl $*" >> "$CALLS"\nif [ "$1" = print ]; then\n ${job?'': 'exit 1'}\n printf '%s\\n' 'working directory = ${jobDir}' 'environment = {' ' M3E_PORT => ${port}' '}' 'pid = 987654' 'stderr path = /tmp/fixture-beta.err'\nfi`,
   lsof:`echo 'lsof' >> "$CALLS"\necho ${listener}`,
   curl:`echo "curl $*" >> "$CALLS"\nexit ${ready?0:1}`,
   open:'echo "open $*" >> "$CALLS"',
   sleep:'echo "sleep $*" >> "$CALLS"',
   kill:'echo "kill $*" >> "$CALLS"\n[ "$1" != -0 ]',
  };
  // Functions survive the launcher's PATH override without starting another Bash
  // for every stub call. Subshell bodies keep stub exits local to each command.
  const bashEnv=path.join(root,'bash-env');
  fs.writeFileSync(bashEnv,Object.entries(scripts).map(([name,body])=>`${name}() (\n${body}\n)`).join('\n'));
  // Hang watchdog only; readiness behavior is checked by attempt counts below.
  const result=spawnSync('/bin/bash',[path.join(root,'scripts/beta/launch.sh')],{encoding:'utf8',timeout:120000,env:{...process.env,BASH_ENV:bashEnv,CALLS:log,M3E_LAUNCH_WAIT_ATTEMPTS:attempts,M3E_HOME:path.join(root,'home'),M3E_DATA_DIR:path.join(root,'home/workspace'),M3E_SEED_DB_PATH:path.join(root,'home/seed.sqlite'),M3E_DB_FILE:'data.sqlite',M3E_PORT:'4173',...(label?{M3E_BETA_LAUNCHD_LABEL:label}:{})}});
  assert.equal(result.error,undefined);
  return {...result,calls:fs.readFileSync(log,'utf8'),jobDir,homeCreated:fs.existsSync(path.join(root,'home'))};
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('matching launchd job restarts without kill or standalone node',()=>{
 const r=fixture();assert.equal(r.status,0,r.stderr);
 assert.match(r.calls,/launchctl kickstart -k gui\/\d+\/com.m3e.beta-nosync/);
 assert.doesNotMatch(r.calls,/^kill |node .*start_viewer/m);
 assert.equal(r.homeCreated,false);
 assert.match(r.calls,/curl .*\/api\/maps\//);assert.match(r.calls,/open http/);
 assert.ok(r.calls.indexOf('node ')<r.calls.indexOf('launchctl kickstart'));
});
test('another checkout on the same port refuses without kill or launch',()=>{
 const r=fixture({mismatch:true});assert.equal(r.status,1);assert.ok(r.stderr.includes(r.jobDir));
 assert.equal(r.homeCreated,false);
 assert.doesNotMatch(r.calls,/kickstart|^kill |node .*start_viewer|^open /m);
});
test('missing job uses standalone launch and port cleanup',()=>{
 const r=fixture({job:false});assert.equal(r.status,0,r.stderr);
 assert.doesNotMatch(r.calls,/kickstart/);assert.match(r.calls,/kill 987654/);assert.match(r.calls,/node .*start_viewer/);
});
test('different launchd port uses standalone launch',()=>{
 const r=fixture({port:'4180'});assert.equal(r.status,0,r.stderr);assert.doesNotMatch(r.calls,/kickstart/);assert.match(r.calls,/node .*start_viewer/);
});
test('launchd listener must belong to job even when API responds',()=>{
 const r=fixture({listener:'123456'});assert.equal(r.status,1);assert.match(r.stderr,/\/tmp\/fixture-beta.err/);
 assert.doesNotMatch(r.calls,/^kill |node .*start_viewer|^open /m);
 assert.equal((r.calls.match(/^lsof$/gm)||[]).length,3);
 assert.doesNotMatch(r.calls,/^curl /m);
});
test('launchd API timeout reports stderr path without stopping job',()=>{
 const r=fixture({ready:false});assert.equal(r.status,1);assert.match(r.stderr,/\/tmp\/fixture-beta.err/);assert.doesNotMatch(r.calls,/^kill |^open /m);
 assert.equal((r.calls.match(/^curl /gm)||[]).length,3);
 assert.equal((r.calls.match(/^sleep 0\.25$/gm)||[]).length,3);
});
test('invalid wait attempts are rejected before polling',()=>{
 const r=fixture({attempts:'0'});assert.equal(r.status,1);
 assert.match(r.stderr,/M3E_LAUNCH_WAIT_ATTEMPTS must be a positive integer/);
 assert.doesNotMatch(r.calls,/^curl |^sleep /m);
});
test('WorkingDirectory symlink resolves to matching checkout',()=>{
 const r=fixture({symlink:true,label:'com.m3e.custom-beta'});assert.equal(r.status,0,r.stderr);assert.match(r.calls,/kickstart -k gui\/\d+\/com.m3e.custom-beta/);
});
test('non-Darwin uses standalone launch without launchctl',()=>{
 const r=fixture({platform:'Linux'});assert.equal(r.status,0,r.stderr);assert.doesNotMatch(r.calls,/launchctl/);assert.match(r.calls,/node .*start_viewer/);
 assert.equal((r.calls.match(/^curl /gm)||[]).length,1);
 assert.equal((r.calls.match(/^sleep 1$/gm)||[]).length,1);
 assert.doesNotMatch(r.calls,/^sleep 0\.25$/m);
});
