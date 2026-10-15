(function(){
'use strict';
const MINE='Từ của tôi', LSKEY='sotu-han-anh-v1', MIN=6e4, HOUR=36e5, DAY=864e5;
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const norm=s=>String(s||'').normalize('NFC').toLowerCase().replace(/[\s.,!?'"’‘“”`~\-–—()…:;]/g,'');
const strip=s=>String(s||'').replace(/[\[\]]/g,'');
const surface=c=>{const m=String(c.ex||'').match(/\[(.+?)\]/);return m?m[1]:c.w};
const hl=s=>esc(s).replace(/\[(.+?)\]/g,'<b class="hl">$1</b>');
const blankOut=s=>esc(s).replace(/\[(.+?)\]/g,'<span class="blank">___</span>');
const LANGS=['ko','en','zh'];
const LNAME={ko:'tiếng Hàn',en:'tiếng Anh',zh:'tiếng Trung'};
const LCODE={ko:'ko-KR',en:'en-GB',zh:'zh-CN'};
const fc=L=>L==='ko'?'kr':L==='zh'?'zh':'';
const noTone=s=>norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const ICON_SAY='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const ICON_PLAY='<svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const sayBtn=(text,cls='')=>`<button class="say ${cls}" type="button" data-say="${esc(strip(text))}" aria-label="Nghe phát âm">${ICON_SAY}</button>`;

/* ---------- State ---------- */
function fresh(){return{lang:'ko',settings:{newPerDay:15,dir:'fwd',autoplay:true,rate:1},cards:{ko:{},en:{},zh:{}},custom:{ko:[],en:[],zh:[]},tomb:[],days:{},reset:{ko:0,en:0,zh:0},sAt:0,updatedAt:0}}
function hydrate(o){
  const d=fresh(); if(!o||typeof o!=='object') return d;
  return Object.assign(d,o,{
    settings:Object.assign(d.settings,o.settings||{}),
    cards:{ko:Object.assign({},(o.cards||{}).ko),en:Object.assign({},(o.cards||{}).en),zh:Object.assign({},(o.cards||{}).zh)},
    custom:{ko:[...((o.custom||{}).ko||[])],en:[...((o.custom||{}).en||[])],zh:[...((o.custom||{}).zh||[])]},
    tomb:[...(o.tomb||[])], days:Object.assign({},o.days||{}),
    reset:Object.assign({ko:0,en:0,zh:0},o.reset||{})
  });
}
let S=(()=>{try{return hydrate(JSON.parse(localStorage.getItem(LSKEY)))}catch(e){return fresh()}})();
function persistLocal(){try{localStorage.setItem(LSKEY,JSON.stringify(S))}catch(e){}}
function save(){S.updatedAt=Date.now();const ks=Object.keys(S.days).sort();while(ks.length>120)delete S.days[ks.shift()];persistLocal();queuePush()}

const dkey=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const endOfDay=()=>{const d=new Date();d.setHours(23,59,59,999);return+d};
const todayPeek=L=>((S.days[dkey()]||{})[L])||{n:0,r:0};
function todayStat(L){const k=dkey();S.days[k]=S.days[k]||{};S.days[k][L]=S.days[k][L]||{n:0,r:0};return S.days[k][L]}
function streak(){
  const has=k=>{const x=S.days[k];return!!x&&Object.values(x).some(v=>(v.n||0)+(v.r||0)>0)};
  const d=new Date();let n=0;if(!has(dkey(d)))d.setDate(d.getDate()-1);
  while(has(dkey(d))){n++;d.setDate(d.getDate()-1)}return n;
}

/* ---------- Decks ---------- */
const DECKS={};
function buildDeck(L){
  const out=[];
  (L==='ko'?KO:L==='zh'?(typeof ZH!=='undefined'?ZH:[]):EN).forEach(tp=>tp.w.forEach(a=>out.push(L==='ko'
    ?{id:'ko:'+a[0],w:a[0],m:a[1],hv:a[2],ex:a[3],exv:a[4],topic:tp.t}
    :L==='zh'?{id:a[6]||('zh:'+a[0]),w:a[0],py:a[1],m:a[2],hv:a[3],ex:a[4],exv:a[5],topic:tp.t}
    :{id:'en:'+a[0],w:a[0],pos:a[1],m:a[2],note:a[3],ex:a[4],exv:a[5],topic:tp.t})));
  if(L==='zh'){for(const k in ZBOOK)delete ZBOOK[k];for(const c of out){const m=/^Bài (\d+)/.exec(c.topic);if(m)(ZBOOK[+m[1]]=ZBOOK[+m[1]]||[]).push(c.id)}}
  if(L==='ko'&&typeof KIIP_WORDS!=='undefined'){
    const have=new Set(out.map(c=>c.id));
    for(let n=1;n<=18;n++)BOOK[n]=[];
    for(const [ch,w,m,hv,id] of KIIP_WORDS){
      BOOK[ch].push(id);
      if(!have.has(id)){have.add(id);out.push({id,w,m,hv,ex:'',exv:'',topic:'KIIP Bài '+ch,book:ch})}
    }
  }
  S.custom[L].filter(c=>!S.tomb.includes(c.id)).forEach(c=>out.push(Object.assign({},c,{topic:MINE,custom:true})));
  return out;
}
const BOOK={},ZBOOK={},BYID={ko:new Map(),en:new Map(),zh:new Map()};
function rebuildDecks(){DECKS.ko=buildDeck('ko');DECKS.en=buildDeck('en');DECKS.zh=buildDeck('zh');for(const L of LANGS){BYID[L]=new Map(DECKS[L].map(c=>[c.id,c]))}}
const topicsOf=L=>[...new Set(DECKS[L].map(c=>c.topic))];
const UI={scope:null,topic:{ko:'all',en:'all',zh:'all'},qtype:{ko:'meaning',en:'meaning',zh:'meaning'},ltype:'lchoose',addOpen:false,search:'',status:'all'};
const scoped=L=>!!UI.scope&&UI.scope.lang===L;
const topicKey=L=>scoped(L)?'scope:'+UI.scope.label:UI.topic[L];
function setScope(ids,label){UI.scope={lang:S.lang,ids:new Set(ids),order:ids,label};R.built=false;QS.quiz=QS.listen=null}
function filtered(L){if(scoped(L))return UI.scope.order.map(id=>BYID[L].get(id)).filter(Boolean);const t=UI.topic[L];if(t!=='all'&&!topicsOf(L).includes(t))UI.topic[L]='all';return UI.topic[L]==='all'?DECKS[L]:DECKS[L].filter(c=>c.topic===UI.topic[L])}
const rec=(L,c)=>S.cards[L][c.id];
const statusOf=r=>!r?'new':r.i>=7?'known':'learning';
const STATUS_VN={new:'Mới',learning:'Đang học',known:'Đã nhớ'};
const isDue=(r,now,eod)=>r.i<1?r.d<=now+20*MIN:r.d<=eod;

/* ---------- SRS ---------- */
function schedule(old,g,now){
  const r=old?Object.assign({},old):{i:0,e:2.5,n:0,l:0};
  if(r.i<1){
    if(g===0){r.i=0;r.d=now+MIN}
    else if(g===1){r.i=0;r.d=now+6*MIN}
    else if(g===2){r.i=1;r.d=now+DAY}
    else{r.i=4;r.e+=0.15;r.d=now+4*DAY}
  }else{
    if(g===0){r.l=(r.l||0)+1;r.e=Math.max(1.3,r.e-0.2);r.i=0;r.d=now+10*MIN}
    else if(g===1){r.e=Math.max(1.3,r.e-0.15);r.i=Math.max(1,r.i*1.2);r.d=now+r.i*DAY}
    else if(g===2){r.i=r.i*r.e;r.d=now+r.i*DAY}
    else{r.e+=0.15;r.i=r.i*r.e*1.3;r.d=now+r.i*DAY}
  }
  r.i=Math.round(r.i*100)/100;r.e=Math.round(r.e*100)/100;r.n=(r.n||0)+1;r.t=now;return r;
}
function fmtIvl(ms){
  const m=ms/MIN;if(m<60)return Math.max(1,Math.round(m))+' phút';
  const h=ms/HOUR;if(h<22)return Math.round(h)+' giờ';
  const d=ms/DAY;if(d<30)return Math.max(1,Math.round(d))+' ngày';
  if(d<365)return String(Math.round(d/3)/10).replace('.',',')+' tháng';
  return String(Math.round(d/36.5)/10).replace('.',',')+' năm';
}

/* ---------- Speech ---------- */
const HAS_TTS='speechSynthesis' in window;
let VOICES=[];
function loadVoices(){if(HAS_TTS){try{VOICES=speechSynthesis.getVoices()||[]}catch(e){}}}
if(HAS_TTS){loadVoices();try{speechSynthesis.addEventListener('voiceschanged',()=>{loadVoices();if(VIEW==='settings')renderVoiceInfo()})}catch(e){speechSynthesis.onvoiceschanged=loadVoices}}
let VPREF=(()=>{try{return JSON.parse(localStorage.getItem('sotu-voice'))||{}}catch(e){return{}}})();
function saveVPref(){try{localStorage.setItem('sotu-voice',JSON.stringify(VPREF))}catch(e){}}
const NOVELTY=/albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical/i;
const GOOD_RE=/natural|neural|premium|enhanced|google|nâng cao|cao cấp/i;
function voiceScore(v,L){
  let s0=0;
  const lg=String(v.lang||'').toLowerCase().replace('_','-'),n=String(v.name||'');
  if(!lg.startsWith(L))return -1;
  if(L==='zh'){if(lg==='zh-cn')s0=8;else if(/zh-(tw|hk)/.test(lg))s0=-5}
  let s=10+s0;
  if(L==='en'){if(lg==='en-gb')s+=8;else if(lg==='en-us')s+=6;else if(/en-(au|ie|ca|nz)/.test(lg))s+=4}
  if(/natural|neural/i.test(n))s+=60;
  if(/online/i.test(n))s+=15;
  if(/premium|cao cấp/i.test(n))s+=50;
  if(/enhanced|nâng cao/i.test(n))s+=40;
  if(/google/i.test(n))s+=30;
  if(v.localService===false)s+=5;
  if(/compact|espeak|eloquence/i.test(n))s-=20;
  if(NOVELTY.test(n))s-=100;
  return s;
}
function voicesFor(L){return VOICES.map(v=>({v,s:voiceScore(v,L)})).filter(x=>x.s>=0).sort((a,b)=>b.s-a.s).map(x=>x.v)}
const IS_IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const sysMode=L=>VPREF[L]==='__system__'||(!VPREF[L]&&IS_IOS);
function voiceFor(L){if(sysMode(L))return null;const list=voicesFor(L);if(!list.length)return null;const p=VPREF[L];if(p){const f=list.find(v=>v.voiceURI===p);if(f)return f}return list[0]}
const voiceIsGood=v=>!!v&&GOOD_RE.test(v.name);
function speak(text,L,rate){
  if(!HAS_TTS||!text)return;L=L||S.lang;
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(strip(text)),v=voiceFor(L);
    u.lang=v?v.lang:LCODE[L];if(v)u.voice=v;
    u.rate=rate||S.settings.rate;u.pitch=1;
    speechSynthesis.speak(u);
  }catch(e){}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-say]');if(b)speak(b.dataset.say,b.dataset.lang,b.dataset.slow?0.6:0)});

/* ---------- Sync (claude db, per-person private) ---------- */
const SY={ref:null,timer:null,retry:0};
const SYNC_TXT={local:'Lưu trên máy này',ok:'Đã đồng bộ',saving:'Đang lưu…',err:'Chưa đồng bộ được',offline:'Ngoại tuyến'};
function setSync(s){const el=$('#sync');el.dataset.s=s;$('span',el).textContent=SYNC_TXT[s];SY.state=s}
async function initSync(){
  try{
    if(!window.claude||typeof window.claude.use!=='function'){setSync('local');return}
    const [db,user]=await Promise.all([window.claude.use('db'),window.claude.use('user')]);
    if(!db||!user){setSync('local');return}
    const id=await user.id();if(!id){setSync('local');return}
    SY.ref=db.collection('data/users/'+id).doc('state');
    await pull();
  }catch(e){setSync('local')}
}
async function pull(){
  if(!SY.ref)return;
  try{
    const snap=await SY.ref.get();
    if(snap.exists){const d=snap.data();if(d&&typeof d.s==='string'){if(mergeIn(hydrate(JSON.parse(d.s)))){persistLocal();rebuildDecks();afterRemote()}}}
    await push();
  }catch(e){setSync('err')}
}
function queuePush(){queueGist();if(!SY.ref)return;clearTimeout(SY.timer);setSync('saving');SY.timer=setTimeout(push,1500)}
async function push(){
  if(!SY.ref)return;
  try{await SY.ref.set({s:JSON.stringify(S),at:Date.now()});SY.retry=0;setSync('ok')}
  catch(e){if(e&&e.code==='unavailable'&&SY.retry<2){SY.retry++;setTimeout(push,1500+Math.random()*2500)}else setSync('err')}
}
function mergeIn(r){
  let ch=false;
  for(const L of LANGS){
    const rs=Math.max(S.reset[L]||0,(r.reset||{})[L]||0);
    if(rs>(S.reset[L]||0)){S.reset[L]=rs;for(const k in S.cards[L])if((S.cards[L][k].t||0)<rs){delete S.cards[L][k];ch=true}}
    const a=S.cards[L],b=r.cards[L];
    for(const k in b){const y=b[k];if((y.t||0)<rs)continue;if(!a[k]||(y.t||0)>(a[k].t||0)){a[k]=y;ch=true}}
    const ids=new Set(S.custom[L].map(c=>c.id));
    for(const c of r.custom[L])if(!ids.has(c.id)){S.custom[L].push(c);ch=true}
  }
  for(const t of r.tomb)if(!S.tomb.includes(t)){S.tomb.push(t);ch=true}
  for(const d in r.days){S.days[d]=S.days[d]||{};for(const L in r.days[d]){const x=S.days[d][L]||{n:0,r:0},y=r.days[d][L]||{};const n=Math.max(x.n||0,y.n||0),rr=Math.max(x.r||0,y.r||0);if(n!==x.n||rr!==x.r||!S.days[d][L]){S.days[d][L]={n,r:rr};ch=true}}}
  if((r.sAt||0)>(S.sAt||0)){S.settings=Object.assign(S.settings,r.settings);S.lang=r.lang||S.lang;S.sAt=r.sAt;ch=true}
  return ch;
}
function afterRemote(){
  renderHeader();
  if(VIEW==='review'){if(!R.cur||!R.flipped){R.built=false;renderView()}else R.stale=true}
  else{R.built=false;if(VIEW==='list'||VIEW==='settings')renderView()}
}
/* ---------- Sync qua GitHub Gist (cho bản tự đăng lên github.io) ---------- */
const IN_CLAUDE=!!(window.claude&&typeof window.claude.use==='function');
const GKEY='sotu-gist',GFILE='sotu-progress.json';
let GS=(()=>{try{return JSON.parse(localStorage.getItem(GKEY))||{}}catch(e){return{}}})();
function saveGS(){try{localStorage.setItem(GKEY,JSON.stringify(GS))}catch(e){}}
const gistOn=()=>!IN_CLAUDE&&!!GS.token&&!!GS.id;
async function gh(path,opt){
  opt=opt||{};
  const headers={'Accept':'application/vnd.github+json','Authorization':'Bearer '+GS.token};
  if(opt.body)headers['Content-Type']='application/json';
  const r=await fetch('https://api.github.com'+path,Object.assign({},opt,{headers,cache:'no-store'}));
  if(!r.ok){const e=new Error('github '+r.status);e.status=r.status;throw e}
  return r.status===204?null:r.json();
}
function ghErr(e){
  if(e&&e.status===401)return 'Token không hợp lệ hoặc đã hết hạn. Hãy tạo token mới rồi kết nối lại.';
  if(e&&e.status===404)return 'Token chưa có quyền gist, hoặc không tìm thấy gist. Hãy tạo token có chọn quyền gist.';
  if(e&&(e.status===403||e.status===429))return 'GitHub đang tạm giới hạn lượt truy cập. Thử lại sau ít phút.';
  return 'Không kết nối được tới GitHub. Hãy kiểm tra mạng.';
}
async function gistRead(){
  const g=await gh('/gists/'+GS.id);
  const f=g&&g.files&&g.files[GFILE];if(!f)return{raw:'',data:null};
  let raw=f.content||'';
  if(f.truncated&&f.raw_url){const r=await fetch(f.raw_url,{cache:'no-store'});raw=await r.text()}
  try{return{raw,data:JSON.parse(raw)}}catch(e){return{raw,data:null}}
}
let gBusy=false,gAgain=false,gTimer=null;
async function gistSync(){
  if(!gistOn())return;
  if(gBusy){gAgain=true;return}
  gBusy=true;clearTimeout(gTimer);gTimer=null;setSync('saving');
  try{
    const rem=await gistRead();
    if(rem.data&&mergeIn(hydrate(rem.data))){persistLocal();rebuildDecks();afterRemote()}
    const out=JSON.stringify(S);
    if(out!==rem.raw)await gh('/gists/'+GS.id,{method:'PATCH',body:JSON.stringify({files:{[GFILE]:{content:out}}})});
    GS.last=Date.now();GS.err='';GS.dirty=false;saveGS();setSync('ok');
  }catch(e){if(!navigator.onLine){GS.err='';GS.dirty=true;saveGS();setSync('offline')}else{GS.err=ghErr(e);saveGS();setSync('err')}}
  finally{gBusy=false;if(VIEW==='settings')renderSyncBox();if(gAgain){gAgain=false;setTimeout(gistSync,400)}}
}
async function gistConnect(token){
  GS={token:token.trim()};
  const u=await gh('/user');GS.login=u&&u.login;
  let id=null;
  for(let p=1;p<=5&&!id;p++){const list=await gh('/gists?per_page=100&page='+p);if(!list||!list.length)break;const f=list.find(g=>g.files&&g.files[GFILE]);if(f)id=f.id}
  if(!id){const g=await gh('/gists',{method:'POST',body:JSON.stringify({description:'Sổ từ vựng Hàn – Anh: tiến độ học',public:false,files:{[GFILE]:{content:JSON.stringify(S)}}})});id=g.id}
  GS.id=id;saveGS();
  await gistSync();
}
function queueGist(){if(!gistOn())return;clearTimeout(gTimer);if(!navigator.onLine){setSync('offline');GS.dirty=true;saveGS();return}setSync('saving');gTimer=setTimeout(gistSync,3000)}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){pull();if(gistOn()&&(!GS.last||Date.now()-GS.last>15000))gistSync()}
  else if(gTimer)gistSync();
});
window.addEventListener('online',()=>{if(gistOn())gistSync()});
window.addEventListener('offline',()=>{if(gistOn())setSync('offline')});

