import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
// Hang watchdog only; elapsed time is not an acceptance criterion.
const invoke = (cmd, args, cwd, env = {}, input) => spawnSync(cmd,args,{cwd,env:{...process.env,...env},input,encoding:'utf8',timeout:120000});
function scratch(t) { const dir=fs.mkdtempSync(path.join(os.tmpdir(),'m3e-ci-gate-')); t.after(()=>fs.rmSync(dir,{recursive:true,force:true})); return dir; }
function executable(file, body) { fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body,{mode:0o755}); }
function git(dir,args,input,env={}) { const r=invoke('git',args,dir,env,input);assert.equal(r.status,0,r.stderr);return r.stdout.trim(); }

test('pre-push plumbing: dev-beta blocked; other refs pass, including linked worktree', t=>{
  const dir=scratch(t), repo=path.join(dir,'repo'), bare=path.join(dir,'remote.git'), linked=path.join(dir,'linked');
  fs.mkdirSync(repo);
  git(dir,['init','--bare',bare]); git(repo,['init','-b','codex/fixture']);
  const tree=git(repo,['mktree'],'');
  const commit=git(repo,['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',tree,'-m','Hook plumbing fixture']);
  git(repo,['update-ref','HEAD',commit]); git(repo,['worktree','add','--detach',linked,commit]);
  for(const cwd of [repo,linked]) {
    executable(path.join(cwd,'.githooks/pre-push'),fs.readFileSync(path.join(root,'.githooks/pre-push'),'utf8'));
    executable(path.join(cwd,'scripts/ops/preflight.sh'),'#!/usr/bin/env bash\necho FIXTURE_PREFLIGHT_FAILURE >&2\nexit 1\n');
    const fail=invoke('git',['-c','core.hooksPath=.githooks','push',bare,'HEAD:refs/heads/dev-beta'],cwd);
    assert.notEqual(fail.status,0);assert.match(fail.stderr,/FIXTURE_PREFLIGHT_FAILURE/);
    const pass=invoke('git',['-c','core.hooksPath=.githooks','push',bare,`HEAD:refs/heads/${cwd===repo?'other':'linked'}`],cwd);
    assert.equal(pass.status,0,pass.stderr);assert.doesNotMatch(pass.stderr,/FIXTURE_PREFLIGHT/);
  }
  assert.equal(git(bare,['for-each-ref','--format=%(refname)','refs/heads/dev-beta']),'');
  git(bare,['update-ref','refs/heads/dev-beta',commit]);
  const deletion=invoke('git',['-c','core.hooksPath=.githooks','push',bare,':refs/heads/dev-beta'],repo);
  assert.equal(deletion.status,0,deletion.stderr);
  assert.equal(git(bare,['for-each-ref','--format=%(refname)','refs/heads/dev-beta']),'');
});

test('hook installer refuses another path, is idempotent, and does not mutate real Git config', t=>{
  const dir=scratch(t), bin=path.join(dir,'bin'), calls=path.join(dir,'calls');
  executable(path.join(bin,'git'),`#!/usr/bin/env node
const fs=require('node:fs'),args=process.argv.slice(2);
fs.appendFileSync(process.env.CALLS,JSON.stringify(args)+'\\n');
if(args[0]==='rev-parse') console.log(process.env.FIXTURE_ROOT);
else if(args.includes('--get')) console.log(process.env.HOOKS_VALUE || '');
`);
  const env={PATH:bin+path.delimiter+process.env.PATH,CALLS:calls,FIXTURE_ROOT:root};
  const denied=invoke('bash',[path.join(root,'scripts/ops/install-git-hooks.sh')],root,{...env,HOOKS_VALUE:'some-other-hooks'});
  assert.equal(denied.status,1);assert.match(denied.stderr,/Refusing to overwrite/);
  assert.doesNotMatch(fs.readFileSync(calls,'utf8'),/--local/);
  for(const value of ['', '.githooks']) {
    const allowed=invoke('bash',[path.join(root,'scripts/ops/install-git-hooks.sh')],root,{...env,HOOKS_VALUE:value});
    assert.equal(allowed.status,0,allowed.stderr);
  }
  assert.match(fs.readFileSync(calls,'utf8'),/"config","--local","core.hooksPath",".githooks"/);
});

