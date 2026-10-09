// OT lab: omit cockpit theme bridge/inventory; retain route parser and complete operational closure.
const AGENTSTACK_SERVER_DEFAULTS={language:null,murmur:null};
let netSuspended=false;
function initialDashboardRoute(search,serverDefaults={},browserLanguages=[]){
  const params=new URLSearchParams(search);
  const requestedView=params.get('view');
  const requestedLanguage=params.get('lang');
  const requestedMurmur=params.get('murmur');
  const environmentLanguage=serverDefaults&&serverDefaults.language;
  const browserJapanese=browserLanguages.some(language=>
    typeof language==='string'&&/^ja(?:-|$)/i.test(language));
  return {
    view:(requestedView==='deck'||requestedView==='net')?requestedView:'deck',
    history:['live','7d','30d','all'].includes(params.get('history'))
      ?params.get('history')
      :(params.get('showAll')==='1'?'30d':'live'),  // showAll=1 was the old "30 days" switch
    embed:params.get('embed')==='1',
    networkWindow:params.get('window')==='all'?'all':'1',
    language:(requestedLanguage==='ja'||requestedLanguage==='en')
      ?requestedLanguage
      :(environmentLanguage==='ja'||environmentLanguage==='en')
        ?environmentLanguage
        :browserJapanese?'ja':'en',
    murmurEnabled:(requestedMurmur==='on'||requestedMurmur==='off')
      ?requestedMurmur==='on'
      :(!serverDefaults||serverDefaults.murmur!=='off')
  };
}
const INITIAL_ROUTE=initialDashboardRoute(
  window.location.search,
  AGENTSTACK_SERVER_DEFAULTS,
  [navigator.language,...(navigator.languages||[])]
);
const EMBED_MODE=
  INITIAL_ROUTE.embed ||
  window.parent!==window;
document.body.classList.toggle('embed',EMBED_MODE);

const CATLABEL={agent:"ACTIVE AGENTS",
  finished:"FINISHED — stale registration (retire / kill)",
  unnamed:"UNNAMED — pending rename",
  warmup:"WARMUP spare",infra:"INFRA",idle:"IDLE",
  gone:"GONE — registered but tmux absent (kill to retire)",
  retired:"RETIRED — soft-deleted (click to resume)"};
/* ── Report JS exceptions to the server ──────────────────────────────
   This page is frequently viewed inside a webview with no devtools, where a
   thrown exception leaves no trace at all — it only ever looks like "clicking
   that does nothing".  Anything landing here ends up in logs/js-errors.log,
   so a failure produces a log line instead of a mystery. */
function reportJsError(where,err,extra){
  try{
    const b=Object.assign({where,ua:navigator.userAgent,
      msg:(err&&err.message)||String(err),
      stack:(err&&err.stack)||''},extra||{});
    fetch('/api/jserr',{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(b),
      keepalive:true}).catch(()=>{});
  }catch(_){/* reporting must never be the thing that throws */}
}
window.addEventListener('error',e=>reportJsError('window.onerror',e.error||e,
  {src:e.filename,line:e.lineno,col:e.colno,msg:e.message}));
window.addEventListener('unhandledrejection',e=>
  reportJsError('unhandledrejection',e.reason));

const SHOW_DEFAULT=new Set(["agent","finished","unnamed"]);
let lastData=[], booted=false;
const ARM_MS=5000; // kill/exit 両方の確認タイムアウト
const armingSet=new Set();
const armTimers=new Map();
const exitingSet=new Set();
const exitTimers=new Map();

// ── network view: 矩形多選択モード ─────────────────────────────────
// selectMode ON 時のみ動作。ノードクリックで toggle / SVG ドラッグで矩形範囲指定。
// バルク発火は 2 段確認 (bulkArm) → 50ms 間隔で順次 dispatch。
let selectMode=false;
const selectedSet=new Set();
let bulkArm=null;          // 'exit' | 'resume' | null
let bulkArmTimer=null;
let bulkBusy=false;
let selRect=null;          // {x0,y0,x1,y1,el,pointerId}

const esc=s=>(s??"").replace(/[&<>"]/g,c=>(
  {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// agent 名の scientist 部分 → 肖像。長い順で末尾一致(誤マッチ防止)
const SCIENTISTS=["Leeuwenhoek","Boltzmann","Arrhenius","Ramanujan",
  "Langmuir","Guericke","Vesalius","Faraday","Feynman","Einstein","Pasteur",
  "Linnaeus","Ostwald","Maxwell","Pascal","Newton","Planck","Kepler",
  "Mendel","Turing","Hubble","Darwin","Tesla","Curie","Euler","Gauss",
  "Hooke","Bohr","Fabre",
  // Added 2026-06-26 (round 2) — keep in sync with SCIENTIST_NOUNS in utils.py
  "Copernicus","Archimedes","Mendeleev","Franklin","Galileo","Edison",
  "Dirac","Fermi","Koch","Bell",
  // Added 2026-06-26 (round 3)
  "Somerville","Lavoisier","Lovelace","Goodall","Pauling","Noether",
  "Yukawa","Hopper","Lamarr","Bose","Watt"].sort((a,b)=>b.length-a.length);
function scientistOf(name){
  for(const s of SCIENTISTS)
    if(name.toLowerCase().endsWith(s.toLowerCase()))return s;
  return null;
}
// Custom portraits for non-scientist persistent agents.
// Loaded from /api/custom-portraits, backed by AGENTSTACK_CUSTOM_PORTRAITS.
let CUSTOM_PORT={};
async function loadCustomPortraits(){
  try{
    const r=await fetch('/api/custom-portraits',{cache:'no-store'});
    if(!r.ok)return;
    const data=await r.json();
    CUSTOM_PORT=(data&&typeof data==='object'&&!Array.isArray(data))?data:{};
    if(lastData.length)render();
    if(typeof netBooted!=='undefined'&&netBooted){
      buildEls();simHot=Math.max(simHot,60);runSim();
    }
  }catch(e){CUSTOM_PORT={};}
}
// avatar key for portraits: prefer a custom bot mapping, else fall back to scientistOf.
function avatarKeyOf(name){
  return CUSTOM_PORT[(name||'').toLowerCase()]||scientistOf(name);
}

// ── Murmurs ──────────────────────────────────────────────────
// 各エージェントが時々呟く吹き出し。Tier A=30s ランダム / Tier B=状態遷移。
// 科学者ごとに専属フレーズ。フォールバックは `_`。日英混在で短文。
const MURMURS={
  _:{say:["うーん…","ふむ","なるほど","hmm…","考え中","…"],
    start:["やるぞ","let's go"],done:["完了","done"],
    hungry:["お腹すいた","getting full"],empty:["/clear して…","memory full"]},
  // Added 2026-06-26 (round 2)
  Galileo:{say:["e pur si muove","それでも地球は回る","木星の衛星…","望遠鏡で…","落体の法則"],
    start:["観測開始"],done:["確認した"],hungry:["視野が…"],empty:["レンズ磨く"]},
  Copernicus:{say:["地動説…","太陽が中心","de revolutionibus","天球が回る","周転円いらぬ"],
    start:["天体計算"],done:["軌道確定"],hungry:["計算が混む"],empty:["星表整理"]},
  Archimedes:{say:["Eureka!","εὕρηκα","てこの原理","浮力だ…","我に支点を","π を挟む"],
    start:["風呂に入る"],done:["見つけた!"],hungry:["金冠が…"],empty:["砂に描き直す"]},
  Mendeleev:{say:["周期律…","元素が並ぶ","ここは空欄","原子量順に","夢で閃いた"],
    start:["カード並べ"],done:["表が埋まった"],hungry:["欄が足りぬ"],empty:["再配置"]},
  Fermi:{say:["Fermi 推定","中性子…","臨界量は?","シカゴ・パイル","だいたい桁で"],
    start:["概算する"],done:["臨界到達"],hungry:["燃料棒…"],empty:["制御棒入れる"]},
  Dirac:{say:["反物質…","美しい方程式","海に穴が","δ関数","…（沈黙）","positron 予言"],
    start:["方程式を立てる"],done:["elegant"],hungry:["spinor 過多"],empty:["真空を整える"]},
  Franklin:{say:["Photo 51","らせんが…","X線回折","B型 DNA","データが語る"],
    start:["結晶セット"],done:["回折撮れた"],hungry:["露光が長い"],empty:["暗室整理"]},
  Edison:{say:["1%のひらめき","99%の汗","電球が…","蓄音機だ","1万通り試した","Tesla め…"],
    start:["試作開始"],done:["点いた!"],hungry:["フィラメント…"],empty:["実験ノート整理"]},
  Koch:{say:["コッホの原則","純粋培養…","結核菌だ","寒天平板","病原体を特定"],
    start:["培養開始"],done:["同定完了"],hungry:["雑菌が…"],empty:["滅菌する"]},
  Bell:{say:["Watson, come here","電話だ…","Mr. Watson","音を電気に","聾教育…","四面体凧…","tetrahedral kite"],
    start:["通話テスト"],done:["つながった"],hungry:["回線混む"],empty:["受話器を置く"]},
  // Added 2026-06-26 (round 3)
  Yukawa:{say:["中間子…","核力を媒介","π中間子","湯川ポテンシャル","予言した"],
    start:["場を立てる"],done:["予言的中"],hungry:["核力が…"],empty:["真空を整える"]},
  Lovelace:{say:["最初のプログラム","解析機関…","Note G","詩的な科学","Babbage と…"],
    start:["algorithm 書く"],done:["loop 完了"],hungry:["カードが…"],empty:["punch card 整理"]},
  Noether:{say:["対称性=保存則","Noether の定理","不変量…","群と作用","abstract algebra"],
    start:["対称性を探す"],done:["保存量発見"],hungry:["対称性が破れる"],empty:["代数を整理"]},
  Somerville:{say:["天界の機構","'scientist' の語源","数学を綴る","博学に…","星表を読む"],
    start:["翻訳開始"],done:["まとめた"],hungry:["蔵書過多"],empty:["書架整理"]},
  Pauling:{say:["化学結合…","α-helix","電気陰性度","ビタミンC","Nobel ×2"],
    start:["軌道混成"],done:["結合確定"],hungry:["電子不足"],empty:["再混成"]},
  Watt:{say:["蒸気が…","horsepower","分離凝縮器","governor 回る","効率を上げる"],
    start:["蒸気上げる"],done:["稼働開始"],hungry:["石炭切れ"],empty:["ボイラー清掃"]},
  Hopper:{say:["first actual bug","COBOL","nanoseconds…","compile せよ","debugging"],
    start:["compile 開始"],done:["it works"],hungry:["メモリ不足"],empty:["log 整理"]},
  Lavoisier:{say:["質量保存","酸素と命名","燃焼理論","天秤で測る","元素を数える"],
    start:["秤量開始"],done:["balanced"],hungry:["試薬切れ"],empty:["フラスコ洗浄"]},
  Bose:{say:["boson…","統計が…","植物も感じる","crescograph","電波で…"],
    start:["測定開始"],done:["反応記録"],hungry:["感度低下"],empty:["装置調整"]},
  Lamarr:{say:["frequency hopping","spread spectrum","発明もする","WiFi の祖…","美貌と頭脳"],
    start:["周波数切替"],done:["秘匿成功"],hungry:["帯域が混む"],empty:["channel 整理"]},
  Goodall:{say:["チンパンジー…","道具を使う","Gombe にて","観察と忍耐","共感する"],
    start:["field へ"],done:["記録した"],hungry:["群れが移動"],empty:["双眼鏡を拭く"]},
  Faraday:{say:["lines of force…","induction!","電磁場が…","field","実験あるのみ"],
    start:["coil up!","巻線つける"],done:["観測完了","measured"],
    hungry:["磁束が混む"],empty:["回路片付け"]},
  Newton:{say:["F = ma","gravitas…","りんごが…","Principia","action=reaction"],
    start:["微分はじめる"],done:["QED","証明完了"],
    hungry:["重力が増す"],empty:["/clear Principia"]},
  Kepler:{say:["楕円軌道","ellipses…","P² ∝ a³","天体観測","harmonies…"],
    start:["観測開始"],done:["軌道確認"],
    hungry:["軌道が乱れる"],empty:["再計算"]},
  Curie:{say:["radium…","放射線…","Po…","また被曝","fluorescence"],
    start:["分離はじめる"],done:["isolated!"],
    hungry:["線量計が…"],empty:["遮蔽要"]},
  Gauss:{say:["正規分布","17 角形","∮ E·dA","曲率テンソル"],
    start:["least squares!"],done:["fit 完了"],
    hungry:["分散増"],empty:["regularize"]},
  Boltzmann:{say:["S = k log W","entropy 増","H 定理","気体分子論"],
    start:["微視状態数え"],done:["平衡到達"],
    hungry:["エントロピー…"],empty:["熱死寸前"]},
  Tesla:{say:["AC forever","高周波…","共振中","Edison は…"],
    start:["voltage up"],done:["放電完了"],
    hungry:["コイル熱い"],empty:["過電流"]},
  Einstein:{say:["E = mc²","gedankenexperiment…","光速一定","時空が曲がる",
                 "God does not play dice","relativity…","重力 = 加速"],
    start:["思考実験開始","let's compute"],
    done:["elegant!","美しい","シンプルになった"],
    hungry:["mind crowded"],empty:["blackboard wipe"]},
  Leeuwenhoek:{say:["小動物が…","tiny animalcules","レンズ磨き"],
    start:["顕微鏡セット"],done:["観察記録"],
    hungry:["視野が狭い"],empty:["レンズ交換"]},
  Fabre:{say:["糞虫が…","beetles!","観察日記","蜂が…"],
    start:["野外調査"],done:["記録した"],
    hungry:["虫が逃げる"],empty:["日没"]},
  Maxwell:{say:["∇·E = ρ/ε","field eqs","電磁波","demon…"],
    start:["wave eq 解く"],done:["波動確認"],
    hungry:["場が混む"],empty:["renormalize"]},
  Planck:{say:["h = 6.626e-34","quantum!","黒体放射","E = hν"],
    start:["量子化開始"],done:["スペクトル一致"],
    hungry:["紫外発散"],empty:["カットオフ"]},
  Bohr:{say:["complementarity!","原子模型","量子飛躍","対応原理"],
    start:["軌道計算"],done:["遷移確認"],
    hungry:["状態崩壊"],empty:["観測しない"]},
  Hooke:{say:["ut tensio sic vis","spring!","cell が…","ばね定数"],
    start:["F = -kx"],done:["弾性確認"],
    hungry:["塑性域"],empty:["破断"]},
  Mendel:{say:["3:1","対立遺伝子","エンドウ豆","Pp × Pp"],
    start:["交配開始"],done:["世代記録"],
    hungry:["温室狭い"],empty:["畑を耕す"]},
  Pasteur:{say:["pasteurize","微生物が…","発酵中","fermentation!"],
    start:["殺菌処理"],done:["無菌確認"],
    hungry:["培地が…"],empty:["オートクレーブ"]},
  Darwin:{say:["natural selection","ガラパゴス","Beagle 号","共通祖先"],
    start:["観察開始"],done:["仮説書いた"],
    hungry:["標本箱満杯"],empty:["航海日誌新調"]},
  Turing:{say:["halting?","万能機械","decidable?","λ…"],
    start:["compute on"],done:["accept!"],
    hungry:["tape 不足"],empty:["state 爆発"]},
  Feynman:{say:["path integral","ファインマン図","∮ …","wiggling"],
    start:["diagram 描く"],done:["amplitude OK"],
    hungry:["loops 過剰"],empty:["renormalize"]},
  Hubble:{say:["redshift","expanding…","赤方偏移","z = …"],
    start:["望遠鏡向ける"],done:["距離測定完了"],
    hungry:["宇宙が膨らむ"],empty:["再キャリブ"]},
  Arrhenius:{say:["k = A·e^(-Ea/RT)","活性化エネ…","温暖化…"],
    start:["反応開始"],done:["速度定数"],
    hungry:["温度上昇"],empty:["反応停止"]},
  Pascal:{say:["考える葦","probability…","三角形","真空…"],
    start:["賭けてみる"],done:["期待値"],
    hungry:["確率が偏る"],empty:["仕切り直し"]},
  Euler:{say:["e^iπ + 1 = 0","Königsberg","∑1/n²= π²/6"],
    start:["級数展開"],done:["収束した"],
    hungry:["項が多い"],empty:["打ち切り"]},
  Ostwald:{say:["catalysis…","希釈律","Nobel 1909","色彩…"],
    start:["触媒投入"],done:["平衡到達"],
    hungry:["副反応"],empty:["洗浄"]},
  Linnaeus:{say:["binomial","Homo sapiens","systema","属種…"],
    start:["分類開始"],done:["命名完了"],
    hungry:["新種多い"],empty:["カタログ整理"]},
  Vesalius:{say:["fabrica","解剖図","De Humani…","muscle"],
    start:["メス入れる"],done:["スケッチ完了"],
    hungry:["標本不足"],empty:["保存液"]},
  Guericke:{say:["真空ポンプ","Magdeburg!","気圧…","半球"],
    start:["pump down"],done:["真空到達"],
    hungry:["リーク"],empty:["再封"]},
  Ramanujan:{say:["1729","∞ series","partition…","modular"],
    start:["夢に出てきた"],done:["証明あとで"],
    hungry:["紙が足りない"],empty:["インク切れ"]},
  Langmuir:{say:["monolayer","isotherm","表面化学","θ = Kp/(1+Kp)"],
    start:["adsorbing"],done:["covered"],
    hungry:["site 満杯"],empty:["desorb"]},
};
const MURMURS_EN={
  _:{say:["checking the signal","thinking it through","one more pass","mapping the path"],
    start:["starting now","on it"],done:["handoff ready","done"],
    hungry:["context is filling","need more room"],
    empty:["refreshing context","starting fresh"]},
  Curie:{say:["follow the radiation","measure the glow","isolate the signal","nothing is to be feared"],
    start:["beginning the assay"],done:["sample confirmed"],
    hungry:["exposure is rising"],empty:["shielding the sample"]},
  Noether:{say:["symmetry gives conservation","find the invariant","follow the group action","abstract algebra"],
    start:["checking symmetry"],done:["invariant found"],
    hungry:["symmetry is breaking"],empty:["resetting the algebra"]},
  Turing:{say:["will it halt?","state by state","is it decidable?","follow the tape"],
    start:["starting the machine"],done:["state accepted"],
    hungry:["running out of tape"],empty:["resetting the state"]},
  Lovelace:{say:["poetical science","Note G","the engine can compose","loop the cards"],
    start:["writing the algorithm"],done:["loop complete"],
    hungry:["more punched cards"],empty:["sorting the cards"]},
  Hopper:{say:["debug the system","compile it","mind the nanoseconds","ship the language"],
    start:["starting the compiler"],done:["it works"],
    hungry:["memory is tight"],empty:["clearing the logs"]},
  Franklin:{say:["Photo 51","the helix is clear","let the data speak","X-ray pattern ready"],
    start:["aligning the crystal"],done:["diffraction captured"],
    hungry:["long exposure"],empty:["resetting the darkroom"]},
  Faraday:{say:["lines of force","induction!","follow the field","experiment first"],
    start:["energizing the coil"],done:["field measured"],
    hungry:["flux is building"],empty:["resetting the circuit"]},
  Lamarr:{say:["frequency hopping","spread the spectrum","switch the channel","secure the signal"],
    start:["hopping frequencies"],done:["channel secured"],
    hungry:["bandwidth is crowded"],empty:["clearing the channel"]},
  Bose:{say:["count the quanta","share the same state","boson statistics","measure the response"],
    start:["starting the measurement"],done:["response recorded"],
    hungry:["sensitivity is fading"],empty:["recalibrating"]},
  Galileo:{say:["and yet it moves","Jupiter has moons","watch the falling bodies","through the telescope"],
    start:["beginning observation"],done:["orbit confirmed"],
    hungry:["narrowing the field"],empty:["polishing the lens"]},
  Somerville:{say:["map the heavens","translate the mechanism","read the star table","connect every science"],
    start:["starting the translation"],done:["synthesis complete"],
    hungry:["too many volumes"],empty:["sorting the library"]},
  Feynman:{say:["draw the diagram","sum every path","what can I calculate?","let it wiggle"],
    start:["drawing the paths"],done:["amplitude checked"],
    hungry:["too many loops"],empty:["renormalizing"]},
};
function pickMurmur(name,kind){
  const sci=scientistOf(name);
  const table=INITIAL_ROUTE.language==='en'?MURMURS_EN:MURMURS;
  // 英語表に人物が無い場合は英語共通 pool へ落とし、日本語を混ぜない。
  const entry=table[sci]||table._;
  const pool=entry[kind]||table._[kind];
  return pool[Math.floor(Math.random()*pool.length)];
}
// 永続化 Map: buildEls() が毎 tick でノード DOM を作り直すため、
// ここに保持して再 append しないと吹き出しが即消えてしまう。
const gMurmurs=new Map();   // name -> {bub, ts}
function spawnMurmur(name,text){
  if(!INITIAL_ROUTE.murmurEnabled)return;
  if(!text) return;
  const o=gEls.node.get(name); if(!o) return;
  const g=gmap.get(name); if(!g) return;
  if(gMurmurs.has(name)) return;         // 同ノードで既に発話中
  // 次回発話時刻を 18-38s 後にランダム設定（各人独立 → 時刻が散らばる）
  g._nextSpeakTs=Date.now()+18000+Math.random()*20000;
  const side=Math.random()<.5?1:-1;
  // 文字幅推定（CJK は約2倍）
  let estW=10;
  for(const c of text){estW += c.charCodeAt(0)>127 ? 9 : 5.4;}
  const W=Math.max(28,Math.ceil(estW));
  const cx=side*(14+W/2), cy=-16, rx=W/2;
  const tipL=side>0?18:-26, tipR=side>0?26:-18, tipX=side>0?13:-13;
  const bub=svgEl('g',{class:'murmur'});
  bub.appendChild(svgEl('path',{class:'mtail',
    d:`M${tipL} -9 L${tipX} -2 L${tipR} -9 Z`}));
  bub.appendChild(svgEl('ellipse',{class:'mbp',
    cx:cx,cy:cy,rx:rx,ry:8}));
  const tx=svgEl('text',{class:'mtx',x:cx,y:cy+3.4,
    'text-anchor':'middle'});
  tx.textContent=text;
  bub.appendChild(tx);
  o.grp.appendChild(bub);
  gMurmurs.set(name,{bub,ts:Date.now()});
  setTimeout(()=>{
    if(bub.parentNode)bub.remove();
    gMurmurs.delete(name);
  },3800);
}
// buildEls() の最後に呼んで、生存中の吹き出しを新しいノード group に再付着
function reattachMurmurs(){
  for(const[name,m]of gMurmurs){
    const o=gEls.node.get(name);
    if(o){o.grp.appendChild(m.bub);}
    else {if(m.bub.parentNode)m.bub.remove();gMurmurs.delete(name);}
  }
}
function portURL(sci,hi){
  /* Portraits come from the server, which resolves a name to a file. A
     static build has no server, and <img src> never reaches the demo's
     fetch shim, so without this hook every face falls back to initials —
     the page still works and quietly looks like a different product. */
  if(window.AGENTSTACK_DEMO&&window.AGENTSTACK_DEMO.portraitURL)
    return window.AGENTSTACK_DEMO.portraitURL(sci,hi);
  return `/portrait?name=${encodeURIComponent(sci)}${hi?'&hi=1':''}`;
}
function portraitFallback(el){
  if(!el||el.dataset.portraitFallback==='1'){
    if(el){el.hidden=true;el.style.display='none';}
    return;
  }
  el.dataset.portraitFallback='1';
  const u=new URL(el.getAttribute('src')||el.getAttribute('href')||'',location.href);
  u.searchParams.delete('hi');
  if(el.tagName&&el.tagName.toLowerCase()==='image')el.setAttribute('href',u.pathname+u.search);
  else el.src=u.pathname+u.search;
}

function toast(prefix,msg,err){
  const t=document.getElementById('toast');
  t.innerHTML=`<span class="p">${esc(prefix)}</span> ${esc(msg)}`;
  t.className='on'+(err?' err':'');
  clearTimeout(t._t); t._t=setTimeout(()=>t.className='',3400);
}

async function jump(name,ev){
  ev.stopPropagation();
  // Embedded in the ORRERY cockpit, the terminal lives in the host: hand the
  // session over instead of asking this server to open a separate terminal.
  if(EMBED_MODE){
    window.parent.postMessage({type:'orrery-jump',name:name},location.origin);
    return;
  }
  toast('▸ LINK','> '+name+' …');
  try{
    const r=await fetch('/api/jump',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({session:name})});
    const j=await r.json();
    if(j.ok) toast('▸ LINK','> '+name+'  ::  '+(j.detail||j.action).toUpperCase());
    else toast('✕ FAIL','> '+(j.error||'unknown'),true);
  }catch(e){ toast('✕ FAIL','> uplink lost: '+e,true); }
}
// 2段クリック確認で finished/gone エージェントを kill+retire（実 kill は
// サーバ側 build_agents() の category 判定で finished/gone のみ通る）。
// armingSet/armTimers で状態管理し、render() による DOM 再生成に耐性を持たせる。
async function killAgent(ev,name){
  ev.stopPropagation();
  function getCard(){return document.querySelector(`.bay[data-name="${CSS.escape(name)}"]`);}
  function getBtn(c){return c?c.querySelector('.killbtn'):null;}
  if(!armingSet.has(name)){
    armingSet.add(name);
    const c=getCard();if(c){c.classList.add('arming');const b=getBtn(c);if(b)b.textContent='confirm';}
    armTimers.set(name,setTimeout(()=>{
      armingSet.delete(name);armTimers.delete(name);
      const c2=getCard();if(c2){c2.classList.remove('arming');const b2=getBtn(c2);if(b2)b2.textContent='✕ KILL';}
    },ARM_MS));
    return;
  }
  clearTimeout(armTimers.get(name));armTimers.delete(name);armingSet.delete(name);
  const card=getCard();if(!card)return;
  card.classList.add('killing');
  const btn=getBtn(card);if(btn)btn.textContent='…';
  try{
    const r=await fetch('/api/kill',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({session:name})});
    const j=await r.json();
    if(j.ok){
      toast('▸ KILL','> '+name+'  ::  '+(j.actions||[]).join(', '));
      card.classList.add('removing');
      setTimeout(()=>card.remove(),500);
    }else{
      card.classList.remove('killing');
      if(btn)btn.textContent='✕ KILL';
      toast('✕ FAIL','> '+(j.error||'unknown'),true);
    }
  }catch(e){
    const c3=getCard();if(c3)c3.classList.remove('killing');
    const b3=getBtn(c3);if(b3)b3.textContent='✕ KILL';
    toast('✕ FAIL','> kill err: '+e,true);
  }
}

async function exitAgent(ev,name){
  ev.stopPropagation();
  function getCard(){return document.querySelector(`.bay[data-name="${CSS.escape(name)}"]`);}
  function getBtn(c){return c?c.querySelector('.exitbtn'):null;}
  if(!exitingSet.has(name)){
    exitingSet.add(name);
    const c=getCard();if(c){c.classList.add('exit-arming');const b=getBtn(c);if(b)b.textContent='confirm';}
    exitTimers.set(name,setTimeout(()=>{
      exitingSet.delete(name);exitTimers.delete(name);
      const c2=getCard();if(c2){c2.classList.remove('exit-arming');const b2=getBtn(c2);if(b2)b2.textContent='↩ EXIT';}
    },ARM_MS));
    return;
  }
  clearTimeout(exitTimers.get(name));exitTimers.delete(name);exitingSet.delete(name);
  const card=getCard();if(!card)return;
  card.classList.remove('exit-arming');
  card.classList.add('exiting');
  const btn=getBtn(card);if(btn)btn.textContent='…';
  try{
    const r=await fetch('/api/exit',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({session:name})});
    const j=await r.json();
    card.classList.remove('exiting');
    if(btn)btn.textContent='↩ EXIT';
    if(j.ok){
      const warn=(j.actions||[]).includes('warn-attached')?' (attached)':'';
      toast('▸ EXIT','> '+name+'  ::  /exit sent'+warn);
    }else toast('✕ FAIL','> '+(j.error||'unknown'),true);
  }catch(e){
    card.classList.remove('exiting');
    if(btn)btn.textContent='↩ EXIT';
    toast('✕ FAIL','> exit err: '+e,true);
  }
}