/* ---------- Shell ---------- */
let VIEW='review';
function renderHeader(){
  const L=S.lang,now=Date.now(),eod=endOfDay();
  let due=0,known=0;
  for(const c of DECKS[L]){const r=rec(L,c);if(!r)continue;if(isDue(r,now,eod))due++;if(r.i>=7)known++}
  const newLeft=Math.max(0,S.settings.newPerDay-todayPeek(L).n);
  $('#stats').innerHTML=`<div class="stat due"><b>${due}</b><span>cần ôn</span></div><div class="stat"><b>${newLeft}</b><span>từ mới còn lại</span></div><div class="stat"><b>${streak()}</b><span>ngày liên tiếp</span></div><div class="stat"><b>${known}<em class="of">/${DECKS[L].length}</em></b><span>đã nhớ</span></div>`;
}
function render(){
  if(VIEW==='book'&&S.lang==='en')VIEW='review';
  $('.tabs [data-v="book"]').hidden=S.lang==='en';
  document.body.dataset.lang=S.lang;
  document.title='Sổ từ vựng · '+({ko:'한국어',en:'IELTS',zh:'中文'})[S.lang];
  $$('.lang button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.l===S.lang)));
  $$('.tabs button').forEach(b=>b.dataset.v===VIEW?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));
  renderHeader();renderView();
}
function renderView(){({review:viewReview,quiz:viewQuiz,listen:viewQuiz,book:viewBook,list:viewList,settings:viewSettings})[VIEW]()}
$$('.lang button').forEach(b=>b.addEventListener('click',()=>{if(S.lang===b.dataset.l)return;S.lang=b.dataset.l;S.sAt=Date.now();R.built=false;save();if(HAS_TTS)speechSynthesis.cancel();render();window.scrollTo(0,0)}));
$$('.tabs button').forEach(b=>b.addEventListener('click',()=>{VIEW=b.dataset.v;if(HAS_TTS)speechSynthesis.cancel();render();window.scrollTo(0,0)}));
$('#sync').addEventListener('click',()=>{if(SY.ref)pull();else if(gistOn())gistSync();else{VIEW='settings';render();const el=$('#syncSec');if(el)el.scrollIntoView()}});

