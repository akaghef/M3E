const TM=id=>document.getElementById(id);

/* Open the detail panel first, fill it second.  If preparing the contents
   throws, the panel still opens and the error is reported, instead of the
   click appearing to do nothing at all.
   Deliberately plain getElementById here, not the TM() helper: TM is declared
   further down with `const`, so if the script died before that point the
   safeguard itself would fail for the very reason it exists. */
function openPanel(name){
  try{
    const T0=document.getElementById('term');
    if(T0){T0.classList.add('on');T0.setAttribute('aria-hidden','false');}
  }catch(_){/* nothing left to fall back to */}
  try{
    openPanelInner(name);
  }catch(err){
    try{reportJsError('openPanel',err,
      {msg:`openPanel(${name}): ${err&&err.message}`});}catch(_){}
    const meta=document.getElementById('tm-meta');
    if(meta)meta.textContent='could not render some details (see logs/js-errors.log)';
  }
}
function openPanelInner(name){
  panelName=name;
  const a=(lastData||[]).find(x=>x.name===name)||
          (typeof gmap!=='undefined'&&gmap.get(name))||{};
  // gmap の補完 (network view では role 等が gmap 側だけにある)
  const g=(typeof gmap!=='undefined'&&gmap.get(name))||{};
  const run=!!a.running, rel=a.last_active_rel||a.rel||'';
  const stat=a.retired?'RETIRED':run?'● ONLINE':
    a.category==='finished'?'EXITED':a.present===false?'○ REGISTERED':'○ SHELL';
  const portrait=TM('tm-portrait'),avatar=avatarKeyOf(name);
  portrait.hidden=!avatar;
  portrait.style.display='';
  portrait.dataset.portraitFallback='0';
  portrait.alt=avatar?`${name} portrait`:'';
  if(avatar)portrait.src=portURL(avatar,true);
  else portrait.removeAttribute('src');
  TM('tm-nm').textContent=name;
  const T=TM('term');
  T.classList.toggle('s-run',run);
  TM('tm-meta').textContent=
    stat+(a.model?' · '+a.model:'')+(a.ctx_window?' · '+a.ctx_window:'')
    +(rel?' · last '+rel:'');
  const exitBtn=TM('tm-exit-btn');
  if(exitBtn){exitBtn.style.display=run?'':'none';
    exitBtn.classList.remove('arming');exitBtn.disabled=false;
    exitBtn.textContent='Exit';}
  // gtip 相当のサマリーを tm-summary に描画 (モバイルで hover が効かない救済)
  renderPanelSummary(name, a, g);
  renderAnnotEditor(name, (g&&g.annot)||a.annot||null);
  renderHistory24h(name);
  T.classList.add('on');T.setAttribute('aria-hidden','false');
  setTab('hist');
}

// Generic, text-only role presets for OSS.
const ANNOT_PRESETS=[
  'orchestrator','researcher','reviewer','builder'
];

// ROLE ASSIGN エディタを agent パネルに描画。UI から役割ラベルを付与/変更/削除。
function renderAnnotEditor(name,annot){
  const box=TM('tm-annot'); if(!box)return;
  const cur=annot||{};
  const chips=ANNOT_PRESETS.map(role=>{
    const on=cur.role===role?' on':'';
    return `<button class="an-chip${on}" data-r="${esc(role)}">`
      +`${esc(role)}</button>`;}).join('');
  const curTxt=cur.role?esc(cur.role):'<i>unassigned</i>';
  box.innerHTML=
    `<div class="an-head">ROLE ASSIGN<span class="an-cur">${curTxt}</span></div>`
    +`<div class="an-presets">${chips}</div>`
    +`<div class="an-form">`
    +`<input class="an-role" id="an-role" maxlength="40" placeholder="role label …" `
    +`value="${esc(cur.role||'')}">`
    +`<button class="an-set" id="an-set">Set</button>`
    +`<button class="an-clear" id="an-clear">Clear</button></div>`;
  box.querySelectorAll('.an-chip').forEach(b=>b.onclick=()=>{
    TM('an-role').value=b.dataset.r;
    box.querySelectorAll('.an-chip').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); TM('an-role').focus();
  });
  TM('an-set').onclick=()=>saveAnnot(name,false);
  TM('an-clear').onclick=()=>saveAnnot(name,true);
  TM('an-role').addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();saveAnnot(name,false);}});
  box.setAttribute('aria-hidden','false');
}

