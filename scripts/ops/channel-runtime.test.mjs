import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {git,guardBeta,guardFinal,releaseInfo,installFinal,ensureBuild,fingerprint,withChannelLock,agentIconPython} from './channel-runtime.mjs';
const project=process.cwd();
function fixture(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'m3e-channel-'));
 // The imported runtime's internal Git calls also need the fixture's environment.
 const hookEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>key.startsWith('GIT_')));
 for(const key of Object.keys(hookEnv))delete process.env[key];
 const originalPython=process.env.M3E_AGENT_ICON_PYTHON;
 // Generic build fixtures do not run the icon gate or require host Pillow.
 process.env.M3E_AGENT_ICON_PYTHON=process.execPath;
 try{
 git(root,'init','-b','dev-beta');git(root,'config','user.name','Test');git(root,'config','user.email','test@example.invalid');
 for(const d of ['beta','final','docs/06_Operations','scripts/ops','scripts/final','install/assets'])fs.mkdirSync(path.join(root,d),{recursive:true});
 for(const c of ['beta','final']){fs.writeFileSync(path.join(root,c,'source.txt'),c);fs.writeFileSync(path.join(root,c,'package.json'),JSON.stringify({name:'fixture',version:'1.0.0',scripts:{build:"node -e \"require('fs').mkdirSync('dist/browser',{recursive:true});require('fs').writeFileSync('dist/browser/viewer.js','built');require('fs').mkdirSync('dist/node',{recursive:true});require('fs').writeFileSync('dist/node/start_viewer.js','')\""}}));}
 fs.writeFileSync(path.join(root,'.gitignore'),'node_modules/\ndist/\n');fs.writeFileSync(path.join(root,'install/assets/seed.txt'),'seed');
 fs.writeFileSync(path.join(root,'docs/06_Operations/Version_Registry.md'),'| v1 | v1 | test |\n| v2 | v2 | test |\n');
 fs.copyFileSync(path.join(project,'scripts/ops/channel-runtime.mjs'),path.join(root,'scripts/ops/channel-runtime.mjs'));
 git(root,'add','.');git(root,'commit','-m','base');git(root,'update-ref','refs/remotes/origin/dev-beta','HEAD');git(root,'update-ref','refs/remotes/origin/main','HEAD');git(root,'tag','v1');git(root,'tag','v2');
 fn(root);
 }finally{fs.rmSync(root,{recursive:true,force:true});Object.assign(process.env,hookEnv);if(originalPython===undefined)delete process.env.M3E_AGENT_ICON_PYTHON;else process.env.M3E_AGENT_ICON_PYTHON=originalPython;}}
