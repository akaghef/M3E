function buildEls(){
  document.getElementById('net').classList.toggle('dense',gmap.size>300);
  [...gsvg.querySelectorAll('.edge,.edge-hit,.edge-count,.node')].forEach(n=>n.remove());
  gEls={node:new Map(),edge:[],badge:[]};
  // kind 別 (to/cc/bcc) かつ方向別 (A→B / B→A) に分かれて来る gedges を
  // pair 単位 (向き非依存) で合計し、各 pair に 1 個だけバッジを出す。
  // /api/edge-messages も双方向集計なので、これで drawer の count と一致する。
  const pairKey=(s,t)=>s<t?s+'|'+t:t+'|'+s;
  const pairTotal=new Map();
  for(const e of gedges){
    const k=pairKey(e.source,e.target);
    pairTotal.set(k,(pairTotal.get(k)||0)+(e.count||0));
  }
  const mk=(e,cls,mid)=>{
    // hit-line: 透明・太め・先に append（z-order で可視 line の下に置く）
    const hit=svgEl('line',{class:'edge-hit'});
    hit.dataset.s=e.source; hit.dataset.t=e.target;
    hit.dataset.kind=cls.includes('spawn')?'spawn':'comm';
    hit.addEventListener('click',edgeClick);
    gsvg.appendChild(hit);
    const attrs={class:cls};
    if(mid)attrs['marker-end']=`url(#${mid})`;   // 通信のみ矢印
    const ln=svgEl('line',attrs);
    if(cls==='edge'){
      const sw=LWMUL*Math.max(1,Math.min(6,1+Math.log2((e.count||1)+1)));
      ln.setAttribute('stroke-width',sw.toFixed(2));
    }
    gsvg.appendChild(ln);
    gEls.edge.push({ln,hit,s:e.source,t:e.target,cls});
  };
  gedges.forEach(e=>mk(e,'edge','mk-c'));        // 通信: シアン+矢印
  gspawn.forEach(e=>mk(e,'edge spawn',null));    // 親子: 破線・矢印なし
  // 通信 edge の中点に件数バッジを 1 pair 1 個だけ出す（向き非依存）
  const badgeSeen=new Set();
  for(const e of gedges){
    const k=pairKey(e.source,e.target);
    if(badgeSeen.has(k))continue;
    badgeSeen.add(k);
    const total=pairTotal.get(k);
    if(!total)continue;
    const tx=svgEl('text',{class:'edge-count'});
    tx.textContent=total;
    gsvg.appendChild(tx);
    gEls.badge.push({tx,s:e.source,t:e.target});
  }
  // 系統(role): 親=spawn.source / 子=spawn.target / 両方=中間
  const PAR=new Set(gspawn.map(s=>s.source));
  const CHI=new Set(gspawn.map(s=>s.target));
  const runGrps=[];   // 稼働中ノードは最後に再appendして前面化（CK P2）
  // 介入待ち (?/!) はさらにその上へ。SVG に z-index は無く描画順=DOM順なので、
  // 後から描かれた隣接ノードの ctx-arc-glow やラベルが人間を呼ぶ合図を覆い隠す
  // 事故が実在した（Swift-Noether の `!` が Quiet-Franklin に塗り潰され、
  // 「昔は出ていたのに消えた」ように見えていた）。レイアウトは force-directed で
  // 毎回変わるため、この事故は再現したりしなかったりして目視検査をすり抜ける。
  const attnGrps=[];
  for(const[name,g]of gmap){
    g.role=PAR.has(name)&&CHI.has(name)?'both':
      PAR.has(name)?'parent':CHI.has(name)?'child':'none';
    // 状態はサーバー(live())が確定: run / finished(husk) / gone / retired
    // （旧: present を一律 idle に潰していた＝非active が沈まない CK P1）
    const st=g.retired?'retired'
      :(g.state||(g.running?'run':g.present?'finished':'gone'));
    const selCls=selectedSet.has(name)?' selnode':'';
    const cls=`node ${st} sp-${g.role}${selCls}`;
    const grp=svgEl('g',{class:cls});
    grp.appendChild(svgEl('circle',{class:'node-halo',r:NR+11}));
    grp.appendChild(svgEl('circle',{class:'ring',r:NR+1}));
    // 稼働状態はメダリオンの明度、working は外周の回転円弧で表現する。
    // CTX arc はデータ表示なので状態に関係なく静止させる。
    if(st==='run'){
      const aw=g.actState||'wait';
      grp.classList.add('act-'+aw);
      runGrps.push(grp);
      if(aw==='ask'||aw==='question')attnGrps.push(grp);
    }
    // CTX fuel = top-origin clockwise arc, capped at 270°. Unknown values
    // intentionally create no arc. Remaining <20% warms from amber to red.
    if(typeof g.ctxUsed==='number'){
      const CTXR=NR+5,C=2*Math.PI*CTXR,maxArc=C*.75;
      const rem=Math.max(0,Math.min(1,(100-g.ctxUsed)/100));
      const gap=C-maxArc;
      const track=svgEl('circle',{class:'ctx-track',r:CTXR});
      track.setAttribute('stroke-dasharray',
        `${maxArc.toFixed(2)} ${gap.toFixed(2)}`);
      grp.appendChild(track);
      const arcClass=rem<.2?' ctx-low':'';
      const arcDash=
        `${(maxArc*rem).toFixed(2)} ${(C-maxArc*rem).toFixed(2)}`;
      const arcGlow=svgEl('circle',{
        class:'ctx-arc-glow'+arcClass,r:CTXR,
        'data-remaining':Math.round(rem*100)});
      arcGlow.setAttribute('stroke-dasharray',arcDash);
      grp.appendChild(arcGlow);
      const arc=svgEl('circle',{
        class:'ctx-arc'+arcClass,r:CTXR,
        'data-remaining':Math.round(rem*100)});
      arc.setAttribute('stroke-dasharray',arcDash);
      grp.appendChild(arc);
    }
    // Working is a separate pathLength-normalized motion ring outside CTX fuel.
    grp.appendChild(svgEl('circle',{
      class:'motion-ring',r:NR+9,pathLength:100}));
    const pkey=avatarKeyOf(name);
    if(pkey){
      const img=svgEl('image',{class:'pimg',href:portURL(pkey,true),
        x:-NR,y:-NR,width:2*NR,height:2*NR,
        'clip-path':'url(#pclip)',
        preserveAspectRatio:'xMidYMid slice'});
      img.addEventListener('error',()=>portraitFallback(img));
      grp.appendChild(img);
      grp.appendChild(svgEl('circle',{class:'portrait-shade',r:NR}));
      grp.appendChild(svgEl('circle',{class:'prole',r:NR,fill:'none'}));
    }else{
      const rad=g.running?8:g.deg>3?7:6;
      grp.appendChild(svgEl('circle',{class:'dot',r:rad}));
    }
    const engineProvider=providerKeyFor(g);
    if(engineProvider){
      const badge=providerBadge(engineProvider,NR*.72,NR*.72,14);
      if(badge){
        badge.insertBefore(svgEl('circle',{
          class:'provider-seat-shadow',cy:1.5,r:7}),badge.firstChild);
        grp.appendChild(badge);
      }
    }
    renderLiveStateBubble(grp,g.actState);
    const tx=svgEl('text',{x:0,y:NR+16,'text-anchor':'middle'});
    tx.textContent=name;
    if(g.requested_name){
      // ORRERY Mail が要求とは別の名前で登録した。エージェント自体は動き続ける
      // ので、言わなければ誰も気づかない（唯一の痕跡が「肖像が出ない」で、
      // それは不具合ではなく地味なノードにしか見えない）。名指しで出す。
      tx.setAttribute('class','nlab-subst');
      const st=svgEl('title');
      st.textContent='requested '+g.requested_name+', registered as '+name;
      grp.appendChild(st);
    }
    grp.appendChild(tx);
    // Role is the only secondary text on the node: quiet mono smallcaps pill.
    const annotLab=g.annot?((g.annot.emoji?g.annot.emoji+' ':'')+(g.annot.role||'')).trim():'';
    const hasAnnot=!!annotLab;
    if(hasAnnot){
      const lab=annotLab;
      const ay=NR+29;
      const at=svgEl('text',{class:'annot-lab',x:0,y:ay,'text-anchor':'middle'});
      at.textContent=lab;
      grp.appendChild(at);
      const tw=at.getComputedTextLength()||(lab.length*6.2);
      const padX=5;
      const ar=svgEl('rect',{class:'annot-pill',
        x:(-tw/2-padX).toFixed(1),y:(ay-9.5).toFixed(1),
        width:(tw+padX*2).toFixed(1),height:12.5,rx:6.2,ry:6.2});
      grp.insertBefore(ar,at);   // pill を text の後ろ（下層）へ
    }
    grp.addEventListener('mouseenter',ev=>{
      if(!drag){focusNode(name);tipShow(name,ev);}});
    grp.addEventListener('mousemove',ev=>{if(!drag)tipMove(ev);});
    grp.addEventListener('mouseleave',()=>{
      if(!drag){clearFocus();tipHide();}});
    grp.addEventListener('pointerdown',ev=>onDown(ev,name));
    gsvg.appendChild(grp);
    gEls.node.set(name,{grp});
  }
  // 稼働中ノードを最後に再append＝最前面（密グラフで埋もれない CK P2）
  runGrps.forEach(el=>gsvg.appendChild(el));
  // 人間を呼ぶ合図は常に最前面。どんな配置でも ?/! が隠れないことを保証する。
  attnGrps.forEach(el=>gsvg.appendChild(el));
  fitAnnotPills();
  reattachMurmurs();   // 再描画で消えた吹き出しを生かす
}