async function saveAnnot(name,clear){
  const emoji='';
  const role =clear?'':(TM('an-role')?.value ||'').trim();
  try{
    const r=await fetch('/api/annotate',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name,role,emoji})});
    const j=await r.json();
    if(!j.ok){flashAnnot('FAILED'); return;}
    const next=role?{role,emoji,
      group:(typeof gmap!=='undefined'&&gmap.get(name)?.annot?.group)||''}:null;
    const g=(typeof gmap!=='undefined')&&gmap.get(name);
    if(g)g.annot=next;                        // 次 netTick を待たず即反映
    renderAnnotEditor(name,next);
    flashAnnot(clear?'CLEARED':'ASSIGNED');
    if(typeof buildEls==='function')buildEls(); // チップを即再描画
  }catch(e){flashAnnot('ERROR');}
}

function flashAnnot(msg){
  const h=document.querySelector('#tm-annot .an-cur');
  if(!h)return;
  const prev=h.innerHTML;
  h.textContent=msg; h.classList.add('flash');
  setTimeout(()=>{h.classList.remove('flash');
    // 直近の current 表示へ戻す（saveAnnot 側で再描画済なら触らない）
    if(h.textContent===msg)h.innerHTML=prev;},1400);
}

function renderPanelSummary(name, a, g){
  const box=TM('tm-summary');
  if(!box)return;
  const task=a.task||g.task;
  const live=a.live||g.live;
  const role=g.role||a.role;
  const actState=a.act_state||g.actState||g.act_state;
  const ctxUsed=(typeof a.ctx_used==='number')?a.ctx_used
    :(typeof g.ctxUsed==='number'?g.ctxUsed:null);
  const ctxWin=a.ctx_window||g.ctxWindow||g.ctx_window;
  const workDisp=a.work_disp||g.workDisp||g.work_disp;
  const lastDisp=a.last_disp||g.lastDisp||g.last_disp;
  const deliv=+(a.deliv||g.deliv||0);
  const rows=[];
  const ROLE={parent:'parent (delegator)',child:'child (delegated)',
    both:'both',none:'none'};
  if(role) rows.push(`<div class="ts-row"><b>role</b><span>${ROLE[role]||'—'}</span></div>`);
  if(typeof ctxUsed==='number'){
    const hpv=100-ctxUsed,
      tier=hpv>=50?'hi':hpv>=20?'mid':'lo',
      win=ctxWin?` / ${esc(ctxWin)}`:'';
    rows.push(`<div class="ts-row"><b>ctx</b><span>`+
      `<span class="ts-gauge ts-gauge-${tier}">`+
      `<i style="width:${hpv}%"></i></span>`+
      `${hpv}% left <span class="ts-empty">(${ctxUsed}% used${win})</span></span></div>`);
    const STL={work:'⚙ working',wait:'Zz waiting',ask:'! approval',question:'? question'};
    const tm=actState==='work'&&workDisp
      ? ` <span class="ts-empty">· ${esc(workDisp)}</span>`
      : (actState!=='work'&&lastDisp
        ? ` <span class="ts-empty">· last ${esc(lastDisp)}</span>`:'');
    if(actState) rows.push(`<div class="ts-row"><b>state</b><span>${STL[actState]||'—'}${tm}</span></div>`);
  }
  const taskHtml=task?esc(task):'<span class="ts-empty">(no task recorded)</span>';
  rows.push(`<div class="ts-row"><b>task</b><span>${taskHtml}</span></div>`);
  if(live) rows.push(`<div class="ts-row"><b>live</b><span class="ts-live">${esc(live)}</span></div>`);
  if(deliv>0) rows.push(`<div class="ts-row"><b>out</b><span>¶ ${deliv} logs</span></div>`);
  box.innerHTML=rows.join('');
  box.setAttribute('aria-hidden', rows.length?'false':'true');
}
// ── HISTORY (Task E + Task G+) ─────────────────────────────────
//   detail panel の常時可視タイムライン。/api/agent-history を 1 回叩いて
//   SVG を組む。tooltip は frame 内 absolute。panel 開閉ごとに再 fetch
//   （server 側で 60s cache 済）。
//   Task G+: window は events の実 range に auto-fit。タイトル / 軸も動的。
const SP_W=720, SP_H=64;
const SP_PAD={l:6,r:6,t:8,b:8};
// 秒数 → "6.2h" / "2.5d" / "12w" のような短表記
function fmtSpan(sec){
  if(sec<=0)return '0';
  if(sec<60) return sec.toFixed(0)+'s';
  if(sec<3600) return (sec/60).toFixed(sec<600?1:0)+'m';
  if(sec<86400) return (sec/3600).toFixed(sec<3600*10?1:0)+'h';
  const days=sec/86400;
  if(days<180) return days.toFixed(days<10?1:0)+'d';
  return (days/7).toFixed(0)+'w';
}
async function renderHistory24h(name){
  const wrap=TM('tm-spark'); if(!wrap)return;
  const svg=TM('sp-svg'); const tot=TM('sp-tot'); const tip=TM('sp-tip');
  const ttl=document.getElementById('sp-ttl');
  const axis=document.getElementById('sp-axis');
  wrap.setAttribute('aria-hidden','false');
  // 即座にフレームだけ描いておく（fetch 中の空白を避ける）
  drawSparkSkeleton(svg);
  tot.textContent='LOADING…';
  if(tip)tip.setAttribute('aria-hidden','true');
  if(ttl) ttl.textContent='HISTORY';
  if(axis) axis.innerHTML='';
  let j=null;
  try{
    // Task G+: hours 省略 → server が event range で auto-fit
    const r=await fetch('/api/agent-history?name='+encodeURIComponent(name));
    j=await r.json();
  }catch(e){tot.textContent='FETCH FAILED';return;}
  if(panelName!==name)return;            // 切替後の応答は破棄
  if(!j||!j.ok){
    tot.textContent=(j&&j.error||'no data').toUpperCase();
    drawSparkEmpty(svg, (j&&j.error)||'no agent');
    return;
  }
  const events=j.events||[];
  const truncated=(j.total_raw||events.length)>events.length;
  tot.textContent=events.length
    ? events.length+' events'+(truncated?' (sampled from '+j.total_raw+')':'')
    : 'no activity';
  // ── 動的タイトル / 軸 ───────────────────────────────────
  const span=Math.max(1,(j.now_ts||0)-(j.since_ts||0));
  if(ttl) ttl.textContent='HISTORY ' + fmtSpan(span).toUpperCase();
  if(axis){
    // 5 等分の刻みを生成。左端 = -span、右端 = "now"。
    // 軸はイベント分布視覚化なので、now 表記は最新 event = range.end_ts に固定
    const labels=[];
    for(let i=0;i<5;i++){
      const t=(4-i)/4;     // 1.0 (=-span) → 0.0 (=now)
      const back=span*t;
      if(i===4) labels.push('now');
      else labels.push('-'+fmtSpan(back));
    }
    axis.innerHTML=labels.map(l=>`<span>${l}</span>`).join('');
  }
  drawSparkline(svg, j, tip, wrap);
}