function deps(root,c){fs.mkdirSync(path.join(root,c,'node_modules/dotenv'),{recursive:true});fs.writeFileSync(path.join(root,c,'node_modules/dotenv/config.js'),'');}
function installFixture(root,{fail=false}={}) {
 const dir=path.join(root,'beta'),pkg=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));
 if(fail) pkg.scripts.preinstall="node -e \"require('fs').mkdirSync('node_modules/partial',{recursive:true});require('fs').writeFileSync('node_modules/partial/new.txt','incomplete');process.exit(3)\"";
 fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify(pkg));
 fs.writeFileSync(path.join(dir,'package-lock.json'),JSON.stringify({name:pkg.name,version:pkg.version,lockfileVersion:3,requires:true,packages:{'':{name:pkg.name,version:pkg.version,...(fail?{hasInstallScript:true}:{})}}}));
 git(root,'add','beta/package.json','beta/package-lock.json');git(root,'commit','-m','install fixture');git(root,'update-ref','refs/remotes/origin/dev-beta','HEAD');
 deps(root,'beta');fs.writeFileSync(path.join(dir,'node_modules/keep.bin'),Buffer.from([0,255,13,10]));
 return path.join(root,'node_modules/.m3e-beta-backup');
}
test('failed npm ci restores existing dependencies and removes partial install',()=>fixture(root=>{
 const backup=installFixture(root,{fail:true});
 assert.throws(()=>ensureBuild(root,'beta',{install:true}),/npm ci failed; current server has not been stopped/);
 assert.deepEqual(fs.readFileSync(path.join(root,'beta/node_modules/keep.bin')),Buffer.from([0,255,13,10]));
 assert.equal(fs.readFileSync(path.join(root,'beta/node_modules/dotenv/config.js'),'utf8'),'');
 assert.deepEqual(fs.readdirSync(path.join(root,'beta/node_modules')).sort(),['dotenv','keep.bin']);
 assert.equal(fs.existsSync(backup),false);assert.equal(fs.existsSync(path.join(root,'beta/dist/.m3e-build.json')),false);
 assert.doesNotThrow(()=>guardBeta(root));
}));
test('successful npm ci removes backup and leaves Beta build inputs clean',()=>fixture(root=>{
 const backup=installFixture(root);
 ensureBuild(root,'beta',{install:true});
 assert.equal(fs.existsSync(backup),false);assert.equal(fs.existsSync(path.join(root,'beta/node_modules/keep.bin')),false);
 assert.equal(fs.readFileSync(path.join(root,'beta/dist/browser/viewer.js'),'utf8'),'built');
 assert.doesNotThrow(()=>guardBeta(root));assert.equal(git(root,'status','--porcelain','--untracked-files=all'),'');
}));
test('leftover dependency backup blocks installation without deleting either copy',()=>fixture(root=>{
 const backup=installFixture(root);fs.mkdirSync(backup,{recursive:true});fs.writeFileSync(path.join(backup,'old.txt'),'recover me');
 for(const install of [true,false]) {
  assert.throws(()=>ensureBuild(root,'beta',{install}),/Dependency backup remains:.*previous install may have been interrupted/);
  assert.equal(fs.readFileSync(path.join(backup,'old.txt'),'utf8'),'recover me');
  assert.deepEqual(fs.readFileSync(path.join(root,'beta/node_modules/keep.bin')),Buffer.from([0,255,13,10]));
  assert.deepEqual(fs.readdirSync(path.join(root,'beta/node_modules')).sort(),['dotenv','keep.bin']);
  assert.equal(fs.existsSync(path.join(root,'beta/dist')),false);
 }
}));
test('Beta accepts integrated clean source while preserving unrelated documents',()=>fixture(root=>{
 fs.writeFileSync(path.join(root,'notes.md'),'unfinished');assert.equal(guardBeta(root),git(root,'rev-parse','HEAD'));assert.equal(fs.readFileSync(path.join(root,'notes.md'),'utf8'),'unfinished');
}));
test('Beta rejects dirty, untracked, task branch and unpublished source',()=>fixture(root=>{
 fs.writeFileSync(path.join(root,'beta/new.txt'),'new');assert.throws(()=>guardBeta(root),/dirty/);fs.unlinkSync(path.join(root,'beta/new.txt'));
 fs.appendFileSync(path.join(root,'beta/source.txt'),'dirty');assert.throws(()=>guardBeta(root),/dirty/);git(root,'add','.');git(root,'commit','-m','unpublished');assert.throws(()=>guardBeta(root),/match/);
 git(root,'checkout','-b','codex/task');assert.throws(()=>guardBeta(root),/dev-beta/);
}));
test('build stamps source and output; tampered bundle is rebuilt',()=>fixture(root=>{
 deps(root,'beta');ensureBuild(root,'beta');const stamp=JSON.parse(fs.readFileSync(path.join(root,'beta/dist/.m3e-build.json')));assert.equal(stamp.source,git(root,'rev-parse','HEAD'));
 fs.writeFileSync(path.join(root,'beta/dist/browser/viewer.js'),'old preview');ensureBuild(root,'beta');assert.equal(fs.readFileSync(path.join(root,'beta/dist/browser/viewer.js'),'utf8'),'built');
}));
test('failed build never certifies the new version',()=>fixture(root=>{
 deps(root,'beta');fs.writeFileSync(path.join(root,'beta/package.json'),JSON.stringify({name:'fixture',version:'1.0.0',scripts:{build:'node -e "process.exit(3)"'}}));git(root,'add','.');git(root,'commit','-m','failure fixture');git(root,'update-ref','refs/remotes/origin/dev-beta','HEAD');
 assert.throws(()=>ensureBuild(root,'beta'),/failed/);assert.equal(fs.existsSync(path.join(root,'beta/dist/.m3e-build.json')),false);
}));
test('Final selection requires registered published tag and supported schema',()=>fixture(root=>{
 assert.equal(releaseInfo(root,'v1').dataSchema,'v1');assert.throws(()=>releaseInfo(root,'dev-beta'),/published/);assert.throws(()=>releaseInfo(root,'v2'),/schema/);
 fs.writeFileSync(path.join(root,'beta/change'),'change');git(root,'add','.');git(root,'commit','-m','unreleased');git(root,'tag','v3');assert.throws(()=>releaseInfo(root,'v3'),/not published/);
}));
test('Final manifest checks immutable release source',()=>fixture(root=>{
 const files=['final/source.txt'];fs.writeFileSync(path.join(root,'.m3e-release.json'),JSON.stringify({schemaVersion:1,channel:'final',files,sourceHash:fingerprint(root,files),commit:'fixed'}));assert.equal(guardFinal(root),'fixed');
 fs.appendFileSync(path.join(root,'final/source.txt'),'mutation');assert.throws(()=>guardFinal(root),/changed/);
}));
test('Final legacy checkout refuses dirty product source',()=>fixture(root=>{
 assert.ok(guardFinal(root));fs.writeFileSync(path.join(root,'final/new.txt'),'new');assert.throws(()=>guardFinal(root),/dirty/);
}));
test('missing release selection has no filesystem or network effects',()=>fixture(root=>{
 const before=git(root,'status','--porcelain');assert.throws(()=>installFinal(root,undefined),/--release/);assert.equal(git(root,'status','--porcelain'),before);
}));
test('retired promotion commands and daily --with-final leave checkout unchanged',()=>fixture(root=>{
 const before=git(root,'status','--porcelain');for(const s of ['migrate-from-beta','sync-beta-to-final']){const r=spawnSync('bash',[path.join(project,`scripts/final/${s}.sh`)],{cwd:root,encoding:'utf8'});assert.equal(r.status,2);}
 const r=spawnSync('bash',[path.join(project,'scripts/ops/daily-sync.sh'),'--with-final'],{cwd:root,encoding:'utf8'});assert.equal(r.status,2);assert.equal(git(root,'status','--porcelain'),before);
}));

