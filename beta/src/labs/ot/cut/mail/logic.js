/* ════════════════ MAIL COMET (ORRERY Mail 通信の可視化) ════════════════
   /api/messages-since を 4 秒ポーリング。新しい message ごとに
   sender→recipient の edge 上に "信号 packet" を飛ばし、中間点で
   subject + 本文先頭を一瞬だけ表示する。reduced-motion を尊重。
*/
let mailLastTs=0, mailPollTm=0, mailQueue=[], mailActive=0, mailRetryTm=0;
const mailShownGroups=new Set();  // broadcast: 既に card を出した group key (= id + timestamp)
const mailSeenKeys=new Set(), mailSeenOrder=[];
const MAIL_MAX_ACTIVE=4;       // 同時飛行 packet 数の上限
const MAIL_QUEUE_MAX=40;       // バーストで溜まり過ぎたら古い順に捨てる
const MAIL_SEEN_MAX=400;       // 1 秒 overlap poll の重複排除を有界に保つ
const MAIL_ENDPOINT_WAIT_MS=7000; // graph poll より先着した mail を捨てずに待つ
const MAIL_CARD_MAX=3;         // mail storm でも network を文字で覆わない
const mailVisibleCards=[];     // oldest → newest
const MAIL_TRAVEL_MS=1700;     // 端→端の所要時間（ゆっくり目で動きが追える）
const MAIL_LINGER_MS=6000;     // 到着後にカードが滞在する時間（読める長さ）
const MAIL_HOVER_HOLD=true;    // カード hover 中は fade を保留

function registerMailCard(card){
  while(mailVisibleCards.length>=MAIL_CARD_MAX){
    const oldest=mailVisibleCards.shift();
    if(oldest&&typeof oldest._mailDismiss==='function')oldest._mailDismiss();
  }
  mailVisibleCards.push(card);
}
function unregisterMailCard(card){
  const index=mailVisibleCards.indexOf(card);
  if(index>=0)mailVisibleCards.splice(index,1);
}

function worldToScreen(wx,wy){
  // viewBox 変換を逆引きして HTML レイヤーの絶対座標に変換
  const r=gsvg.getBoundingClientRect();
  return {x:r.left+(wx-gView.vx)*gView.k,
          y:r.top +(wy-gView.vy)*gView.k};
}

async function mailPulseTick(){
  if(document.hidden||view!=='net'||netSuspended)return;
  try{
    // server cursor は秒精度かつ strict `>`。直前 1 秒を重ね、同じ秒の
    // query 後に commit された message を次回 poll で回収する。
    const url='/api/messages-since?since='+Math.max(0,mailLastTs-1);
    const r=await fetch(url);
    const j=await r.json();
    if(j.ok){
      mailLastTs=Math.max(mailLastTs,Number(j.now)||0);
      for(const m of annotateBroadcastMessages(j.messages||[])){
        const key=mailMessageKey(m);
        if(mailSeenKeys.has(key))continue;
        mailSeenKeys.add(key);mailSeenOrder.push(key);
        while(mailSeenOrder.length>MAIL_SEEN_MAX)
          mailSeenKeys.delete(mailSeenOrder.shift());
        m._queuedAt=Date.now();
        mailQueue.push(m);
      }
      // 上限超え分は古い方から捨てる
      while(mailQueue.length>MAIL_QUEUE_MAX) mailQueue.shift();
      mailDrain();
    }
  }catch(e){ /* silent */ }
}

function mailMessageKey(m){
  return [m.id??'',m.ts??'',m.sender??'',m.recipient??'',m.kind??''].join('|');
}

function annotateBroadcastMessages(messages){
  const byId=new Map();
  for(const m of messages){
    const k=(m.id!=null)?('id:'+m.id+'@'+(m.ts??'')):('k:'+m.sender+'|'+(m.subject||'')+'|'+m.ts);
    (byId.get(k)||byId.set(k,[]).get(k)).push(m);
  }
  for(const m of messages){
    const k=(m.id!=null)?('id:'+m.id+'@'+(m.ts??'')):('k:'+m.sender+'|'+(m.subject||'')+'|'+m.ts);
    const grp=byId.get(k);
    m._gkey=k; m._rcount=grp.length; m._recips=grp.map(x=>x.recipient);
  }
  return messages;
}