function drawSparkSkeleton(svg){
  // grid / midlines のみ、event は無し
  const lines=[];
  // 6 hour 区切りで縦 grid
  for(let i=0;i<=4;i++){
    const x=SP_PAD.l + (SP_W-SP_PAD.l-SP_PAD.r)*(i/4);
    lines.push(`<line class="grid" x1="${x}" x2="${x}" `+
      `y1="${SP_PAD.t}" y2="${SP_H-SP_PAD.b}"/>`);
  }
  const yMid=SP_H/2;
  lines.push(`<line class="mid" x1="${SP_PAD.l}" x2="${SP_W-SP_PAD.r}" `+
    `y1="${yMid}" y2="${yMid}"/>`);
  lines.push(`<line class="base" x1="${SP_PAD.l}" x2="${SP_W-SP_PAD.r}" `+
    `y1="${SP_H-SP_PAD.b}" y2="${SP_H-SP_PAD.b}"/>`);
  // now line (右端)
  lines.push(`<line class="nowline" x1="${SP_W-SP_PAD.r}" `+
    `x2="${SP_W-SP_PAD.r}" y1="${SP_PAD.t-2}" y2="${SP_H-SP_PAD.b+2}"/>`);
  svg.innerHTML=lines.join('');
}

function drawSparkEmpty(svg, label){
  drawSparkSkeleton(svg);
  const t=document.createElementNS('http://www.w3.org/2000/svg','text');
  t.setAttribute('class','hush');
  t.setAttribute('x', SP_W/2);
  t.setAttribute('y', SP_H/2 + 3);
  t.setAttribute('text-anchor','middle');
  t.textContent=(label||'').toUpperCase().slice(0,40);
  svg.appendChild(t);
}

