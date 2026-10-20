import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const launch=fs.readFileSync(new URL('../beta/launch.sh',import.meta.url),'utf8');
function fixture({job=true,mismatch=false,port='4173',listener='987654',ready=true,platform='Darwin',symlink=false,label}={}) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'m3e-launch-'));
 try {
  const bin=path.join(root,'bin'),log=path.join(root,'calls');
  for(const dir of ['scripts/beta','beta/dist/node','beta/node_modules/dotenv','bin','other checkout']) fs.mkdirSync(path.join(root,dir),{recursive:true});
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
   sleep:':',
   kill:'echo "kill $*" >> "$CALLS"\n[ "$1" != -0 ]',
  };
  for(const [name,body] of Object.entries(scripts))fs.writeFileSync(path.join(bin,name),`#!/bin/bash\n${body}\n`,{mode:0o755});
  // Shell functions dispatch to PATH fixtures even after launch.sh prepends Homebrew.
  const bashEnv=path.join(root,'bash-env');
  fs.writeFileSync(bashEnv,Object.keys(scripts).map(name=>`${name}() { "$FIXTURE_BIN/${name}" "$@"; }`).join('\n'));
  const result=spawnSync('/bin/bash',[path.join(root,'scripts/beta/launch.sh')],{encoding:'utf8',timeout:10000,env:{...process.env,PATH:`${bin}:${process.env.PATH}`,BASH_ENV:bashEnv,FIXTURE_BIN:bin,CALLS:log,M3E_HOME:path.join(root,'home'),M3E_DATA_DIR:path.join(root,'home/workspace'),M3E_SEED_DB_PATH:path.join(root,'home/seed.sqlite'),M3E_DB_FILE:'data.sqlite',M3E_PORT:'4173',...(label?{M3E_BETA_LAUNCHD_LABEL:label}:{})}});
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
});
test('launchd API timeout reports stderr path without stopping job',()=>{
 const r=fixture({ready:false});assert.equal(r.status,1);assert.match(r.stderr,/\/tmp\/fixture-beta.err/);assert.doesNotMatch(r.calls,/^kill |^open /m);
});
test('WorkingDirectory symlink resolves to matching checkout',()=>{
 const r=fixture({symlink:true,label:'com.m3e.custom-beta'});assert.equal(r.status,0,r.stderr);assert.match(r.calls,/kickstart -k gui\/\d+\/com.m3e.custom-beta/);
});
test('non-Darwin uses standalone launch without launchctl',()=>{
 const r=fixture({platform:'Linux'});assert.equal(r.status,0,r.stderr);assert.doesNotMatch(r.calls,/launchctl/);assert.match(r.calls,/node .*start_viewer/);
});
