// v18: chat "IA" de cada cartão (aba Pastas). Separado do chat principal do site (não mexe nele).
// Fala com o programa "JC Chat Bridge" no PC: direto em http://127.0.0.1:47821 (mesmo PC) ou, de outro aparelho,
// por um documento aiJobs/<id> no Firestore (listener do documento; nada de polling na nuvem).
// O GPT/Grok rodam na conta da Eliane, num navegador escondido no PC. Nada aqui apaga arquivos ou pastas.
const BR=(localStorage.getItem('jc-bridge-url')||'http://127.0.0.1:47821').replace(/\/$/,'');
const P={gpt:{n:'ChatGPT',s:'GPT'},grok:{n:'Grok',s:'Grok'}};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $=h=>{const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstElementChild};
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const IC={chat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" stroke-width="2.6"/></svg>',
 clip:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 11-8.6 8.6a5 5 0 0 1-7-7L14 4a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/></svg>',
 send:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>',
 dl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 17v3h16v-3"/></svg>'};
export const CHAT_ICON=IC.chat;

// ---------- cache local (IndexedDB) do histórico por cartão ----------
const idb=(()=>{let p;const open=()=>p??=new Promise((res,rej)=>{const r=indexedDB.open('jc-aichat',1);r.onupgradeneeded=()=>r.result.createObjectStore('cards');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
 const tx=async(m,f)=>{const db=await open();return new Promise((res,rej)=>{const t=db.transaction('cards',m);const r=f(t.objectStore('cards'));t.oncomplete=()=>res(r?.result);t.onerror=()=>rej(t.error)})};
 return{get:k=>tx('readonly',s=>s.get(k)).catch(()=>null),put:(k,v)=>tx('readwrite',s=>s.put(v,k)).catch(()=>{})}})();

// ---------- utilidades de imagem ----------
const toDataURL=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(b)});
async function urlToDataURL(u){if(!u)return null;if(u.startsWith('data:'))return u;return toDataURL(await (await fetch(u)).blob())}
async function jpeg(src,max,q){const b=typeof src==='string'?await (await fetch(src)).blob():src;const bm=await createImageBitmap(b);const s=Math.min(1,max/Math.max(bm.width,bm.height));
 const c=document.createElement('canvas');c.width=Math.max(1,Math.round(bm.width*s));c.height=Math.max(1,Math.round(bm.height*s));const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(bm,0,0,c.width,c.height);bm.close?.();return c.toDataURL('image/jpeg',q)}
async function fit(src,budget){for(const m of [1600,1280,1024,800,640,480])for(const q of [.85,.72,.6]){const u=await jpeg(src,m,q);if(u.length<budget)return u}return jpeg(src,360,.5)}
const imgsFrom=dt=>[...(dt?.items||[])].filter(i=>i.kind==='file'&&i.type.startsWith('image/')).map(i=>i.getAsFile()).filter(Boolean);
function fmtText(t){/* markdown simples: ```bloco```, `código`, **negrito**, links; o resto é texto puro (escapado) */
 const parts=String(t||'').split(/```[\w-]*\n?/);return parts.map((p,i)=>i%2?`<pre>${esc(p.replace(/\n$/,''))}</pre>`:esc(p).replace(/`([^`\n]+)`/g,'<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g,'<b>$1</b>').replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g,'<br>')).join('')}
const fetchT=(u,o={},ms=2500)=>{const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);return fetch(u,{...o,signal:c.signal,targetAddressSpace:'loopback'}).finally(()=>clearTimeout(t))};

// ---------- conexão com o PC ----------
async function probeLocal(){try{const r=await fetchT(BR+'/status',{cache:'no-store'},1800);const j=await r.json();return j&&j.app==='jc-chat-bridge'?j:null}catch(e){return null}}
const imgSrc=u=>!u?'':/^(data:|blob:|https?:)/.test(u)?u:BR+u;

let open=null;
export async function openAIChat({store,photo,name,folderName,clientId}){
 if(open)open.close();
 const card=photo.id;let prov=localStorage.getItem('jc-ai-prov')==='grok'?'grok':'gpt';
 const S={mode:'?',st:null,msgs:[],conv:{},pend:[],busy:{gpt:false,grok:false},cloudUnsub:null,closed:false};
 const ov=$(`<div class="aic-ov m-back" role="dialog" aria-label="Chat com IA">
  <div class="aic-top"><img class="aic-th" alt=""><div class="aic-t"><b>${esc(name)}</b><span>${esc(folderName||'')}</span></div>
   <div class="aic-st" title="Conexão com o programa do PC"><i></i><span>Conectando…</span></div><button class="aic-x" title="Fechar (Esc)" aria-label="Fechar">×</button></div>
  <div class="aic-body"><div class="aic-ref" title="Imagem referente"><img alt="Imagem referente"><span class="aic-ref-l">Imagem referente</span></div>
   <div class="aic-chat"><div class="aic-list" aria-live="polite"></div><div class="aic-warn" hidden></div>
    <div class="aic-pend"></div>
    <form class="aic-comp" autocomplete="off"><button type="button" class="aic-prov" aria-label="Trocar entre ChatGPT e Grok"></button>
     <button type="button" class="aic-att" title="Anexar imagem" aria-label="Anexar imagem">${IC.clip}</button><input type="file" accept="image/*" multiple hidden>
     <textarea rows="1" maxlength="20000" enterkeyhint="send"></textarea><button type="submit" class="aic-send" title="Enviar (Enter)" aria-label="Enviar">${IC.send}</button></form>
   </div></div><div class="aic-drop">Solte a imagem para anexar</div></div>`);
 const q=s=>ov.querySelector(s);const list=q('.aic-list'),warn=q('.aic-warn'),pendEl=q('.aic-pend'),ta=q('textarea'),pb=q('.aic-prov'),fileIn=q('input[type=file]'),stEl=q('.aic-st');
 const thumb=store.photoURL(photo);q('.aic-th').src=thumb;const refImg=q('.aic-ref img');refImg.src=thumb;
 let refFull=null;const refP=store.fullURL(photo).then(u=>{if(u){refFull=u;refImg.src=u}return u}).catch(()=>thumb);
 document.body.append(ov);document.body.classList.add('aic-open');
 const close=()=>{if(S.closed)return;S.closed=true;ov.remove();document.body.classList.remove('aic-open');removeEventListener('keydown',kd,true);S.statusUnsub?.();clearInterval(S.stTimer);open=null};
 open={close};
 const kd=e=>{if(e.key==='Escape'){if(ov.querySelector('.aic-lb')){ov.querySelector('.aic-lb').remove()}else close();e.stopPropagation();e.preventDefault()}};addEventListener('keydown',kd,true);
 q('.aic-x').onclick=close;
 q('.aic-ref').onclick=()=>viewer(refFull||thumb);
 // ---------- provedor ----------
 const paintProv=()=>{pb.className='aic-prov p-'+prov;pb.innerHTML=`<span>${P[prov].s}</span>`;pb.title=`Usando ${P[prov].n}. Clique para trocar para ${P[prov==='gpt'?'grok':'gpt'].n}`;ta.placeholder=`Mensagem para o ${P[prov].n}…`;ov.dataset.prov=prov;paintPend();paintStatus()};
 pb.onclick=()=>{prov=prov==='gpt'?'grok':'gpt';localStorage.setItem('jc-ai-prov',prov);paintProv();ta.focus()};
 // ---------- anexos (a imagem referente fica em espera até o 1º comando de texto em cada IA) ----------
 const refPending=()=>!S.conv[prov];
 function paintPend(){pendEl.innerHTML=(refPending()?`<div class="aic-chip ref" title="A imagem referente vai junto com o seu primeiro comando para o ${P[prov].n}"><img src="${esc(thumb)}" alt=""><span><b>Imagem referente</b><small>aguardando comando</small></span></div>`:'')
  +S.pend.map((p,i)=>`<div class="aic-chip"><img src="${esc(p.url)}" alt=""><button type="button" data-i="${i}" title="Tirar anexo" aria-label="Tirar anexo">×</button></div>`).join('');
  pendEl.hidden=!pendEl.children.length;pendEl.querySelectorAll('button[data-i]').forEach(b=>b.onclick=()=>{const p=S.pend.splice(+b.dataset.i,1)[0];URL.revokeObjectURL(p.url);paintPend()})}
 const addFiles=fs=>{for(const f of fs)if(f&&f.type.startsWith('image/'))S.pend.push({file:f,url:URL.createObjectURL(f),name:f.name||'imagem'});paintPend();ta.focus()};
 q('.aic-att').onclick=()=>fileIn.click();fileIn.onchange=()=>{addFiles([...fileIn.files]);fileIn.value=''};
 ta.addEventListener('paste',e=>{const f=imgsFrom(e.clipboardData);if(f.length){e.preventDefault();addFiles(f)}});
 let dd=0;ov.addEventListener('dragenter',e=>{if([...(e.dataTransfer?.types||[])].includes('Files')){dd++;ov.classList.add('dragging')}});
 ov.addEventListener('dragleave',()=>{if(--dd<=0){dd=0;ov.classList.remove('dragging')}});
 ov.addEventListener('dragover',e=>{if([...(e.dataTransfer?.types||[])].includes('Files')){e.preventDefault();e.stopPropagation()}});
 ov.addEventListener('drop',e=>{dd=0;ov.classList.remove('dragging');const f=[...(e.dataTransfer?.files||[])].filter(x=>x.type.startsWith('image/'));e.preventDefault();e.stopPropagation();if(f.length)addFiles(f)});
 const grow=()=>{ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,180)+'px'};ta.addEventListener('input',grow);
 ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&!matchMedia('(pointer:coarse)').matches){e.preventDefault();q('form').requestSubmit()}});
 // ---------- mensagens ----------
 function msgHTML(m){const pv=P[m.provider]?.n||'';const imgs=(m.imgs||[]).map(u=>`<div class="aic-im" data-src="${esc(imgSrc(u))}"><img src="${esc(imgSrc(u))}" alt="" loading="lazy">${m.role==='ai'?`<button class="aic-dl" title="Baixar imagem" aria-label="Baixar imagem">${IC.dl}</button>`:''}</div>`).join('');
  if(m.role==='user')return`<div class="aic-m u"><div class="aic-b">${m.ref?'<span class="aic-tag">+ imagem referente</span>':''}${imgs?`<div class="aic-ims">${imgs}</div>`:''}<div class="aic-tx">${fmtText(m.text)}</div></div><small>para ${pv}${m.at?' · '+new Date(m.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):''}</small></div>`;
  if(m.role==='typing')return`<div class="aic-m a p-${m.provider}"><div class="aic-who">${pv}</div><div class="aic-b">${m.text?`<div class="aic-tx">${fmtText(m.text)}</div>`:''}<div class="aic-dots"><i></i><i></i><i></i><span>${esc(m.note||'escrevendo…')}</span></div></div></div>`;
  if(m.role==='erro')return`<div class="aic-m a err"><div class="aic-who">${pv}</div><div class="aic-b"><div class="aic-tx">${fmtText(m.text)}</div>${m.code==='verificacao'?`<button class="aic-btn" data-show="${m.provider}">Mostrar janela no PC</button>`:''}</div></div>`;
  return`<div class="aic-m a p-${m.provider}"><div class="aic-who">${pv}</div><div class="aic-b">${imgs?`<div class="aic-ims">${imgs}</div>`:''}${m.text?`<div class="aic-tx">${fmtText(m.text)}</div>`:''}</div></div>`}
 function paint(){const all=[...S.msgs,...Object.values(S.typing||{})];
  list.innerHTML=all.length?all.map(msgHTML).join(''):`<div class="aic-empty">${IC.chat}<b>A imagem referente já está carregada.</b><span>Escreva o que quer fazer com ela. Ela vai junto com o seu primeiro comando.</span></div>`;
  list.querySelectorAll('.aic-im').forEach(el=>{el.onclick=e=>{if(e.target.closest('.aic-dl'))return;viewer(el.dataset.src)};const d=el.querySelector('.aic-dl');if(d)d.onclick=()=>download(el.dataset.src)});
  list.querySelectorAll('[data-show]').forEach(b=>b.onclick=()=>janela('mostrar',b.dataset.show));
  list.scrollTop=list.scrollHeight;list.querySelectorAll('img').forEach(i=>{if(!i.complete)i.addEventListener('load',()=>{list.scrollTop=list.scrollHeight},{once:true})})}
 function viewer(src){const v=$(`<div class="aic-lb"><img src="${esc(src)}" alt=""><button class="aic-x" title="Fechar">×</button></div>`);v.onclick=()=>v.remove();ov.append(v)}
 async function download(src){try{const b=await (await fetch(src)).blob();const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`${(name||'imagem').replace(/[\\/:*?"<>|]+/g,'_')} - ${P[prov].s} ${new Date().toLocaleString('pt-BR').replace(/[/:]/g,'-')}.${(b.type.split('/')[1]||'png').replace('jpeg','jpg')}`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000)}catch(e){window.open(src,'_blank')}}
 const saveCache=()=>idb.put(card,{msgs:S.msgs.slice(-200),conv:S.conv,at:Date.now()});
 // ---------- status ----------
 function paintStatus(){const m=S.mode,st=S.st;let cls='off',txt='',w='';
  if(m==='?'){cls='wait';txt='Conectando ao PC…'}
  else if(m==='local'){const e=st?.provedores?.[prov]?.estado;cls=e==='pronto'?'on':e==='iniciando'||e==='carregando'?'wait':'warn';
   txt=`PC conectado · ${P[prov].n} ${e==='pronto'?'pronto':e==='login'?'sem login':e==='verificacao'?'pede verificação':e==='iniciando'?'abrindo…':e==='erro'?'com problema':e||''}`+(st?.simulado?' (simulado)':'');
   if(e==='login')w=`O ${P[prov].n} não está logado no programa do PC. No PC, abra <b>C:\\jc-chat-bridge\\LOGIN.bat</b> e entre na conta.`;
   if(e==='verificacao')w=`O ${P[prov].n} pediu uma verificação "sou humano". <button class="aic-btn" data-show="${prov}">Mostrar janela no PC</button>`;
   if(st?.janela==='visivel')w+=`${w?'<br>':''}A janela do navegador está aparecendo no PC. <button class="aic-btn" data-hide="1">Esconder janela</button>`}
  else if(m==='nuvem'){const h=S.hb;const fresh=h&&h.online&&Date.now()-(h.atMs||0)<35*60*1000;const e=h?.[prov];cls=fresh?(e==='pronto'?'on':'warn'):'warn';
   txt=fresh?`PC conectado pela nuvem · ${P[prov].n} ${e==='pronto'?'pronto':e==='login'?'sem login':e==='verificacao'?'pede verificação':e||''}`:'PC sem sinal';
   if(!fresh)w='Não encontrei o programa do PC (JC Chat Bridge). O PC precisa estar ligado. Se você está no próprio PC e o Chrome perguntou sobre “acessar a rede local”, clique em <b>Permitir</b> e reabra esta janela.';
   else if(e==='login')w=`O ${P[prov].n} não está logado no PC. No PC, rode <b>LOGIN.bat</b>.`;else if(e==='verificacao')w=`O ${P[prov].n} pediu uma verificação "sou humano" no PC. Abra este chat no próprio PC para mostrar a janela.`}
  else{cls='off';txt='PC desligado';w='O programa do PC (JC Chat Bridge) não respondeu. Ligue o PC ou rode <b>C:\\jc-chat-bridge\\INSTALAR.bat</b>.'}
  stEl.className='aic-st '+cls;stEl.querySelector('span').textContent=txt;warn.innerHTML=w;warn.hidden=!w;
  warn.querySelectorAll('[data-show]').forEach(b=>b.onclick=()=>janela('mostrar',b.dataset.show));warn.querySelectorAll('[data-hide]').forEach(b=>b.onclick=()=>janela('esconder'))}
 async function janela(acao,p){if(S.mode!=='local')return;try{await fetchT(BR+'/janela',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao,provider:p})},8000);S.st=await probeLocal();paintStatus()}catch(e){}}
 async function connect(){const st=await probeLocal();if(S.closed)return;
  if(st){S.mode='local';S.st=st;await loadHistory();S.stTimer=setInterval(async()=>{if(document.hidden)return;const s=await probeLocal();if(s){S.st=s;paintStatus()}else{S.mode='off';paintStatus()}},8000)}/* localhost: não gasta cota */
  else if(store.kind==='firebase'&&store.fs){S.mode='nuvem';const c=await idb.get(card);if(c){S.msgs=c.msgs||[];S.conv=c.conv||{}}
   const fs=store.fs;S.statusUnsub=fs.onSnapshot(fs.doc(store.db,'machine','chat-bridge'),sn=>{S.hb=sn.exists()?sn.data():null;paintStatus()},()=>{S.hb=null;paintStatus()})}/* 1 leitura ao abrir */
  else{S.mode='off';const c=await idb.get(card);if(c){S.msgs=c.msgs||[];S.conv=c.conv||{}}}
  paint();paintPend();paintStatus()}
 async function loadHistory(){try{const r=await fetchT(BR+'/history?card='+encodeURIComponent(card),{cache:'no-store'},6000);const h=await r.json();S.msgs=h.msgs||[];S.conv=h.conv||{};saveCache()}catch(e){const c=await idb.get(card);if(c){S.msgs=c.msgs||[];S.conv=c.conv||{}}}paint();paintPend()}
 // ---------- enviar ----------
 S.typing={};
 q('form').onsubmit=async e=>{e.preventDefault();const text=ta.value.trim();const p=prov;
  if(!text){ta.focus();if(S.pend.length||refPending())ta.placeholder='Escreva o comando para a imagem…';return}
  if(S.busy[p])return toast(`Espere o ${P[p].n} terminar a resposta anterior.`);
  if(S.mode!=='local'&&S.mode!=='nuvem'){await connect();if(S.mode!=='local'&&S.mode!=='nuvem')return toast('O programa do PC não está ligado.')}
  const withRef=refPending();const files=S.pend.splice(0);ta.value='';grow();paintPend();
  const um={id:'u-'+uid(),role:'user',provider:p,text,ref:withRef,imgs:files.map(f=>f.url),at:Date.now()};S.msgs.push(um);
  S.busy[p]=true;S.typing[p]={role:'typing',provider:p,text:'',note:S.mode==='nuvem'?'enviando pelo servidor…':'escrevendo…'};paint();
  try{if(S.mode==='local')await sendLocal(p,text,files,withRef);else await sendCloud(p,text,files,withRef,um)}
  catch(err){S.msgs.push({id:'e-'+uid(),role:'erro',provider:p,text:err.message||String(err),code:err.code,at:Date.now()})}
  finally{S.busy[p]=false;delete S.typing[p];if(!S.closed){paint();paintPend();if(S.mode==='local')S.st=await probeLocal()||S.st;paintStatus()}saveCache()}};
 async function sendLocal(p,text,files,withRef){
  const images=await Promise.all(files.map(f=>f.file.size<12e6?toDataURL(f.file):jpeg(f.file,2560,.9)));
  const ref=withRef?await urlToDataURL(await refP||thumb):null;
  const r=await fetchT(BR+'/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({card,cardName:name,provider:p,text,images,ref})},60000);
  const j=await r.json();if(!j.ok)throw Object.assign(new Error(j.error||'Falha ao enviar'),{code:j.code});
  for(;;){await new Promise(r=>setTimeout(r,500));let s;try{s=await (await fetchT(BR+'/job?id='+j.job,{cache:'no-store'},5000)).json()}catch(e){continue}
   if(S.typing[p]){S.typing[p].text=s.partial||'';S.typing[p].note=s.status==='fila'?'na fila…':'escrevendo…';if(!S.closed)paint()}
   if(s.status==='pronto'||s.status==='erro')break}
  await loadHistory()}/* o histórico do PC é a fonte certa (inclui o que veio de outros aparelhos) */
 async function sendCloud(p,text,files,withRef,um){const fs=store.fs,db=store.db;
  const budget=Math.floor(760000/Math.max(1,files.length));const images=await Promise.all(files.map(f=>fit(f.file,budget)));
  um.imgs=await Promise.all(files.map(f=>jpeg(f.file,480,.7)));/* cache leve */
  const id=uid();const ref=fs.doc(db,'aiJobs',id);
  await fs.setDoc(ref,{card,cardName:name,provider:p,text,images,includeRef:withRef,refPhotoId:withRef?card:null,status:'pending',createdAt:fs.serverTimestamp(),createdAtMs:Date.now(),from:clientId||''});
  const d=await new Promise((res,rej)=>{let got=false;const to=setTimeout(()=>{if(!got){un();rej(Object.assign(new Error('O PC não respondeu. Ele está ligado com o JC Chat Bridge rodando?'),{code:'offline'}))}},25000);
   const un=fs.onSnapshot(ref,sn=>{const x=sn.data();if(!x)return;if(x.status!=='pending'){got=true;clearTimeout(to)}
    if(x.status==='working'&&S.typing[p]){S.typing[p].note='escrevendo…';if(!S.closed)paint()}
    if(['done','error','expired'].includes(x.status)){un();res(x)}},err=>{clearTimeout(to);rej(err)})});
  if(d.status!=='done')throw Object.assign(new Error(d.error||'Falhou'),{code:d.code});
  S.conv[p]=S.conv[p]||'nuvem';S.msgs.push({id:'a-'+id,role:'ai',provider:p,text:d.reply?.text||'',imgs:d.reply?.images||[],at:Date.now()})}
 function toast(t){const e=$(`<div class="aic-toast">${esc(t)}</div>`);ov.append(e);setTimeout(()=>e.remove(),2600)}
 paintProv();paint();paintPend();connect();setTimeout(()=>ta.focus({preventScroll:true}),60);
 return{close}}
window.__aiChat={open:openAIChat,bridge:BR};