function drawSparkline(svg, j, tip, wrap){
  const since=j.since_ts, now=j.now_ts;
  const span=Math.max(1, now-since);
  const innerW=SP_W-SP_PAD.l-SP_PAD.r;
  const yMid=SP_H/2;
  // skeleton 再描画
  drawSparkSkeleton(svg);
  if(!j.events.length){
    drawSparkEmpty(svg,'silence — no events in window');
    return;
  }
  // event 種ごとに y を分ける（mail=中央帯, spawn=上, exit/retire=下）
  // sent と recv は同じ中央帯だが上下に分けて読みやすく
  const yFor=(k)=>{
    if(k==='spawn')return SP_PAD.t + 4;
    if(k==='retire'||k==='exit')return SP_H-SP_PAD.b - 4;
    if(k==='mail_sent')return yMid - 6;
    return yMid + 6;                          // mail_recv
  };
  const nodes=[];
  for(const ev of j.events){
    const x=SP_PAD.l + innerW * Math.max(0, Math.min(1,(ev.ts-since)/span));
    const y=yFor(ev.kind);
    let shape;
    if(ev.kind==='spawn'){
      // amber dot, slightly bigger
      shape=`<circle class="ev spawn" cx="${x.toFixed(2)}" cy="${y}" r="3.4"/>`;
    } else if(ev.kind==='retire'||ev.kind==='exit'){
      // alert X marker
      shape=`<g class="ev ${ev.kind}" transform="translate(${x.toFixed(2)},${y})">`
        +`<line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5"/>`
        +`<line x1="-3.5" y1="3.5" x2="3.5" y2="-3.5"/></g>`;
    } else {
      // mail: tick line, sent above center, recv below
      const h=ev.kind==='mail_sent'?8:7;
      shape=`<line class="ev ${ev.kind}" x1="${x.toFixed(2)}" `+
        `x2="${x.toFixed(2)}" y1="${y-h/2}" y2="${y+h/2}" `+
        `stroke-width="1.4" stroke-linecap="round"/>`;
    }
    nodes.push(shape);
  }
  // wider hit area: overlay invisible rects for hover/click
  // 既存 shape をそのまま入れ、別 layer で hit rect を生成
  const hits=j.events.map((ev,i)=>{
    const x=SP_PAD.l + innerW * Math.max(0, Math.min(1,(ev.ts-since)/span));
    return `<rect class="ev-hit" data-i="${i}" x="${(x-4).toFixed(2)}" `+
      `y="${SP_PAD.t-2}" width="8" height="${SP_H-SP_PAD.t-SP_PAD.b+4}" `+
      `fill="transparent" pointer-events="all"/>`;
  }).join('');
  // re-add nowline on top
  const nowLine=`<line class="nowline" x1="${SP_W-SP_PAD.r}" `+
    `x2="${SP_W-SP_PAD.r}" y1="${SP_PAD.t-2}" y2="${SP_H-SP_PAD.b+2}"/>`;
  svg.insertAdjacentHTML('beforeend', nodes.join('')+nowLine+hits);
  // hover wiring
  const evs=j.events;
  const hover=(idx)=>{
    if(idx==null||idx<0||idx>=evs.length){
      if(tip)tip.setAttribute('aria-hidden','true');
      svg.querySelectorAll('.ev.act').forEach(n=>n.classList.remove('act'));
      return;
    }
    const ev=evs[idx];
    // event shape を highlight（hit rect は別 layer なので index 2倍管理は避け
    // クエリで該当 x の event を探すのは過剰なので、ループで dataset 付与する）
    svg.querySelectorAll('.ev').forEach((n,i)=>{
      // hit rect を除いた event shape のみ index を打つ
      if(i<evs.length)n.classList.toggle('act', i===idx);
    });
    showSparkTip(tip, wrap, svg, ev, idx, since, now);
  };
  svg.querySelectorAll('.ev-hit').forEach(h=>{
    h.addEventListener('mouseenter',()=>hover(+h.dataset.i));
    h.addEventListener('mouseleave',()=>hover(null));
    h.addEventListener('click',()=>hover(+h.dataset.i));
  });
  // frame 全体 mouseleave で tip を仕舞う（svg を外れたとき）
  wrap.querySelector('.sp-frame').addEventListener('mouseleave',
    ()=>{if(tip)tip.setAttribute('aria-hidden','true');
         svg.querySelectorAll('.ev.act').forEach(n=>n.classList.remove('act'));});
}

