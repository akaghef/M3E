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
    if(b)b.textContent='confirm';
  }
}