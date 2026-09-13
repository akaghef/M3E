        `<span class="t">${esc(a.work_disp||'WORKING')}</span></div>`;
    }else if(a.act_state==='question'){
      stind=`<div class="stind question" title="agent is asking — pick an option">`+
        `<span class="led-sq"></span>`+
        `<span class="t">?</span></div>`;
    }else if(a.act_state==='ask'){
      stind=`<div class="stind ask" title="approval requested">`+
        `<span class="led-sq"></span>`+
        `<span class="t">APPROVAL</span></div>`;
    }else if(a.act_state==='wait'&&a.last_disp){
      stind=`<div class="stind wait" title="previous turn took ${esc(a.last_disp)}">`+
        `last ${esc(a.last_disp)}</div>`;
    }
  }
  // Context hairline (running agents with context telemetry only).
  const ctxline=(a.running&&typeof a.ctx_used==='number')
    ? (()=>{ const rem=Math.max(0,Math.min(100,100-a.ctx_used));
        const tier=rem>=50?'hi':rem>=20?'mid':'lo';
        return `<div class="ctxline ctx-${tier}" title="ctx ${rem}% left">`+
          `<i style="width:${rem}%"></i></div>`;})()
    : '';

  let live;
  if(a.live){
    live=`<div class="live" title="${esc(a.live)}"><span>${esc(a.live)}</span></div>`;
  }else{
    live=`<div class="live standby">— STANDBY · no live activity —</div>`;
  }

  const task=a.task
    ?`<div class="kv"><b>ord</b><span>${esc(a.task)}</span></div>`:'';
  let instr='';
  if(a.instruction){
    const im=(a.instruction.importance||'').toLowerCase();
    const ib=(im==='high'||im==='urgent')
      ?` <span class="chip imp">${im}</span>`:'';
    instr=`<div class="kv"><b>rx</b><span>${esc(a.instruction.sender)} ▸ ${esc(a.instruction.subject)}${ib}</span></div>`;
  }

  const sci=scientistOf(a.name);
  const pkey=avatarKeyOf(a.name);
  const port=pkey
    ? `<img class="pimg" src="${portURL(pkey,true)}" alt="" loading="lazy" `+
      `onerror="portraitFallback(this)">`
    : `<div class="pna">${esc(a.name.slice(0,2).toUpperCase())}</div>`;
  const stCls=a.running&&a.act_state?' st-'+a.act_state:'';
  // kill button: finished/gone かつ tmux client が attached していない場合のみ。
  // attached=True は「人間が画面で見ている」サイン。running 判定が /compact 中などに
  // false negative になっても、attached が出ているうちは絶対に kill ボタンを出さない。
  // (2026-05-20 SilverBoltzmann kill → SwiftFaraday 連鎖事故の防止)
  const killBtn=(a.category==='finished'||a.category==='gone') && !a.attached
    ?`<button class="killbtn" onclick="killAgent(event,'${esc(a.name)}')" title="kill (click twice to confirm)">✕ KILL</button>`
    :'';
  // exit button: running エージェントのみ表示（attached は除外しない — 意図的中断）
  const exitBtn=a.running
    ?`<button class="exitbtn" onclick="exitAgent(event,'${esc(a.name)}')" title="graceful exit (/exit)">↩ EXIT</button>`
    :'';
  return `<div class="bay cat-${a.category}${stCls}" style="--i:${i}"
       data-name="${esc(a.name)}"
       onclick="openPanel('${esc(a.name)}')">
    ${stind}<div class="top">
      <div class="port" title="${sci?esc(sci):''}">${port}</div>
      <div class="idcol">
        <div class="idrow">
          ${a.provider==='anthropic'||a.provider==='openai'
            ?`<img class="prov-logo prov-${a.provider} ${led}" src="${assetURL(a.provider)}" alt="${a.provider}" title="${a.provider}">`
            :`<span class="led ${led}"></span>`}
          <span class="nm">${esc(a.name)}</span>
        </div>
        ${a.requested_name
          ? `<div class="subst-note" title="ORRERY Mail registered a different identity than the one requested">↯ asked for ${esc(a.requested_name)}</div>`
          : ''}
        <div class="chips">${chips.join('')}</div>
      </div>
    </div>
    ${ctxline}${live}${task}${instr}
    <div class="foot">
      <div class="foot-left">
        <s>${a.running?'● ONLINE':'○ SHELL'}</s>
        <span class="dim">LAST ${esc(a.last_active_rel)}</span>
        <span class="dim" title="${esc(a.cmd||'—')}">${esc((a.cmd||'—').slice(0,10))}</span>
      </div>
      ${exitBtn}${killBtn}
    </div>
  </div>`;
}

function render(){
  const q=document.getElementById('q').value.toLowerCase().trim();
  const live=historyRange==='live';
  const wrap=document.getElementById('wrap');
  const data=lastData.filter(a=>{
    if(live && !SHOW_DEFAULT.has(a.category)) return false;
    if(q){
      const hay=(a.name+' '+a.task+' '+a.live+' '+
        (a.instruction?a.instruction.subject+' '+a.instruction.sender:'')).toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
  if(!data.length){
    wrap.className='';
    // Say which slice of history came up empty, and offer the next wider one:
    // "biomatter" matching only live agents was read as a search bug (2026-09-11).
    const wider=HISTORY_WIDER[historyRange];
    const scope={live:'AMONG LIVE SESSIONS','7d':'IN THE LAST 7 DAYS','30d':'IN THE LAST 30 DAYS',all:'IN ALL HISTORY'}[historyRange];
    wrap.innerHTML='<div class="state">NO MATCHING SIGNAL<span class="hint">'+scope+
      (wider?' · <a data-history="'+wider+'">'+HISTORY_WIDER_LABEL[wider]+'</a>':'')+'</span></div>';
    return;
  }
  let html='',cur=null,i=0;
  for(const a of data){
    if(a.category!==cur){
      cur=a.category;
      const c=data.filter(x=>x.category===cur).length;
      html+=`<div class="sector" style="--i:${i}">${esc(CATLABEL[cur]||cur)}
        <u>[ ${c} ]</u></div>`; i++;
    }
    html+=bay(a,i++);
  }
  wrap.className=booted?'':'boot';
  wrap.innerHTML=html;
  booted=true;
  // 再レンダリング後にアーミング状態を復元（DOM 置き換えで class が消えるのを防ぐ）
  for(const nm of armingSet){
    const c=wrap.querySelector(`.bay[data-name="${CSS.escape(nm)}"]`);
    if(!c){armingSet.delete(nm);const t=armTimers.get(nm);if(t)clearTimeout(t);armTimers.delete(nm);continue;}
    c.classList.add('arming');
    const b=c.querySelector('.killbtn');
    if(b)b.textContent='confirm';
  }
  for(const nm of exitingSet){
    const c=wrap.querySelector(`.bay[data-name="${CSS.escape(nm)}"]`);
    if(!c){exitingSet.delete(nm);const t=exitTimers.get(nm);if(t)clearTimeout(t);exitTimers.delete(nm);continue;}
    c.classList.add('exit-arming');
    const b=c.querySelector('.exitbtn');