// ── network view: 矩形多選択 — モード切替 / 選択操作 / バルク dispatch ─
function setSelMode(on){
  const next=!!on;
  if(next===selectMode){
    if(!next)clearSel();   // 重複 OFF でも一応クリア
    return;
  }
  selectMode=next;
  document.getElementById('net').classList.toggle('sel-mode',next);
  const t=document.getElementById('selToggle');
  if(t)t.classList.toggle('on',next);
  if(!next)clearSel();
}
function toggleSel(name){
  if(!selectMode)return;
  if(selectedSet.has(name))selectedSet.delete(name);
  else selectedSet.add(name);
  refreshSelClasses();updateSelBar();
}
function clearSel(){
  if(selectedSet.size===0){updateSelBar();return;}
  selectedSet.clear();
  refreshSelClasses();updateSelBar();
}
function refreshSelClasses(){
  // 全 node の selnode class を selectedSet と同期。buildEls() でも反映されるが、
  // tick を待たずに即時更新するためここでも触る。
  for(const[name,o]of gEls.node){
    o.grp.classList.toggle('selnode',selectedSet.has(name));
  }
}
function selCategorize(){
  // 選択中ノードを exit 対象 (running/finished) / resume 対象 (retired/gone) に振り分け
  const exitable=[],resumable=[];
  for(const name of selectedSet){
    const g=gmap.get(name);if(!g)continue;
    const st=g.retired?'retired'
      :(g.state||(g.running?'run':g.present?'finished':'gone'));
    if(st==='run'||st==='finished')exitable.push(name);
    else if(st==='retired'||st==='gone')resumable.push(name);
  }
  return {exitable,resumable};
}
function updateSelBar(){
  const bar=document.getElementById('selbar');
  if(!bar)return;
  const n=selectedSet.size;
  document.getElementById('selbarNum').textContent=String(n);
  bar.classList.toggle('show',n>0);
  const {exitable,resumable}=selCategorize();
  const eBtn=document.getElementById('selbarExit');
  const rBtn=document.getElementById('selbarResume');
  const pBtn=document.getElementById('selbarReplay');
  // 既存 arm 状態のラベルは保持する
  if(!bulkArm||bulkArm!=='exit'){
    eBtn.querySelector('.sb-tx').textContent='Exit '+exitable.length;
  }
  if(!bulkArm||bulkArm!=='resume'){
    rBtn.querySelector('.sb-tx').textContent='Resume '+resumable.length;
  }
  eBtn.disabled=exitable.length===0||bulkBusy;
  rBtn.disabled=resumable.length===0||bulkBusy;
  if(pBtn){
    // gmap に居る → /api/graph 上で ORRERY Mail registered なので history を持ち得る。
    // 1 体だけだと detail-panel の sparkline で見られるので disable。
    let mailReg=0;
    for(const nm of selectedSet){ if(gmap.has(nm)) mailReg++; }
    pBtn.querySelector('.sb-tx').textContent='Replay '+mailReg;
    pBtn.disabled=mailReg<2 || !!window._replayMode;
  }
}
function _clearBulkArm(){
  if(bulkArmTimer){clearTimeout(bulkArmTimer);bulkArmTimer=null;}
  bulkArm=null;
  const eBtn=document.getElementById('selbarExit');
  const rBtn=document.getElementById('selbarResume');
  if(eBtn)eBtn.classList.remove('arm');
  if(rBtn)rBtn.classList.remove('arm');
  updateSelBar();
}
function _armBulk(kind){
  // 一方を arm すると他方は解除 (誤発火防止)
  if(bulkArmTimer)clearTimeout(bulkArmTimer);
  bulkArm=kind;
  const eBtn=document.getElementById('selbarExit');
  const rBtn=document.getElementById('selbarResume');
  eBtn.classList.toggle('arm',kind==='exit');
  rBtn.classList.toggle('arm',kind==='resume');
  const {exitable,resumable}=selCategorize();
  if(kind==='exit')eBtn.querySelector('.sb-tx').textContent='Confirm Exit '+exitable.length;
  else rBtn.querySelector('.sb-tx').textContent='Confirm Resume '+resumable.length;
  bulkArmTimer=setTimeout(_clearBulkArm,ARM_MS);
}
async function bulkDispatch(kind,names,btn){
  // /api/exit (kind='exit') または /api/jump (kind='resume', 既存 do_jump が
  // tmux 不在 → do_resume へフォールバックするので resume 経路も /api/jump で OK)。
  // rate limit を避けるため 60ms 間隔で順次 POST。失敗詳細は console、結果は集計 toast。
  const url=kind==='exit'?'/api/exit':'/api/jump';
  const lab=kind==='exit'?'EXIT':'RESUME';
  bulkBusy=true;
  btn.classList.add('busy');
  const origTx=btn.querySelector('.sb-tx').textContent;
  btn.querySelector('.sb-tx').textContent='Sending…';
  toast('▸ BULK '+lab,'> '+names.length+' agents …');
  let ok=0,fail=0;const failNames=[];
  for(const nm of names){
    try{
      const r=await fetch(url,{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({session:nm})});
      const j=await r.json();
      if(j.ok)ok++;
      else{fail++;failNames.push(nm+':'+(j.error||'?'));console.warn('bulk '+kind+' fail',nm,j);}
    }catch(e){fail++;failNames.push(nm+':'+e);console.warn('bulk '+kind+' err',nm,e);}
    await new Promise(r=>setTimeout(r,60));
  }
  bulkBusy=false;
  btn.classList.remove('busy');
  btn.querySelector('.sb-tx').textContent=origTx;
  const verb=kind==='exit'?'Exited':'Resumed';
  toast('▸ BULK '+lab,verb+' '+ok+(fail?', failed '+fail:''),fail>0);
  if(failNames.length)console.warn('bulk '+kind+' failed names:',failNames);
  // 成功したぶんは選択解除 (反復誤爆防止)
  // exit は対象が消える、resume は新セッション開始するので Set からは外す
  for(const nm of names)selectedSet.delete(nm);
  refreshSelClasses();updateSelBar();
}
async function bulkExit(){
  if(bulkBusy)return;
  const {exitable}=selCategorize();
  if(exitable.length===0)return;
  if(bulkArm!=='exit'){_armBulk('exit');return;}
  _clearBulkArm();
  await bulkDispatch('exit',exitable,document.getElementById('selbarExit'));
}
async function bulkResume(){
  if(bulkBusy)return;
  const {resumable}=selCategorize();
  if(resumable.length===0)return;
  if(bulkArm!=='resume'){_armBulk('resume');return;}
  _clearBulkArm();
  await bulkDispatch('resume',resumable,document.getElementById('selbarResume'));
}
// 配線: トグル / バー / Esc / view 切替
(function(){
  const tgl=document.getElementById('selToggle');
  if(tgl)tgl.addEventListener('click',()=>setSelMode(!selectMode));
  const eBtn=document.getElementById('selbarExit');
  const rBtn=document.getElementById('selbarResume');
  const xBtn=document.getElementById('selbarClear');
  const pBtn=document.getElementById('selbarReplay');
  if(eBtn)eBtn.addEventListener('click',bulkExit);
  if(rBtn)rBtn.addEventListener('click',bulkResume);
  if(xBtn)xBtn.addEventListener('click',()=>{_clearBulkArm();clearSel();});
  if(pBtn)pBtn.addEventListener('click',()=>{
    if(pBtn.disabled)return;
    const names=[...selectedSet].filter(n=>gmap.has(n));
    if(names.length<2)return;
    startReplay(names);
  });
  window.addEventListener('keydown',ev=>{
    if(ev.key!=='Escape')return;
    // Replay 中の Esc は停止だけにとどめる（選択解除より優先）
    if(window._replayMode){ stopReplay(); return; }
    if(bulkArm){_clearBulkArm();return;}
    if(selectedSet.size>0){clearSel();return;}
    if(selectMode)setSelMode(false);
  });
  updateSelBar();
})();

