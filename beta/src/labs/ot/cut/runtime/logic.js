function openSpawnModal(){
  // The cockpit owns one spawn modal; an embedded dashboard defers to it.
  if(EMBED_MODE){
    window.parent.postMessage({type:'orrery-spawn'},location.origin);
    return;
  }
  const md=SPM('spawnmd');
  if(!md) return;
  populateParentSelect();
  // Reset the manifest; parent deliberately returns to standalone every time.
  let rememberedDir='';
  try{rememberedDir=localStorage.getItem(SPM_DIR_KEY)||'';}catch(e){}
  restoreSpawnTaskDraft(rememberedDir);
  SPM('spm-task').oninput=()=>{
    spmDraftRestored=false;
    saveSpawnTaskDraft();
  };
  SPM('spm-role').value='';
  SPM('spm-worktree').checked=false;
  SPM('spm-wt-base').classList.remove('on');
  SPM('spm-worktree-base').value='';
  spmBusy=false;spmReady=false;spmSelectedName='';
  spmSelectedProvider='';spmSelectedModel='';spmSelectedEffort='';
  spmProviders=[];spmAdjectives=[];spmSuggestedName='';
  spmSuggestedPrefix='';spmSuggestedScientist='';
  spmIdentitySeq++;spmIdentityState='auto';spmIdentityError='';
  spmDirSeq++;
  spmDirRoot='';
  if(spmDirTimer){clearTimeout(spmDirTimer);spmDirTimer=null;}
  spmNameStatus=new Map();
  SPM('spm-agent-strip').innerHTML=
    '<div class="spm-load">loading scientist roster</div>';
  renderSpawnComposite();
  SPM('spm-shuffle').onclick=shuffleSpawnAdjective;
  SPM('spm-dir-chips').innerHTML='';
  SPM('spm-dir').value=rememberedDir;
  closeSpawnDirOptions();
  restoreSpawnAdvanced();
  SPM('spm-providers').innerHTML='';
  SPM('spm-engine-note').textContent='provider · model';
  SPM('spm-models').innerHTML=
    '<div class="spm-load">loading engine catalog</div>';
  SPM('spm-efforts').innerHTML='';
  SPM('spm-effort-row').hidden=true;
  setSpawnStat('loading launch catalog','');
  SPM('spm-spawn').classList.remove('busy');
  updateSpawnButton();
  md.classList.add('on');
  md.setAttribute('aria-hidden','false');
  const seq=++spmLoadSeq;
  loadSpawnCatalog(seq);
  setTimeout(()=>SPM('spm-task').focus(),120);
}
function closeSpawnModal(){
  if(spmBusy) return;  // 飛行中はクローズ拒否（中断防止）
  const md=SPM('spawnmd');
  if(!md) return;
  spmLoadSeq++;
  spmIdentitySeq++;
  spmDirSeq++;
  if(spmDirTimer){clearTimeout(spmDirTimer);spmDirTimer=null;}
  closeSpawnDirOptions();
  md.classList.remove('on');
  md.setAttribute('aria-hidden','true');
}
function setSpawnStat(msg,cls){
  const s=SPM('spm-stat');
  if(!s) return;
  s.textContent=msg;
  s.className='spm-stat'+(cls?' '+cls:'');
}

// worktree チェックで base rev フィールドを expand
document.addEventListener('change',e=>{
  if(e.target&&e.target.id==='spm-worktree'){
    SPM('spm-wt-base').classList.toggle('on',e.target.checked);
  }
});

// Esc でモーダルを閉じる
addEventListener('keydown',e=>{
  if(e.key==='Escape'&&SPM('spawnmd')&&SPM('spawnmd').classList.contains('on')){
    closeSpawnModal();
  }
});

function buildSpawnPayload(){
  const payload={
    task:SPM('spm-task').value.trim(),
    dir:SPM('spm-dir').value.trim(),
    provider:spmSelectedProvider,
    model:spmSelectedModel,
    role:SPM('spm-role').value.trim(),
    group:SPM('spm-group').value.trim()
  };
  const parent=SPM('spm-parent').value.trim();
  if(parent)payload.parent=parent;
  else payload.standalone=true;
  if(spmSelectedName&&spmSuggestedName&&
     spmIdentityState==='verified'&&
     spmNameStatus.get(spmSelectedName)==='available')
    payload.name=spmSuggestedName;
  if(spmSelectedEffort)payload.effort=spmSelectedEffort;
  if(SPM('spm-worktree').checked){
    payload.worktree=true;
    const base=SPM('spm-worktree-base').value.trim();
    if(base)payload.worktree_base=base;
  }
  return payload;
}