function showSparkTip(tip, wrap, svg, ev, idx, since, now){
  if(!tip)return;
  // 時刻フォーマット
  const d=new Date(ev.ts*1000);
  const hh=String(d.getHours()).padStart(2,'0');
  const mm=String(d.getMinutes()).padStart(2,'0');
  const ago=Math.round((now-ev.ts)/60);
  const agoTxt=ago<60?`${ago}m ago`
    :`${Math.floor(ago/60)}h${ago%60?(' '+(ago%60)+'m'):''} ago`;
  const KLAB={mail_sent:'MAIL SENT',mail_recv:'MAIL RECV',
    spawn:'SPAWN',retire:'RETIRE',exit:'EXIT'};
  const klab=KLAB[ev.kind]||ev.kind.toUpperCase();
  // overlay 方式: kind を tip 自体のクラスに、3 行 grid (kind+time / who / subj)
  tip.className='sp-tip '+ev.kind;
  const refTxt=ev.ref?esc(ev.ref):'';
  const subj=ev.subject?esc(ev.subject):'';
  tip.innerHTML=
    `<div class="tp-k">${klab}</div>`
    +`<div class="tp-t">${hh}:${mm} · ${agoTxt}</div>`
    +(refTxt?`<div class="tp-r">${refTxt}</div>`:'')
    +(subj?`<div class="tp-s">${subj}</div>`:'');
  tip.setAttribute('aria-hidden','false');
}