function mailDrain(){
  const pass=mailQueue.length;
  let deferred=false;
  for(let i=0;i<pass&&mailQueue.length&&mailActive<MAIL_MAX_ACTIVE;i++){
    const m=mailQueue.shift();
    if(runMessageAnim(m))continue;
    if(Date.now()-(m._queuedAt||Date.now())<MAIL_ENDPOINT_WAIT_MS){
      mailQueue.push(m);deferred=true;
    }
  }
  if(deferred&&!mailRetryTm){
    mailRetryTm=setTimeout(async()=>{
      mailRetryTm=0;
      // mail(4s) と graph(5s) の位相が逆でも、endpoint を先に更新して再試行。
      await netTick();
      mailDrain();
    },400);
  }
}

function cometEnvelope(t,reduced=false){
  t=Math.max(0,Math.min(1,t));
  if(reduced)return {opacity:1,scale:1,tailOpacity:.45};
  const smooth=x=>x*x*(3-2*x);
  const fadeIn=smooth(Math.min(1,t/.15));
  const fadeOut=1-smooth(Math.max(0,(t-.82)/.18));
  const opacity=fadeIn*fadeOut;
  const scale=t<=.5
    ? 1+.6*smooth(t/.5)
    : 1.6-.8*smooth((t-.5)/.5);
  const tailOpacity=opacity*(.2+.8*Math.sin(Math.PI*t));
  return {opacity,scale,tailOpacity};
}

