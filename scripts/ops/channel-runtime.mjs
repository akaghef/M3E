#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export function git(root,...args) { return execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(); }
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const read = p => JSON.parse(fs.readFileSync(p,'utf8'));
export function withChannelLock(root,fn) {
  let base;
  if(fs.existsSync(path.join(root,'.m3e-release.json'))) base=root;
  else base=path.resolve(root,git(root,'rev-parse','--git-common-dir'));
  const lock=path.join(base,'m3e-channel.lock');
  try {fs.mkdirSync(lock);} catch(e) {if(e.code==='EEXIST') throw Error(`Channel update is busy: ${lock}. Do not remove another owner's lock.`);throw e;}
  fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({pid:process.pid,host:os.hostname(),startedAt:new Date().toISOString()}));
  try{return fn();}finally{fs.rmSync(lock,{recursive:true,force:true});}
}
export function guardBeta(root,{requireRemoteMatch=true}={}) {
  if (git(root,'branch','--show-current') !== 'dev-beta') throw Error('Normal Beta requires dev-beta. Use an isolated preview port/workspace for task branches.');
  if (requireRemoteMatch && git(root,'rev-parse','HEAD') !== git(root,'rev-parse','refs/remotes/origin/dev-beta')) throw Error('Normal Beta requires HEAD to match origin/dev-beta. Integrate and push first.');
  const inputs=['beta','scripts/beta','scripts/ops/channel-runtime.mjs'];
  if (git(root,'status','--porcelain','--untracked-files=all','--',...inputs)) throw Error('Beta build inputs are dirty; preserve and integrate them before delivery.');
  return git(root,'rev-parse','HEAD');
}
export function sourceFiles(root,channel) {
  return git(root,'ls-files','-z','--',channel).split('\0').filter(Boolean);
}
export function fingerprint(root,files) {
  return hash(files.slice().sort().map(f=>`${f}\0${hash(fs.readFileSync(path.join(root,f)))}`).join('\n'));
}
export function guardFinal(root) {
  const manifest=path.join(root,'.m3e-release.json');
  if(fs.existsSync(manifest)) {
    const m=read(manifest);
    if(m.schemaVersion!==1 || m.channel!=='final' || !Array.isArray(m.files) || m.files.some(f=>!f.startsWith('final/') || f.split('/').includes('..'))) throw Error('Invalid Final release manifest');
    if(fingerprint(root,m.files)!==m.sourceHash) throw Error('Final release source changed; reinstall the selected published release.');
    return m.commit;
  }
  // Existing checkouts remain usable; this does not certify or promote a release.
  if(git(root,'status','--porcelain','--untracked-files=all','--','final')) throw Error('Final source is dirty; no implicit promotion or overwrite is allowed.');
  return git(root,'rev-parse','HEAD:final');
}
export function ensureBuild(root,channel,{force=false,install=false}={}) {
  const source=channel==='beta'?guardBeta(root):guardFinal(root);
  const modules=path.join(root,channel,'node_modules');
  // Outside channel inputs, under the existing node_modules/ ignore rule.
  const backup=path.join(root,'node_modules',`.m3e-${channel}-backup`);
  if(fs.existsSync(backup)) throw Error(`Dependency backup remains: ${backup}. A previous install may have been interrupted; inspect and recover it before retrying. current server has not been stopped.`);
  const manifest=path.join(root,'.m3e-release.json');
  const files=channel==='final' && fs.existsSync(manifest)?read(manifest).files:sourceFiles(root,channel);
  const inputHash=fingerprint(root,files);
  const stampPath=path.join(root,channel,'dist','.m3e-build.json');
  const bundle=path.join(root,channel,'dist/browser/viewer.js');
  const entry=path.join(root,channel,'dist/node/start_viewer.js');
  let old;try{old=read(stampPath);}catch{}
  const npm=process.platform==='win32'?'npm.cmd':'npm';
  function run(args) {
    const argv=args;
    const result=process.platform==='win32'
      ? spawnSync([npm,...argv].map(a=>`"${a.replaceAll('"','')}"`).join(' '),{cwd:path.join(root,channel),stdio:'inherit',shell:true})
      : spawnSync(npm,argv,{cwd:path.join(root,channel),stdio:'inherit'});
    if(result.status!==0) throw Error(`npm ${args.join(' ')} failed; current server has not been stopped.`);
  }
  if(install || !fs.existsSync(path.join(modules,'dotenv/config.js'))) {
    const saved=fs.existsSync(modules);
    if(saved) {
      fs.mkdirSync(path.dirname(backup),{recursive:true});
      fs.renameSync(modules,backup);
    }
    try {run(['ci']);} catch(e) {
      if(saved) {
        fs.rmSync(modules,{recursive:true,force:true});
        fs.renameSync(backup,modules);
      }
      throw e;
    }
    if(saved) fs.rmSync(backup,{recursive:true,force:true});
  }
  if(force || !old || old.inputHash!==inputHash || !fs.existsSync(bundle) || !fs.existsSync(entry) || old.entryHash!==hash(fs.readFileSync(entry)) || old.bundleHash!==hash(fs.readFileSync(bundle)) || old.node!==process.version) {
    run(['run','build']);
    if((channel==='beta'?guardBeta(root):guardFinal(root))!==source || fingerprint(root,files)!==inputHash) throw Error('Source changed during build; refusing launch.');
    fs.writeFileSync(stampPath,JSON.stringify({channel,source,inputHash,node:process.version,entryHash:hash(fs.readFileSync(entry)),bundleHash:hash(fs.readFileSync(bundle)),builtAt:new Date().toISOString()},null,2)+'\n');
  }
  console.log(`[channel] ${channel} source=${source} root=${root} bundle=${hash(fs.readFileSync(bundle))}`);
}
export function updateBeta(root) {
  guardBeta(root,{requireRemoteMatch:false});
  git(root,'fetch','origin','dev-beta');
  if(spawnSync('git',['merge-base','--is-ancestor','HEAD','origin/dev-beta'],{cwd:root}).status!==0) throw Error('Beta diverged; refusing automatic merge.');
  git(root,'merge','--ff-only','origin/dev-beta');
  ensureBuild(root,'beta',{force:true,install:true});
}
export function home() {
  return process.env.M3E_HOME || (process.platform==='darwin'?path.join(os.homedir(),'Library/Application Support/M3E'):process.platform==='win32'?path.join(process.env.LOCALAPPDATA,'M3E'):path.join(process.env.XDG_DATA_HOME||path.join(os.homedir(),'.local/share'),'M3E'));
}
// Only already published tags reachable from main and listed in the release registry are installable.
export function releaseInfo(root,tag) {
  if(!/^v[0-9][A-Za-z0-9._-]*$/.test(tag||'')) throw Error('Supply a published release tag: --release v...');
  const ref=`refs/tags/${tag}`;
  const commit=git(root,'rev-parse',`${ref}^{commit}`);
  if(spawnSync('git',['merge-base','--is-ancestor',commit,'origin/main'],{cwd:root}).status!==0) throw Error('Release tag is not published on origin/main.');
  const registry=git(root,'show','origin/main:docs/06_Operations/Version_Registry.md');
  const row=registry.split('\n').map(l=>l.split('|').map(x=>x.trim())).find(c=>c[1]===tag);
  if(!row || row[2]!=='v1') throw Error('Release schema is unknown or requires an explicit tested migration. No data has been changed.');
  return {tag,commit,dataSchema:row[2]};
}
export function installFinal(root,tag) {
  // Validate syntax before network or filesystem mutation.
  if(!/^v[0-9][A-Za-z0-9._-]*$/.test(tag||'')) throw Error('Supply --release <published-tag>; Final update never promotes Beta.');
  git(root,'fetch','origin','main');
  git(root,'fetch','origin',`refs/tags/${tag}:refs/tags/${tag}`);
  const info=releaseInfo(root,tag);
  const releases=path.join(home(),'releases');
  fs.mkdirSync(releases,{recursive:true});
  const target=path.join(releases,`${tag}-${info.commit.slice(0,12)}`);
  if(fs.existsSync(target)) {guardFinal(target);return target;}
  const stage=fs.mkdtempSync(path.join(releases,'.prepare-'));
  try {
    const files=git(root,'ls-tree','-rz','--name-only',info.commit,'final').split('\0').filter(Boolean)
      .filter(f=>!/[\\:*?"<>|]/.test(f) && !/\.sqlite(?:$|[-.])|(?:^|\/)\.env(?:$|\.)/.test(f));
    if(!files.includes('final/package.json') || !files.includes('final/package-lock.json')) throw Error('Published release lacks build inputs.');
    const tar=path.join(stage,'source.tar');
    git(root,'archive','--format=tar',`--output=${tar}`,info.commit,...files,'install/assets');
    execFileSync('tar',['-xf',tar,'-C',stage]);fs.unlinkSync(tar);
    // Current checked-in launch policy also supports old published product versions.
    fs.mkdirSync(path.join(stage,'scripts'),{recursive:true});
    fs.cpSync(path.join(root,'scripts/final'),path.join(stage,'scripts/final'),{recursive:true});
    fs.mkdirSync(path.join(stage,'scripts/ops'),{recursive:true});
    fs.copyFileSync(path.join(root,'scripts/ops/channel-runtime.mjs'),path.join(stage,'scripts/ops/channel-runtime.mjs'));
    fs.writeFileSync(path.join(stage,'.m3e-release.json'),JSON.stringify({schemaVersion:1,channel:'final',...info,files,sourceHash:fingerprint(stage,files)},null,2)+'\n');
    ensureBuild(stage,'final',{force:true,install:true});
    fs.renameSync(stage,target);
    return target;
  } catch(e) {fs.rmSync(stage,{recursive:true,force:true});throw e;}
}
function launchFinal(target) {
  const script=path.join(target,'scripts/final',process.platform==='win32'?'launch.bat':'launch.sh');
  const r=spawnSync(process.platform==='win32'?'cmd.exe':'bash',process.platform==='win32'?['/d','/c',script]:[script],{cwd:target,stdio:'inherit',env:{...process.env,M3E_HOME:home()}});
  if(r.status!==0) throw Error('Final launch failed; the previous release directory and workspace are retained.');
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {
  const [command,rootArg,...args]=process.argv.slice(2),root=path.resolve(rootArg||'.');
  if(command==='guard-beta') guardBeta(root);
  else if(command==='build-beta') withChannelLock(root,()=>ensureBuild(root,'beta'));
  else if(command==='update-beta') withChannelLock(root,()=>updateBeta(root));
  else if(command==='build-final') withChannelLock(root,()=>ensureBuild(root,'final'));
  else if(command==='update-final') {
    if(args[0]!=='--release' || args.length!==2) throw Error('Usage: update-and-launch --release <published-tag>');
    const target=withChannelLock(root,()=>installFinal(root,args[1]));console.log(`[release] prepared=${target}; workspace configuration is unchanged`);launchFinal(target);
  } else throw Error('Unknown channel command');
 } catch(e) {console.error(`[channel] ${e.message}`);process.exitCode=1;}
}