// annot pill 幅を実測で再フィット: buildEls 中は grp 未 attach で幅が測れず、
// 文字推定にフォールバックして枠が文字列からずれる。全 grp を append し終えた
// 後なら測れるのでここで上書きする。
//
// 測るのは getBBox().width であって getComputedTextLength() ではない。後者は
// 字送りの合計で、.annot-lab の letter-spacing:.13em を勘定に入れない実装が
// あり、20 字なら 2 割近く足りない枠が出る（実際にテスターの画面で、文字列
// より内側に囲いが出た）。getBBox は描かれたものそのものを返す。
//
// そして webfont が来る前に測ると、答えは別のフォントについてのものになる。
// 一度きりの計測は「いつ測ったか」を黙って結果に混ぜるので、フォント確定後に
// もう一度あてる。
function fitAnnotPills(){
  const padX=5;
  for(const o of gEls.node.values()){
    const at=o.grp.querySelector('.annot-lab'),pill=o.grp.querySelector('.annot-pill');
    if(!at||!pill)continue;
    let tw=0;
    try{tw=at.getBBox().width;}catch(e){tw=0;}
    if(!(tw>0))tw=at.getComputedTextLength();
    if(tw>0){
      pill.setAttribute('x',(-tw/2-padX).toFixed(1));
      pill.setAttribute('width',(tw+padX*2).toFixed(1));
    }
  }
}
if(document.fonts&&document.fonts.ready){
  document.fonts.ready.then(()=>{try{fitAnnotPills();}catch(e){}});
}