function runMessageAnim(m){
  const a=gmap.get(m.sender), b=gmap.get(m.recipient);
  if(!a||!b)return false; // graph poll より先着: mailDrain が有界再試行
  if(m.sender===m.recipient)return true;  // self-loop は描かない
  mailActive++;
  const imp=(m.importance||'normal').toLowerCase();
  // 1) sender 側に小さく弧波（出発）
  spawnNodePulse(m.sender,'snd');
  // 2) comet 本体（SVG, world 座標）
  const comet=makeComet(imp);
  gsvg.appendChild(comet);
  const cometTail=comet.querySelector('.mc-tail');
  // 3) コンテンツカード（HTML, screen 座標）— broadcast は group ごとに1枚だけ
  const gkey=m._gkey||(m.sender+'|'+(m.subject||'')+'|'+m.ts);
  const showCard=!mailShownGroups.has(gkey);
  let card=null, slot=-1, cardShown=false, cardHideTm=0;
  const dropGroup=()=>{ mailShownGroups.delete(gkey); };
  const removeCard=(fade=true)=>{
    if(!card||card._mailRemoved)return;
    card._mailRemoved=true;
    if(card._hoverExtTm)clearTimeout(card._hoverExtTm);
    if(cardHideTm)clearTimeout(cardHideTm);
    unregisterMailCard(card);
    releaseCardSlot(slot);slot=-1;dropGroup();
    if(fade){
      card.classList.add('fading');
      setTimeout(()=>card.remove(),350);
    }else card.remove();
  };
  if(showCard){
    mailShownGroups.add(gkey);
    card=makeMailCard(m,imp);
    slot=acquireCardSlot();
    card.dataset.slot=slot;
    card._hover=false;
    card._mailDismiss=()=>removeCard(true);
    registerMailCard(card);
    if(MAIL_HOVER_HOLD){
      card.addEventListener('mouseenter',()=>{ card._hover=true; });
      card.addEventListener('mouseleave',()=>{
        card._hover=false;
        // hover 解除時に追加で短めの延長 fade を仕掛け直す
        if(card._hoverExtTm) clearTimeout(card._hoverExtTm);
        card._hoverExtTm=setTimeout(()=>{
          if(!card._hover && card.isConnected)removeCard(true);
        }, 1200);
      });
    }
    document.body.appendChild(card);
  }
  // 4) ルート上を edge "fire"（あれば）
  fireEdgeFor(m.sender,m.recipient);
  const t0=performance.now();
  const REDUCED=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const baseDur=(typeof m.travel_ms==='number' && m.travel_ms>0)
    ? m.travel_ms : MAIL_TRAVEL_MS;
  const DUR=REDUCED?Math.min(500,baseDur):baseDur;
  // 滞留時間: replay 中は HOLD スライダー (RP.holdMs) で可変、それ以外は既定。
  const LINGER=REDUCED?1200:(RP.active?RP.holdMs:MAIL_LINGER_MS);
  function frame(now){
    const elapsed=now-t0;
    const tn=Math.min(1,elapsed/DUR);
    // ease-in-out cubic — 出始めと到着前を緩める
    const e=tn<.5?4*tn*tn*tn:1-Math.pow(-2*tn+2,3)/2;
    // 現在位置 (世界座標) — gmap の最新座標を参照（drag 中もついていく）
    const sa=gmap.get(m.sender), sb=gmap.get(m.recipient);
    if(!sa||!sb){ cleanup(); return; }
    const cx=sa.x+(sb.x-sa.x)*e;
    const cy=sa.y+(sb.y-sa.y)*e;
    const env=cometEnvelope(tn,REDUCED);
    comet.style.opacity=env.opacity.toFixed(3);
    comet.setAttribute('transform','translate('+cx.toFixed(1)+' '+cy.toFixed(1)+
      ') scale('+env.scale.toFixed(3)+')');
    // comet 進行方向に tail 回転
    const dx=sb.x-sa.x, dy=sb.y-sa.y;
    const ang=Math.atan2(dy,dx)*180/Math.PI;
    if(cometTail){
      cometTail.setAttribute('transform','rotate('+ang.toFixed(1)+')');
      cometTail.style.opacity=env.tailOpacity.toFixed(3);
    }
    // カード位置: comet の少し上に
    // カードは comet を追わず edge midpoint に固定（読みやすさ優先）。
    // sender/recipient の動的位置から midpoint を再計算するので物理 sim
    // で動いてもカードは追従する。
    if(card&&!card._mailRemoved){
      const midX=(sa.x+sb.x)/2, midY=(sa.y+sb.y)/2;
      const scr=worldToScreen(midX,midY);
      const cardW=card.offsetWidth||240, cardH=card.offsetHeight||64;
      const vw=window.innerWidth, vh=window.innerHeight;
      let lx=scr.x-cardW/2;
      let ly=scr.y-cardH-22 - slot*(cardH+10);
      // 画面端で位置調整
      lx=Math.max(8,Math.min(vw-cardW-8,lx));
      if(ly<60) ly=scr.y+24+slot*(cardH+10);
      ly=Math.max(60,Math.min(vh-cardH-8,ly));
      card.style.left=lx+'px';
      card.style.top =ly+'px';
      if(!cardShown && tn>=0.15){
        card.classList.add('on'); cardShown=true;
      }
    }
    if(tn<1){ requestAnimationFrame(frame); }
    else { arrive(); }
  }
  function arrive(){
    spawnNodePulse(m.recipient,'arr');
    if(REDUCED){
      comet.style.transition='opacity .35s';
      comet.style.opacity='0';
    }
    setTimeout(()=>comet.remove(), REDUCED?380:40);
    // カードは到着後 LINGER ms 残してから fade out。hover 中は待つ。
    if(card&&!card._mailRemoved){
      const startFade=()=>{
        if(card._hover){
          // hover 中。100ms 後に再判定
          cardHideTm=setTimeout(startFade, 100); return;
        }
        removeCard(true);
      };
      cardHideTm=setTimeout(startFade, LINGER);
    }
    mailActive--;
    mailDrain();
  }
  function cleanup(){
    comet.remove();
    removeCard(false);
    mailActive--; mailDrain();
  }
  requestAnimationFrame(frame);
  return true;
}

function makeComet(imp){
  const g=svgEl('g',{class:'mail-comet imp-'+imp});
  const tail=svgEl('g',{class:'mc-tail'});
  tail.appendChild(svgEl('circle',{
    class:'mc-tail-fill',cx:-11,cy:0,r:18,transform:'scale(1 .16)'}));
  const halo=svgEl('circle',{class:'mc-halo',cx:0,cy:0,r:8});
  const head=svgEl('circle',{class:'mc-head',cx:0,cy:0,r:4.2});
  g.appendChild(tail); g.appendChild(halo); g.appendChild(head);
  return g;
}
// 同時表示時にカードが重ならないよう slot を割り当て・再利用
const mailCardSlots=[false,false,false];
function acquireCardSlot(){
  for(let i=0;i<mailCardSlots.length;i++){
    if(!mailCardSlots[i]){ mailCardSlots[i]=true; return i; }
  }
  return mailCardSlots.length-1;  // 上限超: 末尾 slot に重ね
}
function releaseCardSlot(i){
  if(i>=0&&i<mailCardSlots.length) mailCardSlots[i]=false;
}