function bay(a,i){
  const led=a.running?'on':'';
  const chips=[];
  if(a.model) chips.push(`<span class="chip" title="${esc(a.model_raw||a.model)}">${esc(a.model)}</span>`);
  if(a.ctx_window) chips.push(`<span class="chip win" title="context window">◷ ${esc(a.ctx_window)}</span>`);
  if(+a.deliv>0) chips.push(`<span class="chip dv" title="output logs: ${+a.deliv}">¶ ${+a.deliv}</span>`);
  if(a.mail_linked) chips.push(`<span class="chip att" title="tmux session name matches an ORRERY Mail identity">◉ LINKED</span>`);
  if(a.attached) chips.push(`<span class="chip att" title="a terminal client is attached to this tmux session">◉ ATTACHED</span>`);
  // 'agent' は section header(ACTIVE AGENTS) と冗長なので省略
  if(a.category==='finished')
    chips.push(`<span class="chip imp">◢ EXITED</span>`);
  else if(a.category!=='agent')
    chips.push(`<span class="chip cat">${esc(a.category)}</span>`);
  // 状態 LED（カード右上）— work=黄色点滅+経過時間 / wait=last X 微弱 / ask=赤+APPROVAL / question=シアン+?
  let stind='';
  if(a.running&&a.act_state){
    if(a.act_state==='work'&&(a.work_disp||typeof a.ctx_used==='number')){
      stind=`<div class="stind work" title="working ${esc(a.work_disp||'')}">`+
        `<span class="led-sq"></span>`+
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
    if(b)b.textContent='confirm';
  }
}

function setGauge(id,bid,val,max){
  document.getElementById(id).textContent=val;
  if(bid) document.getElementById(bid).style.width=
    (max? Math.min(100,val/max*100):0)+'%';
}

/* How far back /api/agents reaches for gone / retired agents. `live` needs no
   history (those rows come from tmux), so it fetches the same 30-day slice as
   before and hides the non-live categories client-side. */
const HISTORY_DAYS={live:'30','7d':'7','30d':'30',all:'all'};
const HISTORY_WIDER={live:'30d','7d':'30d','30d':'all',all:null};
const HISTORY_WIDER_LABEL={'30d':'SEARCH THE LAST 30 DAYS',all:'SEARCH ALL HISTORY'};
let historyRange=INITIAL_ROUTE.history;
let tickSeq=0;
function setHistoryRange(range){
  if(!(range in HISTORY_DAYS))return;
  historyRange=range;
  for(const b of document.querySelectorAll('#history button'))
    b.setAttribute('aria-checked',String(b.dataset.history===range));
  render();      // re-slice what we already hold
  tick();        // then widen or narrow the fetch
}
async function tick(){
  const seq=++tickSeq;
  try{
    const r=await fetch('/api/agents?days='+HISTORY_DAYS[historyRange]);
    const j=await r.json();
    if(seq!==tickSeq)return;   // a newer range was requested while this was in flight
    lastData=j.agents;
    const y=window.scrollY;
    render();
    window.scrollTo(0,y);
    const ag=j.agents.filter(a=>a.category==='agent');
    const run=ag.filter(a=>a.running).length;
    setGauge('g-run','b-run',run,ag.length||1);
    setGauge('g-idle','b-idle',ag.length-run,ag.length||1);
    setGauge('g-tot',null,ag.length,0);
  }catch(e){
    document.getElementById('wrap').innerHTML=
      '<div class="state"><b>◢ SIGNAL LOST ◣</b><br><br>'+
      '<span style="font-size:11px;letter-spacing:3px">RETRYING UPLINK…</span></div>';
  }
}

/* ════════════════ NETWORK VIEW ════════════════ */
const SVGNS="http://www.w3.org/2000/svg";
const gsvg=document.getElementById('gsvg');
let gWin=INITIAL_ROUTE.networkWindow,
  gWinLabel=INITIAL_ROUTE.networkWindow==='all'?'ALL':'~ 1d',
  gmap=new Map(), gedges=[], gspawn=[],
  gEls={node:new Map(),edge:[]}, simRAF=0, simHot=0, drag=null,
    netBooted=false, netRenderKey='', simPaintEls=null;
let simCool=1;

function svgEl(t,attrs){const e=document.createElementNS(SVGNS,t);
  for(const k in attrs)e.setAttribute(k,attrs[k]);return e;}

function netDims(){const r=gsvg.getBoundingClientRect();
  return {w:r.width||window.innerWidth,h:r.height||(window.innerHeight-60)};}

function defs(){
  const d=svgEl('defs');
  for(const[id,c]of[['mk-c','var(--amber)'],['mk-s','var(--amber)']]){
    const m=svgEl('marker',{id,viewBox:'0 0 10 10',refX:9,refY:5,
      markerWidth:6.5,markerHeight:6.5,orient:'auto-start-reverse'});
    m.appendChild(svgEl('path',{d:'M0 0L10 5L0 10z',fill:c,opacity:.85}));
    d.appendChild(m);
  }
  const halo=svgEl('radialGradient',{
    id:'node-halo-grad',cx:'50%',cy:'50%',r:'50%'});
  for(const[offset,opacity]of[['0%',.28],['50%',.2],['76%',.08],['100%',0]])
    halo.appendChild(svgEl('stop',{
      offset,'stop-color':'#ece5d6','stop-opacity':opacity}));
  d.appendChild(halo);
  const cometTail=svgEl('linearGradient',{
    id:'comet-tail-grad',gradientUnits:'userSpaceOnUse',
    x1:-29,y1:0,x2:0,y2:0});
  for(const[offset,color,opacity]of[
    ['0%','#f2b65a',0],['68%','#f2b65a',.3],['100%','#ece5d6',.88]])
    cometTail.appendChild(svgEl('stop',{
      offset,'stop-color':color,'stop-opacity':opacity}));
  d.appendChild(cometTail);
  const cometCore=svgEl('radialGradient',{
    id:'comet-core-grad',cx:'50%',cy:'50%',r:'50%'});
  for(const[offset,color,opacity]of[
    ['0%','#ece5d6',.75],['45%','#f2b65a',.32],['100%','#f2b65a',0]])
    cometCore.appendChild(svgEl('stop',{
      offset,'stop-color':color,'stop-opacity':opacity}));
  d.appendChild(cometCore);
  const cp=svgEl('clipPath',{id:'pclip'});
  cp.appendChild(svgEl('circle',{cx:0,cy:0,r:13}));
  d.appendChild(cp);
  gsvg.appendChild(d);
}
const NR=13;  // 肖像ノード半径（基準値。表示サイズは NSIZE/NR の scale で一括拡縮）
/* ── network tuning params (F1 net-controls) ──────────────────────────
   step()/buildEls()/paint() が実行時に直接読む可変変数。右上スライダーが書き換え、
   localStorage に永続化する。SP(spawn spring) は調整対象外＝step()ローカルのまま。
     NSIZE ノード表示サイズ(px)  L     リンク自然長
     LWMUL リンク幅 ×倍率        KR    斥力 (∝1/d²)
     GR    中心引力              KS    リンクばね定数
   NSIZE はノード<g>全体への scale(NSIZE/NR) として適用するので、リング・HPゲージ・
   状態バッジ(!/?/z)・名前・役割チップが全て一体で拡縮し協調する（座標固定要素も追従）。 */
const NETP_DEF={NSIZE:13, L:110, LWMUL:1, KR:2600, GR:0.012, KS:0.012};
let NSIZE=NETP_DEF.NSIZE, L=NETP_DEF.L, LWMUL=NETP_DEF.LWMUL,
    KR=NETP_DEF.KR, GR=NETP_DEF.GR, KS=NETP_DEF.KS;
(function loadNetParams(){
  try{
    const s=JSON.parse(localStorage.getItem('agentdash.netparams')||'{}');
    if(typeof s.NSIZE==='number'&&isFinite(s.NSIZE))NSIZE=s.NSIZE;
    if(typeof s.L==='number'&&isFinite(s.L))L=s.L;
    if(typeof s.LWMUL==='number'&&isFinite(s.LWMUL))LWMUL=s.LWMUL;
    if(typeof s.KR==='number'&&isFinite(s.KR))KR=s.KR;
    if(typeof s.GR==='number'&&isFinite(s.GR))GR=s.GR;
    if(typeof s.KS==='number'&&isFinite(s.KS))KS=s.KS;
  }catch(e){}
  /* `?tune=L:170,KR:5200` は保存された値をこの表示だけ上書きする。
     kiosk/embed や撮影用の一時ウィンドウは localStorage が空の別プロファイル
     なので、スライダーを触らずに間隔を指定できる経路が要る。永続化はしない。 */
  try{
    const raw=new URLSearchParams(location.search).get('tune');
    if(raw){
      const lim={NSIZE:[6,40],L:[40,400],LWMUL:[.2,4],
                 KR:[200,20000],GR:[0,.2],KS:[0,.2]};
      const set={NSIZE:v=>NSIZE=v,L:v=>L=v,LWMUL:v=>LWMUL=v,
                 KR:v=>KR=v,GR:v=>GR=v,KS:v=>KS=v};
      for(const pair of raw.split(',')){
        const [k,v]=pair.split(':');
        const n=parseFloat(v);
        if(!lim[k]||!isFinite(n))continue;
        set[k](Math.max(lim[k][0],Math.min(lim[k][1],n)));
      }
    }
  }catch(e){}
})();

async function netTick(){
  try{
    const qs=gWin==="all"?"all=1":"days="+gWin;
    const r=await fetch('/api/graph?'+qs);
    const j=await r.json();
    const {w,h}=netDims();
    const previousNodeCount=gmap.size;
    const mapWasCleared=gmap.size===0&&gEls.node&&gEls.node.size>0;
    const seen=new Set();
    for(const n of j.nodes){
      seen.add(n.name);
      let g=gmap.get(n.name);
      if(!g){g={x:w/2+(Math.random()-.5)*120,
        y:h/2+(Math.random()-.5)*120,vx:0,vy:0,fixed:false};
        gmap.set(n.name,g);}
      // 呟き: 状態遷移を検出（前回値と比較。初回は発火しない）
      const newSt=n.act_state||'';
      const newTier=(typeof n.ctx_used==='number')
        ?(n.ctx_used<50?'hi':n.ctx_used<80?'mid':'lo'):null;
      if(g._prevSt!==undefined&&n.running&&!drag&&!pan){
        const fresh=!g._nextSpeakTs||Date.now()>=g._nextSpeakTs;
        if(fresh){
          if(g._prevSt==='wait'&&newSt==='work')
            spawnMurmur(n.name,pickMurmur(n.name,'start'));
          else if(g._prevSt==='work'&&newSt==='wait')
            spawnMurmur(n.name,pickMurmur(n.name,'done'));
          else if(g._prevTier==='hi'&&newTier==='mid')
            spawnMurmur(n.name,pickMurmur(n.name,'hungry'));
          else if(g._prevTier&&g._prevTier!=='lo'&&newTier==='lo')
            spawnMurmur(n.name,pickMurmur(n.name,'empty'));
        }
      }
      g._prevSt=newSt; g._prevTier=newTier;
      Object.assign(g,{model:n.model,provider:n.provider||'',
        running:!!n.running,
        present:!!n.present,retired:!!n.retired,rel:n.rel||'—',
        task:n.task||'',live:n.live||'',deg:0,act:+n.act||0,
        state:n.state||'',sig:+n.sig||0,deliv:+n.deliv||0,
        ctxUsed:(typeof n.ctx_used==='number'?n.ctx_used:null),
        actState:n.act_state||'',ctxWindow:n.ctx_window||'',
        workDisp:n.work_disp||'',workSecs:(+n.work_secs||0),
        lastDisp:n.last_disp||'',annot:n.annot||null,
        // 要求した名前が通らなかったエージェント。ここで拾い落とすと、server が
        // 送っていても画面には出ない（この一覧は明示的なコピーなので、payload に
        // 足しただけでは届かない）。
        requested_name:n.requested_name||'',
        surface:n.surface||''});
    }
    for(const k of[...gmap.keys()])if(!seen.has(k))gmap.delete(k);
    gedges=j.edges.filter(e=>gmap.has(e.source)&&gmap.has(e.target));
    gspawn=j.spawn.filter(e=>gmap.has(e.source)&&gmap.has(e.target));
    for(const e of gedges){const a=gmap.get(e.source),b=gmap.get(e.target);
      if(a)a.deg++;if(b)b.deg++;}
    document.getElementById('netinfo').innerHTML=
      `<b>${j.shown??gmap.size}</b> nodes · ${gedges.length} links · `+
      `${gspawn.length} spawn ${gWin==="all"?"":"· "+gWinLabel+" window"}`+
      ` / total ${j.total??'?'}`;
    // DOM に影響する状態だけを安定順に並べ、変化のない poll は再構築しない。
    // task/live/rel 等は tooltip が最新 gmap を都度読むため fingerprint 不要。
    const nodeKey=[...gmap].map(([name,g])=>[
      name,g.state,g.running,g.present,g.retired,g.actState,
      typeof g.ctxUsed==='number'?Math.round(g.ctxUsed):null,
      g.model||'',g.provider||'',g.deg,
      g.annot&&g.annot.emoji||'',g.annot&&g.annot.role||''
    ]).sort((a,b)=>a[0].localeCompare(b[0]));
    const edgeKey=gedges.map(e=>[e.source,e.target,+e.count||0])
      .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const spawnKey=gspawn.map(e=>[e.source,e.target,+e.count||0])
      .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const nextRenderKey=JSON.stringify([nodeKey,edgeKey,spawnKey]);
    if(mapWasCleared||nextRenderKey!==netRenderKey){
      // 増殖・retire・window 切替のどれでも画角を追従させる。ユーザーが
      // zoom/pan 済みなら既存の viewUserAdjusted 契約で自動 fit は抑制される。
      if(mapWasCleared||gmap.size!==previousNodeCount)fitPending=true;
      buildEls(); netRenderKey=nextRenderKey; simHot=120; runSim();
      if(fitPending){
        if(!viewUserAdjusted)fitView();
        scheduleFit();
      }
    }
  }catch(e){
    document.getElementById('netinfo').textContent='SIGNAL LOST — retry…';
  }
}

// provider (AI 提供元) をメダリオン右下の丸座金に載せる。
// 公式ロゴ SVG（bone カラーで再着色済み）は /assets/ から配信。
// 不明 provider は null（呼び出し側で skip）。
const _PROVIDER_ASPECT = {
  // 公式 SVG の viewBox から: w/h
  // anthropic key は Claude ブランドロゴ（24x24 正方形）を表示
  anthropic: 1,         // 24x24 正方形（Claude logo）
  openai:    256/260,   // ~0.98 (ほぼ正方形)
  google:    1,         // 24x24 正方形（Gemini logo）
};
// asset の更新が SVG <image> 要素のキャッシュに引っかかるため、ページごとに
// 一意な version 文字列を付けて確実に最新を取得する（page load ごとに 1 回）。
const _ASSET_V = Date.now().toString(36);
// Asset paths are absolute so the dashboard works wherever the server maps
// it. A static demo build has no server and may sit in a subdirectory, so it
// is allowed to resolve them itself — same hook shape as portURL.
function assetURL(name){
  if(window.AGENTSTACK_DEMO&&window.AGENTSTACK_DEMO.assetURL)
    return window.AGENTSTACK_DEMO.assetURL(name,_ASSET_V);
  return `/assets/${name}.svg?v=${_ASSET_V}`;
}
function providerKeyFor(g){
  const raw=String((g&&g.provider)||'').toLowerCase();
  if(_PROVIDER_ASPECT[raw])return raw;
  const model=String((g&&g.model)||'').toLowerCase();
  if(/claude|opus|sonnet|haiku|fable|mythos/.test(model))return 'anthropic';
  if(/codex|gpt/.test(model))return 'openai';
  return '';
}
function providerBadge(provider,x,y,size=14){
  const ar=_PROVIDER_ASPECT[provider];
  if(!ar)return null;
  const badge=svgEl('g',{class:'provider-badge',
    transform:`translate(${x.toFixed(2)} ${y.toFixed(2)})`});
  badge.appendChild(svgEl('circle',{class:'provider-seat',r:(size/2).toFixed(2)}));
  const h=size*.58,w=h*ar;
  badge.appendChild(svgEl('image',{class:'provider-logo','data-provider':provider,
    href:assetURL(provider),
    x:(-w/2).toFixed(2), y:(-h/2).toFixed(2),
    width:w.toFixed(2), height:h.toFixed(2),
    preserveAspectRatio:'xMidYMid meet'}));
  return badge;
}

function renderLiveStateBubble(grp,actState){
  // buildEls normally creates a fresh node group, but explicit removal keeps
  // the helper correct if a caller ever updates one group in place.
  grp.querySelectorAll('.askbub,.qbub').forEach(n=>n.remove());
  const question=actState==='question';
  const ask=actState==='ask';
  if(!question&&!ask)return null;
  const bubble=svgEl('g',{
    class:question?'qbub':'askbub',
    role:'img',
    'aria-label':question?'agent question':'approval requested'
  });
  // 軌道環はノードを囲む。字はその右上、環の外周に載せる。
  //
  // This ring sits at NR*1.18 = 15.3, inside the context arc at NR+5 = 18,
  // and that is correct. It was moved out to NR+8 for a while on the theory
  // that the gauge was burying it; the theory was wrong. The ring was hard
  // to see because it was dashed and drew 24% of its circumference, not
  // because anything covered it. Drawn as a full circle it reads clearly
  // from inside the gauge, so the radius came back.
  //
  // The lesson is the cheap test that was skipped: remove the dash and look.
  // Two numbers agreeing with a story is not the same as the story being
  // true.
  bubble.appendChild(svgEl('circle',{
    class:'bubo',cx:0,cy:0,r:(NR*1.18).toFixed(2),pathLength:'100'
  }));
  const glyph=svgEl('text',{
    class:question?'bq':'bx',
    x:(NR*.84).toFixed(2),y:(-NR*.84).toFixed(2),'text-anchor':'middle'
  });
  glyph.textContent=question?'?':'!';
  bubble.appendChild(glyph);
  grp.appendChild(bubble);
  return bubble;
}

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
    if(!drag&&settledFrames>=SIM_SETTLE_FRAMES){
      // 収束したフレームで一度だけ fit（ユーザー操作後は抑制）
      if(fitPending&&!viewUserAdjusted&&gmap.size){
        fitView();fitPending=false;
        if(fitTimer){clearTimeout(fitTimer);fitTimer=0;}
      }
      simHot=0;simRAF=0;return;
    }
    if(simHot>0||drag){simRAF=requestAnimationFrame(loop);}
    else{simRAF=0;}
  };
  simRAF=requestAnimationFrame(loop);
}

