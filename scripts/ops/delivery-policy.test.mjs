import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root = process.cwd();
function run(cmd,args,cwd){return spawnSync(cmd,args,{cwd,encoding:'utf8'});}
function tmp(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m3e-policy-'));try{fn(dir);}finally{fs.rmSync(dir,{recursive:true,force:true});}}
function git(dir,...args){const r=run('git',args,dir);assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
function fixture(dir){
 git(dir,'init','-b','dev-beta');git(dir,'config','user.email','test@example.invalid');git(dir,'config','user.name','Test');
 fs.mkdirSync(path.join(dir,'scripts/ops'),{recursive:true});
 fs.copyFileSync(path.join(root,'scripts/ops/daily-sync.sh'),path.join(dir,'scripts/ops/daily-sync.sh'));
 fs.writeFileSync(path.join(dir,'source.txt'),'base');git(dir,'add','.');git(dir,'commit','-m','base');
}
test('retired preview rejects without invoking build, copying assets, or starting a service',()=>tmp(dir=>{
 const bin=path.join(dir,'bin');fs.mkdirSync(bin); const marker=path.join(dir,'called');
 for(const c of ['npm','rsync','cp','lsof','nohup'])fs.writeFileSync(path.join(bin,c),`#!/bin/sh\ntouch '${marker}'\nexit 99\n`,{mode:0o755});
 const r=spawnSync('/bin/bash',[path.join(root,'scripts/beta/preview-worktree.sh'),dir],{env:{...process.env,PATH:bin+':/usr/bin:/bin'},encoding:'utf8'});
 assert.equal(r.status,2);assert.match(r.stderr,/retired/);assert.equal(fs.existsSync(marker),false);
}));
test('daily sync preserves dirty staged and unstaged work without committing',()=>tmp(dir=>{
 fixture(dir);const before=git(dir,'rev-parse','HEAD');fs.writeFileSync(path.join(dir,'source.txt'),'staged');git(dir,'add','source.txt');fs.writeFileSync(path.join(dir,'source.txt'),'unstaged');
 const r=run('bash',['scripts/ops/daily-sync.sh'],dir);assert.equal(r.status,1);assert.match(r.stderr,/preserve unfinished work/);
 assert.equal(git(dir,'rev-parse','HEAD'),before);assert.equal(git(dir,'show',':source.txt'),'staged');assert.equal(fs.readFileSync(path.join(dir,'source.txt'),'utf8'),'unstaged');
}));
test('daily sync rejects a task branch without switching it',()=>tmp(dir=>{
 fixture(dir);git(dir,'checkout','-b','codex/task');const r=run('bash',['scripts/ops/daily-sync.sh'],dir);assert.equal(r.status,1);assert.equal(git(dir,'branch','--show-current'),'codex/task');
}));
test('daily sync only fast-forwards remote source; default leaves final untouched and refuses unpublished commits',()=>tmp(dir=>{
 const remote=path.join(dir,'remote.git'), local=path.join(dir,'local'), peer=path.join(dir,'peer');
 fs.mkdirSync(local);fixture(local);git(dir,'init','--bare',remote);git(local,'remote','add','origin',remote);git(local,'push','-u','origin','dev-beta');git(dir,'clone','--branch','dev-beta',remote,peer);git(peer,'config','user.email','test@example.invalid');git(peer,'config','user.name','Test');
 fs.writeFileSync(path.join(peer,'source.txt'),'remote change');git(peer,'add','source.txt');git(peer,'commit','-m','remote');git(peer,'push');
 let r=run('bash',['scripts/ops/daily-sync.sh'],local);assert.equal(r.status,0,r.stderr);assert.equal(git(local,'rev-parse','HEAD'),git(peer,'rev-parse','HEAD'));assert.equal(fs.existsSync(path.join(local,'final')),false);
 fs.writeFileSync(path.join(local,'source.txt'),'unpublished');git(local,'add','source.txt');git(local,'commit','-m','pending review');const oldRemote=git(local,'rev-parse','origin/dev-beta');r=run('bash',['scripts/ops/daily-sync.sh'],local);assert.equal(r.status,1);assert.match(r.stderr,/unpublished/);assert.equal(git(local,'rev-parse','origin/dev-beta'),oldRemote);
}));
test('scoped skill sync avoids unrelated broken mirrors and detects edited tracked mirrors',()=>tmp(dir=>{
 fs.mkdirSync(path.join(dir,'agent_instructions/skills_canonical/wanted'),{recursive:true});fs.writeFileSync(path.join(dir,'agent_instructions/skills_canonical/wanted/SKILL.md'),'---\nname: wanted\ndescription: Scoped example\n---\nText\n');
 fs.mkdirSync(path.join(dir,'agent_instructions/skills_canonical/unrelated'),{recursive:true});fs.writeFileSync(path.join(dir,'agent_instructions/skills_canonical/unrelated/SKILL.md'),'Unrelated');fs.mkdirSync(path.join(dir,'.agents/skills'),{recursive:true});fs.symlinkSync('/missing-m3e-policy-test-target',path.join(dir,'.agents/skills/unrelated'));
 const args=[path.join(root,'tools/sync_agent_instructions.mjs'),'--skill=wanted','--mirror=.agents/skills'];
 let r=run(process.execPath,[...args,'--write'],dir);assert.equal(r.status,0,r.stderr);assert.equal(fs.existsSync(path.join(dir,'.claude')),false);
 r=run(process.execPath,[...args,'--check'],dir);assert.equal(r.status,0,r.stderr);fs.appendFileSync(path.join(dir,'.agents/skills/wanted/SKILL.md'),'drift');r=run(process.execPath,[...args,'--check'],dir);assert.equal(r.status,1);
 r=run(process.execPath,[...args,'--skill=missing','--check'],dir);assert.notEqual(r.status,0);
}));
test('nightly preserves dirty work, does not merge PRs, and returns failure',()=>tmp(dir=>{
 fixture(dir);fs.copyFileSync(path.join(root,'scripts/ops/nightly-autopilot.sh'),path.join(dir,'scripts/ops/nightly-autopilot.sh'));
 git(dir,'add','scripts/ops/nightly-autopilot.sh');git(dir,'commit','-m','nightly');const before=git(dir,'rev-parse','HEAD');fs.writeFileSync(path.join(dir,'source.txt'),'unfinished');
 const r=spawnSync('bash',['scripts/ops/nightly-autopilot.sh','--no-data'],{cwd:dir,env:{...process.env,TMPDIR:dir},encoding:'utf8'});
 assert.equal(r.status,1,r.stdout+r.stderr);assert.match(r.stdout,/PR sweep retired/);assert.equal(git(dir,'rev-parse','HEAD'),before);assert.equal(fs.readFileSync(path.join(dir,'source.txt'),'utf8'),'unfinished');
}));
