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