/* ════════════════ F1 NET-CONTROLS (physics / display tuning) ════════════════
   右上パネルのスライダーで力学/表示パラメータを即時調整。値は localStorage に永続化。
   力学系(L/KR/GR/KS)は step() が毎フレーム読むので simHot を煽って再収束させるだけ。
   表示系(NR/LWMUL)は buildEls() で SVG を作り直す（座標は gmap 保持なので維持される）。 */
const NC_CFG={
  NSIZE:{get:()=>NSIZE, set:v=>NSIZE=v, fmt:v=>v.toFixed(0),     apply:'repaint'},
  L:    {get:()=>L,     set:v=>L=v,     fmt:v=>v.toFixed(0),     apply:'force'  },
  LWMUL:{get:()=>LWMUL, set:v=>LWMUL=v, fmt:v=>'×'+v.toFixed(1), apply:'rebuild'},
  KR:   {get:()=>KR,    set:v=>KR=v,    fmt:v=>v.toFixed(0),     apply:'force'  },
  GR:   {get:()=>GR,    set:v=>GR=v,    fmt:v=>v.toFixed(3),     apply:'force'  },
  KS:   {get:()=>KS,    set:v=>KS=v,    fmt:v=>v.toFixed(3),     apply:'force'  },
};
function saveNetParams(){
  try{localStorage.setItem('agentdash.netparams',
    JSON.stringify({NSIZE,L,LWMUL,KR,GR,KS}));}catch(e){}
}
function ncSyncRow(row){
  const cfg=NC_CFG[row.dataset.p];
  const inp=row.querySelector('input'), val=row.querySelector('.val');
  const v=cfg.get();
  inp.value=v;
  val.textContent=cfg.fmt(v);
  const pct=((v-(+inp.min))/((+inp.max)-(+inp.min)))*100;
  inp.style.setProperty('--fill',Math.max(0,Math.min(100,pct)).toFixed(1)+'%');
}
function ncApply(mode){
  saveNetParams();
  if(!netBooted)return;            // net view 未起動なら次回 netTick で反映される
  if(mode==='repaint'){paint();return;}          // node scale: 再描画のみ（再構築不要）
  if(mode==='rebuild'){buildEls();simHot=Math.max(simHot,80);}
  else simHot=Math.max(simHot,60);               // force 系: 再収束させる
  runSim();
}
function initNetCtl(){
  const panel=document.getElementById('nctl');
  if(!panel)return;
  const hd=document.getElementById('nctl-hd');
  // On a phone the open panel covers most of the graph it is tuning, so it
  // starts collapsed there — the header is still tappable. A stored choice
  // still wins in both directions; this only decides the first visit.
  const stored=localStorage.getItem('agentdash.netctl.col');
  const narrow=matchMedia('(max-width:640px)').matches;
  if(stored==='1'||(stored===null&&narrow))panel.classList.add('col');
  hd.addEventListener('click',()=>{
    const col=panel.classList.toggle('col');
    try{localStorage.setItem('agentdash.netctl.col',col?'1':'0');}catch(e){}
  });
  panel.querySelectorAll('.nc-row').forEach(row=>{
    const cfg=NC_CFG[row.dataset.p];
    const inp=row.querySelector('input');
    ncSyncRow(row);
    inp.addEventListener('input',()=>{
      cfg.set(+inp.value); ncSyncRow(row); ncApply(cfg.apply);
    });
  });
  document.getElementById('nc-reset').addEventListener('click',()=>{
    for(const k of Object.keys(NETP_DEF))NC_CFG[k].set(NETP_DEF[k]);
    panel.querySelectorAll('.nc-row').forEach(ncSyncRow);
    saveNetParams();
    if(netBooted){buildEls();simHot=Math.max(simHot,90);runSim();}
  });
}
initNetCtl();

