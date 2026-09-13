async function startReplay(names){
  if(RP.active) return;
  if(view!=='net') return;
  const bar=_rb('replayBar');
  if(!bar)return;
  RP.names=names.slice();
  _rb('rbAgents').textContent=names.length+' agents';
  // Task H: time-travel mode (toggle で OFF にできる)。localStorage 保存。
  const ttPref=localStorage.getItem('agentdash.tt');
  RP.timeTravel = ttPref===null ? true : (ttPref==='1');
  // fetch (hours 省略で event range に auto-fit, time-travel 中は pane states も)
  let j=null;
  try{
    const qs=['names='+encodeURIComponent(names.join(','))];
    if(RP.timeTravel) qs.push('include_pane_states=1');
    const r=await fetch('/api/agent-history?'+qs.join('&'));
    j=await r.json();
  }catch(e){
    toast('▸ REPLAY','fetch failed',true);
    return;
  }
  if(!j||!j.ok){
    toast('▸ REPLAY',(j&&j.error)||'no data',true);
    return;
  }
  // pause live mail polling
  mailPulseStop();
  // clear live queue so replay コメットだけが流れる
  mailQueue.length=0;
  RP.events=(j.events||[]).slice();
  RP.events.sort((a,b)=>a.ts-b.ts);
  // Task G+: range が返る場合はそちら優先、無ければ since_ts/now_ts
  const rng=j.range||{start_ts:j.since_ts,end_ts:j.now_ts};
  RP.sinceTs=rng.start_ts; RP.nowTs=rng.end_ts;
  RP.virtTs=RP.sinceTs;
  RP.nextIdx=0; RP.paused=true; RP.lastFrameMs=0;
  RP.active=true;
  RP.selSet=new Set(names);
  // Task G++ (1624): replay 開始時は filter OFF を default に揃える
  RP.filterGroupOnly=false;
  window._replayMode=true;
  document.body.classList.add('replay-on');
  // Task H v2: initial state を gmap snapshot → 初期 alive のみで再構築
  const init=j.initial_state||{ts:RP.sinceTs, alive_agents:[]};
  RP.initialAlive=new Set(init.alive_agents||[]);
  // alive 候補が 0 件なら最初の events から「最古 ts の agents」を seed として補う
  if(RP.initialAlive.size===0 && RP.events.length){
    // 最初の event の agent を seed として 1 体追加 (空 canvas を避ける)
    const first=RP.events[0];
    const seed=first.sender||first.agent;
    if(seed) RP.initialAlive.add(seed);
  }
  RP.askActive=new Set();
  RP.pendingFadeIn=new Set();
  RP.pendingEdgeFadeIn=new Set();
  RP.dirty=false;
  RP.edgeCountChanged=false;
  if(RP.timeTravel){
    document.body.classList.add('tt-on');
    // 現 graph の完全 snapshot (stopReplay で復元)。Map / Array をディープコピー。
    RP.savedGmap=new Map();
    for(const [k,v] of gmap){
      // shallow copy: meta は struct なので primitive のコピーで OK
      RP.savedGmap.set(k, {...v});
    }
    RP.savedGedges=gedges.map(e=>({...e}));
    RP.savedGspawn=gspawn.map(e=>({...e}));
    // gmap を初期状態へ reset (initial_alive のみ、座標は既存値を維持)
    const keep=new Map();
    for(const name of RP.initialAlive){
      const meta=RP.savedGmap.get(name);
      if(meta){
        keep.set(name, {...meta, act:0, deg:0, vx:0, vy:0});
      } else {
        // initial_alive に居るが gmap に居ない → fallback で seed
        const {w,h}=netDims();
        keep.set(name, {
          x:w/2+(Math.random()-.5)*120, y:h/2+(Math.random()-.5)*120,
          vx:0, vy:0, fixed:false, deg:0, act:0,
          model:'', running:false, present:false, retired:false,
          rel:'—', task:'', live:'', state:'', sig:0, deliv:0,
          ctxUsed:null, actState:'', ctxWindow:'',
          workDisp:'', workSecs:0, lastDisp:'', annot:null, role:'none',
        });
      }
    }
    gmap.clear();
    for(const [k,v] of keep) gmap.set(k,v);
    gedges.length=0;
    gspawn.length=0;
    buildEls();
    simHot=Math.max(simHot, 120);
    runSim();
  } else {
    document.body.classList.remove('tt-on');
  }
  _rbSyncTimeTravelBtn();
  _rbMarkEdges();
  _rbBuildSpeedTicks();
  _rbSetSpeed(_rbPickDefaultSpeed(RP.nowTs - RP.sinceTs));
  _rbBuildHoldTicks();
  { const hp=parseInt(localStorage.getItem('agentdash.holdMs')||'',10);
    _rbSetHold(Number.isFinite(hp)?hp:6000); }
  _rbRebuildAxis();
  _rbBuildMarkers();
  _rbSetFilter(false);
  _rbSetPlay(false);
  bar.setAttribute('aria-hidden','false');
  _rbRender();
  updateSelBar();
  const ttLab=RP.timeTravel?' · TIME-TRAVEL':'';
  toast('▸ REPLAY',j.events.length+' events · '+names.length+' agents'+ttLab);
  // 自動 play
  _rbPlay();
}
function _rbSyncTimeTravelBtn(){
  const btn=_rb('rbTimeTravel'); if(!btn) return;
  btn.setAttribute('aria-checked', RP.timeTravel?'true':'false');
}
function stopReplay(){
  if(!RP.active)return;
  RP.active=false;
  RP.paused=true;
  if(RP.rafId){ cancelAnimationFrame(RP.rafId); RP.rafId=0; }
  const bar=_rb('replayBar');
  if(bar) bar.setAttribute('aria-hidden','true');
  document.body.classList.remove('replay-on','tt-on');
  _rbUnmarkEdges();
  // Task H v2: gmap / gedges / gspawn を snapshot から完全復元
  if(RP.savedGmap.size){
    gmap.clear();
    for(const [k,v] of RP.savedGmap) gmap.set(k, {...v});
    gedges.length=0;
    for(const e of RP.savedGedges) gedges.push({...e});
    gspawn.length=0;
    for(const e of RP.savedGspawn) gspawn.push({...e});
    buildEls();
    simHot=Math.max(simHot, 80);
    runSim();
  }
  RP.savedGmap=new Map();
  RP.savedGedges=[];
  RP.savedGspawn=[];
  RP.initialAlive=new Set();
  RP.askActive=new Set();
  RP.pendingFadeIn=new Set();
  RP.pendingEdgeFadeIn=new Set();
  RP.dirty=false;
  RP.edgeCountChanged=false;
  document.querySelectorAll('.ask-replay-glyph').forEach(el=>el.remove());
  if(gEls.node){
    for(const [, o] of gEls.node){
      if(!o.grp) continue;
      o.grp.classList.remove('replay-ask','replay-alert','replay-retired',
                              'node-spawn-fadein','tt-spawning');
    }
  }
  const mw=_rb('rbMarkers'); if(mw) mw.innerHTML='';
  RP.markerEls.length=0;
  _rbHideMarkerTip();
  window._replayMode=false;
  mailQueue.length=0;
  if(view==='net') mailPulseStart();
  updateSelBar();
}