function closeTerm(){
  panelName=null;
  // sparkline 後始末: tooltip を確実に閉じる（別 panel で残ると邪魔）
  const tip=TM('sp-tip'); if(tip)tip.setAttribute('aria-hidden','true');
  const sp=TM('tm-spark'); if(sp)sp.setAttribute('aria-hidden','true');
  const T=TM('term');T.classList.remove('on');
  T.setAttribute('aria-hidden','true');
}
function setTab(tab){
  panelTab=tab;
  TM('term').dataset.tab=tab;
  [...TM('tm-tabs').children].forEach(b=>
    b.classList.toggle('on',b.dataset.tab===tab));
  if(tab==='hist') loadHistory();
  else if(tab==='deliv') loadDeliverables();
}
// 成果物: LOG_*.md の frontmatter agent: が一致するノートを表示する。
// vault 内の結果だけ obsidian:// link にし、通常の project logs も読める形を保つ。
async function loadDeliverables(){
  if(!panelName)return;
  const box=TM('tm-deliv');
  box.innerHTML='<div class="hempty">LOADING…</div>';
  let items=[];
  let vault='';
  try{
    const r=await fetch('/api/deliverables?agent='+
      encodeURIComponent(panelName));
    const j=await r.json();
    items=j.items||[];
    vault=j.vault||'';
  }catch(e){
    box.innerHTML='<div class="hempty">fetch failed</div>';return;}
  if(panelTab!=='deliv')return;            // 切替済みなら破棄
  if(!items.length){
    box.innerHTML='<div class="hempty">no output logs</div>';return;}
  box.innerHTML=items.map(it=>{
    const itemVault=Object.prototype.hasOwnProperty.call(it,'vault')?
      it.vault:vault;
    const d=it.mtime?new Date(it.mtime*1000)
      .toLocaleDateString('en-US',{month:'2-digit',day:'2-digit'}):'';
    const body=`<span class="dv-t">${esc(it.title)}</span>`+
      `<span class="dv-d">${d}</span>`;
    if(!itemVault)
      return `<div class="dv-item" title="${esc(it.rel||'')}">${body}</div>`;
    const file=(it.rel||'').replace(/\.md$/,'');
    const url='obsidian://open?vault='+encodeURIComponent(itemVault)+
      '&file='+encodeURIComponent(file);
    return `<a href="${url}" title="${esc(it.rel||'')}">${body}</a>`;
  }).join('');
}
async function loadHistory(){
  if(!panelName)return;
  const box=TM('tm-hist');
  box.innerHTML='<div class="hempty">LOADING…</div>';
  try{
    const r=await fetch(
      `/api/history?session=${encodeURIComponent(panelName)}`);
    const j=await r.json();
    if(!j.ok){
      box.innerHTML=`<div class="hempty">${esc(j.error||'no history')}</div>`;
      TM('tm-stat').textContent='— no transcript';return;
    }
    const P=[];
    if(j.total>j.shown)
      P.push(`<div class="hnote">${j.total-j.shown} older hidden · `+
        `last ${j.shown} · ${esc(j.file)}</div>`);
    for(const e of j.events){
      const t=e.ts?new Date(e.ts).toLocaleTimeString('en-US'):'';
      if(e.kind==='tool_use'){
        const sp=e.text.indexOf('  ');
        const nm=sp>0?e.text.slice(0,sp):e.text;
        const arg=sp>0?e.text.slice(sp+2):'';
        P.push(`<div class="msg assistant"><div class="who">TOOL`+
          ` <time>${t}</time></div><div class="bub tool">`+
          `<span class="tk">${esc(nm)}</span>${esc(arg)}</div></div>`);
      }else if(e.kind==='tool_result'){
        P.push(`<div class="msg user"><div class="who">RESULT`+
          ` <time>${t}</time></div>`+
          `<div class="bub tool res">${esc(e.text)}</div></div>`);
      }else if(e.kind==='thinking'){
        P.push(`<div class="msg assistant"><div class="who">THINKING`+
          ` <time>${t}</time></div>`+
          `<div class="bub think">${esc(e.text)}</div></div>`);
      }else{
        const u=e.role==='user';
        P.push(`<div class="msg ${u?'user':'assistant'}">`+
          `<div class="who">${u?'USER':'ASSISTANT'}`+
          ` <time>${t}</time></div>`+
          `<div class="bub">${esc(e.text)}</div></div>`);
      }
    }
    box.innerHTML=P.join('')||'<div class="hempty">(history empty)</div>';
    box.scrollTop=box.scrollHeight;
    TM('tm-stat').textContent=
      `transcript ${j.shown}/${j.total} · ${esc(j.file)}`;
  }catch(e){ box.innerHTML='<div class="hempty">comm failed</div>'; }
}

TM('tm-x').addEventListener('click',closeTerm);
TM('term').addEventListener('click',e=>{if(e.target.id==='term')closeTerm();});