function topicSelect(L){
  if(scoped(L))return `<div class="scopebar"><span>Theo sách: ${esc(UI.scope.label.replace(/^Sách: /,''))}</span><button class="linkbtn" id="scopeExit" type="button">Bỏ lọc</button></div>`;
  const ts=topicsOf(L),cur=UI.topic[L];
  return `<label class="tsel"><span>Chủ đề</span><select class="sel" id="topicSel"><option value="all">Tất cả chủ đề (${DECKS[L].length})</option>${ts.map(t=>`<option value="${esc(t)}"${cur===t?' selected':''}>${esc(t)} (${DECKS[L].filter(c=>c.topic===t).length})</option>`).join('')}</select></label>`;
}
function bindTopic(after){const x=$('#scopeExit');if(x)x.addEventListener('click',()=>{UI.scope=null;R.built=false;QS.quiz=QS.listen=null;after()});const s=$('#topicSel');if(s)s.addEventListener('change',()=>{UI.topic[S.lang]=s.value;after()})}

/* ---------- Review ---------- */
const R={queue:[],cur:null,flipped:false,extra:0,built:false,lang:null,topic:null};
function buildQueue(){
  const L=S.lang,deck=filtered(L),now=Date.now(),eod=endOfDay();
  const due=deck.filter(c=>{const r=rec(L,c);return r&&isDue(r,now,eod)}).sort((a,b)=>rec(L,a).d-rec(L,b).d);
  const left=Math.max(0,S.settings.newPerDay+R.extra-todayPeek(L).n);
  const fresh=deck.filter(c=>!rec(L,c)).slice(0,left);
  const q=[];let i=0,j=0;
  while(i<due.length||j<fresh.length){for(let k=0;k<3&&i<due.length;k++)q.push(due[i++]);if(j<fresh.length)q.push(fresh[j++])}
  R.queue=q;R.cur=q.shift()||null;R.flipped=false;R.built=true;R.lang=L;R.topic=topicKey(L);
}
function counts(){const L=S.lang;let n=0,l=0,r=0;for(const c of [R.cur,...R.queue]){if(!c)continue;const x=rec(L,c);if(!x)n++;else if(x.i<1)l++;else r++}return{n,l,r}}
function wordVisual(c,L){
  if(L!=='en'){const ch=[...c.w];return `<div class="grid${ch.length>6?' long':''}" lang="${L}" aria-label="${esc(c.w)}">${ch.map(x=>x===' '?'<span class="cell sp"></span>':`<span class="cell" aria-hidden="true">${esc(x)}</span>`).join('')}</div>`}
  return `<div class="sheet" lang="en"><span class="eword">${esc(c.w)}</span>${c.pos?`<span class="pos">${esc(c.pos)}</span>`:''}</div>`;
}
function metaLine(c,L){
  if(L==='zh'){const sd=c.py?pySandhi(c.py):'';return (c.py?`<div class="meta"><span>Pinyin</span>${esc(c.py)}</div>`:'')+(sd?`<div class="meta"><span>Đọc thực tế</span>${esc(sd)}</div>`:'')+(c.hv?`<div class="meta"><span>Hán-Việt</span>${esc(c.hv)}</div>`:'')}
  if(L==='ko'&&c.hv){const loan=/^từ mượn/i.test(c.hv);return `<div class="meta"><span>${loan?'Gốc từ':'Hán-Việt'}</span>${esc(loan?c.hv.replace(/^từ mượn:?\s*/i,''):c.hv)}</div>`}
  if(L==='en'&&c.note)return `<div class="meta"><span>Collocation</span>${esc(c.note)}</div>`;
  return '';
}
function exBlock(c,L){
  if(!c.ex)return '';
  return `<div class="ex"><p lang="${L}">${hl(c.ex)}</p>${sayBtn(c.ex,'sm')}</div>${c.exv?`<p class="exv">${esc(c.exv)}</p>`:''}`;
}
function viewReview(){
  const L=S.lang,v=$('#view');
  if(!R.built||R.lang!==L||R.topic!==topicKey(L)||!R.cur)buildQueue();
  const tb=`<div class="toolbar">${topicSelect(L)}</div>`;
  if(!R.cur){
    const deck=filtered(L),now=Date.now();
    const remainNew=deck.filter(c=>!rec(L,c)).length;
    const next=deck.map(c=>rec(L,c)).filter(r=>r&&r.d>now).reduce((m,r)=>Math.min(m,r.d),Infinity);
    const t=todayPeek(L);
    const art=L==='ko'?wordVisual({w:'잘했어요'},'ko'):`<div class="sheet"><span class="eword">Well done</span></div>`;
    v.innerHTML=tb+`<div class="card done">${art}<h2>${t.n+t.r?'Xong phần hôm nay':'Chưa có thẻ nào đến hạn'}</h2>
      <p class="muted">${t.n+t.r?`Hôm nay bạn đã học ${t.n} từ mới và ôn ${t.r} lượt. `:''}${next<Infinity?`Thẻ tiếp theo đến hạn sau ${fmtIvl(next-now)}.`:''}${remainNew?'':' Bạn đã học hết từ trong chủ đề này.'}</p>
      <div class="btns">${remainNew?`<button class="btn" id="more">Học thêm ${Math.min(10,remainNew)} từ mới</button>`:''}<button class="btn ghost" id="goQuiz">Làm bài kiểm tra</button></div></div>`;
    bindTopic(()=>{R.built=false;viewReview()});
    const m=$('#more');if(m)m.addEventListener('click',()=>{R.extra+=10;R.built=false;viewReview()});
    $('#goQuiz').addEventListener('click',()=>{VIEW='quiz';render()});
    return;
  }
  const c=R.cur,dir=S.settings.dir,k=counts(),r=rec(L,c),now=Date.now();
  const front=dir==='fwd'
    ?`${wordVisual(c,L)}${sayBtn(c.w)}`
    :`<div class="vn-front">${esc(c.m)}</div><p class="hint">Từ ${LNAME[L]} là gì?</p>`;
  let back='';
  if(R.flipped){
    back=`<div class="back">${dir==='rev'?`<div style="display:flex;flex-direction:column;align-items:center;gap:10px">${wordVisual(c,L)}${sayBtn(c.w)}</div>`:`<div class="meaning">${esc(c.m)}</div>`}${metaLine(c,L)}${exBlock(c,L)}</div>`;
  }
  const actions=R.flipped
    ?`<div class="grades" role="group" aria-label="Bạn nhớ từ này thế nào?">${['Quên','Khó','Được','Dễ'].map((t,g)=>`<button class="g${g}" data-g="${g}">${t}<small>${fmtIvl(schedule(r,g,now).d-now)}</small></button>`).join('')}</div>`
    :`<button class="btn" id="flip">Lật thẻ <kbd>Space</kbd></button>`;
  v.innerHTML=tb+`<div class="counts"><span class="c-new"><b>${k.n}</b>mới</span><span class="c-learn"><b>${k.l}</b>đang học</span><span class="c-rev"><b>${k.r}</b>ôn lại</span></div>
    <article class="card"><div class="topicline"><span>${esc(c.topic)}</span><span>${r?STATUS_VN[statusOf(r)]:'Từ mới'}</span></div><div class="front">${front}</div>${back}</article>${actions}`;
  bindTopic(()=>{R.built=false;viewReview()});
  const f=$('#flip');if(f)f.addEventListener('click',flip);
  $$('.grades button').forEach(b=>b.addEventListener('click',()=>grade(+b.dataset.g)));
  if(!R.flipped&&dir==='fwd'&&S.settings.autoplay)speak(c.w,L);
}
function flip(){if(!R.cur||R.flipped)return;R.flipped=true;viewReview();if(S.settings.dir==='rev'&&S.settings.autoplay)speak(R.cur.w);const g=$('.grades button.g2');if(g)g.focus({preventScroll:true})}
function grade(g){
  if(!R.cur||!R.flipped)return;
  const L=S.lang,c=R.cur,old=rec(L,c),now=Date.now(),r=schedule(old,g,now);
  S.cards[L][c.id]=r;const ts=todayStat(L);if(old)ts.r++;else ts.n++;
  if(r.d-now<20*MIN)R.queue.splice(Math.min(R.queue.length,3),0,c);
  save();R.cur=R.queue.shift()||null;R.flipped=false;if(R.stale){R.stale=false;R.built=false}renderHeader();viewReview();
}

/* ---------- Quiz & Listening (shared engine) ---------- */
const QS={quiz:null,listen:null};
const QTYPES={
  meaning:{t:'Chọn nghĩa',d:'Xem từ, chọn nghĩa tiếng Việt đúng'},
  word:{t:'Chọn từ',d:'Xem nghĩa tiếng Việt, chọn từ đúng'},
  fill:{t:'Điền từ vào câu',d:'Chọn từ (đúng dạng) để hoàn thành câu ví dụ'},
  para:{t:'Nâng cấp câu IELTS',d:'Chọn cách viết lại tự nhiên, đúng ngữ pháp, hướng tới band 7',only:'en'},
  tone:{t:'Chọn đúng thanh điệu',d:'Xem chữ Hán, chọn pinyin có dấu thanh đúng',only:'zh'}
};
const LTYPES={lchoose:{t:'Nghe và chọn nghĩa',d:'Nghe phát âm rồi chọn nghĩa đúng'},ltype:{t:'Nghe và gõ lại',d:'Nghe rồi gõ lại từ, luyện cả chính tả'},
  ltone:{t:'Nghe và chọn thanh điệu',d:'Nghe phát âm, chọn pinyin có dấu thanh đúng',only:'zh'},
  lpair:{t:'Cặp thanh dễ nhầm',d:'Nghe một từ, chọn đúng từ trong nhóm chỉ khác nhau về thanh điệu',only:'zh'}};
const typeOk=(types,k,L)=>!!types[k]&&(!types[k].only||types[k].only===L);
function qkind(view,L){const isL=view==='listen',types=isL?LTYPES:QTYPES,k=isL?UI.ltype:UI.qtype[L];return typeOk(types,k,L)?k:(isL?'lchoose':'meaning')}
const TONE_KINDS=new Set(['tone','ltone','lpair']);