/* ════════════════ VIEW CONTROL ════════════════ */
let view='deck';
function setView(v){
  view=v;
  document.body.dataset.view=v;
  document.getElementById('v-deck').classList.toggle('on',v==='deck');
  document.getElementById('v-net').classList.toggle('on',v==='net');
  if(v==='net'){
    if(!gsvg.querySelector('defs')){defs();applyView();}
    if(!netBooted){netBooted=true;netTick();}
    else{simHot=80;runSim();}
    mailPulseStart();
  }else{
    mailPulseStop();
    // replay 中なら停止 (network 専用機能)
    if(typeof stopReplay==='function' && window._replayMode) stopReplay();
    // network 以外に切り替えたら選択モードを終了
    if(typeof setSelMode==='function')setSelMode(false);
  }
}
(function(){
  const LN_MIN=Math.log(1/24),LN_MAX=Math.log(30);
  function toDays(t){return Math.exp(LN_MIN+t*(LN_MAX-LN_MIN));}
  function fmtDays(d){
    if(d<1){const h=d*24;return '~ '+h.toFixed(1)+'h';}
    return '~ '+d.toFixed(1)+'d';
  }
  let debTm=0;
  const rng=document.getElementById('winrange');
  const lbl=document.getElementById('winlabel');
  const btn=document.getElementById('winall');
  // init from allowlisted URL state, otherwise use the slider default
  const initD=toDays(+rng.value);
  if(gWin==='all'){
    gWinLabel='ALL';lbl.textContent='ALL';btn.classList.add('on');
  }else{
    gWin=String(initD);gWinLabel=fmtDays(initD);lbl.textContent=gWinLabel;
  }
  rng.addEventListener('input',()=>{
    btn.classList.remove('on');
    const d=toDays(+rng.value);
    gWin=String(d);gWinLabel=fmtDays(d);lbl.textContent=gWinLabel;
    clearTimeout(debTm);
    debTm=setTimeout(()=>{gmap.clear();netTick();},200);
  });
  btn.addEventListener('click',()=>{
    if(gWin==='all'){
      const d=toDays(+rng.value);
      gWin=String(d);gWinLabel=fmtDays(d);lbl.textContent=gWinLabel;
    }else{
      gWin='all';gWinLabel='ALL';lbl.textContent='ALL';
    }
    btn.classList.toggle('on',gWin==='all');
    gmap.clear();netTick();
  });
})();
addEventListener('resize',()=>{if(view==='net'){simHot=60;runSim();}});

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
  savedGedges:[],            // 同上 gedges
  savedGspawn:[],            // 同上 gspawn
  pendingFadeIn:new Set(),   // 直近 spawn 経路で gmap に追加された node 名 (rebuild 後にクラス付与)
  pendingEdgeFadeIn:new Set(),// 直近で gedges/gspawn に追加された edge key
  askActive:new Set(),       // 現在 ask 状態の agent
  dirty:false,               // topology が変わったら true (次 tick で buildEls)
  edgeCountChanged:false,    // mail count++ のみ → badge text 同期で済む
};
// Task G++ (1624): filter 判定 — mail/spawn は両端、retire/exit/ask は単独 endpoint
function _rbEventPasses(ev){
  if(!RP.filterGroupOnly) return true;
  const sel=RP.selSet;
  if(ev.kind==='retire' || ev.kind==='exit'
     || ev.kind==='ask_start' || ev.kind==='ask_end') return sel.has(ev.agent);
  // mail_sent / mail_recv / spawn は両端
  return sel.has(ev.sender||ev.agent) && sel.has(ev.recipient||ev.ref);
}
/* ── Task H v2: TIME-TRAVEL — graph をゼロから build (msg 1632) ──────────
   gmap/gedges/gspawn を replay の event で incremental に push し、
   既存の force simulation (step/paint/runSim) に乗せる。`tt-hidden` 隠蔽は
   廃止し、node は **物理的に** 生まれて drift する。retire は g.retired を
   立てて buildEls 経由でグレースケール化。
   - replay 開始: 全状態を snapshot して gmap を initial_alive のみに reset
   - event 適用: spawn → 子 node を親付近に push、mail → comm edge を create
     or count+1、retire → g.retired=true
   - rewind: snapshot 初期状態に re-seed → forward-apply silent
   - 終了: 元の gmap/gedges/gspawn を restore
*/
function _ttEdgeKey(a,b){return a<b?a+'|'+b:b+'|'+a;}
function _ttFindCommEdge(a,b){
  for(const e of gedges){
    if((e.source===a&&e.target===b)||(e.source===b&&e.target===a)) return e;
  }
  return null;
}
function _ttFindSpawnEdge(parent, child){
  for(const e of gspawn){
    if(e.source===parent&&e.target===child) return e;
  }
  return null;
}
// 親付近 (or random) に新ノードを seed。meta は savedGmap から復元。
function _ttSeedNode(name, parent){
  if(!name || gmap.has(name)) return;
  const {w,h}=netDims();
  let px=w/2, py=h/2;
  if(parent){
    const pg=gmap.get(parent);
    if(pg){px=pg.x; py=pg.y;}
  }
  const jitterR=42;
  const ang=Math.random()*Math.PI*2;
  const meta=RP.savedGmap.get(name)||{};
  const seed={
    x:px+Math.cos(ang)*jitterR*(0.6+Math.random()*0.8),
    y:py+Math.sin(ang)*jitterR*(0.6+Math.random()*0.8),
    // 親から飛び出す感じで初期 velocity を与える
    vx:Math.cos(ang)*4*(0.8+Math.random()*0.6),
    vy:Math.sin(ang)*4*(0.8+Math.random()*0.6),
    fixed:false,
    deg:0, act:0, sig:0,
    // meta を savedGmap から copy (portrait/role/model 等が無いと node が "?" になる)
    model:meta.model||'', provider:meta.provider||'',
    running:!!meta.running, present:!!meta.present,
    retired:!!meta.retired, rel:meta.rel||'—',
    task:meta.task||'', live:meta.live||'',
    state:meta.state||'', deliv:+meta.deliv||0,
    ctxUsed:meta.ctxUsed, actState:meta.actState||'',
    ctxWindow:meta.ctxWindow||'',
    workDisp:meta.workDisp||'', workSecs:+meta.workSecs||0,
    lastDisp:meta.lastDisp||'', annot:meta.annot||null,
    role:meta.role||'none',
  };
  gmap.set(name, seed);
  RP.pendingFadeIn.add(name);
  RP.dirty=true;
}
// state-only apply: silent 版 (animation は次の rebuild と pendingFadeIn で出る)
function _rbApplyStateOnly(ev){
  if(!RP.timeTravel) return;
  if(ev.kind==='mail_sent' || ev.kind==='mail_recv'){
    const a=ev.sender||ev.agent, b=ev.recipient||ev.ref;
    if(!a||!b) return;
    // 両端の node を sim に追加 (sender 側を親とみなして相手を seed)
    if(!gmap.has(a)) _ttSeedNode(a, b);
    if(!gmap.has(b)) _ttSeedNode(b, a);
    // comm edge: 無ければ create (count=1)、あれば count++
    let edge=_ttFindCommEdge(a,b);
    if(!edge){
      edge={source:a, target:b, count:1};
      gedges.push(edge);
      RP.pendingEdgeFadeIn.add(_ttEdgeKey(a,b));
      RP.dirty=true;
    } else {
      edge.count=(edge.count||0)+1;
      // edge text badge は paint 内で書き換えではなく buildEls 後の sync が要る。
      // ここでは increment を gmap.deg にも反映し、後で badgeSync が拾う。
      RP.edgeCountChanged=true;
    }
    // node-level act increment (label/HP には影響しないが、互換のため g.act 更新)
    const an=gmap.get(a); if(an) an.act=(an.act||0)+1;
    if(b!==a){
      const bn=gmap.get(b); if(bn) bn.act=(bn.act||0)+1;
    }
  } else if(ev.kind==='spawn'){
    const p=ev.sender||ev.agent, c=ev.recipient||ev.ref;
    if(!p||!c) return;
    if(!gmap.has(p)) _ttSeedNode(p, null);
    if(!gmap.has(c)) _ttSeedNode(c, p);
    if(!_ttFindSpawnEdge(p,c)){
      gspawn.push({source:p, target:c});
      RP.pendingEdgeFadeIn.add(_ttEdgeKey(p,c));
      RP.dirty=true;
    }
  } else if(ev.kind==='retire'){
    const g=gmap.get(ev.agent);
    if(g){g.retired=true; g.running=false; RP.dirty=true;}
  } else if(ev.kind==='exit'){
    const g=gmap.get(ev.agent);
    if(g){g.state='finished'; g.running=false; RP.dirty=true;}
  } else if(ev.kind==='ask_start'){
    RP.askActive.add(ev.agent);
    const o=gEls.node&&gEls.node.get&&gEls.node.get(ev.agent);
    if(o&&o.grp) o.grp.classList.add('replay-ask');
  } else if(ev.kind==='ask_end'){
    RP.askActive.delete(ev.agent);
    const o=gEls.node&&gEls.node.get&&gEls.node.get(ev.agent);
    if(o&&o.grp) o.grp.classList.remove('replay-ask');
  }
}
// dirty 時の rebuild は次の rAF tick で 1 回だけ走らせる (collapse)
function _ttFlushRebuildIfDirty(){
  if(!RP.timeTravel || !RP.dirty) {
    if(RP.edgeCountChanged) { _ttSyncEdgeBadges(); RP.edgeCountChanged=false; }
    return;
  }
  RP.dirty=false;
  RP.edgeCountChanged=false;
  buildEls();
  // 新規 node に fade-in を付与 (buildEls 後の next frame で sticky)
  for(const name of RP.pendingFadeIn){
    const o=gEls.node&&gEls.node.get&&gEls.node.get(name);
    if(o&&o.grp){
      o.grp.classList.add('tt-spawning');
      const grp=o.grp;
      setTimeout(()=>grp.classList.remove('tt-spawning'), 1100);
    }
  }
  RP.pendingFadeIn.clear();
  // 新規 edge にも pulse を付ける (DOM lookup)
  for(const o of gEls.edge){
    const k=_ttEdgeKey(o.s,o.t);
    if(RP.pendingEdgeFadeIn.has(k) && o.ln){
      const ln=o.ln;
      ln.classList.add('tt-edge-spawning');
      setTimeout(()=>ln.classList.remove('tt-edge-spawning'), 1150);
    }
  }
  RP.pendingEdgeFadeIn.clear();
  // ask state を保持: rebuild 後にも replay-ask を当てる
  for(const name of RP.askActive){
    const o=gEls.node&&gEls.node.get&&gEls.node.get(name);
    if(o&&o.grp) o.grp.classList.add('replay-ask');
  }
  simHot=Math.max(simHot, 60);
  runSim();
}
// badge text のみ live で更新 (rebuild 不要な hot path)
function _ttSyncEdgeBadges(){
  if(!gEls.badge) return;
  for(const bd of gEls.badge){
    const e=_ttFindCommEdge(bd.s, bd.t);
    if(e && bd.tx) bd.tx.textContent=String(e.count||0);
  }
}
// rewind: 初期状態 (gmap=initial_alive, gedges=[], gspawn=[]) に戻して
// forward-apply silent
function _ttResetState(){
  if(!RP.timeTravel) return;
  // gmap を初期状態に再構築
  gmap.clear();
  gedges.length=0;
  gspawn.length=0;
  const {w,h}=netDims();
  for(const name of RP.initialAlive){
    const meta=RP.savedGmap.get(name)||{};
    gmap.set(name, {
      x:meta.x ?? (w/2+(Math.random()-.5)*120),
      y:meta.y ?? (h/2+(Math.random()-.5)*120),
      vx:0, vy:0, fixed:false,
      deg:0, act:0, sig:0,
      model:meta.model||'', provider:meta.provider||'',
      running:!!meta.running, present:!!meta.present,
      retired:!!meta.retired, rel:meta.rel||'—',
      task:meta.task||'', live:meta.live||'',
      state:meta.state||'', deliv:+meta.deliv||0,
      ctxUsed:meta.ctxUsed, actState:meta.actState||'',
      ctxWindow:meta.ctxWindow||'',
      workDisp:meta.workDisp||'', workSecs:+meta.workSecs||0,
      lastDisp:meta.lastDisp||'', annot:meta.annot||null,
      role:meta.role||'none',
    });
  }
  RP.askActive=new Set();
  RP.pendingFadeIn.clear();
  RP.pendingEdgeFadeIn.clear();
  RP.dirty=true;
  RP.edgeCountChanged=false;
  buildEls();
  simHot=Math.max(simHot, 80);
  runSim();
}
function _rbNodeAskPop(name){
  if(!name) return;
  const o=gEls.node&&gEls.node.get&&gEls.node.get(name);
  if(!o||!o.grp) return;
  const g=gmap.get(name); if(!g) return;
  const scr=worldToScreen(g.x, g.y);
  const el=document.createElement('div');
  el.className='ask-replay-glyph';
  el.textContent='?';
  el.style.left=scr.x+'px';
  el.style.top=scr.y+'px';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 950);
}
function _rbNodeAlertPulse(name){
  if(!name) return;
  const o=gEls.node&&gEls.node.get&&gEls.node.get(name);
  if(!o||!o.grp) return;
  o.grp.classList.add('replay-alert');
  setTimeout(()=>o.grp.classList.remove('replay-alert'), 1050);
}
function _rb(id){return document.getElementById(id);}
function _rbSetPlay(playing){
  const b=_rb('rbPlay'); if(!b)return;
  b.classList.toggle('playing',playing);
  b.querySelector('.rb-glyph').textContent=playing?'⏸':'▶';
  b.querySelector('.rb-plab').textContent=playing?'PAUSE':'PLAY';
  b.setAttribute('aria-pressed', playing?'true':'false');
}
function _rbFmtClock(ts,nowTs){
  if(!ts){return ['--:--','--'];}
  const d=new Date(ts*1000);
  const hh=String(d.getHours()).padStart(2,'0');
  const mm=String(d.getMinutes()).padStart(2,'0');
  const delta=Math.max(0,nowTs-ts);
  const rel=delta<=3?'NOW':('-'+fmtSpan(delta));    // range 単位に追従
  return [hh+':'+mm, rel];
}
function _rbRender(){
  if(!RP.active)return;
  const span=Math.max(1, RP.nowTs-RP.sinceTs);
  const pct=Math.max(0,Math.min(1,(RP.virtTs-RP.sinceTs)/span));
  const fill=_rb('rbFill'); const thumb=_rb('rbThumb');
  if(fill) fill.style.width=(pct*100).toFixed(2)+'%';
  if(thumb){
    thumb.style.left=(pct*100).toFixed(2)+'%';
    thumb.setAttribute('aria-valuenow', Math.round(pct*100));
  }
  const [abs,rel]=_rbFmtClock(Math.round(RP.virtTs), RP.nowTs);
  const a=_rb('rbAbs'); const r=_rb('rbRel');
  if(a) a.textContent=abs;
  if(r) r.textContent=rel;
  _rbUpdateMarkerPlayed();
}
function _rbMarkEdges(){
  // 選択外への edge は半透明 (replay-out)。
  if(!gEls.edge)return;
  const sel=new Set(RP.names);
  for(const o of gEls.edge){
    const out=!(sel.has(o.s) && sel.has(o.t));
    if(out){ o.ln.classList.add('replay-out'); RP.outEdges.add(o.ln); }
  }
}
function _rbUnmarkEdges(){
  for(const ln of RP.outEdges) ln.classList.remove('replay-out');
  RP.outEdges.clear();
}
function _rbWinMs(){
  // ×1 で実時間, ×2880 だと 24h(=86400000ms) ÷ 2880 = 30000ms (30s)
  const win=(RP.nowTs-RP.sinceTs)*1000;
  return Math.max(1000, win/RP.speed);
}
function _rbTravelMsForMail(){
  // MAIL_TRAVEL_MS は通常 1700ms。speed が高いほど短く（24h→30s なら ~150-300ms）。
  // 実時間相当の travel が長すぎると重なって読めないので 200ms 下限。
  const winMs=_rbWinMs();
  return Math.max(200, Math.min(1700, winMs*0.05));
}
function _rbDispatch(ev){
  // Task H v2: time-travel mode は state を gmap/gedges に push (rebuild は次 tick)
  if(RP.timeTravel) _rbApplyStateOnly(ev);
  if(ev.kind==='mail_sent' || ev.kind==='mail_recv'){
    // urgent mail → recipient で `!` パルス
    if((ev.importance||'').toLowerCase()==='urgent'){
      const tgt=ev.kind==='mail_recv'
        ? (ev.recipient||ev.agent)
        : (ev.recipient||ev.ref);
      _rbNodeAlertPulse(tgt);
    }
    // Broadcast history arrives as one event per recipient with the same id.
    // Keep comets unique per recipient while grouping the card by message id.
    const _mid=ev.id||(ev.ts+'-'+ev.sender);
    mailQueue.push({
      id:'replay-mail-'+_mid+':'+(ev.recipient||ev.ref||''),
      ts:ev.ts,
      sender:ev.sender||ev.agent,
      recipient:ev.recipient||ev.ref,
      subject:(ev.subject||'').slice(0,90),
      excerpt:'',
      importance:(ev.importance||'normal'),
      kind:'replay',
      thread_id:ev.thread_id||null,
      travel_ms:_rbTravelMsForMail(),
      _gkey:'rb-mail-'+_mid,
      _rcount:ev.rcpt_n||1,
    });
    while(mailQueue.length>40) mailQueue.shift();
    mailDrain();
  } else if(ev.kind==='spawn'){
    const parent=ev.sender||ev.agent, child=ev.recipient||ev.ref;
    // 古い fade-in helper も残しておく (rebuild 後の重ねがけは安全)
    _rbFireSpawnEdge(parent, child);
    mailQueue.push({
      id:'replay-spawn-'+(ev.id||(ev.ts+'-'+parent)),
      ts:ev.ts, sender:parent, recipient:child,
      subject:(ev.subject||'').slice(0,90), excerpt:'',
      importance:(ev.importance||'normal'), kind:'spawn',
      thread_id:null, travel_ms:_rbTravelMsForMail()*0.85,
    });
    mailDrain();
  } else if(ev.kind==='retire'){
    _rbNodeRetireFlash(ev.agent);
  } else if(ev.kind==='exit'){
    _rbNodeExitGlyph(ev.agent);
  } else if(ev.kind==='ask_start'){
    if(RP.timeTravel) _rbNodeAskPop(ev.agent);
  }
}
function _rbFireSpawnEdge(parent, child){
  if(!gEls.edge)return;
  for(const o of gEls.edge){
    if((o.s===parent&&o.t===child)||(o.s===child&&o.t===parent)){
      if(o.ln){
        o.ln.classList.add('replay-spawn-pulse');
        setTimeout(()=>o.ln.classList.remove('replay-spawn-pulse'), 1200);
      }
    }
  }
}
function _rbNodeFadeIn(name){
  if(!name)return;
  const o=gEls.node&&gEls.node.get&&gEls.node.get(name);
  if(!o||!o.grp)return;
  o.grp.classList.add('node-spawn-fadein');
  setTimeout(()=>o.grp.classList.remove('node-spawn-fadein'), 1200);
}
function _rbNodeRetireFlash(name){
  if(!name)return;
  const o=gEls.node&&gEls.node.get&&gEls.node.get(name);
  if(!o||!o.grp)return;
  o.grp.classList.add('node-retire-flash');
  setTimeout(()=>o.grp.classList.remove('node-retire-flash'), 1400);
}
function _rbNodeExitGlyph(name){
  if(!name)return;
  const o=gEls.node&&gEls.node.get&&gEls.node.get(name);
  if(!o||!o.grp)return;
  const g=gmap.get(name); if(!g)return;
  const scr=worldToScreen(g.x,g.y);
  const el=document.createElement('div');
  el.className='node-exit-glyph';
  el.textContent='↩';
  el.style.left=scr.x+'px';
  el.style.top=scr.y+'px';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 1500);
}
function _rbTick(t){
  if(!RP.active){ RP.rafId=0; return; }
  RP.rafId=requestAnimationFrame(_rbTick);
  // Task H v2: time-travel ON は paused 中でも force sim を回し続ける
  // (sliders / drag が即座に効くようにする)。simHot を毎フレーム warm に保つ。
  if(RP.timeTravel){
    simHot=Math.max(simHot, 30);
    if(!simRAF) runSim();
  }
  if(RP.paused || RP.scrubDragging){
    RP.lastFrameMs=t;
    _rbRender();
    _ttFlushRebuildIfDirty();
    return;
  }
  if(!RP.lastFrameMs){ RP.lastFrameMs=t; return; }
  const dtMs=t-RP.lastFrameMs;
  RP.lastFrameMs=t;
  RP.virtTs += (dtMs/1000)*RP.speed;
  if(RP.virtTs >= RP.nowTs){
    RP.virtTs=RP.nowTs;
    _rbFlushUntilVirt();
    _ttFlushRebuildIfDirty();
    _rbRender();
    _rbPause();
    return;
  }
  _rbFlushUntilVirt();
  _ttFlushRebuildIfDirty();
  _rbRender();
}
function _rbFlushUntilVirt(){
  const events=RP.events;
  while(RP.nextIdx<events.length && events[RP.nextIdx].ts <= RP.virtTs){
    const ev=events[RP.nextIdx];
    if(_rbEventPasses(ev)) _rbDispatch(ev);
    RP.nextIdx++;
  }
}
function _rbPlay(){
  if(!RP.active)return;
  if(RP.virtTs >= RP.nowTs){ RP.virtTs = RP.sinceTs; RP.nextIdx=0; }
  RP.paused=false; RP.lastFrameMs=0;
  _rbSetPlay(true);
  if(!RP.rafId) RP.rafId=requestAnimationFrame(_rbTick);
}
function _rbPause(){
  RP.paused=true; _rbSetPlay(false);
}
function _rbTogglePlay(){
  if(!RP.active)return;
  if(RP.paused) _rbPlay(); else _rbPause();
}
// Task G++: 連続 log-scale 速度
const RB_SPD_MIN=1, RB_SPD_MAX=10000;
const _RB_LOGMAX=Math.log(RB_SPD_MAX);    // ln(10000) ≒ 9.21
function _rbSpdToT(spd){
  // speed → slider position t ∈ [0,1]
  const v=Math.max(RB_SPD_MIN, Math.min(RB_SPD_MAX, spd));
  return Math.log(v)/_RB_LOGMAX;
}
function _rbTToSpd(t){
  // t ∈ [0,1] → speed (exact preset snap で見やすく数値整える)
  const raw=Math.exp(Math.max(0,Math.min(1,t))*_RB_LOGMAX);
  // 端は丸める。それ以外は人間が読みやすい sigfig 2 桁丸め
  if(raw<=1.05) return 1;
  if(raw>=RB_SPD_MAX*0.97) return RB_SPD_MAX;
  if(raw<10) return Math.round(raw*10)/10;
  if(raw<100) return Math.round(raw);
  return Math.round(raw/10)*10;
}
function _rbFmtSpeed(spd){
  if(spd<10) return '×'+spd.toFixed(1).replace(/\.0$/,'');
  return '×'+Math.round(spd);
}
function _rbSetSpeed(spd){
  RP.speed=Math.max(RB_SPD_MIN, Math.min(RB_SPD_MAX, spd));
  const t=_rbSpdToT(RP.speed);
  const thumb=_rb('rbSpdThumb');
  const fill=_rb('rbSpdFill');
  const val=_rb('rbSpdVal');
  if(thumb){
    thumb.style.left=(t*100).toFixed(2)+'%';
    thumb.setAttribute('aria-valuenow', Math.round(RP.speed));
  }
  if(fill) fill.style.width=(t*100).toFixed(2)+'%';
  if(val) val.textContent=_rbFmtSpeed(RP.speed);
}
function _rbBuildSpeedTicks(){
  // ticks at all presets + minor decade marks
  const ticks=_rb('rbSpdTicks'); if(!ticks)return;
  ticks.innerHTML='';
  const major=[1,60,2880,10000];
  const minor=[10,100,1000];
  const add=(v,maj)=>{
    const t=_rbSpdToT(v);
    const s=document.createElement('span');
    s.style.left=(t*100).toFixed(2)+'%';
    if(maj) s.className='maj';
    s.title='×'+v;
    ticks.appendChild(s);
  };
  for(const v of major) add(v,true);
  for(const v of minor) add(v,false);
}
function _rbSpeedFromPointer(ev){
  const track=_rb('rbSpdTrack'); if(!track)return;
  const r=track.getBoundingClientRect();
  const t=Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width));
  _rbSetSpeed(_rbTToSpd(t));
}
// ── HOLD (メッセージカード滞留時間) — 対数スケール 0.1s..15s ───────────
// 0.1s〜15s は 150 倍。線形だと低速側が潰れるので SPD と同様 log スケール。
const RB_HOLD_MIN=100, RB_HOLD_MAX=15000;
const _RB_HOLD_LOGR=Math.log(RB_HOLD_MAX/RB_HOLD_MIN);   // ln(150) ≒ 5.01
function _rbHoldToT(ms){
  const v=Math.max(RB_HOLD_MIN, Math.min(RB_HOLD_MAX, ms));
  return Math.log(v/RB_HOLD_MIN)/_RB_HOLD_LOGR;
}
function _rbTToHold(t){
  let raw=RB_HOLD_MIN*Math.exp(Math.max(0,Math.min(1,t))*_RB_HOLD_LOGR);
  if(raw<=RB_HOLD_MIN*1.05) return RB_HOLD_MIN;
  if(raw>=RB_HOLD_MAX*0.97) return RB_HOLD_MAX;
  const step=raw<1000?100:500;   // 1s 未満は 0.1s 刻み、以上は 0.5s 刻み
  return Math.round(raw/step)*step;
}
function _rbFmtHold(ms){
  return (ms/1000).toFixed(1).replace(/\.0$/,'')+'s';
}
function _rbSetHold(ms){
  RP.holdMs=Math.max(RB_HOLD_MIN, Math.min(RB_HOLD_MAX, ms));
  const t=_rbHoldToT(RP.holdMs);
  const thumb=_rb('rbHoldThumb');
  const fill=_rb('rbHoldFill');
  const val=_rb('rbHoldVal');
  if(thumb){
    thumb.style.left=(t*100).toFixed(2)+'%';
    thumb.setAttribute('aria-valuenow', Math.round(RP.holdMs));
  }
  if(fill) fill.style.width=(t*100).toFixed(2)+'%';
  if(val) val.textContent=_rbFmtHold(RP.holdMs);
  try{ localStorage.setItem('agentdash.holdMs', String(RP.holdMs)); }catch(_){}
}
function _rbBuildHoldTicks(){
  const ticks=_rb('rbHoldTicks'); if(!ticks)return;
  ticks.innerHTML='';
  const major=[100,1000,6000];
  const minor=[300,500,3000,15000];
  const add=(v,maj)=>{
    const t=_rbHoldToT(v);
    const s=document.createElement('span');
    s.style.left=(t*100).toFixed(2)+'%';
    if(maj) s.className='maj';
    s.title=_rbFmtHold(v);
    ticks.appendChild(s);
  };
  for(const v of major) add(v,true);
  for(const v of minor) add(v,false);
}
function _rbHoldFromPointer(ev){
  const track=_rb('rbHoldTrack'); if(!track)return;
  const r=track.getBoundingClientRect();
  const t=Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width));
  _rbSetHold(_rbTToHold(t));
}
// Task G+++ (1625): event marker overlay
function _rbBuildMarkers(){
  const wrap=_rb('rbMarkers'); if(!wrap)return;
  wrap.innerHTML='';
  RP.markerEls.length=0;
  const span=Math.max(1, RP.nowTs - RP.sinceTs);
  for(let i=0;i<RP.events.length;i++){
    const ev=RP.events[i];
    const pct=Math.max(0,Math.min(1,(ev.ts - RP.sinceTs)/span));
    const el=document.createElement('div');
    el.className='rb-mk k-'+(ev.kind||'mail').replace('_','-').split('-')[0];
    // kind class 体系: mail_sent/mail_recv → 'k-mail', spawn → 'k-spawn', retire → 'k-retire', exit → 'k-exit'
    if(ev.kind==='mail_sent' || ev.kind==='mail_recv') el.className='rb-mk k-mail';
    else if(ev.kind==='spawn') el.className='rb-mk k-spawn';
    else if(ev.kind==='retire') el.className='rb-mk k-retire';
    else if(ev.kind==='exit') el.className='rb-mk k-exit';
    el.style.left=(pct*100).toFixed(3)+'%';
    el.dataset.idx=i;
    el.addEventListener('mouseenter', _rbShowMarkerTip);
    el.addEventListener('mouseleave', _rbHideMarkerTip);
    wrap.appendChild(el);
    RP.markerEls.push(el);
  }
  _rbApplyFilterToMarkers();
}
function _rbApplyFilterToMarkers(){
  // filter ON → 不通過 marker を `.filtered-out` で薄く
  for(let i=0;i<RP.markerEls.length;i++){
    const el=RP.markerEls[i];
    const ev=RP.events[i];
    el.classList.toggle('filtered-out', RP.filterGroupOnly && !_rbEventPasses(ev));
  }
}
function _rbUpdateMarkerPlayed(){
  // virtTs 通過済みの marker は dim
  const v=RP.virtTs;
  for(let i=0;i<RP.markerEls.length;i++){
    const el=RP.markerEls[i];
    el.classList.toggle('played', RP.events[i].ts <= v);
  }
}
function _rbShowMarkerTip(e){
  const idx=+e.currentTarget.dataset.idx;
  const ev=RP.events[idx]; if(!ev)return;
  const tip=_rb('rbMkTip'); if(!tip)return;
  // 形式: "13:42 ✦ MAIL → BlueCurie  ·  Task X 完了"
  const d=new Date(ev.ts*1000);
  const hhmm=String(d.getHours()).padStart(2,'0')+':'
    +String(d.getMinutes()).padStart(2,'0');
  const kindCls='mk-k-'+(ev.kind==='mail_sent'||ev.kind==='mail_recv'?'mail'
    :ev.kind==='spawn'?'spawn':ev.kind==='retire'?'retire':'exit');
  const kindLabel=ev.kind==='mail_sent'?'MAIL ▸':ev.kind==='mail_recv'?'MAIL ◂'
    :ev.kind==='spawn'?'SPAWN ▸':ev.kind==='retire'?'RETIRE'
    :ev.kind==='exit'?'EXIT':String(ev.kind||'').toUpperCase();
  const peer=ev.recipient && ev.sender
    ? (ev.kind==='mail_recv'?ev.sender:ev.recipient)
    : (ev.ref||'');
  const subj=(ev.subject||'').trim();
  const subjPart=subj?'  ·  '+esc(subj.slice(0,40)):'';
  tip.innerHTML=`<span class="mk-t">${hhmm}</span>`
    +`<span class="${kindCls}">${esc(kindLabel)}</span> `
    +`<b>${esc(peer)}</b>${subjPart}`;
  // 位置 = marker と同じ x
  tip.style.left=e.currentTarget.style.left;
  tip.setAttribute('aria-hidden','false');
}
function _rbHideMarkerTip(){
  const tip=_rb('rbMkTip'); if(!tip)return;
  tip.setAttribute('aria-hidden','true');
}
// Task G++ (1624): filter toggle
function _rbSetFilter(on){
  RP.filterGroupOnly=!!on;
  const btn=_rb('rbFilter');
  if(btn) btn.setAttribute('aria-checked', on?'true':'false');
  _rbApplyFilterToMarkers();
}
function _rbToggleFilter(){ _rbSetFilter(!RP.filterGroupOnly); }
function _rbScrubFromPointer(ev){
  const track=document.querySelector('#replayBar .rb-track');
  if(!track)return;
  const r=track.getBoundingClientRect();
  const pct=Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width));
  const span=RP.nowTs-RP.sinceTs;
  const newVirt=RP.sinceTs + span*pct;
  if(newVirt > RP.virtTs){
    while(RP.nextIdx<RP.events.length && RP.events[RP.nextIdx].ts <= newVirt){
      const ev2=RP.events[RP.nextIdx];
      if(RP.timeTravel && _rbEventPasses(ev2)) _rbApplyStateOnly(ev2);
      RP.nextIdx++;
    }
  } else {
    if(RP.timeTravel){
      _ttResetState();
      RP.nextIdx=0;
      while(RP.nextIdx<RP.events.length && RP.events[RP.nextIdx].ts <= newVirt){
        const ev2=RP.events[RP.nextIdx];
        if(_rbEventPasses(ev2)) _rbApplyStateOnly(ev2);
        RP.nextIdx++;
      }
    } else {
      while(RP.nextIdx>0 && RP.events[RP.nextIdx-1].ts > newVirt){
        RP.nextIdx--;
      }
    }
  }
  if(RP.timeTravel) _ttFlushRebuildIfDirty();
  RP.virtTs=newVirt;
  _rbRender();
}
// Task G+: controller bar の axis を range span に合わせて再描画
function _rbRebuildAxis(){
  const axis=_rb('rbAxis'); if(!axis)return;
  const span=Math.max(1, RP.nowTs - RP.sinceTs);
  const labels=[];
  for(let i=0;i<5;i++){
    const t=(4-i)/4;             // 1.0 (=-span) → 0.0 (=now)
    if(i===4) labels.push('now');
    else labels.push('-'+fmtSpan(span*t));
  }
  axis.innerHTML=labels.map(l=>`<span>${l}</span>`).join('');
}
// range の長さから「30 秒で全部流す」を目標に preset を選ぶ。
// ×1 (実時間) / ×60 (1m=1s) / ×2880 (24h=30s) のいずれかにスナップ。
function _rbPickDefaultSpeed(spanSec){
  const presets=[1,60,2880];
  const target=Math.max(1, spanSec/30);
  let best=presets[0], bestDelta=Infinity;
  for(const p of presets){
    const d=Math.abs(Math.log(p/target));
    if(d<bestDelta){bestDelta=d; best=p;}
  }
  return best;
}
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
// Task H v2: TIME-TRAVEL toggle (UI 配線)
function _rbToggleTimeTravel(){
  const wasOn=RP.timeTravel;
  RP.timeTravel=!wasOn;
  localStorage.setItem('agentdash.tt', RP.timeTravel?'1':'0');
  _rbSyncTimeTravelBtn();
  if(!RP.active) return;
  if(RP.timeTravel){
    // OFF → ON: snapshot (もし無ければ現状を snapshot) → reset → forward apply
    document.body.classList.add('tt-on');
    if(RP.savedGmap.size===0){
      RP.savedGmap=new Map();
      for(const [k,v] of gmap) RP.savedGmap.set(k, {...v});
      RP.savedGedges=gedges.map(e=>({...e}));
      RP.savedGspawn=gspawn.map(e=>({...e}));
    }
    if(RP.initialAlive.size===0){
      // initial が空なら最初の event の seed 1 体で開始
      if(RP.events.length){
        const first=RP.events[0];
        const seed=first.sender||first.agent;
        if(seed) RP.initialAlive.add(seed);
      }
    }
    _ttResetState();
    RP.nextIdx=0;
    while(RP.nextIdx<RP.events.length && RP.events[RP.nextIdx].ts <= RP.virtTs){
      const ev2=RP.events[RP.nextIdx];
      if(_rbEventPasses(ev2)) _rbApplyStateOnly(ev2);
      RP.nextIdx++;
    }
    _ttFlushRebuildIfDirty();
  } else {
    // ON → OFF: snapshot を restore して legacy mode の "全 graph" を再現
    document.body.classList.remove('tt-on');
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
  }
  _rbRender();
}
// 配線: replay bar UI
(function(){
  const bar=_rb('replayBar'); if(!bar) return;
  _rb('rbClose').addEventListener('click', stopReplay);
  _rb('rbPlay').addEventListener('click', _rbTogglePlay);
  _rb('rbFilter').addEventListener('click', _rbToggleFilter);
  // Task H: TIME-TRAVEL toggle
  const ttBtn=_rb('rbTimeTravel');
  if(ttBtn){
    ttBtn.addEventListener('click', _rbToggleTimeTravel);
    // 初期状態を pref から復元
    const ttPref=localStorage.getItem('agentdash.tt');
    RP.timeTravel = ttPref===null ? true : (ttPref==='1');
    _rbSyncTimeTravelBtn();
  }
  // 速度スライダー — drag-to-scrub。virtTs を保ったまま速度のみ変わる。
  const sThumb=_rb('rbSpdThumb');
  const sTrack=_rb('rbSpdTrack');
  let spdDragging=false;
  function _spDown(e){
    if(!RP.active)return;
    spdDragging=true;
    sThumb.setPointerCapture && sThumb.setPointerCapture(e.pointerId);
    _rbSpeedFromPointer(e);
  }
  function _spMove(e){
    if(!spdDragging)return;
    _rbSpeedFromPointer(e);
  }
  function _spUp(e){
    if(!spdDragging)return;
    spdDragging=false;
    try{ sThumb.releasePointerCapture(e.pointerId); }catch(_){}
  }
  if(sThumb) sThumb.addEventListener('pointerdown', _spDown);
  if(sTrack) sTrack.addEventListener('pointerdown', e=>{
    if(e.target===sThumb)return;
    if(!RP.active)return;
    spdDragging=true;
    _rbSpeedFromPointer(e);
  });
  window.addEventListener('pointermove', _spMove);
  window.addEventListener('pointerup', _spUp);
  // キーボード: thumb focus 中の ←/→ で 1 step、Shift で大きく
  if(sThumb) sThumb.addEventListener('keydown', ev=>{
    if(!RP.active)return;
    if(ev.key!=='ArrowLeft' && ev.key!=='ArrowRight')return;
    ev.preventDefault();
    const cur=_rbSpdToT(RP.speed);
    const step=ev.shiftKey?0.05:0.01;
    const t=cur + (ev.key==='ArrowRight'?step:-step);
    _rbSetSpeed(_rbTToSpd(t));
  });
  // HOLD スライダー — カード滞留時間。SPD と同じ drag/keyboard パターン。
  const hThumb=_rb('rbHoldThumb');
  const hTrack=_rb('rbHoldTrack');
  let holdDragging=false;
  function _hDown(e){
    if(!RP.active)return;
    holdDragging=true;
    hThumb.setPointerCapture && hThumb.setPointerCapture(e.pointerId);
    _rbHoldFromPointer(e);
  }
  function _hMove(e){ if(holdDragging) _rbHoldFromPointer(e); }
  function _hUp(e){
    if(!holdDragging)return;
    holdDragging=false;
    try{ hThumb.releasePointerCapture(e.pointerId); }catch(_){}
  }
  if(hThumb) hThumb.addEventListener('pointerdown', _hDown);
  if(hTrack) hTrack.addEventListener('pointerdown', e=>{
    if(e.target===hThumb)return;
    if(!RP.active)return;
    holdDragging=true;
    _rbHoldFromPointer(e);
  });
  window.addEventListener('pointermove', _hMove);
  window.addEventListener('pointerup', _hUp);
  if(hThumb) hThumb.addEventListener('keydown', ev=>{
    if(!RP.active)return;
    if(ev.key!=='ArrowLeft' && ev.key!=='ArrowRight')return;
    ev.preventDefault();
    // 1s 未満は 0.1s 刻み、以上は 0.5s 刻み（Shift で大きく）
    const step=RP.holdMs<1000 ? (ev.shiftKey?500:100) : (ev.shiftKey?2000:500);
    _rbSetHold(RP.holdMs + (ev.key==='ArrowRight'?step:-step));
  });
  const thumb=_rb('rbThumb'); const track=document.querySelector('#replayBar .rb-track');
  function down(e){
    if(!RP.active)return;
    RP.scrubDragging=true;
    thumb.setPointerCapture && thumb.setPointerCapture(e.pointerId);
    _rbScrubFromPointer(e);
  }
  function move(e){
    if(!RP.scrubDragging)return;
    _rbScrubFromPointer(e);
  }
  function up(e){
    if(!RP.scrubDragging)return;
    RP.scrubDragging=false;
    thumb.releasePointerCapture && thumb.releasePointerCapture(e.pointerId);
    RP.lastFrameMs=0;     // dt リセット (大ジャンプ後の暴走防止)
  }
  // クリック (track) / ドラッグ (thumb) どちらも対応
  thumb.addEventListener('pointerdown', down);
  track.addEventListener('pointerdown', e=>{
    if(e.target===thumb)return;       // thumb のドラッグ開始は別経路
    if(!RP.active)return;
    RP.scrubDragging=true;
    _rbScrubFromPointer(e);
  });
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  // space で play/pause
  window.addEventListener('keydown', ev=>{
    if(!RP.active)return;
    // テキスト入力中は無視
    const tg=ev.target;
    if(tg && (tg.tagName==='INPUT'||tg.tagName==='TEXTAREA'||tg.isContentEditable))return;
    if(ev.key===' '){ ev.preventDefault(); _rbTogglePlay(); }
  });
})();