test('channel lock excludes concurrent owners and is released on failure',()=>fixture(root=>{
 withChannelLock(root,()=>assert.throws(()=>withChannelLock(root,()=>{}),/busy/));
 assert.throws(()=>withChannelLock(root,()=>{throw Error('fixture failure');}),/fixture failure/);
 assert.doesNotThrow(()=>withChannelLock(root,()=>{}));
}));
test('published Final installs separately and preserves the checkout and workspace',()=>fixture(root=>{
 const generated=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund'],{cwd:path.join(root,'final'),encoding:'utf8',shell:process.platform==='win32'});
 assert.equal(generated.status,0,generated.stderr);
 fs.writeFileSync(path.join(root,'final','old-data.sqlite'),'must not ship');
 git(root,'add','.');git(root,'commit','-m','published fixture');git(root,'tag','-f','v1');git(root,'branch','main');git(root,'remote','add','origin',root);
 const appHome=path.join(root,'personal');fs.mkdirSync(appHome);fs.writeFileSync(path.join(appHome,'data.sqlite'),'personal data');
 const original=process.env.M3E_HOME;process.env.M3E_HOME=appHome;
 try {
  const before=git(root,'rev-parse','HEAD');const product=fs.readFileSync(path.join(root,'final/source.txt'),'utf8');
  const target=installFinal(root,'v1');assert.notEqual(target,root);assert.equal(guardFinal(target),before);assert.equal(fs.existsSync(path.join(target,'final/old-data.sqlite')),false);
  assert.equal(git(root,'rev-parse','HEAD'),before);assert.equal(fs.readFileSync(path.join(root,'final/source.txt'),'utf8'),product);
  assert.equal(fs.readFileSync(path.join(appHome,'data.sqlite'),'utf8'),'personal data');assert.equal(installFinal(root,'v1'),target);
 }finally{if(original===undefined)delete process.env.M3E_HOME;else process.env.M3E_HOME=original;}
}));