function focusNode(name){
  const nb=new Set([name]);
  for(const e of[...gedges,...gspawn]){
    if(e.source===name)nb.add(e.target);
    if(e.target===name)nb.add(e.source);
  }
  document.getElementById('net').classList.add('focus');
  for(const[nm,o]of gEls.node)o.grp.classList.toggle('hl',nb.has(nm));
  for(const o of gEls.edge)
    o.ln.classList.toggle('hl',o.s===name||o.t===name);
  for(const o of gEls.badge||[])
    o.tx.classList.toggle('hl',o.s===name||o.t===name);
}
function clearFocus(){
  document.getElementById('net').classList.remove('focus');
  for(const o of gEls.edge)o.ln.classList.remove('hl');
  for(const o of gEls.badge||[])o.tx.classList.remove('hl');
}

/* ── edge thread drawer ── */
const edrawer=document.getElementById('edrawer');
let _edCur=null, _edSeq=0;
function edgeClick(ev){
  ev.stopPropagation();
  const hit=ev.currentTarget;
  const a=hit.dataset.s, b=hit.dataset.t;
  if(!a||!b) return;
  openDrawer(a,b);
}
async function openDrawer(a,b){
  _edCur={a,b};
  const seq=++_edSeq;
  // focus the edge visually
  for(const o of gEls.edge){
    o.ln.classList.toggle('hot',(o.s===a&&o.t===b)||(o.s===b&&o.t===a));
  }
  edrawer.querySelector('.ed-a').textContent=a;
  edrawer.querySelector('.ed-b').textContent=b;
  edrawer.querySelector('.ed-cnt').textContent='…';
  document.getElementById('ed-list').innerHTML=
    '<div class="ed-loading">▸ loading thread …</div>';
  edrawer.classList.add('on');
  edrawer.setAttribute('aria-hidden','false');
  try{
    const r=await fetch(`/api/edge-messages?a=${encodeURIComponent(a)}`+
      `&b=${encodeURIComponent(b)}&limit=80`);
    const j=await r.json();
    if(seq!==_edSeq) return;       // 別 edge をクリック済み: 古い結果を捨てる
    if(!j.ok){ renderDrawerError(j.error||'unknown'); return; }
    renderDrawerThread(j);
    // 直近メッセージを最大 3 件、古い順に staggered で comet 再アニメ
    // (drawer の文字情報と同期した可視リプレイ)
    const recent=(j.messages||[]).slice(0,3).reverse();
    recent.forEach((m,i)=>{
      setTimeout(()=>{
        if(seq!==_edSeq) return;          // 別 edge をクリック済み: 停止
        const body=(m.body||'').trim();
        const first=body.split('\n')[0]||'';
        const excerpt=first.replace(/^[#>*\-\s`]+/,'').slice(0,120);
        mailQueue.push({
          id:'replay-'+m.id,
          ts:m.ts_unix||m.ts,
          sender:m.sender,
          recipient:m.recipient,
          subject:(m.subject||'').slice(0,90),
          excerpt:excerpt,
          importance:(m.importance||'normal').toLowerCase(),
          kind:m.kind,
          thread_id:m.thread_id
        });
        mailDrain();
      }, i*900);
    });
  }catch(e){
    if(seq!==_edSeq) return;
    renderDrawerError(String(e));
  }
}
function closeDrawer(){
  _edCur=null; _edSeq++;
  edrawer.classList.remove('on');
  edrawer.setAttribute('aria-hidden','true');
  for(const o of gEls.edge)o.ln.classList.remove('hot');
}
function renderDrawerError(msg){
  edrawer.querySelector('.ed-cnt').textContent='!';
  const notConfigured=/AGENTSTACK_(?:PROJECT_KEY|VAULT).*not configured/i.test(msg);
  document.getElementById('ed-list').innerHTML=notConfigured
    ? `<div class="ed-config"><b>NOT CONFIGURED</b>`+
      `<span>Set AGENTSTACK_PROJECT_KEY to enable ORRERY Mail thread history.</span></div>`
    : `<div class="ed-empty">✕ ${esc(msg)}</div>`;
}
function fmtEdgeTs(m){
  const unix=Number(m.ts_unix||0);
  if(unix>0){
    const d=new Date(unix*1000);
    const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} `+
      `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return (m.ts||'').slice(0,16).replace('T',' ');
}
function renderDrawerThread(j){
  edrawer.querySelector('.ed-cnt').textContent=j.count;
  const root=document.getElementById('ed-list');
  if(!j.messages||!j.messages.length){
    root.innerHTML=
      '<div class="ed-empty">no messages on this edge<br>'+
      '<span style="font-size:10px;opacity:.6">'+
      '(edge counts include all directions)</span></div>';
    return;
  }
  const html=j.messages.map(m=>{
    const ts=fmtEdgeTs(m);
    const imp=(m.importance||'normal').toLowerCase();
    const ackBadge=m.ack_required && !m.ack_ts ? '<span class="ed-ack">◬ ACK</span>' : '';
    const prev=(m.body||'').trim();
    return `<div class="ed-msg" onclick="toggleMsg(event)">
      <div class="ed-meta">
        <span class="ed-ts">${esc(ts)}</span>
        <span class="ed-dir">${esc(m.sender)} → ${esc(m.recipient)}</span>
        <span class="ed-imp ${imp}">${esc(imp.toUpperCase())}</span>${ackBadge}
      </div>
      <div class="ed-subj">${esc(m.subject||'(no subject)')}</div>
      <div class="ed-prev">${esc(prev)}</div>
    </div>`;
  }).join('');
  root.innerHTML=html;
}
function toggleMsg(ev){
  ev.currentTarget.classList.toggle('expanded');
}
// close on ESC / outside-click (network area only — deck の他の UI と干渉しない)
document.addEventListener('keydown',ev=>{
  if(ev.key==='Escape' && edrawer.classList.contains('on')) closeDrawer();
});
document.getElementById('gsvg').addEventListener('click',ev=>{
  // SVG 背景クリック (node/edge-hit 以外): 開いてれば閉じる
  if(ev.target.tagName==='svg' && edrawer.classList.contains('on')) closeDrawer();
});

/* ── node tooltip (担当タスク) ── */
const gtip=document.getElementById('gtip');
function tipShow(name,ev){
  const g=gmap.get(name);if(!g)return;
  const st=g.retired?'s-ret':g.running?'s-run':'';
  gtip.className=st;
  const stat=g.retired?'RETIRED':g.running?'● ONLINE':
    g.present?'○ SHELL':'○ REGISTERED';
  const task=g.task
    ? esc(g.task)
    : '<span class="gt-empty">(no task recorded)</span>';
  const liveRow=g.live
    ? `<div class="gt-row"><b>live</b><span class="gt-live">${esc(g.live)}</span></div>`
    : '';
  const ROLE={parent:'parent (delegator)',child:'child (delegated)',
    both:'both',none:'none'};
  const roleRow=`<div class="gt-row"><b>role</b><span>`+
    `${ROLE[g.role]||'—'}</span></div>`;
  const dv=+g.deliv||0;
  const delivRow=dv>0
    ? `<div class="gt-row"><b>out</b><span>¶ ${dv} logs</span></div>`
    : '';
  const STL={work:'⚙ working',wait:'Zz waiting',ask:'! approval'};
  let hpRow='';
  if(g.running&&typeof g.ctxUsed==='number'){
    const hpv=100-g.ctxUsed,
      tier=hpv>=50?'hi':hpv>=20?'mid':'lo',
      win=g.ctxWindow?` / ${esc(g.ctxWindow)}`:'';
    hpRow=`<div class="gt-row"><b>ctx</b><span>`+
      `<span class="gt-gauge gt-gauge-${tier}">`+
      `<i style="width:${hpv}%"></i></span>`+
      `${hpv}% left <span class="gt-empty">(${g.ctxUsed}% used${win})</span>`+
      `</span></div>`;
    const tm=g.actState==='work'&&g.workDisp
      ? ` <span class="gt-empty">· ${esc(g.workDisp)}</span>`
      : (g.actState!=='work'&&g.lastDisp
        ? ` <span class="gt-empty">· last ${esc(g.lastDisp)}</span>`:'');
    hpRow+=`<div class="gt-row"><b>state</b><span>`+
      `${STL[g.actState]||'—'}${tm}</span></div>`;
  }
  const _sci=avatarKeyOf(name);
  const _pt=_sci
    ? `<img class="gt-port" src="${portURL(_sci,true)}" alt="" `+
      `onerror="portraitFallback(this)">` : '';
  gtip.innerHTML=
    `<div class="gt-hd">${_pt}<div class="gt-nm">`+
    `<span class="gt-led"></span>${esc(name)}</div></div>`+
    `<div class="gt-meta">${stat} · ${esc(g.model||'?')} · last ${esc(g.rel)}</div>`+
    roleRow+hpRow+
    `<div class="gt-row"><b>task</b><span>${task}</span></div>`+liveRow+delivRow;
  gtip.classList.add('on');
  tipMove(ev);
}
function tipMove(ev){
  if(!gtip.classList.contains('on'))return;
  const pad=16, r=gtip.getBoundingClientRect();
  let x=ev.clientX+pad, y=ev.clientY+pad;
  if(x+r.width>innerWidth-8) x=ev.clientX-r.width-pad;
  if(y+r.height>innerHeight-8) y=ev.clientY-r.height-pad;
  gtip.style.left=Math.max(8,x)+'px';
  gtip.style.top=Math.max(8,y)+'px';
}
function tipHide(){gtip.classList.remove('on');}

// pointerdown → 候補保持。5px 以上動けばドラッグ、動かなければクリック=Jump。
// ── Zoom / Pan ──────────────────────────────────────────────
// viewBox を動かしてズーム・パン。シミュレーションは world 座標で不変、
// 画面はそれを切り出して拡縮するだけなので物理に副作用なし。
const gView={vx:0,vy:0,k:1};
const K_MIN=0.3, K_MAX=4, K_STEP=1.15;
let pan=null;
/* Fit-to-view: 力学の到達範囲はノード数と斥力に依存するので、広い画面ほど
   グラフが中央に小さく固まる。収束後に bbox を測って viewBox を合わせる。
   ユーザーが一度でも wheel / pan した後は自動 fit しない（操作を奪わない）。 */
let fitPending=true, viewUserAdjusted=false, fitTimer=0, fitFollowTick=0;
const FIT_PAD=64;        // world px。ノード半径＋ラベル＋role チップの余白
const FIT_K_MAX=2.0;     // 少数ノードで過剰に拡大しないための上限
function fitView(){
  const arr=[...gmap.values()];
  if(!arr.length)return;
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const g of arr){
    if(g.x<x0)x0=g.x; if(g.x>x1)x1=g.x;
    if(g.y<y0)y0=g.y; if(g.y>y1)y1=g.y;
  }
  x0-=FIT_PAD;y0-=FIT_PAD;x1+=FIT_PAD;y1+=FIT_PAD;
  const {w,h}=netDims();
  const bw=Math.max(1,x1-x0), bh=Math.max(1,y1-y0);
  const k=Math.max(K_MIN,Math.min(FIT_K_MAX,Math.min(w/bw,h/bh)));
  // bbox 中心を画面中心に置く
  gView.k=k;
  gView.vx=(x0+x1)/2-w/(2*k);
  gView.vy=(y0+y1)/2-h/(2*k);
  applyView();
}
/* 収束イベントだけに頼ると、rAF が止まる状況（非表示タブ・合成停止）で
   一度も fit されない。フォールバックとして遅延タイマーでも fit する。
   通常は収束 fit の方が先に撃たれ、このタイマーは空振りして終わる。
   fitPending は残すので、後から収束すれば最終レイアウトで撃ち直す。 */
const FIT_FALLBACK_MS=3500, FIT_FALLBACK_TRIES=3;
function scheduleFit(tries=FIT_FALLBACK_TRIES){
  if(fitTimer)clearTimeout(fitTimer);
  fitTimer=setTimeout(()=>{
    fitTimer=0;
    if(!fitPending||viewUserAdjusted||!gmap.size)return;
    fitView();
    // 最後の試行で打ち止め。以後の再収束で勝手に視点が飛ばないようにする
    if(tries>1)scheduleFit(tries-1); else fitPending=false;
  },FIT_FALLBACK_MS);
}
function applyView(){
  const {w,h}=netDims();
  gsvg.setAttribute('viewBox',
    `${gView.vx.toFixed(2)} ${gView.vy.toFixed(2)} `+
    `${(w/gView.k).toFixed(2)} ${(h/gView.k).toFixed(2)}`);
}
function screenToWorld(clientX,clientY){
  // viewBox は (vx,vy)..(vx+w/k,vy+h/k) を container 全面に対応させる
  const r=gsvg.getBoundingClientRect();
  return {x: gView.vx + (clientX-r.left)/gView.k,
          y: gView.vy + (clientY-r.top) /gView.k};
}
gsvg.addEventListener('wheel',ev=>{
  ev.preventDefault();
  const r=gsvg.getBoundingClientRect();
  const cx=ev.clientX-r.left, cy=ev.clientY-r.top;
  const wx=gView.vx+cx/gView.k, wy=gView.vy+cy/gView.k;
  const k2=Math.max(K_MIN,Math.min(K_MAX,
    gView.k*(ev.deltaY<0?K_STEP:1/K_STEP)));
  // カーソル位置の world 点を固定したまま倍率変更
  gView.vx=wx-cx/k2;gView.vy=wy-cy/k2;gView.k=k2;
  viewUserAdjusted=true;
  applyView();
},{passive:false});
/* ── ピンチ拡縮（touch） ──────────────────────────────────────────────
   wheel は指のない端末には無いので、touch では倍率を変える手段が
   まったく無かった。2本目の指が降りたらピンチに入り、pan とノード
   drag はその場で降ろす（1本目が何の上で降りたかに関わらず、2本指は
   拡縮の意図とみなす）。基準は「最初の 2 指の中点にあった world 点」で、
   これを現在の中点に留めるので、つまんだ場所が動かない。 */
const touches=new Map();
let pinch=null;
function pinchGeom(){
  const [a,b]=[...touches.values()];
  return {d:Math.hypot(a.x-b.x,a.y-b.y),
          mx:(a.x+b.x)/2, my:(a.y+b.y)/2};
}
function pinchStart(){
  const g=pinchGeom(), r=gsvg.getBoundingClientRect();
  pinch={d0:g.d, k0:gView.k,
         wx:gView.vx+(g.mx-r.left)/gView.k,
         wy:gView.vy+(g.my-r.top)/gView.k};
  pan=null;
  if(drag){ if(drag.lpTimer)clearTimeout(drag.lpTimer); drag=null; }
  tipHide&&tipHide();
}
function pinchMove(){
  const g=pinchGeom(), r=gsvg.getBoundingClientRect();
  if(!pinch.d0)return;
  const k2=Math.max(K_MIN,Math.min(K_MAX,pinch.k0*(g.d/pinch.d0)));
  gView.k=k2;
  gView.vx=pinch.wx-(g.mx-r.left)/k2;
  gView.vy=pinch.wy-(g.my-r.top)/k2;
  viewUserAdjusted=true;
  applyView();
}
gsvg.addEventListener('pointerdown',ev=>{
  if(ev.pointerType==='touch'){
    touches.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
    if(touches.size===2){pinchStart();return;}
    if(touches.size>2)return;
  }
  if(ev.target.closest('.node'))return;       // ノード drag に譲る
  if(ev.target.classList.contains('edge-hit'))return; // edge click に譲る
  if(selectMode){
    // 選択モード: 矩形範囲指定を開始 (pan は抑制)
    const w=screenToWorld(ev.clientX,ev.clientY);
    const el=svgEl('rect',{class:'selrect',x:w.x,y:w.y,width:0,height:0});
    gsvg.appendChild(el);
    selRect={x0:w.x,y0:w.y,x1:w.x,y1:w.y,el,id:ev.pointerId,
      base:new Set(selectedSet),add:ev.shiftKey||ev.metaKey||ev.ctrlKey};
    gsvg.setPointerCapture(ev.pointerId);
    return;
  }
  pan={x0:ev.clientX,y0:ev.clientY,
       vx0:gView.vx,vy0:gView.vy,id:ev.pointerId};
  gsvg.setPointerCapture(ev.pointerId);
});
gsvg.addEventListener('pointermove',ev=>{
  if(ev.pointerType==='touch'&&touches.has(ev.pointerId)){
    touches.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
    if(pinch&&touches.size===2){pinchMove();return;}
  }
  if(selRect&&ev.pointerId===selRect.id){
    const w=screenToWorld(ev.clientX,ev.clientY);
    selRect.x1=w.x;selRect.y1=w.y;
    const x=Math.min(selRect.x0,selRect.x1),y=Math.min(selRect.y0,selRect.y1);
    const W=Math.abs(selRect.x1-selRect.x0),H=Math.abs(selRect.y1-selRect.y0);
    selRect.el.setAttribute('x',x);selRect.el.setAttribute('y',y);
    selRect.el.setAttribute('width',W);selRect.el.setAttribute('height',H);
    // ライブプレビュー: 矩形内のノードを selectedSet に反映
    const next=new Set(selRect.add?selRect.base:[]);
    for(const[nm,g]of gmap){
      if(g.x>=x&&g.x<=x+W&&g.y>=y&&g.y<=y+H)next.add(nm);
    }
    if(!setsEqual(next,selectedSet)){
      selectedSet.clear();for(const n of next)selectedSet.add(n);
      refreshSelClasses();updateSelBar();
    }
    return;
  }
  if(!pan||ev.pointerId!==pan.id)return;
  gView.vx=pan.vx0-(ev.clientX-pan.x0)/gView.k;
  gView.vy=pan.vy0-(ev.clientY-pan.y0)/gView.k;
  if(Math.hypot(ev.clientX-pan.x0,ev.clientY-pan.y0)>5)viewUserAdjusted=true;
  applyView();
});
const _panEnd=ev=>{
  if(touches.delete(ev.pointerId)&&pinch&&touches.size<2){
    // 指が1本になっても pan には戻さない。戻すと、離した瞬間に残った指の
    // 位置へ画面が飛ぶ（pan の原点が無いため）。次の押下から再開する。
    pinch=null;pan=null;return;
  }
  if(selRect&&ev.pointerId===selRect.id){
    try{gsvg.releasePointerCapture(ev.pointerId);}catch(_){}
    // 最終座標で一度評価 (pointermove が一度も来ない高速ドラッグでも確実に拾う)
    const w=screenToWorld(ev.clientX,ev.clientY);
    selRect.x1=w.x;selRect.y1=w.y;
    const x=Math.min(selRect.x0,selRect.x1),y=Math.min(selRect.y0,selRect.y1);
    const W=Math.abs(selRect.x1-selRect.x0),H=Math.abs(selRect.y1-selRect.y0);
    const next=new Set(selRect.add?selRect.base:[]);
    if(W>=2||H>=2){
      for(const[nm,g]of gmap){
        if(g.x>=x&&g.x<=x+W&&g.y>=y&&g.y<=y+H)next.add(nm);
      }
    }
    if(!setsEqual(next,selectedSet)){
      selectedSet.clear();for(const n of next)selectedSet.add(n);
      refreshSelClasses();updateSelBar();
    }
    if(selRect.el&&selRect.el.parentNode)selRect.el.remove();
    selRect=null;
    return;
  }
  if(pan&&ev.pointerId===pan.id){
    try{gsvg.releasePointerCapture(ev.pointerId);}catch(_){}
    pan=null;
  }};
gsvg.addEventListener('pointerup',_panEnd);
gsvg.addEventListener('pointercancel',_panEnd);
// 空き領域のダブルクリックで fit に戻す（zoom/pan した後の復帰口）
gsvg.addEventListener('dblclick',ev=>{
  if(ev.target.closest('.node'))return;
  if(ev.target.classList.contains('edge-hit'))return;
  viewUserAdjusted=false;fitPending=false;fitView();
});
function setsEqual(a,b){
  if(a.size!==b.size)return false;
  for(const x of a)if(!b.has(x))return false;
  return true;
}
window.addEventListener('resize',()=>{if(gsvg.hasAttribute('viewBox'))applyView();});

// setPointerCapture は使わない（click イベントを潰すため）。
// タッチデバイスでは hover が効かないので、500ms の長押しで tipShow を
// 発火させて gtip を表示する。長押し成立後はタップを「閉じる動作」として
// 扱い、openPanel への遷移は抑制。閉じるには他の場所をタップ。
const LONGPRESS_MS=500;
function onDown(ev,name){
  ev.preventDefault();
  drag={name,x0:ev.clientX,y0:ev.clientY,moved:false,
        pointerType:ev.pointerType,longPressed:false,lpTimer:null,
        selMode:selectMode};
  if(!selectMode && ev.pointerType==='touch'){
    drag.lpTimer=setTimeout(()=>{
      if(drag && !drag.moved){
        drag.longPressed=true;
        tipShow(name, drag.lastEv||ev);
      }
    }, LONGPRESS_MS);
  }
}
function onMove(ev){
  if(!drag)return;
  if(drag.selMode){
    // 選択モード中はノードを動かさない (矩形選択 / クリック toggle 専用)
    if(!drag.moved &&
       Math.hypot(ev.clientX-drag.x0,ev.clientY-drag.y0)>=5)drag.moved=true;
    return;
  }
  if(drag.lpTimer) drag.lastEv=ev;          // 長押し時の最終座標を保持
  if(!drag.moved &&
     Math.hypot(ev.clientX-drag.x0,ev.clientY-drag.y0)<5){
    if(drag.longPressed) tipMove(ev);       // 長押し成立後の指追従
    return;
  }
  // 動き始めた = drag 扱い、長押しタイマーは取り消し
  if(drag.lpTimer){clearTimeout(drag.lpTimer);drag.lpTimer=null;}
  drag.moved=true;
  const g=gmap.get(drag.name);if(!g)return;
  g.fixed=true;
  const w=screenToWorld(ev.clientX,ev.clientY);
  g.x=w.x;g.y=w.y;g.vx=g.vy=0;
  simHot=Math.max(simHot,40);runSim();
}
function onUp(ev){
  if(!drag)return;
  const d=drag;drag=null;
  if(d.lpTimer){clearTimeout(d.lpTimer);d.lpTimer=null;}
  if(d.selMode){
    // 選択モード: 移動でない単独タップ → 選択 toggle (移動なら無視)
    if(!d.moved)toggleSel(d.name);
    return;
  }
  const g=gmap.get(d.name);
  if(d.moved){if(g)g.fixed=false;return;}
  if(d.longPressed){
    // 長押しで gtip 表示済み。指を離しても閉じない (他をタップで閉じる)。
    return;
  }
  openPanel(d.name);   // 通常タップ = 詳細パネル
}
window.addEventListener('pointermove',onMove);
window.addEventListener('pointerup',onUp);
// 長押し中の iOS Safari のテキスト選択メニュー / コンテキストメニューを抑制
window.addEventListener('contextmenu',ev=>{
  if(ev.target.closest('.node')) ev.preventDefault();
});
// 長押しで開いた tooltip を別の場所タップで閉じる
window.addEventListener('pointerdown',ev=>{
  if(!gtip.classList.contains('on'))return;
  if(ev.target.closest('.node')||ev.target.closest('#gtip'))return;
  tipHide();
});

function step(){
  const {w,h}=netDims();
  const arr=[...gmap.values()];
  const SP=.026;   // spawn spring（調整対象外）。KR/KS/L/GR は可変グローバル
  for(let i=0;i<arr.length;i++){
    const a=arr[i];
    for(let j=i+1;j<arr.length;j++){
      const b=arr[j];
      let dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy||1;
      if(d2<90000){
        const f=KR/d2, d=Math.sqrt(d2),
          ux=dx/d*f,uy=dy/d*f;
        if(!a.fixed){a.vx+=ux;a.vy+=uy;}
        if(!b.fixed){b.vx-=ux;b.vy-=uy;}
      }
    }
  }
  const spring=(s,t,k)=>{
    const a=gmap.get(s),b=gmap.get(t);if(!a||!b)return;
    let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,
      f=(d-L)*k,ux=dx/d*f,uy=dy/d*f;
    if(!a.fixed){a.vx+=ux;a.vy+=uy;}
    if(!b.fixed){b.vx-=ux;b.vy-=uy;}
  };
  gedges.forEach(e=>spring(e.source,e.target,KS));
  gspawn.forEach(e=>spring(e.source,e.target,SP));
  let maxMove=0;
  for(const g of arr){
    if(g.fixed)continue;
    const ox=g.x,oy=g.y;
    g.vx+=(w/2-g.x)*GR*0.04;
    g.vy+=(h/2-g.y)*GR*0.04;
    g.vx*=.86*simCool;g.vy*=.86*simCool;
    g.x+=Math.max(-18,Math.min(18,g.vx));
    g.y+=Math.max(-18,Math.min(18,g.vy));
    // 名前＋role pill まで含めて viewport 内に残すための安全余白。
    g.x=Math.max(76,Math.min(w-76,g.x));
    g.y=Math.max(36,Math.min(h-66,g.y));
    maxMove=Math.max(maxMove,Math.hypot(g.x-ox,g.y-oy));
  }
  return maxMove;
}

function paint(){
  for(const o of gEls.edge){
    const a=gmap.get(o.s),b=gmap.get(o.t);if(!a||!b)continue;
    o.ln.setAttribute('x1',a.x);o.ln.setAttribute('y1',a.y);
    o.ln.setAttribute('x2',b.x);o.ln.setAttribute('y2',b.y);
    if(o.hit){
      o.hit.setAttribute('x1',a.x);o.hit.setAttribute('y1',a.y);
      o.hit.setAttribute('x2',b.x);o.hit.setAttribute('y2',b.y);
    }
  }
  for(const o of gEls.badge||[]){
    const a=gmap.get(o.s),b=gmap.get(o.t);if(!a||!b)continue;
    o.tx.setAttribute('x',(a.x+b.x)/2);
    o.tx.setAttribute('y',(a.y+b.y)/2);
  }
  const nsc=NSIZE/NR;   // ノード一括拡縮（リング/バッジ/ラベルごと <g> 全体に適用）
  for(const[nm,o]of gEls.node){
    const g=gmap.get(nm);if(g)o.grp.setAttribute('transform',
      `translate(${g.x.toFixed(1)} ${g.y.toFixed(1)})`
      +(nsc!==1?` scale(${nsc.toFixed(3)})`:''));
  }
  simPaintEls=gEls;
  // 増殖中は収束を待たず、現在の bbox に緩く追従する。これにより新しい
  // 世代が斥力で広がる途中も端で切れない。settle 後は fitPending が落ちる。
  if(fitPending&&!viewUserAdjusted&&gmap.size&&++fitFollowTick%6===0)fitView();
}

const REDUCED=matchMedia('(prefers-reduced-motion:reduce)').matches;
/* Two-stage cooling lowers force-driven terminal velocity before the
   five-frame settle gate. Unchanged DOM and sub-pixel motion skip paint. */
const SIM_SETTLE_MOVE=.45, SIM_SETTLE_FRAMES=5, SIM_PAINT_MOVE=.01;
function runSim(){
  if(simRAF)return;
  let settledFrames=0,firstFrame=true;
  const loop=()=>{
    const iter=REDUCED?6:1;
    simCool=drag?1:(simHot<30?.70:simHot<60?.90:1);
    let maxMove=0;
    for(let i=0;i<iter;i++)maxMove=Math.max(maxMove,step());
    if(firstFrame||drag||gEls!==simPaintEls||maxMove>=SIM_PAINT_MOVE)paint();
    firstFrame=false;
    if(!drag&&maxMove<SIM_SETTLE_MOVE)settledFrames++;
    else settledFrames=0;
    simHot--;