/* ═══════════════════════ AGENT DETAIL PANEL ═══════════════════════ */
let panelName=null,panelTab='hist';
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
TM('tm-exit-btn').addEventListener('click',async()=>{
  if(!panelName)return;
  const btn=TM('tm-exit-btn');
  btn.textContent='…';btn.disabled=true;
  try{
    const r=await fetch('/api/exit',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({session:panelName})});
    const j=await r.json();
    btn.disabled=false;
    if(j.ok){
      const warn=(j.actions||[]).includes('warn-attached')?' (attached)':'';
      toast('▸ EXIT','> '+panelName+'  ::  /exit sent'+warn);
      btn.textContent='↩ Exit';}
    else{toast('✕ FAIL','> '+(j.error||'unknown'),true);
      btn.textContent='↩ Exit';}
  }catch(e){
    btn.disabled=false;
    btn.textContent='↩ Exit';
    toast('✕ FAIL','> exit err: '+e,true);
  }
});
addEventListener('keydown',e=>{if(e.key==='Escape'&&panelName)closeTerm();});
TM('tm-tabs').addEventListener('click',e=>{
  const b=e.target.closest('button[data-tab]');if(b)setTab(b.dataset.tab);
});
TM('tm-open').addEventListener('click',()=>{
  if(panelName)jump(panelName,{stopPropagation(){}});
});

document.getElementById('q').addEventListener('input',render);
for(const b of document.querySelectorAll('#history button'))
  b.setAttribute('aria-checked',String(b.dataset.history===INITIAL_ROUTE.history));