test('watch-ci plumbing: late registration, pending, terminal failures, empty and API failure', async t=>{
  const dir=scratch(t), bin=path.join(dir,'bin'), state=path.join(dir,'state');
  executable(path.join(bin,'gh'),`#!/usr/bin/env node
const fs=require('node:fs'),args=process.argv.slice(2),mode=process.env.MODE;
if(args[0]==='auth') process.exit(mode==='auth-error'?1:0);
if(args[1]==='view'){console.log('job step ##[error] deterministic failure detail');process.exit(0);}
if(mode==='api-error'){console.error('API unavailable');process.exit(1);}
const n=Number(fs.existsSync(process.env.STATE)?fs.readFileSync(process.env.STATE,'utf8'):0)+1;fs.writeFileSync(process.env.STATE,String(n));
const item=(id,status,conclusion)=>({databaseId:id,workflowName:id===1?'Build & Test':'Late workflow',headSha:process.env.SHA,status,conclusion,url:'https://example.invalid/run'});
let rows=[];
if(mode==='late') rows=[item(1,'completed','success'),...(n>=2?[item(2,n<3?'queued':'completed',n<3?'': 'failure')]:[])];
else if(mode==='pending') rows=[item(1,'in_progress','')];
else if(mode!=='empty') rows=[item(1,'completed',mode)];
console.log(JSON.stringify(rows));
`);
  // Deterministic logical clock: process startup/load must not make deadline tests flaky.
  const clock=path.join(dir,'clock.mjs');
  fs.writeFileSync(clock,'let tick=0; Date.now=()=> tick+=20;');
  const env={NODE_OPTIONS:'--import='+clock,PATH:bin+path.delimiter+process.env.PATH,STATE:state,SHA:git(root,['rev-parse','HEAD']),M3E_CI_DISCOVERY_SECONDS:'.08',M3E_CI_REGISTRATION_TIMEOUT_SECONDS:'.3',M3E_CI_TIMEOUT_SECONDS:'.6',M3E_CI_POLL_SECONDS:'.02'};
  for(const mode of ['success','failure','cancelled','startup_failure','timed_out','skipped','late','pending','empty','auth-error','api-error']) {
    fs.writeFileSync(state,'0');
    const result=invoke('bash',[path.join(root,'scripts/ops/watch-ci.sh')],root,{...env,MODE:mode});
    assert.equal(result.status,mode==='success'?0:1,mode+': '+result.stderr);
    if(['failure','cancelled','startup_failure','late'].includes(mode)) assert.match(result.stderr,/##\[error\] deterministic failure detail/);
    if(mode==='late') assert.match(result.stdout,/Late workflow/);
    if(mode==='empty') assert.match(result.stderr,/no runs appeared/);
  }
});

test('preflight aggregates failures, continues checks, and refuses missing dependencies', t=>{
  const dir=scratch(t), ops=path.join(dir,'scripts/ops');fs.mkdirSync(ops,{recursive:true});
  for(const name of ['preflight.sh','preflight.mjs']) fs.copyFileSync(path.join(root,'scripts/ops',name),path.join(ops,name));
  const manifest=path.join(ops,'ci-checks.json');
  fs.writeFileSync(manifest,JSON.stringify({first:['.','exit 1'],second:['.','echo SECOND_RAN'],third:['.','exit 2']}));
  const result=invoke('bash',[path.join(ops,'preflight.sh')],dir);
  assert.equal(result.status,1);assert.match(result.stdout,/SECOND_RAN/);assert.match(result.stdout,/FAIL: first, third/);
  fs.writeFileSync(manifest,JSON.stringify({test:['beta','echo MUST_NOT_RUN']}));
  const missing=invoke('bash',[path.join(ops,'preflight.sh')],dir);
  assert.equal(missing.status,1);assert.match(missing.stderr,/beta\/node_modules is missing/);assert.doesNotMatch(missing.stdout,/MUST_NOT_RUN/);
});

function commitFiles(repo, files, parent) {
  const index = path.join(path.dirname(repo), `fixture-index-${Math.random().toString(36).slice(2)}`);
  const env = {GIT_INDEX_FILE:index};
  try {
    git(repo,['read-tree','--empty'],'',env);
    for (const [file, contents] of Object.entries(files)) {
      const blob = git(repo,['hash-object','-w','--stdin'],contents);
      const mode = file === '.githooks/pre-push' ? '100755' : '100644';
      git(repo,['update-index','--add','--cacheinfo',`${mode},${blob},${file}`],'',env);
    }
    const tree = git(repo,['write-tree'],'',env);
    return git(repo,['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',tree,...(parent?['-p',parent]:[]),'-m','Commit fixture']);
  } finally { fs.rmSync(index,{force:true}); }
}
function commitPreflightFixture(t) {
  const dir=scratch(t),repo=path.join(dir,'repo'),bare=path.join(dir,'remote.git');fs.mkdirSync(repo);
  git(dir,['init','--bare',bare]);git(repo,['init','-b','codex/fixture']);
  const files={
    'scripts/ops/preflight.sh':fs.readFileSync(path.join(root,'scripts/ops/preflight.sh'),'utf8'),
    'scripts/ops/preflight.mjs':fs.readFileSync(path.join(root,'scripts/ops/preflight.mjs'),'utf8'),
    'scripts/ops/ci-checks.json':JSON.stringify({
      'personal-path':['.','bash scripts/ops/check-personal-path.sh'],
      'copied-dependencies':['beta','test -f node_modules/sentinel && printf \'%s\\n\' checked >> \"$M3E_FIXTURE_MARKER\"'],
    }),
    'scripts/ops/check-personal-path.sh':fs.readFileSync(path.join(root,'scripts/ops/check-personal-path.sh'),'utf8'),
    '.githooks/pre-push':fs.readFileSync(path.join(root,'.githooks/pre-push'),'utf8'),
    'beta/package-lock.json':'fixture-lock-v1\n',
    'unrelated.md':'committed baseline\n',
  };
  const passed=commitFiles(repo,files);git(repo,['update-ref','HEAD',passed]);
  const later=commitFiles(repo,{...files,'later.md':'another HEAD\n'},passed);
  git(repo,['update-ref','refs/heads/codex/later',later]);git(repo,['checkout','codex/later']);
  fs.writeFileSync(path.join(repo,'unrelated.md'),'uncommitted primary-only change\n');
  fs.mkdirSync(path.join(repo,'beta/node_modules'),{recursive:true});
  fs.writeFileSync(path.join(repo,'beta/node_modules/sentinel'),'installed dependency marker\n');
  const nonSymlink=path.join(repo,'beta/node_modules');assert.equal(fs.lstatSync(nonSymlink).isSymbolicLink(),false);
  return {dir,repo,bare,files,passed,commitFiles:(updates,parent=passed)=>commitFiles(repo,{...files,...updates},parent),push:(sha)=>invoke('git',['-c','core.hooksPath=.githooks','push',bare,`${sha}:refs/heads/dev-beta`],repo),worktrees:()=>git(repo,['worktree','list','--porcelain']).split('\n').filter(line=>line.startsWith('worktree ')).length};
}

test('dev-beta push checks the pushed commit from a dirty checkout even when it is not HEAD', t=>{
  const fixture=commitPreflightFixture(t);
  const marker=path.join(fixture.dir,'preflight-ran');
  const result=invoke('git',['-c','core.hooksPath=.githooks','push',fixture.bare,`${fixture.passed}:refs/heads/dev-beta`],fixture.repo,{M3E_FIXTURE_MARKER:marker});
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  assert.equal(fs.existsSync(marker),true,`preflight marker missing: ${result.stdout}\n${result.stderr}\n${git(fixture.repo,['status','--short'])}`);
  assert.equal(fs.readFileSync(marker,'utf8'),'checked\n');
  assert.equal(fs.readFileSync(path.join(fixture.repo,'unrelated.md'),'utf8'),'uncommitted primary-only change\n');
  assert.equal(fixture.worktrees(),1,'temporary worktree is removed after success');
});

test('dev-beta push rejects a bad pushed commit and removes its temporary worktree', t=>{
  const fixture=commitPreflightFixture(t), bad=fixture.commitFiles({'.kiro/specs/example/sources.md':'nisi'+'mori'+'yuuya\n'});
  const marker=path.join(fixture.dir,'preflight-ran');
  const result=invoke('git',['-c','core.hooksPath=.githooks','push',fixture.bare,`${bad}:refs/heads/dev-beta`],fixture.repo,{M3E_FIXTURE_MARKER:marker});
  assert.notEqual(result.status,0);assert.match(result.stderr,/FAIL personal-path/);assert.equal(fs.readFileSync(marker,'utf8'),'checked\n');
  assert.equal(fixture.worktrees(),1,'temporary worktree is removed after a failed check');
  assert.equal(git(fixture.bare,['for-each-ref','--format=%(refname)','refs/heads/dev-beta']),'');
});

test('commit preflight stops when source and pushed commit lockfiles differ', t=>{
  const fixture=commitPreflightFixture(t), changed=fixture.commitFiles({'beta/package-lock.json':'fixture-lock-v2\n'});
  const result=fixture.push(changed);
  assert.notEqual(result.status,0);assert.match(result.stderr,/package-lock.json differs.*npm --prefix beta ci/);
  assert.equal(fixture.worktrees(),1,'no temporary worktree is left when dependency reuse is refused');
});

test('commit preflight refuses missing source node_modules with install guidance', t=>{
  const fixture=commitPreflightFixture(t), modules=path.join(fixture.repo,'beta/node_modules'), hidden=`${modules}.hidden`;
  fs.renameSync(modules,hidden);
  try {
    const result=fixture.push(fixture.passed);
    assert.notEqual(result.status,0);assert.match(result.stderr,/beta\/node_modules is missing.*npm --prefix beta ci/);
    assert.equal(fixture.worktrees(),1,'no temporary worktree is created without reusable dependencies');
  } finally { fs.renameSync(hidden,modules); }
});