/* ---------- Thanh điệu: tách pinyin thành âm tiết, đổi dấu thanh ---------- */
const TONE_OF={'\u0304':1,'\u0301':2,'\u030c':3,'\u0300':4},TONE_MK=['','\u0304','\u0301','\u030c','\u0300'];
const PY_SYL=/^(?:[zcs]h|[bpmfdtnlgkhjqxrzcsyw])?(?:iang|iong|uang|ang|eng|ing|ong|iao|ian|uai|uan|van|ai|ei|ao|ou|an|en|er|in|ia|ie|iu|ua|uo|ui|un|ue|ve|vn|a|o|e|i|u|v)r?$/;
const PY_MEMO=new Map();
function pySeg(s){
  // Âm tiết không đứng đầu phải bắt đầu bằng phụ âm (a, o, e ở giữa từ luôn có dấu ' đi trước)
  const n=s.length,best=Array(n+1).fill(null);best[0]=[];
  for(let i=0;i<n;i++){if(!best[i])continue;
    for(let j=i+1;j<=Math.min(n,i+7);j++){const sub=s.slice(i,j);
      if(i>0&&!/^[bpmfdtnlgkhjqxrzcsyw]/.test(sub))continue;
      if(!PY_SYL.test(sub))continue;
      if(!best[j]||best[i].length+1<best[j].length)best[j]=best[i].concat([[i,j]])}}
  return best[n];
}
function pyMarkAt(b){let k=b.indexOf('a');if(k<0)k=b.indexOf('e');if(k<0&&b.includes('ou'))k=b.indexOf('o');if(k<0)for(let i=b.length-1;i>=0;i--)if('iouv'.includes(b[i])){k=i;break}return k}
function pyParse(py){
  if(PY_MEMO.has(py))return PY_MEMO.get(py);
  const items=[];
  for(const ch of String(py||'').normalize('NFD')){
    const last=items[items.length-1];
    if(/[a-z]/i.test(ch))items.push({s:ch,b:ch.toLowerCase(),t:0});
    else if(ch==='\u0308'&&last&&last.b){last.s+=ch;last.b='v'}
    else if(TONE_OF[ch]&&last&&last.b)last.t=TONE_OF[ch];
    else items.push({x:ch});
  }
  const parts=[],syl=[];let ok=true,i=0;
  while(i<items.length){
    if(items[i].x!=null){parts.push(items[i]);i++;continue}
    let j=i;while(j<items.length&&items[j].x==null)j++;
    const ls=items.slice(i,j),seg=pySeg(ls.map(l=>l.b).join(''));
    if(!seg){ok=false;break}
    for(const [a,b] of seg){const L=ls.slice(a,b),base=L.map(l=>l.b).join('');let mi=L.findIndex(l=>l.t);const tone=mi<0?0:L[mi].t;if(mi<0)mi=pyMarkAt(base);const sy={L,base,tone,mi};syl.push(sy);parts.push(sy)}
    i=j;
  }
  const r=ok&&syl.length?{parts,syl}:null;PY_MEMO.set(py,r);return r;
}
function pyRender(P,tones){let k=0;return P.parts.map(p=>{if(p.x!=null)return p.x;const t=tones[k++];return p.L.map((l,i)=>l.s+(i===p.mi&&t?TONE_MK[t]:'')).join('')}).join('').normalize('NFC')}
// Thanh 3 đứng trước thanh 3 đọc thành thanh 2 (pinyin vẫn viết dấu thanh 3)
const sandhiTones=t=>t.map((x,i)=>x===3&&t[i+1]===3?2:x);
function pySandhi(py){const P=pyParse(py);if(!P)return '';const o=P.syl.map(x=>x.tone),r=sandhiTones(o);return r.join()===o.join()?'':pyRender(P,r)}
const toneConf=(a,b)=>{const k=[a,b].sort().join('');return k==='23'?3:(k==='14'||!a||!b)?2:1};
function toneOpts(c,listen){
  // Đáp án sai = cùng pinyin nhưng đổi dấu thanh, ưu tiên đổi một âm tiết theo các cặp hay nhầm (2–3, 1–4).
  const P=c.py&&pyParse(c.py);if(!P)return null;
  const Y=P.syl,o=Y.map(x=>x.tone),right=c.py.normalize('NFC');
  if(pyRender(P,o)!==right)return null;
  // Không đổi 一, 不: pinyin trong app đã viết theo cách đọc biến điệu (yìqǐ, búcuò).
  const dom=Y.map(x=>((x.base==='yi'&&c.w.includes('一'))||(x.base==='bu'&&c.w.includes('不')))?[]:(x.tone||!listen)?[1,2,3,4]:[]);
  const so=sandhiTones(o).join();
  // Bỏ phương án nghe giống hệt đáp án (khi nghe) hoặc chính là cách đọc biến điệu (khi nhìn).
  const bad=a=>listen?sandhiTones(a).join()===so:a.join()===so;
  const out=[{t:right,ok:true}],seen=new Set([right]);
  const add=a=>{if(out.length>=4)return;const t=pyRender(P,a);if(!seen.has(t)){seen.add(t);out.push({t,ok:false})}};
  const one=[];
  Y.forEach((x,i)=>dom[i].forEach(t=>{if(t===o[i])return;const a=o.slice();a[i]=t;if(!bad(a))one.push({a,w:toneConf(o[i],t)+Math.random()*1.5})}));
  one.sort((p,q)=>q.w-p.w).forEach(x=>add(x.a));
  if(out.length<4){
    const two=[];
    for(let i=0;i<Y.length;i++)for(let j=i+1;j<Y.length;j++)for(const ti of dom[i])for(const tj of dom[j]){if(ti===o[i]||tj===o[j])continue;const a=o.slice();a[i]=ti;a[j]=tj;if(!bad(a))two.push(a)}
    shuffle(two).forEach(add);
  }
  return out.length===4?shuffle(out):null;
}
function pairItems(){
  const sets=[];(typeof ZH_TONES!=='undefined'?ZH_TONES:[]).forEach(g=>g.p.forEach(x=>sets.push(x)));
  return shuffle(sets).slice(0,10).map(x=>{
    const m=x.map(([w,py,mn])=>({id:'tone:'+w,w,py,m:mn,hv:'',ex:'',exv:''})),c=m[Math.floor(Math.random()*m.length)];
    return{kind:'lpair',card:c,set:m,opts:shuffle(m.map(y=>({t:y.w,ok:y===c,h:`<b class="zh" lang="zh">${esc(y.w)}</b> <span class="py">${esc(y.py)}</span> <small class="muted">${esc(y.m)}</small>`})))};
  });
}
const TONE_TIPS=`<details class="tips"><summary>Mẹo phân biệt thanh điệu</summary>
<p><b>Bốn thanh.</b> Thanh 1 cao và đều (mā). Thanh 2 đi lên (má). Thanh 3 xuống thấp rồi lên (mǎ); khi đứng trước âm tiết khác thường chỉ đọc nửa đầu, thấp và trầm. Thanh 4 rơi mạnh từ cao xuống (mà).</p>
<p><b>Hay nhầm nhất.</b> Thanh 2 với thanh 3: cả hai đều có đoạn đi lên, nhưng thanh 3 bắt đầu thấp hơn hẳn. Thanh 1 với thanh 4: cùng bắt đầu cao, thanh 4 rơi xuống dứt khoát.</p>
<p><b>Thanh 3 + thanh 3.</b> Thanh 3 đứng trước đọc thành thanh 2, nhưng pinyin vẫn viết dấu thanh 3: 你好 viết nǐ hǎo, đọc ní hǎo; 可以 viết kěyǐ, đọc kéyǐ. Thẻ từ có hiện dòng “Đọc thực tế” cho những từ này.</p>
<p><b>不.</b> Trước thanh 4 đọc bú (不是 búshì, 不客气 bú kèqi); trước các thanh khác đọc bù (不好 bù hǎo).</p>
<p><b>一.</b> Đứng một mình, khi đếm số hay chỉ thứ tự đọc yī (第一 dì-yī, 星期一 xīngqīyī). Trước thanh 4 đọc yí (一下 yíxià); trước thanh 1, 2, 3 đọc yì (一起 yìqǐ). Trong app, pinyin của 一 và 不 đã viết theo cách đọc này, còn thanh 3 vẫn giữ dấu gốc.</p>
<p><b>Thanh nhẹ.</b> Âm tiết đọc ngắn, nhẹ và không có dấu: 妈妈 māma, 谢谢 xièxie. Có từ chỉ khác nhau ở thanh nhẹ: 东西 dōngxi là đồ vật, còn dōngxī là đông và tây.</p>
</details>`;
function pairTable(){
  const G=typeof ZH_TONES!=='undefined'?ZH_TONES:[];if(!G.length)return '';
  return `<details class="tips"><summary>Bảng cặp thanh dễ nhầm</summary>${G.map(g=>`<h3 class="tgh">${esc(g.t)}</h3>${g.d?`<p>${esc(g.d)}</p>`:''}<ul class="tset">${g.p.map(x=>`<li>${x.map(([w,py,m])=>`<span class="tw">${sayBtn(w,'sm')}<b class="zh" lang="zh">${esc(w)}</b><span class="py">${esc(py)}</span><small>${esc(m)}</small></span>`).join('')}</li>`).join('')}</ul>`).join('')}</details>`;
}
function makeItem(kind,c,L){
  if(kind==='ltype')return{kind,card:c};
  if(kind==='tone'||kind==='ltone')return{kind,card:c,opts:toneOpts(c,kind==='ltone')};
  const key=kind==='word'?(x=>x.w):kind==='fill'?(x=>x.ex&&/\[.+?\]/.test(x.ex)?surface(x):''):(x=>x.m);
  const correct=key(c),all=DECKS[L];
  const pool=[...shuffle(all.filter(x=>x.topic===c.topic&&x.id!==c.id)),...shuffle(all.filter(x=>x.topic!==c.topic))];
  const opts=[{t:correct,ok:true}],seen=new Set([norm(correct)]);
  for(const x of pool){if(opts.length>=4)break;const v=key(x);if(!v||seen.has(norm(v)))continue;seen.add(norm(v));opts.push({t:v,ok:false})}
  return{kind,card:c,opts:shuffle(opts)};
}
function startRound(view){
  const L=S.lang;let items=[];
  const kind=qkind(view,L);
  if(kind==='para'){items=shuffle(PARA).slice(0,10).map(p=>({kind,prompt:p.q,why:p.why,opts:shuffle(p.o.map((t,i)=>({t,ok:i===0})))}))}
  else if(kind==='lpair')items=pairItems();
  else{
    let deck=filtered(L);if(kind==='fill')deck=deck.filter(c=>/\[.+?\]/.test(c.ex||''));
    if(kind==='tone'||kind==='ltone')deck=deck.filter(c=>toneOpts(c,kind==='ltone'));
    const seen=deck.filter(c=>rec(L,c));
    let picks=shuffle(seen).slice(0,10);
    if(picks.length<10)picks=picks.concat(shuffle(deck.filter(c=>!rec(L,c))).slice(0,10-picks.length));
    items=shuffle(picks).map(c=>makeItem(kind,c,L));
  }
  QS[view]=items.length?{view,lang:L,items,i:0,score:0,wrong:[],answered:false,done:false}:{empty:true,lang:L};
}
function viewQuiz(){
  const view=VIEW,L=S.lang,v=$('#view');let Q=QS[view];
  if(Q&&Q.lang!==L)Q=QS[view]=null;
  const isL=view==='listen';
  if(!Q||Q.empty){
    const types=isL?LTYPES:QTYPES,cur=qkind(view,L);
    const keys=Object.keys(types).filter(k=>typeOk(types,k,L));
    let notice='';
    if(isL){
      if(!HAS_TTS)notice='<div class="notice">Trình duyệt này không hỗ trợ đọc thành tiếng. Hãy mở bằng Chrome, Safari hoặc Edge.</div>';
      else if(!sysMode(L)&&VOICES.length&&!voiceFor(L))notice=`<div class="notice">Thiết bị chưa có giọng đọc ${LNAME[L]}. Xem cách tải giọng trong <button class="linkbtn" data-goset>Cài đặt</button>.</div>`;
      else if(!sysMode(L)&&VOICES.length&&!voiceIsGood(voiceFor(L)))notice=`<div class="notice">Máy đang dùng giọng đọc cơ bản nên nghe chưa tự nhiên. Vào <button class="linkbtn" data-goset>Cài đặt</button> để chọn hoặc tải giọng tốt hơn.</div>`;
    }
    v.innerHTML=`<h2>${isL?'Luyện nghe':'Kiểm tra'}</h2>${notice}
      <div class="types" role="radiogroup">${keys.map(k=>`<button class="type" role="radio" data-k="${k}" aria-pressed="${k===cur}" aria-checked="${k===cur}"><span class="radio"></span><span><b>${types[k].t}</b><small>${types[k].d}</small></span></button>`).join('')}</div>
      ${cur==='para'||cur==='lpair'?'':`<div class="toolbar" style="margin-top:0">${topicSelect(L)}</div>`}
      ${Q&&Q.empty?'<p class="msg no">Chủ đề này chưa có đủ từ cho dạng bài này. Hãy chọn chủ đề khác.</p>':''}
      <p class="muted small">${cur==='lpair'?'Mỗi lượt 10 câu, lấy ngẫu nhiên từ bảng cặp thanh dễ nhầm bên dưới.':`Mỗi lượt 10 câu, ưu tiên những từ bạn đã học. ${isL?'':'Từ trả lời sai sẽ được đưa vào phần ôn thẻ ngay.'}`}</p>
      <button class="btn" id="startQ">Bắt đầu</button>${TONE_KINDS.has(cur)?TONE_TIPS+(cur==='lpair'?pairTable():''):''}`;
    $$('[data-goset]').forEach(b=>b.addEventListener('click',()=>{VIEW='settings';render();window.scrollTo(0,0)}));
    $$('.type').forEach(b=>b.addEventListener('click',()=>{if(isL)UI.ltype=b.dataset.k;else UI.qtype[L]=b.dataset.k;QS[view]=null;viewQuiz()}));
    bindTopic(()=>{QS[view]=null;viewQuiz()});
    $('#startQ').addEventListener('click',()=>{startRound(view);viewQuiz();const q=QS[view];if(q&&!q.empty&&q.items[0].kind[0]==='l')speak(q.items[0].card.w,L)});
    return;
  }
  if(Q.done){
    const n=Q.items.length,p=Q.score/n;
    const msg=p>=0.9?'Rất tốt! Bạn nắm chắc nhóm từ này.':p>=0.7?'Khá ổn. Xem lại những câu sai bên dưới nhé.':'Hãy ôn lại các từ bên dưới rồi làm lại.';
    const wrongCards=Q.wrong.filter(it=>it.card);
    v.innerHTML=`<div class="score">${Q.score}<span>/${n}</span></div><p>${msg}</p>
      ${Q.wrong.length?`<h3 style="margin-top:20px">Cần xem lại</h3><ul class="misslist">${Q.wrong.map(it=>it.card?`<li><b class="${fc(L)}">${esc(it.card.w)}</b>${TONE_KINDS.has(it.kind)?`<span class="py">${esc(it.card.py)}</span>`:''}<span class="muted">${esc(it.card.m)}</span></li>`:`<li><span>${esc(it.opts.find(o=>o.ok).t)}</span></li>`).join('')}</ul>`:''}
      <div class="btns"><button class="btn" id="again">Làm lượt mới</button>${!isL&&wrongCards.some(it=>rec(L,it.card))?'<button class="btn ghost" id="toReview">Ôn lại từ sai</button>':''}<button class="btn ghost" id="changeType">Đổi dạng bài</button></div>`;
    $('#again').addEventListener('click',()=>{startRound(view);viewQuiz();const q=QS[view];if(q&&!q.empty&&q.items[0].kind[0]==='l')speak(q.items[0].card.w,L)});
    const tr=$('#toReview');if(tr)tr.addEventListener('click',()=>{R.built=false;VIEW='review';render()});
    $('#changeType').addEventListener('click',()=>{QS[view]=null;viewQuiz()});
    return;
  }
  const it=Q.items[Q.i],c=it.card,n=Q.items.length;
  let prompt='';
  if(it.kind==='meaning')prompt=`<p class="ask">Nghĩa của từ này là gì?</p><div class="qword ${fc(L)}" lang="${L}">${esc(c.w)}${sayBtn(c.w)}</div>${L==='en'&&c.pos?`<p class="hint" style="margin-top:6px"><i>${esc(c.pos)}</i></p>`:''}`;
  else if(it.kind==='word')prompt=`<p class="ask">Từ nào có nghĩa là</p><div class="qmean">${esc(c.m)}</div>`;
  else if(it.kind==='fill')prompt=`<p class="ask">Chọn từ thích hợp cho chỗ trống</p><div class="qsent ${fc(L)}" lang="${L}">${blankOut(c.ex)}</div>${c.exv?`<p style="text-align:left;margin:10px 0 0"><button class="linkbtn" id="hintBtn">Xem nghĩa của câu</button></p><p class="exv" id="hintTxt" hidden style="text-align:left;margin-top:6px">${esc(c.exv)}</p>`:''}`;
  else if(it.kind==='tone')prompt=`<p class="ask">Chọn pinyin có dấu thanh đúng</p><div class="qword zh" lang="zh">${esc(c.w)}</div><p class="hint" style="margin-top:6px">${esc(c.m)}</p>`;
  else if(it.kind==='para')prompt=`<p class="ask">Câu gốc (band 5). Cách viết lại nào tốt nhất?</p><div class="qsent" lang="en">${esc(it.prompt)}</div>`;
  else prompt=`<p class="ask">${{lchoose:'Nghe và chọn nghĩa đúng',ltype:'Nghe và gõ lại từ bạn nghe được',ltone:'Nghe và chọn pinyin có dấu thanh đúng',lpair:'Nghe và chọn từ bạn nghe được'}[it.kind]}</p><div class="play"><button class="playbtn" type="button" data-say="${esc(c.w)}" aria-label="Phát lại">${ICON_PLAY}</button><button class="linkbtn" type="button" data-say="${esc(c.w)}" data-slow="1">Nghe chậm</button></div>`;
  let answers='';
  if(it.kind==='ltype')answers=`<div class="typed"><input class="inp" id="typed" lang="${L}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="${L==='ko'?'Gõ bằng bàn phím tiếng Hàn':L==='zh'?'Gõ chữ Hán hoặc pinyin (không cần dấu)':'Gõ từ tiếng Anh'}" aria-label="Câu trả lời"><button class="btn" id="checkT">Kiểm tra</button></div>`;
  else{
    const optKr=L!=='en'&&(it.kind==='word'||it.kind==='fill'),optPy=it.kind==='tone'||it.kind==='ltone';
    answers=`<div class="opts">${it.opts.map((o,i)=>`<button class="opt ${optKr?fc(L):''}${optPy?' py':''}" data-i="${i}" ${optKr?`lang="${L}"`:''}><span class="n">${i+1}</span><span>${o.h||esc(o.t)}</span></button>`).join('')}</div>`;
  }
  v.innerHTML=`<div class="qhead"><span>Câu ${Q.i+1}/${n}</span><span>Đúng ${Q.score}</span></div><div class="bar"><i style="width:${Q.i/n*100}%"></i></div>
    <div class="qcard">${prompt}</div>${answers}<div id="fb"></div>`;
  $$('.opt').forEach(b=>b.addEventListener('click',()=>answer(+b.dataset.i)));
  const hb=$('#hintBtn');if(hb)hb.addEventListener('click',()=>{$('#hintTxt').hidden=false;hb.hidden=true});
  const ti=$('#typed');
  if(ti){
    ti.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();Q.answered?nextQ():checkTyped()}});
    $('#checkT').addEventListener('click',checkTyped);
    if(window.matchMedia('(hover:hover)').matches)ti.focus({preventScroll:true});
  }
}
function feedback(it,ok,typed){
  const L=S.lang,c=it.card,Q=QS[VIEW],last=Q.i===Q.items.length-1;
  let body='';
  if(it.kind==='para')body=`<p>${esc(it.why)}</p>`;
  else body=`<p><b class="${fc(L)}" lang="${L}" style="font-size:18px">${esc(c.w)}</b> ${sayBtn(c.w,'sm')}</p><p>${esc(c.m)}</p>${metaLine(c,L)}${exBlock(c,L)}`;
  if(it.set)body+=`<p class="muted small" style="margin-top:4px">So sánh với</p><ul class="cmp">${it.set.filter(x=>x!==c).map(x=>`<li>${sayBtn(x.w,'sm')}<b class="zh" lang="zh">${esc(x.w)}</b><span class="py">${esc(x.py)}</span><span class="muted">${esc(x.m)}</span></li>`).join('')}</ul>`;
  if(typed!=null&&!ok)body=`<p class="muted small">Bạn gõ: ${esc(typed)||'(trống)'}</p>`+body;
  $('#fb').innerHTML=`<div class="fb ${ok?'':'no'}"><span class="verdict">${ok?'Chính xác':'Chưa đúng'}</span>${body}</div><div class="btns"><button class="btn" id="nextQ">${last?'Xem kết quả':'Câu tiếp theo'} <kbd>Enter</kbd></button></div>`;
  $('#nextQ').addEventListener('click',nextQ);
  if(typed==null)$('#nextQ').focus({preventScroll:true});
  $('#fb').scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
}
function markResult(it,ok){
  const Q=QS[VIEW],L=S.lang;
  if(ok)Q.score++;
  else{Q.wrong.push(it);if(it.card&&VIEW==='quiz'){const r=rec(L,it.card);if(r){r.d=Date.now();r.t=Date.now();save();renderHeader()}}}
}
function answer(i){
  const Q=QS[VIEW];if(!Q||Q.answered||Q.done)return;const it=Q.items[Q.i];if(!it.opts||!it.opts[i])return;
  Q.answered=true;const ok=it.opts[i].ok;markResult(it,ok);
  $$('.opt').forEach((b,j)=>{b.disabled=true;if(it.opts[j].ok)b.classList.add('right');else if(j===i)b.classList.add('wrong')});
  feedback(it,ok,null);
  if(it.kind==='lchoose'||it.kind==='meaning'){}else if(it.card&&S.settings.autoplay)speak(it.card.w);
}
function checkTyped(){
  const Q=QS[VIEW];if(!Q||Q.answered)return;const it=Q.items[Q.i],inp=$('#typed');
  const val=inp.value.trim();const ok=norm(val)===norm(it.card.w)||(S.lang==='zh'&&!!it.card.py&&noTone(val)===noTone(it.card.py));
  Q.answered=true;markResult(it,ok);inp.readOnly=true;$('#checkT').disabled=true;
  inp.style.borderColor=ok?'var(--ok)':'var(--bad)';
  feedback(it,ok,val);
}
function nextQ(){
  const Q=QS[VIEW];if(!Q||!Q.answered)return;
  if(Q.i>=Q.items.length-1){Q.done=true}else{Q.i++;Q.answered=false}
  viewQuiz();window.scrollTo(0,0);
  if(!Q.done){const it=Q.items[Q.i];if(it.kind[0]==='l')speak(it.card.w)}
}