document.getElementById('history').addEventListener('click',e=>{
  const b=e.target.closest('button[data-history]');if(b)setHistoryRange(b.dataset.history);
});
document.getElementById('wrap').addEventListener('click',e=>{
  const a=e.target.closest('.state a[data-history]');if(a)setHistoryRange(a.dataset.history);
});
loadCustomPortraits();
if(INITIAL_ROUTE.view==='net')setView('net');
tick();
setInterval(()=>{ if(document.hidden||netSuspended)return; if(view==='deck') tick(); },3000);

async function mailHealthTick(){
  try{
    const r=await fetch('/api/mail-watcher-health');
    const d=await r.json();
    const el=document.getElementById('mail-health');
    if(!el) return;
    el.dataset.status=d.status||'unknown';
    const age=d.last_success_age_s;
    const parts=[];
    if(d.watcher_running) parts.push('watcher: up');
    else parts.push('watcher: DOWN');
    if(age!=null) parts.push('last ok: '+age+'s ago');
    if(d.signal_count>0) parts.push('signals: '+d.signal_count);
    const rc=d.recent_results||{};
    if(Object.keys(rc).length) parts.push('10m: '+Object.entries(rc).map(([k,v])=>k+'='+v).join(' '));
    el.title='mail health: '+parts.join(' · ');
  }catch(e){}
}
mailHealthTick();
setInterval(()=>{ if(document.hidden||netSuspended)return; mailHealthTick(); },10000);

// ── + NEW AGENT spawn modal ────────────────────────────────────
// 1) parent dropdown を現存 agent から構築 (running 優先)
// 2) /api/spawn に POST → server.py が register_agent / send_message /
//    annotate / spawn_child.sh を実行
// 3) child name を toast し、5s 後 tick() が deck に新エージェントを拾う
const SPM=id=>document.getElementById(id);
const SPM_DIR_KEY='agentdash.spawn.dir';
const SPM_TASK_DRAFT_KEY='agentdash.spawn.task-draft';
const SPM_ADVANCED_KEY='agentdash.spawn.advanced';
let spmBusy=false,spmReady=false,spmLoadSeq=0;
let spmSelectedName='',spmSelectedProvider='',spmSelectedModel='';
let spmSelectedEffort='',spmProviders=[];
let spmNameStatus=new Map();
let spmAdjectives=[],spmSuggestedName='',spmSuggestedPrefix='';
let spmSuggestedScientist='';
let spmIdentitySeq=0,spmIdentityState='auto',spmIdentityError='';
let spmDirSeq=0,spmDirTimer=null,spmDirOptions=[],spmDirActive=-1;
let spmDirRoot='';
let spmDraftDir='',spmDraftRestored=false;

function spawnTaskDraftKey(dir){
  return SPM_TASK_DRAFT_KEY+'.'+encodeURIComponent(String(dir||'').trim());
}

function saveSpawnTaskDraft(dir=spmDraftDir,value=SPM('spm-task').value){
  const target=String(dir||'').trim();
  if(!target)return false;
  try{
    const key=spawnTaskDraftKey(target);
    if(value)localStorage.setItem(key,value);
    else localStorage.removeItem(key);
    return true;
  }catch(e){return false;}
}

function restoreSpawnTaskDraft(dir){
  const target=String(dir||'').trim();
  let draft='';
  if(target){
    try{draft=localStorage.getItem(spawnTaskDraftKey(target))||'';}catch(e){}
  }
  SPM('spm-task').value=draft;
  spmDraftDir=target;
  spmDraftRestored=!!draft;
  return spmDraftRestored;
}

function clearSpawnTaskDraft(dir){
  const target=String(dir||'').trim();
  if(!target)return;
  try{localStorage.removeItem(spawnTaskDraftKey(target));}catch(e){}
}

function setSpawnDraftStatus(restored){
  if(restored)
    setSpawnStat('restored saved task draft · '+spmDraftDir,'ok');
  else setSpawnStat('ready · review the launch manifest','');
}

function updateSpawnButton(){
  const button=SPM('spm-spawn');
  if(!button)return;
  const identityReady=!spmSelectedName||spmIdentityState==='verified';
  button.disabled=spmBusy||!spmReady||!identityReady;
}

function populateParentSelect(){
  const sel=SPM('spm-parent');
  if(!sel) return;
  // lastData: render() 同期で更新される現存 agent 配列
  const candidates=(Array.isArray(lastData)?lastData:[])
    .filter(a=>a&&a.name&&(a.category==='agent'||a.category==='finished'))
    .sort((a,b)=>{
      // running 優先 → last_active 降順
      const ra=a.running?0:1, rb=b.running?0:1;
      if(ra!==rb) return ra-rb;
      return (b.last_active||0)-(a.last_active||0);
    });
  // dashboard 自身が親になりたい場合に備えて手動入力も許可するが、
  // まずは現存 agent から拾う (空でも壊れない)
  const standalone=
    '<option value="">STANDALONE · independent agent</option>';
  const opts=candidates.map(a=>{
    const tag=a.running?'●':'○';
    const meta=a.last_active_rel||'';
    return `<option value="${esc(a.name)}">${tag} ${esc(a.name)} · ${esc(meta)}</option>`;
  });
  sel.innerHTML=standalone+opts.join('');
  sel.value='';
}

function renderSpawnNames(names){
  const strip=SPM('spm-agent-strip');
  spmNameStatus=new Map();
  const rows=Array.isArray(names)?names:[];
  for(const row of rows){
    if(row&&row.name)spmNameStatus.set(row.name,
      row.status==='available'?'available':
      row.status==='occupied'?'occupied':'unknown');
  }
  const auto=`<button type="button" class="spm-agent spm-agent-auto on" `+
    `data-name="" role="option" aria-selected="true">`+
    `<span class="spm-agent-face">∴</span>`+
    `<span class="spm-agent-name">AUTO</span>`+
    `<span class="spm-agent-status">launcher</span></button>`;
  strip.innerHTML=auto+rows.map(row=>{
    const name=String(row&&row.name||'');
    const status=spmNameStatus.get(name)||'unknown';
    const enabled=status==='available';
    const initials=name.slice(0,2).toUpperCase();
    const portrait=row&&row.portrait
      ? `<img src="${portURL(name,true)}" alt="" loading="lazy" `+
        `onerror="portraitFallback(this)">`
      : '';
    return `<button type="button" class="spm-agent status-${status}" `+
      `data-name="${esc(name)}" role="option" aria-selected="false" `+
      `${enabled?'':`disabled aria-disabled="true"`}>`+
      `<span class="spm-agent-face"><span class="spm-agent-init">`+
      `${esc(initials)}</span>${portrait}</span>`+
      `<span class="spm-agent-name">${esc(name)}</span>`+
      `<span class="spm-agent-status">${status}</span></button>`;
  }).join('');
  strip.querySelectorAll('.spm-agent:not(:disabled)').forEach(btn=>{
    btn.onclick=()=>selectSpawnName(btn.dataset.name);
  });
  strip.onwheel=e=>{
    if(Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
    e.preventDefault();
    strip.scrollLeft+=e.deltaY;
  };
  const available=[...spmNameStatus.values()]
    .filter(status=>status==='available').length;
  SPM('spm-name-note').textContent=
    `Launcher will choose a name · ${available} scientists available`;
}

function selectSpawnName(name){
  if(name&&spmNameStatus.get(name)!=='available')return;
  spmSelectedName=name||'';
  SPM('spm-agent-strip').querySelectorAll('.spm-agent').forEach(btn=>{
    const on=btn.dataset.name===spmSelectedName;
    btn.classList.toggle('on',on);
    btn.setAttribute('aria-selected',on?'true':'false');
  });
  if(!spmSelectedName){
    spmIdentitySeq++;
    spmSuggestedName='';
    spmSuggestedPrefix='';
    spmSuggestedScientist='';
    spmIdentityState='auto';
    spmIdentityError='';
    renderSpawnComposite();
    if(spmReady)setSpawnStat('ready · review the launch manifest','');
    updateSpawnButton();
    return Promise.resolve('');
  }
  return requestSuggestedSpawnName(spmSelectedName);
}

function renderSpawnComposite(){
  const card=SPM('spm-name-card');
  const picked=!!spmSelectedName;
  const on=picked&&!!spmSuggestedName&&spmIdentityState==='verified';
  card.classList.toggle('on',on);
  card.classList.toggle('checking',picked&&spmIdentityState==='checking');
  card.classList.toggle('err',picked&&spmIdentityState==='error');
  card.setAttribute('aria-busy',
    picked&&spmIdentityState==='checking'?'true':'false');
  SPM('spm-adjective').textContent=on?spmSuggestedPrefix:
    (picked?(spmIdentityState==='checking'?'VERIFYING':'UNAVAILABLE'):'AUTO');
  SPM('spm-scientist').textContent=on?spmSuggestedScientist:
    (picked?spmSelectedName:'NAME');
  const portrait=SPM('spm-name-portrait');
  const fallback=SPM('spm-name-auto');
  fallback.hidden=false;
  fallback.textContent=picked?spmSelectedName.slice(0,2).toUpperCase():'∴';
  portrait.hidden=!picked;
  if(picked){
    portrait.style.display='';
    delete portrait.dataset.portraitFallback;
    portrait.src=portURL(spmSelectedName,true);
    portrait.alt=spmSelectedName;
  }else{
    portrait.removeAttribute('src');
    portrait.alt='';
  }
  if(on){
    SPM('spm-name-note').textContent=
      `Ready to launch as ${spmSuggestedName} · verified available`;
  }else if(picked&&spmIdentityState==='checking'){
    SPM('spm-name-note').textContent='Checking the live identity registry…';
  }else if(picked&&spmIdentityState==='error'){
    SPM('spm-name-note').textContent=
      spmIdentityError||'Identity availability could not be verified';
  }else{
    SPM('spm-name-note').textContent=
      'Launcher will choose an available name';
  }
  SPM('spm-shuffle').disabled=picked&&spmIdentityState==='checking';
}

async function requestSuggestedSpawnName(scientist){
  const requested=String(scientist||'');
  const seq=++spmIdentitySeq;
  spmSuggestedName='';
  spmSuggestedPrefix='';
  spmSuggestedScientist='';
  spmIdentityState='checking';
  spmIdentityError='';
  renderSpawnComposite();
  if(spmReady)setSpawnStat('checking identity availability','');
  updateSpawnButton();
  try{
    const response=await fetch('/api/suggest-name?scientist='+
      encodeURIComponent(requested),{cache:'no-store'});
    const payload=await response.json();
    if(seq!==spmIdentitySeq||requested!==spmSelectedName)return '';
    const fullName=String(payload&&payload.name||'').trim();
    if(response.status===409)
      throw new Error(`${requested} is fully booked · choose another scientist or AUTO`);
    if(!response.ok||!fullName)
      throw new Error((payload&&payload.error)||'identity verification failed');
    const displayScientist=scientistOf(fullName)||'';
    spmSuggestedName=fullName;
    spmSuggestedPrefix=displayScientist
      ? fullName.slice(0,-displayScientist.length):'';
    spmSuggestedScientist=displayScientist||fullName;
    spmIdentityState='verified';
    renderSpawnComposite();
    setSpawnStat('ready · verified identity in launch manifest','');
    updateSpawnButton();
    return fullName;
  }catch(error){
    if(seq!==spmIdentitySeq||requested!==spmSelectedName)return '';
    spmSuggestedName='';
    spmSuggestedPrefix='';
    spmSuggestedScientist='';
    spmIdentityState='error';
    spmIdentityError='Unavailable · '+String(error&&error.message||error);
    renderSpawnComposite();
    setSpawnStat('identity unavailable · retry SHUFFLE or choose AUTO','err');
    updateSpawnButton();
    return '';
  }
}

function shuffleSpawnAdjective(){
  if(!spmSelectedName)return Promise.resolve('');
  return requestSuggestedSpawnName(spmSelectedName);
}

function setSpawnDir(value,persist=false){
  const dir=String(value||'').trim();
  const previous=spmDraftDir;
  const task=SPM('spm-task');
  if(previous&&previous!==dir)saveSpawnTaskDraft(previous,task.value);
  SPM('spm-dir').value=dir;
  SPM('spm-dir-chips').querySelectorAll('.spm-dir-chip').forEach(btn=>{
    const on=btn.dataset.dir===dir;
    btn.classList.toggle('on',on);
    btn.setAttribute('aria-pressed',on?'true':'false');
  });
  if(persist&&dir){
    try{localStorage.setItem(SPM_DIR_KEY,dir);}catch(e){}
  }
  if(dir&&dir!==previous){
    if(!previous&&task.value){
      spmDraftDir=dir;
      spmDraftRestored=false;
      saveSpawnTaskDraft(dir,task.value);
    }else{
      restoreSpawnTaskDraft(dir);
    }
    if(spmReady)setSpawnDraftStatus(spmDraftRestored);
  }
  closeSpawnDirOptions();
}

function closeSpawnDirOptions(){
  const root=SPM('spm-dir-options');
  if(!root)return;
  spmDirSeq++;
  spmDirOptions=[];spmDirActive=-1;
  root.hidden=true;
  root.innerHTML='';
  SPM('spm-dir').setAttribute('aria-expanded','false');
  SPM('spm-dir').removeAttribute('aria-activedescendant');
}

function renderSpawnDirOptions(rows,message=''){
  const root=SPM('spm-dir-options');
  spmDirOptions=Array.isArray(rows)?rows:[];
  spmDirActive=-1;
  if(!spmDirOptions.length&&!message){
    closeSpawnDirOptions();
    return;
  }
  root.innerHTML=spmDirOptions.length?spmDirOptions.map((row,index)=>
    `<button type="button" class="spm-dir-option" role="option" `+
    `id="spm-dir-option-${index}" data-index="${index}" `+
    `aria-selected="false" title="${esc(row.path)}">`+
    `<span class="spm-dir-arrow">▸</span>`+
    `<span class="spm-dir-option-name">${esc(row.name)}</span></button>`
  ).join(''):`<div class="spm-dir-empty">${esc(message)}</div>`;
  root.hidden=false;
  SPM('spm-dir').setAttribute('aria-expanded','true');
  root.querySelectorAll('.spm-dir-option').forEach(button=>{
    button.onmousedown=event=>event.preventDefault();
    button.onclick=()=>chooseSpawnDirOption(Number(button.dataset.index));
  });
}

function setSpawnDirActive(index){
  if(!spmDirOptions.length)return;
  spmDirActive=(index+spmDirOptions.length)%spmDirOptions.length;
  SPM('spm-dir-options').querySelectorAll('.spm-dir-option').forEach((button,i)=>{
    const on=i===spmDirActive;
    button.setAttribute('aria-selected',on?'true':'false');
    if(on)button.scrollIntoView({block:'nearest'});
  });
  SPM('spm-dir').setAttribute('aria-activedescendant',
    `spm-dir-option-${spmDirActive}`);
}

function chooseSpawnDirOption(index){
  const option=spmDirOptions[index];
  if(!option)return;
  setSpawnDir(option.path,true);
  SPM('spm-dir').focus();
}

function splitSpawnDirQuery(value){
  const raw=String(value||'').trim();
  if(!raw)return {path:'~',prefix:''};
  if(raw==='~'||raw==='.')return {path:'~',prefix:''};
  if(raw.endsWith('/'))return {path:raw.slice(0,-1)||'/',prefix:''};
  const slash=raw.lastIndexOf('/');
  if(slash<0)return {path:'~',prefix:raw};
  return {path:raw.slice(0,slash)||'/',prefix:raw.slice(slash+1)};
}

async function resolveSpawnDirRoot(){
  if(spmDirRoot)return spmDirRoot;
  const response=await fetch('/api/fs/dirs',{cache:'no-store'});
  const payload=await response.json();
  if(!response.ok||!payload||typeof payload.path!=='string'||
     !payload.path.startsWith('/'))
    throw new Error((payload&&payload.error)||'directory root unavailable');
  spmDirRoot=payload.path;
  return spmDirRoot;
}

function spawnDirRows(payload){
  return (Array.isArray(payload&&payload.dirs)?payload.dirs:[]).map(row=>({
    name:String(row&&row.name||''),
    path:String(row&&row.path||'')
  })).filter(row=>row.name&&row.path);
}

async function fetchSpawnDirOptions(value,seq=++spmDirSeq){
  let query=splitSpawnDirQuery(value);
  try{
    const raw=String(value||'').trim();
    // A complete path — what the field holds after a chip or an option was
    // chosen — wants its children next, not its siblings. Asking for the
    // siblings also fails outright when the path is itself a spawn root,
    // because its parent lies outside the browsable roots, and the operator
    // was left typing every level by hand.
    if(raw&&raw!=='~'&&raw!=='.'&&!raw.endsWith('/')){
      let candidate=raw;
      if(candidate==='~'||candidate.startsWith('~/'))
        candidate=(await resolveSpawnDirRoot())+candidate.slice(1);
      if(candidate.startsWith('/')){
        const response=await fetch('/api/fs/dirs?path='+
          encodeURIComponent(candidate),{cache:'no-store'});
        const payload=await response.json();
        if(seq!==spmDirSeq)return;
        if(response.ok&&payload&&typeof payload.path==='string'){
          const rows=spawnDirRows(payload);
          if(rows.length){renderSpawnDirOptions(rows,'');return;}
        }
      }
    }
    let response=null,payload=null;
    if(query.path==='~'||query.path.startsWith('~/')){
      const root=await resolveSpawnDirRoot();
      query={path:root+query.path.slice(1),prefix:query.prefix};
    }
    response=await fetch('/api/fs/dirs?path='+
      encodeURIComponent(query.path),{cache:'no-store'});
    payload=await response.json();
    if(seq!==spmDirSeq)return;
    if(!response.ok||!payload||!Array.isArray(payload.dirs))
      throw new Error((payload&&payload.error)||'directory lookup failed');
    const prefix=query.prefix.toLowerCase();
    const rows=spawnDirRows(payload).filter(row=>
      !prefix||row.name.toLowerCase().startsWith(prefix));
    renderSpawnDirOptions(rows,rows.length?'':'no matching directories');
  }catch(error){
    if(seq!==spmDirSeq)return;
    renderSpawnDirOptions([],'directory suggestions unavailable');
  }
}

function scheduleSpawnDirOptions(value,delay=250){
  if(spmDirTimer)clearTimeout(spmDirTimer);
  const seq=++spmDirSeq;
  spmDirTimer=setTimeout(()=>{
    spmDirTimer=null;
    fetchSpawnDirOptions(value,seq);
  },delay);
}

// How long to watch one async launch. The server derives
// verdict_deadline_seconds from the launcher's readiness timeout and
// termination grace; a missing or malformed value keeps the 140s default, and
// no value shortens it or keeps a watcher alive past an hour.
const SPAWN_WATCH_DEFAULT_MS=140000;
const SPAWN_WATCH_MAX_MS=3600000;
function spawnWatchLimitMs(pending){
  const seconds=pending?pending.verdict_deadline_seconds:undefined;
  if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<=0)
    return SPAWN_WATCH_DEFAULT_MS;
  return Math.min(Math.max(seconds*1000,SPAWN_WATCH_DEFAULT_MS),SPAWN_WATCH_MAX_MS);
}