function pythonFixture(root,fn) {
 const original={PATH:process.env.PATH,M3E_AGENT_ICON_PYTHON:process.env.M3E_AGENT_ICON_PYTHON};
 const bins=['without-pillow','with-pillow'].map(name=>path.join(root,name));
 for(const [i,bin] of bins.entries()) {
  fs.mkdirSync(bin);fs.writeFileSync(path.join(bin,'python3'),`#!/bin/sh\n[ "$1" = '-c' ] && [ "$2" = 'import PIL' ] || exit 2\nexit ${i===0?1:0}\n`,{mode:0o755});
 }
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'beta/package.json'),'utf8'));
 pkg.scripts.build += ` && node -e "require('fs').writeFileSync('dist/python.txt',process.env.M3E_AGENT_ICON_PYTHON||'')"`;
 fs.writeFileSync(path.join(root,'beta/package.json'),JSON.stringify(pkg));
 git(root,'add','beta/package.json');git(root,'commit','-m','python build fixture');git(root,'update-ref','refs/remotes/origin/dev-beta','HEAD');
 deps(root,'beta');process.env.PATH=[...bins,original.PATH].join(path.delimiter);delete process.env.M3E_AGENT_ICON_PYTHON;
 try{fn(bins);}finally{for(const [key,value] of Object.entries(original)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
}
test('Windows preserves existing Python resolution without PATH probes',()=>{
 assert.equal(agentIconPython({PATH:'/missing'},'win32'),undefined);
 assert.equal(agentIconPython({PATH:'/missing',M3E_AGENT_ICON_PYTHON:'python'},'win32'),'python');
});
test('build selects the first PATH python3 that imports Pillow',{skip:process.platform==='win32'},()=>fixture(root=>pythonFixture(root,bins=>{
 ensureBuild(root,'beta');
 assert.equal(fs.readFileSync(path.join(root,'beta/dist/python.txt'),'utf8'),path.join(bins[1],'python3'));
})));
test('no Pillow stops before build and leaves no build record',{skip:process.platform==='win32'},()=>fixture(root=>pythonFixture(root,bins=>{
 fs.copyFileSync(path.join(bins[0],'python3'),path.join(bins[1],'python3'));
 // Keep npm/node/git available, but exclude real Python interpreters.
 const commands=path.join(root,'commands');fs.mkdirSync(commands);
 for(const name of ['node','npm','git']) {
  const command=spawnSync('/bin/sh',['-c',`command -v ${name}`],{encoding:'utf8'}).stdout.trim();
  fs.symlinkSync(command,path.join(commands,name));
 }
 process.env.PATH=[...bins,commands].join(path.delimiter);
 assert.throws(()=>ensureBuild(root,'beta'),{message:'No python3 with Pillow found on PATH; set M3E_AGENT_ICON_PYTHON to a Python that can import PIL. current server has not been stopped.'});
 assert.equal(fs.existsSync(path.join(root,'beta/dist')),false);
})));
test('explicit icon Python is passed through without probing',{skip:process.platform==='win32'},()=>fixture(root=>pythonFixture(root,bins=>{
 const python=path.join(bins[0],'explicit-python');
 fs.writeFileSync(python,`#!/bin/sh\ntouch '${path.join(root,'probed')}'\nexit 1\n`,{mode:0o755});
 process.env.M3E_AGENT_ICON_PYTHON=python;ensureBuild(root,'beta');
 assert.equal(fs.readFileSync(path.join(root,'beta/dist/python.txt'),'utf8'),python);
 assert.equal(fs.existsSync(path.join(root,'probed')),false);
})));
test('Final builds without probing Python when icon Python is unset',{skip:process.platform==='win32'},()=>fixture(root=>pythonFixture(root,bins=>{
 const probe=path.join(root,'python-probed');
 for(const bin of bins) fs.writeFileSync(path.join(bin,'python3'),`#!/bin/sh\ntouch '${probe}'\nexit 1\n`,{mode:0o755});
 deps(root,'final');
 ensureBuild(root,'final');
 assert.equal(fs.existsSync(probe),false);
 assert.equal(fs.readFileSync(path.join(root,'final/dist/browser/viewer.js'),'utf8'),'built');
 assert.equal(fs.existsSync(path.join(root,'final/dist/.m3e-build.json')),true);
})));