/* ---------- Học theo sách (KIIP, 发展汉语) ---------- */
const BOOKS={
  ko:{name:'KIIP 초급 1',sub:'KIIP 초급 1, 한국어와 한국문화. Danh sách từ lấy từ phần 색인 của sách',
      units:()=>typeof KIIP_UNITS!=='undefined'?KIIP_UNITS:[],ids:n=>BOOK[n]||[],from:'bookFrom',to:'bookTo',defTo:13,
      pages:n=>{const p=n<=9?12+10*(n-1):112+10*(n-10);return[p,p+9]},
      note:n=>n===10?'Hết phần 1. Sách có bài ôn tập 1 (bài 1–9) ở trang 102.':'',endNote:'Sách có bài ôn tập 2 (bài 10–18) ở trang 202.'},
  zh:{name:'发展汉语 初级综合 I',sub:'发展汉语 初级综合 I (Developing Chinese). Hiện có bài 1–15; danh sách từ lấy từ phần 生词总表 của sách',
      units:()=>typeof ZH_UNITS!=='undefined'?ZH_UNITS:[],ids:n=>ZBOOK[n]||[],from:'zhFrom',to:'zhTo',defTo:15,
      pages:n=>[ZH_PAGES[n],ZH_PAGES[n+1]-1],
      note:()=>'',endNote:'Sau bài 15, sách có phần tổng kết ngữ pháp 语言点小结（一）về câu hỏi ở trang 171.'}
};
const BK={unit:{ko:null,zh:null}};
const curBook=()=>BOOKS[S.lang];
function bookRange(){const B=curBook(),units=B.units(),max=units.length||1;let a=S.settings[B.from]||1,b=S.settings[B.to]||B.defTo;a=Math.min(Math.max(1,a),max);b=Math.min(Math.max(1,b),max);return[Math.min(a,b),Math.max(a,b)]}
function unitIds(a,b){const B=curBook(),ids=[],seen=new Set();for(let n=a;n<=b;n++)for(const id of B.ids(n))if(!seen.has(id)){seen.add(id);ids.push(id)}return ids}
function unitStats(ids){const C=S.cards[S.lang];let k=0,l=0,n=0;for(const id of ids){const s=statusOf(C[id]);if(s==='known')k++;else if(s==='learning')l++;else n++}return{k,l,n,t:ids.length}}
const pctOf=s=>s.t?Math.round((s.k+s.l*0.5)/s.t*100):0;
function goScoped(ids,label,view){setScope(ids,label);if(view==='quiz'&&S.lang==='ko'&&UI.qtype.ko==='fill')UI.qtype.ko='meaning';VIEW=view;render();window.scrollTo(0,0)}
function viewBook(){
  const L=S.lang,B=curBook(),units=B.units(),v=$('#view');
  if(!B||!units.length){v.innerHTML='<p class="empty">Chưa có dữ liệu sách.</p>';return}
  if(BK.unit[L])return viewUnit(BK.unit[L]);
  const [a,b]=bookRange(),ids=unitIds(a,b),st=unitStats(ids);
  const days=Math.ceil(st.n/Math.max(1,S.settings.newPerDay));
  const opts=n=>units.map(u=>`<option value="${u.n}"${u.n===n?' selected':''}>Bài ${u.n}</option>`).join('');
  v.innerHTML=`<h2>Học theo sách</h2>
    <p class="muted small" style="margin-top:0">${esc(B.sub)}; nghĩa, giải thích ngữ pháp và câu ví dụ do ứng dụng soạn để ôn tập, nên học kèm sách.</p>
    <section class="set"><h3>Phạm vi ôn tập</h3>
      <div class="range"><select class="sel" id="bkFrom" aria-label="Từ bài">${opts(a)}</select><span>đến</span><select class="sel" id="bkTo" aria-label="Đến bài">${opts(b)}</select></div>
      <div class="chips"><span><b>${st.k}</b> đã nhớ</span><span><b>${st.l}</b> đang học</span><span><b>${st.n}</b> chưa học</span><span>${st.t} từ</span></div>
      <div class="bar"><i style="width:${pctOf(st)}%"></i></div>
      ${st.n?`<p class="muted small">Với ${S.settings.newPerDay} từ mới mỗi ngày, cần khoảng ${days} ngày để học hết phần chưa học. Bạn có thể tăng số từ mới mỗi ngày trong Cài đặt.</p>`:''}
      <div class="btns two"><button class="btn" id="bkRev">Ôn thẻ</button><button class="btn ghost" id="bkQuiz">Kiểm tra</button></div>
    </section>
    <ol class="units">${units.map(u=>{const s=unitStats(B.ids(u.n));const nt=B.note(u.n);return `${nt?`<li class="rev">${esc(nt)}</li>`:''}<li><button class="unit${u.n>=a&&u.n<=b?' inrange':''}" data-u="${u.n}"><span class="un">${u.n}</span><span class="ut"><b class="${fc(L)}" lang="${L}">${esc(u.ko)}</b><small>${esc(u.vn)}</small></span><span class="up"><span class="mini"><i style="width:${pctOf(s)}%"></i></span><small>${s.k}/${s.t}</small></span></button></li>`}).join('')}<li class="rev">${esc(B.endNote)}</li></ol>`;
  const setR=()=>{S.settings[B.from]=+$('#bkFrom').value;S.settings[B.to]=+$('#bkTo').value;S.sAt=Date.now();save();viewBook()};
  $('#bkFrom').addEventListener('change',setR);$('#bkTo').addEventListener('change',setR);
  $('#bkRev').addEventListener('click',()=>goScoped(ids,`Sách: bài ${a}–${b}`,'review'));
  $('#bkQuiz').addEventListener('click',()=>goScoped(ids,`Sách: bài ${a}–${b}`,'quiz'));
  $$('.unit').forEach(btn=>btn.addEventListener('click',()=>{BK.unit[L]=+btn.dataset.u;viewBook();window.scrollTo(0,0)}));
}
function viewUnit(n){
  const L=S.lang,B=curBook(),units=B.units(),u=units[n-1],ids=B.ids(n),st=unitStats(ids),[p1,p2]=B.pages(n),v=$('#view');
  const cards=ids.map(id=>BYID[L].get(id)).filter(Boolean);
  v.innerHTML=`<div class="toolbar"><button class="linkbtn" id="bkBack" type="button">← Tất cả các bài</button></div>
    <p class="muted small" style="margin:8px 0 0">Bài ${n}, sách trang ${p1}–${p2}. Chủ đề: ${esc(u.topic)}</p>
    <h2 class="${fc(L)} utitle" lang="${L}">${esc(u.ko)} ${sayBtn(u.ko,'sm')}</h2><p style="margin:0">${esc(u.vn)}</p>
    <div class="chips"><span><b>${st.k}</b> đã nhớ</span><span><b>${st.l}</b> đang học</span><span><b>${st.n}</b> chưa học</span></div>
    <div class="btns two"><button class="btn" id="uRev">Ôn thẻ</button><button class="btn ghost" id="uQuiz">Kiểm tra</button></div>
    <h3 class="sec">Ngữ pháp</h3>
    ${u.g.map(g=>`<section class="gram"><div class="gp ${fc(L)}" lang="${L}">${esc(g.p)}</div><div class="gt">${esc(g.t)}</div><p>${esc(g.d)}</p><ul class="gex">${g.ex.map(([k,vn])=>`<li><div class="ex"><p lang="${L}">${esc(k)}</p>${sayBtn(k,'sm')}</div><p class="exv">${esc(vn)}</p></li>`).join('')}</ul></section>`).join('')}
    <h3 class="sec">Từ vựng (${cards.length})</h3>
    <div class="wl">${cards.map(c=>{const s=statusOf(rec(L,c));const hv=c.hv&&!/^từ mượn/i.test(c.hv)?c.hv:'';const sub=[c.py,hv].filter(Boolean).join(' · ');return `<div class="wrow"><span class="w-word ${fc(L)}" lang="${L}">${esc(c.w)}</span><span class="w-m2">${esc(c.m)}${sub?`<small>${esc(sub)}</small>`:''}</span><span class="tag ${s}">${STATUS_VN[s]}</span>${sayBtn(c.w,'sm')}</div>`}).join('')}</div>
    <div class="unav">${n>1?`<button class="btn ghost auto" data-go="${n-1}" type="button">← Bài ${n-1}</button>`:'<span></span>'}${n<units.length?`<button class="btn ghost auto" data-go="${n+1}" type="button">Bài ${n+1} →</button>`:''}</div>`;
  $('#bkBack').addEventListener('click',()=>{BK.unit[L]=null;viewBook();window.scrollTo(0,0)});
  $('#uRev').addEventListener('click',()=>goScoped(ids,`Sách: bài ${n}`,'review'));
  $('#uQuiz').addEventListener('click',()=>goScoped(ids,`Sách: bài ${n}`,'quiz'));
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>{BK.unit[L]=+b.dataset.go;viewBook();window.scrollTo(0,0)}));
}