async function submitSpawn(){
  if(spmBusy) return;
  if(!spmReady){setSpawnStat('launch catalog is not ready','err');return;}
  if(spmSelectedName&&spmIdentityState!=='verified'){
    setSpawnStat('identity availability is not verified','err');
    updateSpawnButton();return;
  }
  const payload=buildSpawnPayload();
  if(!payload.task){setSpawnStat('task description is required','err');
    SPM('spm-task').focus();return;}
  if(!payload.dir){setSpawnStat('launch directory is required','err');
    SPM('spm-dir').focus();return;}
  if(!payload.provider){setSpawnStat('provider is required','err');return;}
  if(!payload.model){setSpawnStat('model is required','err');return;}
  const provider=spmProviders.find(item=>item.id===payload.provider);
  if(provider&&provider.efforts.length&&!payload.effort){
    setSpawnStat('effort is required for this provider','err');return;
  }
  spmBusy=true;
  const btn=SPM('spm-spawn');
  btn.disabled=true; btn.classList.add('busy');
  SPM('newbtn').classList.add('busy');
  setSpawnStat('▸ launching… register → launch → tmux','');
  const draftSaved=saveSpawnTaskDraft(payload.dir,SPM('spm-task').value);
  spmDraftDir=payload.dir;
  try{
    try{localStorage.setItem(SPM_DIR_KEY,payload.dir);}catch(e){}
    // async: the server registers the child and starts the launcher, then
    // answers at once; readiness is settled in the background and read back
    // from /api/spawn-status, so the dialog does not sit over the deck for
    // the ten-odd seconds a REPL takes to come up.
    const r=await fetch('/api/spawn',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...payload,async:true})
    });
    const j=await r.json();
    spmBusy=false;
    btn.classList.remove('busy');
    SPM('newbtn').classList.remove('busy');
    if(!j.ok){
      setSpawnStat('✕ '+(j.error||'spawn failed')+
        (draftSaved?' · task draft saved':' · task remains in this form'),'err');
      updateSpawnButton();
      return;
    }
    if(j.pending){
      spmDraftRestored=false;
      const adjusted=j.name_substituted
        ? ' · identity changed from '+(j.requested_name||'?') : '';
      toast(j.name_substituted?'▸ LAUNCHING · NAME CHANGED':'▸ LAUNCHING',
        '> '+(j.child_name||'')+adjusted+' :: registered · waiting for the REPL');
      updateSpawnButton();
      closeSpawnModal();
      watchSpawnLaunch(j.child_name,payload.dir,spawnWatchLimitMs(j));
      return;
    }
    clearSpawnTaskDraft(payload.dir);
    spmDraftRestored=false;
    const adjusted=j.name_substituted
      ? ' · identity changed from '+(j.requested_name||'?') : '';
    setSpawnStat('▸ SPAWNED '+(j.child_name||'')+adjusted+
      (j.worktree?' · worktree exp/'+j.child_name:''),'ok');
    toast(j.name_substituted?'▸ SPAWNED · NAME CHANGED':'▸ SPAWNED',
      '> '+(j.child_name||'')+adjusted+' :: tmux session opening');
    // 1.2s 余韻を見せてから自動クローズ
    setTimeout(()=>{
      updateSpawnButton();
      closeSpawnModal();
    },1200);
    // 次回ポーリングまで待たず即時 tick で新エージェントを拾いに行く
    setTimeout(()=>{ if(view==='deck') tick(); else netTick(); }, 1800);
  }catch(e){
    spmBusy=false;
    btn.classList.remove('busy');
    SPM('newbtn').classList.remove('busy');
    setSpawnStat(draftSaved
      ? 'dashboard server unavailable · task draft saved'
      : 'dashboard server unavailable · keep this page open; task draft could not be saved',
      'err');
    updateSpawnButton();
  }
}