// Poll the background verdict of an async spawn and report it as a toast.
async function watchSpawnLaunch(name,dir,limitMs=SPAWN_WATCH_DEFAULT_MS){
  const started=Date.now();
  while(Date.now()-started<limitMs){
    await new Promise(r=>setTimeout(r,2000));
    let j=null;
    try{
      const r=await fetch('/api/spawn-status?name='+encodeURIComponent(name),{cache:'no-store'});
      j=await r.json();
    }catch(e){continue;}
    if(!j||!j.ok||j.state==='launching')continue;
    if(j.state==='ready'){
      clearSpawnTaskDraft(dir);
      toast('▸ SPAWNED','> '+name+' :: tmux session ready');
      setTimeout(()=>{ if(view==='deck') tick(); else netTick(); },300);
    }else{
      toast('✕ SPAWN FAILED','> '+name+' :: '+(j.error||'launcher failed')+' · task draft saved',true);
    }
    return;
  }
  toast('✕ SPAWN','> '+name+' :: no verdict after '+Math.round(limitMs/1000)+'s',true);
}

function renderSpawnDirs(dirs){
  const root=SPM('spm-dir-chips');
  const clean=[...new Set((Array.isArray(dirs)?dirs:[])
    .map(value=>String(value||'').trim()).filter(Boolean))];
  root.innerHTML=clean.map(dir=>
    `<button type="button" class="spm-chip spm-dir-chip" `+
    `data-dir="${esc(dir)}" aria-pressed="false">${esc(dir)}</button>`
  ).join('');
  root.querySelectorAll('.spm-dir-chip').forEach(btn=>{
    btn.onclick=()=>setSpawnDir(btn.dataset.dir,true);
  });
  let remembered='';
  try{remembered=localStorage.getItem(SPM_DIR_KEY)||'';}catch(e){}
  setSpawnDir(remembered||clean[0]||'~',false);
  const input=SPM('spm-dir');
  input.oninput=()=>{
    const value=input.value.trim();
    root.querySelectorAll('.spm-dir-chip').forEach(btn=>{
      const on=btn.dataset.dir===value;
      btn.classList.toggle('on',on);
      btn.setAttribute('aria-pressed',on?'true':'false');
    });
    scheduleSpawnDirOptions(input.value);
  };
  input.onfocus=()=>scheduleSpawnDirOptions(input.value,0);
  input.onblur=()=>setTimeout(()=>{
    if(!SPM('spm-dir-options').contains(document.activeElement))
      closeSpawnDirOptions();
  },100);
  input.onchange=()=>{
    if(spmDirActive<0)setSpawnDir(input.value,true);
  };
  input.onkeydown=event=>{
    if(event.key==='ArrowDown'&&spmDirOptions.length){
      event.preventDefault();setSpawnDirActive(spmDirActive+1);
    }else if(event.key==='ArrowUp'&&spmDirOptions.length){
      event.preventDefault();
      setSpawnDirActive(spmDirActive<0?spmDirOptions.length-1:spmDirActive-1);
    }else if(event.key==='Enter'&&spmDirActive>=0){
      event.preventDefault();chooseSpawnDirOption(spmDirActive);
    }else if(event.key==='Escape'&&!SPM('spm-dir-options').hidden){
      event.preventDefault();event.stopPropagation();closeSpawnDirOptions();
    }
  };
}

function normalizeSpawnProviders(catalog){
  const legacy=Array.isArray(catalog.models)?[{
    id:'claude',label:'Claude',models:catalog.models,
    default_model:catalog.default_model
  }]:[];
  const source=Array.isArray(catalog.providers)&&catalog.providers.length
    ? catalog.providers:legacy;
  return source.map(provider=>{
    const id=String(provider&&provider.id||'').trim().toLowerCase();
    const models=(Array.isArray(provider&&provider.models)?provider.models:[])
      .map(model=>{
        if(typeof model==='string')return {id:model,label:model,default:false,badge:''};
        const modelId=String(model&&model.id||'').trim();
        return {id:modelId,label:String(model&&model.label||modelId).trim(),
          default:Boolean(model&&model.default),
          badge:String(model&&model.badge||'').trim()};
      }).filter(model=>model.id);
    const defaultModel=String(provider&&provider.default_model||
      ((models.find(model=>model.default)||{}).id)||
      (id==='claude'?catalog.default_model:'')||'').trim();
    const efforts=[...new Set((Array.isArray(provider&&provider.efforts)
      ? provider.efforts:[]).map(value=>String(value||'').trim())
      .filter(Boolean))];
    return {id,label:String(provider&&provider.label||id).trim(),
      models,defaultModel,efforts,
      defaultEffort:String(provider&&provider.effort_default||'').trim()};
  }).filter(provider=>/^[a-z][a-z0-9_-]*$/.test(provider.id)&&
    provider.models.length);
}

const SPM_MODEL_TONES=Object.freeze({
  'gpt-5.6-sol':'deepest reasoning · hard problems',
  'gpt-5.6-terra':'everyday implementation',
  'gpt-5.6-luna':'fast & light',
  'gpt-6-astra':'most capable · demanding work'
});
const SPM_EFFORT_HINTS=Object.freeze({
  low:'routine',medium:'standard',high:'complex',xhigh:'hardest · default',
  max:'astra only · beyond xhigh',ultra:'astra only · maximum'
});

function spawnModelTone(providerId,modelId){
  if(SPM_MODEL_TONES[modelId])return SPM_MODEL_TONES[modelId];
  if(providerId==='claude'){
    if(modelId.includes('opus'))return 'deep design · hard problems';
    if(modelId.includes('sonnet'))return 'everyday implementation';
    if(modelId.includes('haiku'))return 'fast & light';
  }
  return '';
}

function renderSpawnProviders(providers){
  spmProviders=providers;
  const root=SPM('spm-providers');
  root.innerHTML=providers.map(provider=>
    `<button type="button" class="spm-provider-tab" role="tab" `+
    `data-provider="${esc(provider.id)}" aria-selected="false">`+
    `${esc(provider.label||provider.id)}</button>`
  ).join('');
  root.querySelectorAll('.spm-provider-tab').forEach(btn=>{
    btn.onclick=()=>selectSpawnProvider(btn.dataset.provider);
  });
  const initial=providers.find(provider=>provider.id==='claude')||
    providers[0]||null;
  selectSpawnProvider(initial&&initial.id||'');
}

function selectSpawnProvider(providerId){
  const provider=spmProviders.find(item=>item.id===providerId);
  spmSelectedProvider=provider?provider.id:'';
  spmSelectedModel='';
  spmSelectedEffort='';
  SPM('spm-providers').querySelectorAll('.spm-provider-tab').forEach(btn=>{
    const on=btn.dataset.provider===spmSelectedProvider;
    btn.classList.toggle('on',on);
    btn.setAttribute('aria-selected',on?'true':'false');
    btn.tabIndex=on?0:-1;
  });
  renderSpawnModels(provider);
}

function renderSpawnModels(provider){
  const root=SPM('spm-models');
  const models=provider&&Array.isArray(provider.models)?provider.models:[];
  const fallback=models.some(model=>model.id===provider.defaultModel)
    ? provider.defaultModel:((models[0]||{}).id||'');
  root.innerHTML=models.map(model=>{
    const tone=spawnModelTone(provider&&provider.id||'',model.id);
    const displayLabel=tone?(model.label||model.id):model.id;
    const catalogId=tone&&displayLabel!==model.id
      ? `<small>${esc(model.id)}</small>`:'';
    return `<button type="button" class="spm-chip spm-model-chip" `+
      `data-model="${esc(model.id)}" role="radio" aria-checked="false">`+
      `<b>${esc(displayLabel)}</b>${catalogId}`+
      `${tone?`<em class="spm-model-tone">${esc(tone)}</em>`:''}`+
      `</button>`;
  }).join('')||'<div class="spm-load">no models configured</div>';
  root.querySelectorAll('.spm-model-chip').forEach(btn=>{
    btn.onclick=()=>selectSpawnModel(btn.dataset.model);
  });
  selectSpawnModel(fallback);
  renderSpawnEfforts(provider);
}

function selectSpawnModel(model){
  const valid=[...SPM('spm-models').querySelectorAll('.spm-model-chip')]
    .some(btn=>btn.dataset.model===model);
  spmSelectedModel=valid?model:'';
  SPM('spm-models').querySelectorAll('.spm-model-chip').forEach(btn=>{
    const on=btn.dataset.model===spmSelectedModel;
    btn.classList.toggle('on',on);
    btn.setAttribute('aria-checked',on?'true':'false');
  });
  renderSpawnEngineNote();
}

function renderSpawnEfforts(provider){
  const row=SPM('spm-effort-row');
  const root=SPM('spm-efforts');
  const hint=SPM('spm-effort-hint');
  const efforts=provider&&Array.isArray(provider.efforts)?provider.efforts:[];
  row.hidden=!efforts.length;
  root.innerHTML=efforts.map(effort=>
    `<button type="button" class="spm-chip spm-effort-chip" `+
    `data-effort="${esc(effort)}" role="radio" aria-checked="false" `+
    `title="${esc(SPM_EFFORT_HINTS[effort]
      ? effort+' · '+SPM_EFFORT_HINTS[effort]:'')}">`+
    `${esc(effort)}</button>`
  ).join('');
  hint.hidden=true;hint.textContent='';
  root.querySelectorAll('.spm-effort-chip').forEach(btn=>{
    btn.onclick=()=>selectSpawnEffort(btn.dataset.effort);
  });
  const fallback=efforts.includes(provider&&provider.defaultEffort)
    ? provider.defaultEffort:(efforts[0]||'');
  selectSpawnEffort(fallback);
}

function selectSpawnEffort(effort){
  const valid=[...SPM('spm-efforts').querySelectorAll('.spm-effort-chip')]
    .some(btn=>btn.dataset.effort===effort);
  spmSelectedEffort=valid?effort:'';
  SPM('spm-efforts').querySelectorAll('.spm-effort-chip').forEach(btn=>{
    const on=btn.dataset.effort===spmSelectedEffort;
    btn.classList.toggle('on',on);
    btn.setAttribute('aria-checked',on?'true':'false');
  });
  const hint=SPM('spm-effort-hint');
  const copy=SPM_EFFORT_HINTS[spmSelectedEffort]||'';
  hint.hidden=!copy;
  hint.textContent=copy?`${spmSelectedEffort} · ${copy}`:'';
  renderSpawnEngineNote();
}

function renderSpawnEngineNote(){
  const provider=spmProviders.find(item=>item.id===spmSelectedProvider);
  const parts=[provider&&provider.label||spmSelectedProvider,
    spmSelectedModel,spmSelectedEffort].filter(Boolean);
  SPM('spm-engine-note').textContent=parts.length
    ? parts.join(' · '):'provider · model';
}

async function loadSpawnCatalog(seq){
  try{
    const response=await fetch('/api/spawn-names',{cache:'no-store'});
    const catalog=await response.json();
    if(seq!==spmLoadSeq)return;
    if(response.ok&&catalog&&typeof catalog.unavailable==='string'){
      spmReady=false;
      SPM('spm-agent-strip').textContent='scientist roster unavailable';
      SPM('spm-models').textContent='engine catalog unavailable';
      updateSpawnButton();
      setSpawnStat(catalog.unavailable,'err');
      return;
    }
    if(!response.ok||!catalog||!Array.isArray(catalog.names)||
       !Array.isArray(catalog.adjectives)||!Array.isArray(catalog.dirs))
      throw new Error((catalog&&catalog.error)||'invalid picker response');
    const providers=normalizeSpawnProviders(catalog);
    if(!providers.length)throw new Error('engine catalog unavailable');
    spmAdjectives=[...new Set(catalog.adjectives
      .map(value=>String(value||'').trim())
      .filter(value=>/^[A-Z][A-Za-z]*$/.test(value)))];
    if(!spmAdjectives.length)
      throw new Error('adjective catalog unavailable');
    renderSpawnNames(catalog.names);
    selectSpawnName('');
    renderSpawnProviders(providers);
    renderSpawnDirs(catalog.dirs);
    spmReady=true;
    updateSpawnButton();
    setSpawnDraftStatus(spmDraftRestored);
  }catch(error){
    if(seq!==spmLoadSeq)return;
    spmReady=false;
    spmAdjectives=[];spmSuggestedName='';
    spmSuggestedPrefix='';spmSuggestedScientist='';
    renderSpawnComposite();
    SPM('spm-agent-strip').innerHTML=
      '<div class="spm-load">scientist roster unavailable</div>';
    SPM('spm-providers').innerHTML='';
    SPM('spm-models').innerHTML=
      '<div class="spm-load">engine catalog unavailable</div>';
    SPM('spm-effort-row').hidden=true;
    updateSpawnButton();
    setSpawnStat('launch catalog unavailable · '+String(error),'err');
  }
}

function restoreSpawnAdvanced(){
  const details=SPM('spm-advanced');
  if(!details)return;
  let open=false;
  try{open=localStorage.getItem(SPM_ADVANCED_KEY)==='open';}catch(e){}
  details.ontoggle=null;
  details.open=open;
  details.ontoggle=()=>{
    try{localStorage.setItem(SPM_ADVANCED_KEY,
      details.open?'open':'closed');}catch(e){}
  };
}

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

// Task H: replay 中は netTick で buildEls が走ると tt-hidden が消えるので停止。
//   replay 終了で次の周期から自動再開（stopReplay は state を残さない）。
setInterval(()=>{
  if(document.hidden)return;
  if(view==='net' && !window._replayMode && !netSuspended)netTick();
},5000);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden||netSuspended)return;
  if(view==='net'&&!window._replayMode){netTick();mailPulseTick();}
  else if(view==='deck')tick();
});
// Tier A: 1.5s ハートビート。各エージェントは個別の `_nextSpeakTs` 持ち、
// 発話時刻が独立にランダム化されるため出現タイミングが散らばる。
// 初回観測時は 3-22s 後にシードして起動時の一斉発話を回避。
setInterval(()=>{
  if(document.hidden||netSuspended||view!=='net'||drag||pan) return;
  const now=Date.now();
  const due=[];
  for(const[name,g]of gmap){
    if(!g.running||gMurmurs.has(name)) continue;
    if(!g._nextSpeakTs){
      g._nextSpeakTs=now+3000+Math.random()*19000;  // 初期 3-22s
      continue;
    }
    if(now>=g._nextSpeakTs) due.push(name);
  }
  // ほぼ同時刻発火は稀（独立ランダム）。万一の時は 250ms stagger
  due.forEach((name,i)=>{
    setTimeout(()=>spawnMurmur(name,pickMurmur(name,'say')), i*250);
  });
},1500);