/* ---------- Word list ---------- */
function viewList(){
  const L=S.lang,v=$('#view');
  const tally={new:0,learning:0,known:0};DECKS[L].forEach(c=>tally[statusOf(rec(L,c))]++);
  const f=L==='zh'
    ?[['w','Chữ Hán *','例: 朋友'],['py','Pinyin','péngyou'],['m','Nghĩa tiếng Việt *','bạn bè'],['hv','Hán-Việt','bằng hữu'],['ex','Câu ví dụ','他是我的[朋友]。'],['exv','Dịch câu ví dụ','Anh ấy là bạn của tôi.']]
    :L==='ko'
    ?[['w','Từ tiếng Hàn *','예: 산책하다'],['m','Nghĩa tiếng Việt *','đi dạo'],['hv','Hán-Việt (nếu có)','산책 散策 · tản sách'],['ex','Câu ví dụ','저녁에 공원에서 [산책해요].'],['exv','Dịch câu ví dụ','Buổi tối tôi đi dạo ở công viên.']]
    :[['w','Từ tiếng Anh *','e.g. commute'],['m','Nghĩa tiếng Việt *','đi lại (giữa nhà và nơi làm)'],['pos','Loại từ','v / n / adj'],['note','Collocation / ghi chú','a long commute; commute to work'],['ex','Câu ví dụ','Many people [commute] for over an hour.'],['exv','Dịch câu ví dụ','Nhiều người đi lại hơn một tiếng mỗi ngày.']];
  v.innerHTML=`<div class="toolbar"><input class="inp" id="q" type="search" placeholder="Tìm từ hoặc nghĩa" value="${esc(UI.search)}" aria-label="Tìm từ" style="flex:1 1 200px"><select class="sel" id="st" aria-label="Lọc theo trạng thái"><option value="all">Mọi trạng thái</option>${['new','learning','known'].map(s=>`<option value="${s}"${UI.status===s?' selected':''}>${STATUS_VN[s]}</option>`).join('')}</select></div>
    <div class="toolbar" style="margin-top:6px">${topicSelect(L)}</div>
    <div class="chips"><span><b>${tally.known}</b> đã nhớ</span><span><b>${tally.learning}</b> đang học</span><span><b>${tally.new}</b> chưa học</span></div>
    <button class="btn ghost" id="addBtn" aria-expanded="${UI.addOpen}">${UI.addOpen?'Đóng':'Thêm từ của bạn'}</button>
    <div class="formbox" id="addForm" ${UI.addOpen?'':'hidden'}>
      ${f.map(([k,lab,ph])=>`<div class="field"><label for="f-${k}">${lab}</label><input class="inp" id="f-${k}" placeholder="${esc(ph)}" ${k==='w'||k==='ex'?`lang="${L}"`:''} autocomplete="off"></div>`).join('')}
      <p class="muted small" style="margin:0">Đặt từ cần học trong câu vào [ngoặc vuông] để dùng cho bài điền từ. Nếu bỏ trống, ứng dụng sẽ tự tìm từ trong câu.</p>
      <p class="msg" id="addMsg"></p>
      <button class="btn" id="saveWord">Lưu từ</button>
    </div>
    <div class="wl" id="wl"></div>`;
  const q=$('#q');q.addEventListener('input',()=>{UI.search=q.value;renderList()});
  $('#st').addEventListener('change',e=>{UI.status=e.target.value;renderList()});
  bindTopic(renderList);
  $('#addBtn').addEventListener('click',()=>{UI.addOpen=!UI.addOpen;viewList();if(UI.addOpen)$('#f-w').focus()});
  $('#saveWord').addEventListener('click',addWord);
  renderList();
}
function renderList(){
  const L=S.lang,q=norm(UI.search),now=Date.now();
  const rows=filtered(L).filter(c=>(UI.status==='all'||statusOf(rec(L,c))===UI.status)&&(!q||norm(c.w).includes(q)||norm(c.m).includes(q)||(c.py&&noTone(c.py).includes(noTone(UI.search)))));
  $('#wl').innerHTML=rows.length?rows.map(c=>{
    const r=rec(L,c),st=statusOf(r);
    const due=r?(r.d<=now?'Đến hạn ôn':`Ôn lại sau ${fmtIvl(r.d-now)}`):'Chưa học';
    return `<details><summary><span class="w-word ${fc(L)}" lang="${L}">${esc(c.w)}</span><span class="w-m">${esc(c.m)}</span><span class="tag ${st}">${STATUS_VN[st]}</span></summary>
      <div class="w-body"><div class="ansrow"><div class="meaning" style="font-size:17px">${esc(c.m)}${c.pos?` <span class="pos">${esc(c.pos)}</span>`:''}</div>${sayBtn(c.w,'sm')}</div>${metaLine(c,L)}${exBlock(c,L)}
      <div class="w-foot"><span>${esc(c.topic)}, ${due.charAt(0).toLowerCase()+due.slice(1)}</span>${c.custom?`<button class="linkbtn" data-del="${esc(c.id)}" style="color:var(--bad)">Xóa từ</button>`:''}</div></div></details>`;
  }).join(''):`<p class="empty">Không tìm thấy từ nào. ${UI.search?'Thử từ khóa khác, hoặc thêm từ này vào danh sách của bạn.':''}</p>`;
  $$('[data-del]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.dataset.del;if(!confirm('Xóa từ này khỏi danh sách của bạn?'))return;
    S.tomb.push(id);S.custom[L]=S.custom[L].filter(c=>c.id!==id);delete S.cards[L][id];save();rebuildDecks();R.built=false;renderHeader();viewList();
  }));
}
function addWord(){
  const L=S.lang,val=id=>{const e=$('#f-'+id);return e?e.value.trim():''},msg=$('#addMsg');
  const w=val('w'),m=val('m');
  if(!w||!m){msg.className='msg no';msg.textContent='Hãy nhập cả từ và nghĩa tiếng Việt.';return}
  if(DECKS[L].some(c=>norm(c.w)===norm(w))){msg.className='msg no';msg.textContent='Từ này đã có trong danh sách.';return}
  let ex=val('ex');if(ex&&!/\[.+?\]/.test(ex)){const i=ex.toLowerCase().indexOf(w.toLowerCase());if(i>=0)ex=ex.slice(0,i)+'['+ex.slice(i,i+w.length)+']'+ex.slice(i+w.length)}
  const id=L+':c'+Date.now().toString(36);
  const c=L==='zh'?{id,w,py:val('py'),m,hv:val('hv'),ex,exv:val('exv')}:L==='ko'?{id,w,m,hv:val('hv'),ex,exv:val('exv')}:{id,w,pos:val('pos'),m,note:val('note'),ex,exv:val('exv')};
  S.custom[L].push(c);save();rebuildDecks();R.built=false;renderHeader();
  UI.addOpen=true;viewList();
  const mm=$('#addMsg');mm.className='msg ok';mm.textContent=`Đã thêm “${w}”. Từ này sẽ xuất hiện trong phần ôn thẻ, chủ đề “${MINE}”.`;
}