function makeMailCard(m,imp){
  const c=document.createElement('div');
  c.className='mail-card imp-'+imp;
  const route=document.createElement('div'); route.className='mc-route';
  const sb=document.createElement('b'); sb.textContent=m.sender;
  const arr=document.createElement('span'); arr.className='arr';
  arr.textContent='▸';
  const rb=document.createElement('b');
  if(m._rcount && m._rcount>1){
    rb.textContent=m._rcount+'人';
    if(m._recips&&m._recips.length) rb.title=m._recips.join(', ');
  } else {
    rb.textContent=m.recipient;
  }
  route.appendChild(sb); route.appendChild(arr); route.appendChild(rb);
  if(m.kind && m.kind!=='to'){
    const k=document.createElement('span'); k.className='mc-kind';
    k.textContent=m.kind.toUpperCase();
    route.appendChild(k);
  }
  c.appendChild(route);
  if(m.subject){
    const s=document.createElement('div'); s.className='mc-subj';
    s.textContent=m.subject;
    c.appendChild(s);
  }
  if(m.excerpt){
    const e=document.createElement('div'); e.className='mc-ex';
    e.textContent=m.excerpt;
    c.appendChild(e);
  }
  return c;
}

function spawnNodePulse(name,kind){
  const o=gEls.node && gEls.node.get && gEls.node.get(name);
  if(!o||!o.grp) return;
  const pc=svgEl('circle',{
    class:kind==='arr'?'node-arr-pulse':'node-snd-pulse',
    cx:0,cy:0,r:14});
  o.grp.appendChild(pc);
  setTimeout(()=>pc.remove(), kind==='arr'?1100:600);
}

function fireEdgeFor(s,t){
  if(!gEls.edge) return;
  for(const o of gEls.edge){
    if((o.s===s&&o.t===t)||(o.s===t&&o.t===s)){
      if(o.ln && o.cls && o.cls.includes('edge')&&!o.cls.includes('spawn')){
        o.ln.classList.add('firing');
        setTimeout(()=>o.ln.classList.remove('firing'), 900);
      }
    }
  }
}

function mailPulseStart(){
  if(mailPollTm) return;
  // 入った瞬間より前の message はリプレイしない
  mailLastTs=Math.floor(Date.now()/1000);
  // 起動直後の取りこぼし防止に 1 秒巻き戻し
  mailLastTs=Math.max(0,mailLastTs-1);
  mailPulseTick();    // 即時 1 回
  mailPollTm=setInterval(mailPulseTick, 4000);
}
function mailPulseStop(){
  if(mailPollTm){ clearInterval(mailPollTm); mailPollTm=0; }
}

/* ════════════════ DIGEST REPLAY (Task G) ════════════════════════════════════
   選択した複数 agent の 24h 履歴を mail-comet engine に流し直す。
   - replayMode フラグで live polling を停止
   - 仮想時計が events[i].ts に到達したら mailQueue / 各種演出に dispatch
   - speed = 1/60/2880 (×2880 = 24h → 30s)
   - scrub: 仮想時計を移動。前進ならイベント pointer をその時刻まで skip
   - mail comet の MAIL_TRAVEL_MS は per-event scale (×2880 で 200ms 程度) */
const RP={
  active:false, paused:false, speed:2880, holdMs:6000, names:[],
  events:[], nextIdx:0, sinceTs:0, nowTs:0,   // 仮想時計の窓
  virtTs:0,                                   // 現在の仮想時刻 (秒)
  rafId:0, lastFrameMs:0,
  scrubDragging:false,
  outEdges:new Set(),
  filterGroupOnly:false,    // Task G++ (1624): 選択集合内のみ
  selSet:new Set(),         // names を Set 化 (filter 判定で hot path)
  markerEls:[],             // Task G+++ (1625): event marker DOM 参照
  // Task H v2 (msg 1632): time-travel — graph をゼロから build
  timeTravel:true,           // default ON: 物理シミュレーションで graph を成長させる
  initialAlive:new Set(),    // range.start_ts 時点で alive だった agent 名
  savedGmap:new Map(),       // replay 開始前の gmap snapshot (stopReplay で restore)