/* ---------- Settings ---------- */
const VSAMPLE={zh:'你好，很高兴认识你。',ko:'안녕하세요. 오늘 날씨가 정말 좋네요.',en:'Hello. The weather is really lovely today, isn\'t it?'};
function renderVoiceInfo(){
  for(const L of LANGS){
    const sel=$('#v-'+L),q=$('#vq-'+L);if(!sel)continue;
    if(!HAS_TTS){sel.innerHTML='<option>Không hỗ trợ</option>';sel.disabled=true;q.textContent='Trình duyệt này không hỗ trợ đọc thành tiếng.';continue}
    const list=voicesFor(L),cur=voiceFor(L);
    sel.disabled=false;
    const autoLbl=IS_IOS?'Tự động: giọng mặc định của máy':(list.length?'Tự động: '+esc(list[0].name):'Tự động');
    sel.innerHTML=`<option value="">${autoLbl}</option><option value="__system__"${VPREF[L]==='__system__'?' selected':''}>Giọng mặc định của hệ thống</option>`+list.map(v=>`<option value="${esc(v.voiceURI)}"${VPREF[L]===v.voiceURI?' selected':''}>${esc(v.name)} (${esc(v.lang)})${voiceIsGood(v)?' ★':''}</option>`).join('');
    if(!VPREF[L]||(VPREF[L]!=='__system__'&&!list.some(v=>v.voiceURI===VPREF[L])))sel.value='';
    if(sysMode(L)){q.className='vq';q.textContent=IS_IOS?`Đang dùng giọng bạn chọn cho ${({ko:'Korean',en:'English (UK)',zh:'Chinese (China mainland)'})[L]} trong Cài đặt iPhone → Trợ năng → Nội dung được đọc → Giọng nói.`:'Đang dùng giọng mặc định của hệ điều hành cho ngôn ngữ này.';continue}
    if(!list.length){q.className='vq basic';q.textContent=`Thiết bị chưa có giọng ${LNAME[L]}. Xem hướng dẫn tải giọng bên dưới.`;continue}
    const good=voiceIsGood(cur);
    q.className='vq '+(good?'good':'basic');
    q.textContent=good?'Giọng chất lượng cao.':'Giọng cơ bản, nghe chưa tự nhiên. Hãy thử giọng khác có dấu ★, hoặc tải thêm theo hướng dẫn bên dưới.';
  }
}
function renderSyncBox(){
  const box=$('#syncBox');if(!box)return;
  if(IN_CLAUDE){
    box.innerHTML=`<p>${SY.ref?'Tiến độ được lưu vào tài khoản Claude của bạn, nên học trên điện thoại hay máy tính đều tiếp tục được. Dữ liệu này chỉ mình bạn xem được.':'Tiến độ đang được lưu trên trình duyệt của thiết bị này.'}</p><p class="muted small">Đồng bộ qua GitHub Gist chỉ dùng cho bản bạn tự đăng lên github.io.</p>`;
    return;
  }
  if(gistOn()){
    box.innerHTML=`<p>Đang đồng bộ qua GitHub Gist${GS.login?` với tài khoản <b>@${esc(GS.login)}</b>`:''}.</p>
      <p class="muted small">${GS.last?'Lần đồng bộ gần nhất: '+esc(new Date(GS.last).toLocaleString('vi-VN')):'Chưa đồng bộ lần nào.'}</p>
      ${!navigator.onLine?'<p class="msg">Đang ngoại tuyến. Bạn vẫn học bình thường, tiến độ sẽ tự đồng bộ khi có mạng.</p>':''}${GS.err?`<p class="msg no">${esc(GS.err)}</p>`:''}
      <div class="seg"><button id="gNow" type="button">Đồng bộ ngay</button><button id="gOff" type="button">Ngắt kết nối</button></div>`;
    $('#gNow').addEventListener('click',gistSync);
    $('#gOff').addEventListener('click',()=>{if(!confirm('Ngắt kết nối GitHub trên máy này? Tiến độ vẫn được giữ trên máy và trong gist.'))return;clearTimeout(gTimer);GS={};saveGS();setSync('local');renderSyncBox()});
    return;
  }
  box.innerHTML=`<p>Tiến độ đang lưu trên trình duyệt của máy này. Kết nối với GitHub Gist để đồng bộ giữa điện thoại và máy tính.</p>
    <ol class="gsteps">
      <li>Bấm <a href="https://github.com/settings/tokens/new?scopes=gist&amp;description=So%20tu%20vung" target="_blank" rel="noopener">tạo token trên GitHub</a>. Trang mở ra đã chọn sẵn quyền <b>gist</b>.</li>
      <li>Ở mục Expiration, chọn thời hạn (ví dụ 1 năm), rồi kéo xuống cuối trang bấm <b>Generate token</b>.</li>
      <li>Sao chép mã bắt đầu bằng <code>ghp_</code>, dán vào ô dưới đây rồi bấm Kết nối.</li>
      <li>Trên máy còn lại, mở trang và dán cùng mã đó. Hãy lưu mã vào ghi chú riêng, vì GitHub chỉ hiện mã một lần.</li>
    </ol>
    <div class="typed"><input class="inp" id="gTok" type="password" placeholder="ghp_…" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="GitHub token"><button class="btn" id="gGo" type="button">Kết nối</button></div>
    <p class="msg" id="gMsg"></p>
    <p class="muted small">Mã chỉ được lưu trong trình duyệt của máy này và chỉ dùng để đọc, ghi một gist bí mật chứa tiến độ học. Chỉ nên kết nối trên máy cá nhân.</p>`;
  const go=async()=>{
    const v=$('#gTok').value.trim(),m=$('#gMsg');
    if(!v){m.className='msg no';m.textContent='Hãy dán token vào ô trên.';return}
    m.className='msg';m.textContent='Đang kết nối…';$('#gGo').disabled=true;
    try{await gistConnect(v);if(GS.err)throw{status:0,msg:GS.err};renderSyncBox()}
    catch(e){const msg=e&&e.msg?e.msg:ghErr(e);GS={};saveGS();setSync('local');m.className='msg no';m.textContent=msg;$('#gGo').disabled=false}
  };
  $('#gGo').addEventListener('click',go);
  $('#gTok').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go()}});
}
function viewSettings(){
  const s=S.settings,v=$('#view');
  v.innerHTML=`<h2>Cài đặt</h2>
  <section class="set"><h3>Ôn thẻ</h3>
    <label class="line">Số từ mới mỗi ngày (mỗi ngôn ngữ)<select class="sel" id="sNew">${[5,10,15,20,30].map(n=>`<option${n===s.newPerDay?' selected':''}>${n}</option>`).join('')}</select></label>
    <div style="padding:8px 0">Mặt trước của thẻ<div class="seg"><button data-dir="fwd" aria-pressed="${s.dir==='fwd'}">Ngoại ngữ → Việt</button><button data-dir="rev" aria-pressed="${s.dir==='rev'}">Việt → Ngoại ngữ</button></div></div>
    <label class="line">Tự đọc từ khi hiện thẻ<input type="checkbox" id="sAuto"${s.autoplay?' checked':''}></label>
  </section>
  <section class="set"><h3>Giọng đọc</h3>
    ${LANGS.map(L=>`<div class="vrow"><label for="v-${L}">Giọng ${LNAME[L]}</label><div class="vsel"><select class="sel" id="v-${L}"></select><button class="say" type="button" data-say="${esc(VSAMPLE[L])}" data-lang="${L}" aria-label="Nghe thử">${ICON_SAY}</button></div><p class="vq" id="vq-${L}"></p></div>`).join('')}
    <label class="line">Tốc độ đọc<select class="sel" id="sRate">${[[0.8,'Chậm'],[0.9,'Hơi chậm'],[1,'Tự nhiên']].map(([x,t])=>`<option value="${x}"${x===s.rate?' selected':''}>${t}</option>`).join('')}</select></label>
    <details class="tips"><summary>Cách có giọng đọc tự nhiên hơn</summary>
      <p>Trang này dùng giọng đọc có sẵn trên thiết bị, nên chất lượng tùy vào giọng bạn đã cài. Giọng có dấu ★ là giọng chất lượng cao.</p>
      <p><b>Máy tính Windows:</b> mở Claude bằng trình duyệt Microsoft Edge. Edge có sẵn các giọng “Online (Natural)” như SunHi, InJoon (tiếng Hàn) và Sonia, Ryan (tiếng Anh Anh), nghe gần như người thật. Cần có mạng.</p>
      <p><b>Chrome trên máy tính:</b> thường có giọng “Google 한국의” và “Google UK English”, tự nhiên hơn giọng mặc định của hệ điều hành.</p>
      <p><b>iPhone, iPad:</b> vào Settings → Accessibility → <b>Read &amp; Speak</b> → Voices (iOS 18 trở về trước là Spoken Content; hoặc gõ “Voices” vào ô tìm kiếm của Settings). Mở Korean, tải giọng có chữ <b>Enhanced</b> hoặc <b>Premium</b> (ví dụ Yuna), rồi <b>chạm vào giọng đó để đánh dấu chọn</b>. Làm tương tự với English, chọn một giọng UK. Safari trên iPhone thường không hiện các giọng tải thêm trong danh sách ở trên, nên hãy để ô giọng ở “Tự động: giọng mặc định của máy” để iPhone dùng giọng bạn đã chọn. Nếu chưa nghe thấy thay đổi, hãy tắt hẳn Safari hoặc app rồi mở lại.</p>
      <p><b>Android:</b> Cài đặt → Hệ thống hoặc Trợ năng → Chuyển văn bản thành lời nói → chọn “Dịch vụ lời nói của Google” → mở phần cài đặt của nó → Cài đặt dữ liệu giọng nói → tải tiếng Hàn và tiếng Anh. Tên menu có thể khác đôi chút tùy hãng máy.</p>
      <p><b>Mac:</b> Cài đặt hệ thống → Trợ năng → Nội dung được đọc → Giọng hệ thống → Quản lý giọng, rồi tải Yuna (bản Nâng cao hoặc Cao cấp) và một giọng tiếng Anh.</p>
    </details>
  </section>
  <section class="set" id="syncSec"><h3>Đồng bộ</h3><div id="syncBox"></div></section>
  <section class="set"><h3>Tiến độ</h3>
    <p class="muted" style="margin:0 0 12px">Xóa toàn bộ lịch ôn của ${LNAME[S.lang]}. Từ bạn tự thêm vẫn được giữ lại.</p>
    <button class="btn danger" id="reset">Xóa tiến độ ${LNAME[S.lang]}</button>
  </section>`;
  const touch=()=>{S.sAt=Date.now();save();R.built=false;renderHeader()};
  $('#sNew').addEventListener('change',e=>{s.newPerDay=+e.target.value;touch()});
  $$('[data-dir]').forEach(b=>b.addEventListener('click',()=>{s.dir=b.dataset.dir;touch();viewSettings()}));
  $('#sAuto').addEventListener('change',e=>{s.autoplay=e.target.checked;touch()});
  $('#sRate').addEventListener('change',e=>{s.rate=+e.target.value;touch();speak(VSAMPLE[S.lang],S.lang)});
  LANGS.forEach(L=>{const sel=$('#v-'+L);if(sel)sel.addEventListener('change',()=>{VPREF[L]=sel.value;saveVPref();renderVoiceInfo();speak(VSAMPLE[L],L)})});
  $('#reset').addEventListener('click',()=>{
    if(!confirm(`Xóa toàn bộ tiến độ học ${LNAME[S.lang]}? Không thể hoàn tác.`))return;
    S.cards[S.lang]={};S.reset[S.lang]=Date.now();save();R.built=false;QS.quiz=QS.listen=null;renderHeader();viewSettings();
  });
  renderVoiceInfo();renderSyncBox();
}

/* ---------- Keyboard ---------- */
document.addEventListener('keydown',e=>{
  if(e.target.closest('input,textarea,select'))return;
  if(e.target.closest('button')&&(e.key==='Enter'||e.key===' '))return;
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  if(VIEW==='review'&&R.cur){
    if(!R.flipped&&(e.key===' '||e.key==='Enter')){e.preventDefault();flip()}
    else if(R.flipped&&'1234'.includes(e.key)&&e.key.length===1){grade(+e.key-1)}
  }else if((VIEW==='quiz'||VIEW==='listen')&&QS[VIEW]&&!QS[VIEW].empty&&!QS[VIEW].done){
    const Q=QS[VIEW];
    if(!Q.answered&&'1234'.includes(e.key)&&e.key.length===1)answer(+e.key-1);
    else if(Q.answered&&e.key==='Enter')nextQ();
  }
});

rebuildDecks();render();initSync();if(gistOn())gistSync();
if(!IN_CLAUDE&&'serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{})})}
})();
