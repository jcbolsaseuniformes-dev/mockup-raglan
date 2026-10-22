// ===== Pastas: storage adapters + UI =====
// Data model: folders {id,name,parentId,createdAt}, photos {id,folderId,url|blob,note,createdAt}
const CFG=window.PASTAS_CONFIG||{};
const uid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));

// ---------- shared in-memory cache (both adapters render from this) ----------
class BaseStore{
 constructor(){this.f=new Map();this.p=new Map();this.subs=new Set();this.urls=new Map()}
 onChange(cb){this.subs.add(cb);return()=>this.subs.delete(cb)}
 emit(kind='data'){this.subs.forEach(cb=>cb(kind))}
 folders(parentId=null){return[...this.f.values()].filter(x=>(x.parentId??null)===parentId).sort((a,b)=>a.createdAt-b.createdAt)}
 photos(folderId){return[...this.p.values()].filter(x=>x.folderId===folderId).sort((a,b)=>a.createdAt-b.createdAt)}
 folder(id){return this.f.get(id)}
 photo(id){return this.p.get(id)}
 path(id){const out=[];let c=this.f.get(id);while(c){out.unshift(c);c=this.f.get(c.parentId)}return out}
 descendants(id){const out=[];const st=[id];while(st.length){const c=st.pop();for(const x of this.f.values())if(x.parentId===c){out.push(x.id);st.push(x.id)}}return out}
 isInside(id,targetId){return targetId===id||this.descendants(id).includes(targetId)}
 counts(id){return{folders:this.folders(id).length,photos:this.photos(id).length}}
 photoURL(p){if(p.url)return p.url;if(!p.blob)return'';let u=this.urls.get(p.id);if(!u){u=URL.createObjectURL(p.blob);this.urls.set(p.id,u)}return u}
 async fullURL(p){return this.photoURL(p)}
 _revoke(id){const u=this.urls.get(id);if(u){URL.revokeObjectURL(u);this.urls.delete(id)}}
}

// ---------- IndexedDB adapter (local, default) ----------
class IndexedDBStore extends BaseStore{
 kind='local';
 async init(){
  this.db=await new Promise((res,rej)=>{const r=indexedDB.open('raglan-pastas',1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('folders',{keyPath:'id'});const ps=d.createObjectStore('photos',{keyPath:'id'});ps.createIndex('folderId','folderId')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
  const all=s=>new Promise((res,rej)=>{const r=this.db.transaction(s).objectStore(s).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
  for(const x of await all('folders'))this.f.set(x.id,x);for(const x of await all('photos'))this.p.set(x.id,x);return this}
 _tx(store,fn){return new Promise((res,rej)=>{const t=this.db.transaction(store,'readwrite');fn(t.objectStore(store));t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
 async createFolder(name,parentId=null){const x={id:uid(),name,parentId,createdAt:Date.now()};await this._tx('folders',s=>s.put(x));this.f.set(x.id,x);this.emit();return x}
 async renameFolder(id,name){const x={...this.f.get(id),name};await this._tx('folders',s=>s.put(x));this.f.set(id,x);this.emit()}
 async moveFolder(id,parentId){if(parentId&&this.isInside(id,parentId))throw new Error('ciclo');const x={...this.f.get(id),parentId};await this._tx('folders',s=>s.put(x));this.f.set(id,x);this.emit()}
 async deleteFolder(id){const ids=[id,...this.descendants(id)];const ph=[...this.p.values()].filter(p=>ids.includes(p.folderId));
  await this._tx('folders',s=>ids.forEach(i=>s.delete(i)));await this._tx('photos',s=>ph.forEach(p=>s.delete(p.id)));
  ids.forEach(i=>this.f.delete(i));ph.forEach(p=>{this._revoke(p.id);this.p.delete(p.id)});this.emit()}
 async addPhoto(folderId,blob,name=''){const x={id:uid(),folderId,blob,name,note:'',createdAt:Date.now()};await this._tx('photos',s=>s.put(x));this.p.set(x.id,x);this.emit();return x}
 async updateNote(id,note){const x={...this.p.get(id),note};this.p.set(id,x);await this._tx('photos',s=>s.put(x));this.emit('note')}
 async movePhoto(id,folderId){const x={...this.p.get(id),folderId};await this._tx('photos',s=>s.put(x));this.p.set(id,x);this.emit()}
 async deletePhoto(id){await this._tx('photos',s=>s.delete(id));this._revoke(id);this.p.delete(id);this.emit()}
}

// ---------- Firebase adapter (Firestore only, realtime; works on the free Spark plan) ----------
// Activated when PASTAS_CONFIG.firebase holds a firebaseConfig object. No Cloud Storage:
//  <prefix>folders/<id>   {name,parentId,createdAt}
//  <prefix>photos/<id>    {folderId,name,note,createdAt,thumb}   thumb = ~300px JPEG data URL (grid)
//  <prefix>photoData/<id> {data}                                 data  = full JPEG data URL (≤1200px, < ~850 KB), loaded lazily
const DOC_BUDGET=850000;
async function blobToDataURL(b){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(b)})}
async function encodeJPEG(src,max,q){const bmp=await createImageBitmap(src);const s=Math.min(1,max/Math.max(bmp.width,bmp.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(bmp.width*s));c.height=Math.max(1,Math.round(bmp.height*s));
 const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(bmp,0,0,c.width,c.height);bmp.close?.();return c.toDataURL('image/jpeg',q)}
async function fitDataURL(blob,sizes=[1200,1000,800,640,480],quals=[.82,.72,.62,.5]){let last;
 for(const m of sizes)for(const q of quals){last=await encodeJPEG(blob,m,q);if(last.length<DOC_BUDGET)return last}
 throw new Error('Imagem grande demais para salvar')}
class FirebaseStore extends BaseStore{
 kind='firebase';
 constructor(cfg,opts={}){super();this.cfg=cfg;this.opts=opts;this.full=new Map()}
 async init(){const V=this.opts.sdkVersion||'10.12.2',B=`https://www.gstatic.com/firebasejs/${V}/`;
  const [{initializeApp},fs]=await Promise.all([import(B+'firebase-app.js'),import(B+'firebase-firestore.js')]);
  this.fs=fs;const app=initializeApp(this.cfg,'pastas');
  if(this.opts.anonymousAuth){const au=await import(B+'firebase-auth.js');await au.signInAnonymously(au.getAuth(app))}
  this.db=fs.getFirestore(app);const pre=this.opts.prefix||'';this.cf=pre+'folders';this.cp=pre+'photos';this.cd=pre+'photoData';
  const listen=(col,map)=>new Promise(res=>{let first=true;fs.onSnapshot(fs.collection(this.db,col),snap=>{let onlyNotes=true;
   snap.docChanges().forEach(ch=>{const d={id:ch.doc.id,...ch.doc.data()};if(ch.type==='removed'){map.delete(d.id);this.full.delete(d.id);onlyNotes=false}else{const old=map.get(d.id);if(!old||Object.keys(d).some(k=>k!=='note'&&d[k]!==old[k]))onlyNotes=false;map.set(d.id,d)}});
   if(first){first=false;res()}else this.emit(onlyNotes?'remote-note':'data')},err=>{console.warn('Firebase:',err.message);res()})});
  await Promise.all([listen(this.cf,this.f),listen(this.cp,this.p)]);return this}
 _d(col,id){return this.fs.doc(this.db,col,id)}
 async _batchDelete(refs){for(let i=0;i<refs.length;i+=450){const b=this.fs.writeBatch(this.db);refs.slice(i,i+450).forEach(r=>b.delete(r));await b.commit()}}
 photoURL(p){return p.thumb||this.full.get(p.id)||''}
 async fullURL(p){if(this.full.has(p.id))return this.full.get(p.id);const s=await this.fs.getDoc(this._d(this.cd,p.id));const u=s.exists()?s.data().data:p.thumb;this.full.set(p.id,u);return u}
 async createFolder(name,parentId=null){const x={name,parentId,createdAt:Date.now()};const id=uid();this.f.set(id,{id,...x});this.emit();await this.fs.setDoc(this._d(this.cf,id),x);return{id,...x}}
 async renameFolder(id,name){await this.fs.updateDoc(this._d(this.cf,id),{name})}
 async moveFolder(id,parentId){if(parentId&&this.isInside(id,parentId))throw new Error('ciclo');await this.fs.updateDoc(this._d(this.cf,id),{parentId})}
 async deleteFolder(id){const ids=[id,...this.descendants(id)];const ph=[...this.p.values()].filter(p=>ids.includes(p.folderId));
  await this._batchDelete([...ph.flatMap(p=>[this._d(this.cp,p.id),this._d(this.cd,p.id)]),...ids.map(i=>this._d(this.cf,i))])}
 async addPhoto(folderId,blob,name=''){const id=uid();const [data,thumb]=await Promise.all([fitDataURL(blob),encodeJPEG(blob,300,.7)]);
  await this.fs.setDoc(this._d(this.cd,id),{data});this.full.set(id,data);
  const x={folderId,name,note:'',createdAt:Date.now(),thumb};await this.fs.setDoc(this._d(this.cp,id),x);return{id,...x}}
 async updateNote(id,note){const x=this.p.get(id);if(x)this.p.set(id,{...x,note});await this.fs.updateDoc(this._d(this.cp,id),{note})}
 async movePhoto(id,folderId){await this.fs.updateDoc(this._d(this.cp,id),{folderId})}
 async deletePhoto(id){await this._batchDelete([this._d(this.cp,id),this._d(this.cd,id)]);this.full.delete(id)}
}

async function createStore(){
 if(CFG.firebase&&CFG.firebase.apiKey){try{return await new FirebaseStore(CFG.firebase,CFG.firebaseOptions).init()}catch(e){console.warn('Firebase indisponível, usando armazenamento local:',e.message)}}
 return new IndexedDBStore().init()}

// ---------- image compression (max ~1600px JPEG) ----------
async function compress(file,max=CFG.maxImageSize||1600,q=CFG.jpegQuality||.85){
 const bmp=await createImageBitmap(file);const s=Math.min(1,max/Math.max(bmp.width,bmp.height));const c=document.createElement('canvas');c.width=Math.round(bmp.width*s);c.height=Math.round(bmp.height*s);
 const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(bmp,0,0,c.width,c.height);bmp.close?.();
 return new Promise(r=>c.toBlob(r,'image/jpeg',q))}

// ---------- UI ----------
const $=(h)=>{const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstElementChild};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const FOLDER_SVG=`<svg class="folder-ic" viewBox="0 0 104 84"><defs><linearGradient id="fb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4aa3ff"/><stop offset="1" stop-color="#1c62d6"/></linearGradient><linearGradient id="ff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5cb0ff"/><stop offset="1" stop-color="#2a74e8"/></linearGradient></defs>
<path d="M6 10a6 6 0 0 1 6-6h24l8 8h48a6 6 0 0 1 6 6v54a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6Z" fill="url(#fb)"/><rect x="12" y="16" width="80" height="22" rx="3" fill="#e8f1ff" opacity=".9"/>
<path d="M4 28a6 6 0 0 1 6-6h84a6 6 0 0 1 6 6l-4 44a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6Z" fill="url(#ff)"/><path d="M8 30h88" stroke="#fff" stroke-opacity=".25"/></svg>`;
const PLUS=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
const UPLOAD=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-4.5-4.5L8 19"/><path d="M17 3v6M14 6h6" stroke="#fff"/></svg>`;

function modal({title,text='',input=false,value='',ok='Salvar',danger=false}){return new Promise(res=>{
 const m=$(`<div class="m-back"><div class="modal glass" role="dialog"><h3>${esc(title)}</h3>${text?`<p>${esc(text)}</p>`:''}${input?`<input maxlength="80" placeholder="Nome da pasta" value="${esc(value)}">`:''}
  <div class="m-btns"><button class="m-btn" data-a="c">Cancelar</button><button class="m-btn ${danger?'dan':'pri'}" data-a="s">${esc(ok)}</button></div></div></div>`);
 const inp=m.querySelector('input');const done=v=>{m.remove();document.removeEventListener('keydown',key,true);res(v)};
 const save=()=>{if(input){const v=inp.value.trim();if(!v){inp.focus();inp.style.borderColor='#ff6b6b';return}done(v)}else done(true)};
 const key=e=>{if(e.key==='Escape'){e.preventDefault();done(null)}else if(e.key==='Enter'){e.preventDefault();save()}};
 m.addEventListener('mousedown',e=>{if(e.target===m)done(null)});m.querySelector('[data-a=c]').onclick=()=>done(null);m.querySelector('[data-a=s]').onclick=save;
 document.addEventListener('keydown',key,true);document.body.append(m);(inp||m.querySelector('[data-a=s]')).focus()})}
function toast(t){const e=$(`<div class="toast glass">${esc(t)}</div>`);document.body.append(e);setTimeout(()=>e.remove(),2200)}

const store=await createStore();window.__pastasStore=store;
const root=document.getElementById('pastas');let cur=null;const openNotes=new Set();let drag=null;
const trash=document.getElementById('trash');

function go(id){cur=id||null;location.hash=cur?'#/pastas/'+cur:'#/pastas'}
function render(){
 if(cur&&!store.folder(cur))cur=null;
 const fa=document.activeElement,fid=fa?.dataset?.note,sel=fid?[fa.selectionStart,fa.selectionEnd]:null;const scroll=root.scrollTop;
 const path=store.path(cur);const c=store.counts(cur);
 root.innerHTML='';
 const head=$(`<div class="p-head">${cur?`<div class="p-back" title="Voltar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg></div>`:''}</div>`);
 const crumbs=[{id:null,name:'Minhas pastas'},...path];
 crumbs.forEach((x,i)=>{if(i)head.append($(`<span class="crumb-sep">›</span>`));const b=$(`<button class="crumb${i===crumbs.length-1?' cur':''}">${esc(x.name)}</button>`);
  if(i<crumbs.length-1){b.onclick=()=>go(x.id);dropTarget(b,x.id)}head.append(b)});
 head.append($(`<span class="p-info">${c.folders} pasta${c.folders===1?'':'s'} · ${c.photos} foto${c.photos===1?'':'s'}${store.kind==='firebase'?' · sincronizado':' · salvo neste navegador'}${matchMedia('(pointer:coarse)').matches?' · toque e segure para mover':''}</span>`));
 head.querySelector('.p-back')?.addEventListener('click',()=>go(path.length>1?path[path.length-2].id:null));
 root.append(head);
 const grid=$(`<div class="p-grid"></div>`);root.append(grid);
 const nt=$(`<div class="new-wrap"><div class="new-tile" title="Nova pasta">${PLUS}</div><div class="nm">Nova pasta</div></div>`);nt.querySelector('.new-tile').onclick=newFolder;grid.append(nt);
 if(cur){const up=$(`<div class="new-wrap"><div class="up-tile" title="Enviar fotos">${UPLOAD}</div><div class="nm">Enviar fotos</div></div>`);up.querySelector('.up-tile').onclick=()=>fileIn.click();grid.append(up)}
 for(const f of store.folders(cur)){const n=store.counts(f.id);
  const t=$(`<div class="tile" draggable="true" data-folder="${f.id}" title="${esc(f.name)}">${FOLDER_SVG}<div class="nm">${esc(f.name)}</div><div class="sub">${n.photos} foto${n.photos===1?'':'s'}${n.folders?` · ${n.folders} pasta${n.folders===1?'':'s'}`:''}</div></div>`);
  t.onclick=()=>go(f.id);dragSource(t,{type:'folder',id:f.id});dropTarget(t,f.id);grid.append(t)}
 for(const p of store.photos(cur)){const open=openNotes.has(p.id);
  const e=$(`<div class="ph" draggable="true" data-photo="${p.id}"><div class="frame"><img alt="" src="${store.photoURL(p)}"></div><button class="plus${open?' open':''}${p.note?' has':''}" title="Anotações">+</button>
   <div class="note${open?' open':''}"><textarea data-note="${p.id}" placeholder="Anotações sobre a foto…">${esc(p.note||'')}</textarea><div class="saved"></div></div></div>`);
  e.querySelector('.frame').onclick=()=>lightbox(p.id);
  const pl=e.querySelector('.plus'),nb=e.querySelector('.note'),ta=e.querySelector('textarea'),sv=e.querySelector('.saved');
  pl.onclick=ev=>{ev.stopPropagation();const o=!openNotes.has(p.id);o?openNotes.add(p.id):openNotes.delete(p.id);nb.classList.toggle('open',o);pl.classList.toggle('open',o);if(o)setTimeout(()=>ta.focus(),200)};
  let tm;ta.oninput=()=>{sv.textContent='…';clearTimeout(tm);tm=setTimeout(async()=>{await store.updateNote(p.id,ta.value);pl.classList.toggle('has',!!ta.value);sv.textContent='Salvo ✓'},400)};
  ta.draggable=false;ta.addEventListener('dragstart',ev=>ev.stopPropagation());
  dragSource(e,{type:'photo',id:p.id});grid.append(e)}
 if(!cur&&!store.folders(null).length)grid.append($(`<div class="p-empty">Crie sua primeira pasta clicando em “+”.</div>`));
 if(cur&&!store.folders(cur).length&&!store.photos(cur).length)grid.append($(`<div class="p-empty">Pasta vazia. Envie fotos pelo botão ou arraste imagens do computador para cá.</div>`));
 // OS file drop
 grid.addEventListener('dragover',ev=>{if(cur&&!drag&&[...ev.dataTransfer.types].includes('Files')){ev.preventDefault();grid.classList.add('filedrop')}});
 grid.addEventListener('dragleave',ev=>{if(!grid.contains(ev.relatedTarget))grid.classList.remove('filedrop')});
 grid.addEventListener('drop',ev=>{grid.classList.remove('filedrop');if(cur&&!drag&&ev.dataTransfer.files.length){ev.preventDefault();upload(ev.dataTransfer.files)}});
 root.scrollTop=scroll;
 if(fid){const t=root.querySelector(`textarea[data-note="${fid}"]`);if(t){t.focus();t.setSelectionRange(...sel)}}}
function dragSource(el,item){
 el.addEventListener('dragstart',ev=>{drag=item;ev.dataTransfer.effectAllowed='move';ev.dataTransfer.setData('text/plain',item.type+':'+item.id);el.classList.add('dragging');document.body.classList.add('dnd')});
 el.addEventListener('dragend',()=>{drag=null;el.classList.remove('dragging');document.body.classList.remove('dnd');document.querySelectorAll('.drop').forEach(x=>x.classList.remove('drop'));trash.classList.remove('hot')});
 touchDrag(el,item)}
function canDrop(target){if(!drag)return false;if(drag.type==='folder')return target!==drag.id&&!(target&&store.isInside(drag.id,target))&&store.folder(drag.id)?.parentId!==target;return target!==null&&store.photo(drag.id)?.folderId!==target}
async function doMove(d,target){try{if(d.type==='folder')await store.moveFolder(d.id,target);else await store.movePhoto(d.id,target);toast(`Movido para “${target?store.folder(target).name:'Minhas pastas'}”`)}catch(e){toast('Não foi possível mover')}}
async function doTrash(d){
 if(d.type==='folder'){const f=store.folder(d.id);const n=store.descendants(d.id).length,ph=[d.id,...store.descendants(d.id)].reduce((s,i)=>s+store.photos(i).length,0);
  if(await modal({title:'Excluir pasta?',text:`“${f.name}”${n||ph?` e todo o conteúdo (${n} subpasta${n===1?'':'s'}, ${ph} foto${ph===1?'':'s'})`:''} será excluída. Esta ação não pode ser desfeita.`,ok:'Excluir',danger:true}))await store.deleteFolder(d.id)}
 else if(await modal({title:'Excluir foto?',text:'A foto e suas anotações serão excluídas. Esta ação não pode ser desfeita.',ok:'Excluir',danger:true}))await store.deletePhoto(d.id)}
function dropTarget(el,target){el.dataset.drop=target??'__root';
 el.addEventListener('dragover',ev=>{if(canDrop(target)){ev.preventDefault();ev.dataTransfer.dropEffect='move';el.classList.add('drop')}});
 el.addEventListener('dragleave',ev=>{if(!el.contains(ev.relatedTarget))el.classList.remove('drop')});
 el.addEventListener('drop',async ev=>{el.classList.remove('drop');if(!canDrop(target))return;ev.preventDefault();ev.stopPropagation();const d=drag;drag=null;doMove(d,target)})}
trash.addEventListener('dragover',ev=>{if(drag){ev.preventDefault();ev.dataTransfer.dropEffect='move';trash.classList.add('hot')}});
trash.addEventListener('dragleave',()=>trash.classList.remove('hot'));
trash.addEventListener('drop',async ev=>{ev.preventDefault();trash.classList.remove('hot');const d=drag;drag=null;if(d)doTrash(d)});
// ---------- touch: long-press (450 ms) to drag, drop on folder / breadcrumb / trash ----------
let tdrag=null;
function touchDrag(el,item){
 el.addEventListener('contextmenu',e=>{if(tdrag||e.pointerType==='touch'||matchMedia('(pointer:coarse)').matches)e.preventDefault()});
 el.addEventListener('touchstart',ev=>{if(ev.touches.length!==1||ev.target.closest('textarea,.plus'))return;const t=ev.touches[0];const st={x:t.clientX,y:t.clientY};
  const timer=setTimeout(()=>{const r=el.getBoundingClientRect();const g=el.cloneNode(true);g.className+=' ghost';Object.assign(g.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',pointerEvents:'none',zIndex:200,opacity:.85,transform:'scale(1.06)'});
   document.body.append(g);tdrag={el,item,g,dx:st.x-r.left,dy:st.y-r.top,over:null};drag=item;el.classList.add('dragging');document.body.classList.add('dnd');navigator.vibrate?.(15)},450);
  const cancel=()=>{clearTimeout(timer);el.removeEventListener('touchmove',mv);el.removeEventListener('touchend',cancel)};
  const mv=e=>{const q=e.touches[0];if(!tdrag&&Math.hypot(q.clientX-st.x,q.clientY-st.y)>10)cancel()};
  el.addEventListener('touchmove',mv,{passive:true});el.addEventListener('touchend',cancel)},{passive:true})}
document.addEventListener('touchmove',e=>{if(!tdrag)return;e.preventDefault();const q=e.touches[0];tdrag.g.style.left=(q.clientX-tdrag.dx)+'px';tdrag.g.style.top=(q.clientY-tdrag.dy)+'px';
 const hit=document.elementFromPoint(q.clientX,q.clientY);const tgt=hit?.closest('#trash,[data-drop]');document.querySelectorAll('.drop').forEach(x=>x.classList.remove('drop'));trash.classList.remove('hot');tdrag.over=null;
 if(tgt===trash){trash.classList.add('hot');tdrag.over='trash'}else if(tgt&&tgt!==tdrag.el){const id=tgt.dataset.drop==='__root'?null:tgt.dataset.drop;if(canDrop(id)){tgt.classList.add('drop');tdrag.over={id}}}},{passive:false});
const endT=e=>{if(!tdrag)return;e.preventDefault();const t=tdrag;tdrag=null;drag=null;t.g.remove();t.el.classList.remove('dragging');document.body.classList.remove('dnd');document.querySelectorAll('.drop').forEach(x=>x.classList.remove('drop'));trash.classList.remove('hot');
 if(t.over==='trash')doTrash(t.item);else if(t.over)doMove(t.item,t.over.id)};
document.addEventListener('touchend',endT,{passive:false});document.addEventListener('touchcancel',endT,{passive:false});
async function newFolder(){const name=await modal({title:'Nova pasta',input:true});if(name)await store.createFolder(name,cur)}
const fileIn=$(`<input type="file" accept="image/*" multiple hidden>`);document.body.append(fileIn);fileIn.onchange=()=>{upload(fileIn.files);fileIn.value=''};
async function upload(files){const list=[...files].filter(f=>f.type.startsWith('image/'));if(!list.length)return toast('Selecione arquivos de imagem');const target=cur;let ok=0;
 for(const f of list){try{await store.addPhoto(target,await compress(f),f.name);ok++}catch(e){console.warn(e)}}toast(`${ok} foto${ok===1?'':'s'} enviada${ok===1?'':'s'}`)}
function lightbox(id){const p=store.photo(id);if(!p)return;const lb=$(`<div class="lb"><button class="x" title="Fechar">×</button><img src="${store.photoURL(p)}">${p.note?`<div class="cap">${esc(p.note)}</div>`:''}</div>`);
 const close=()=>{lb.remove();document.removeEventListener('keydown',k)};const k=e=>{if(e.key==='Escape')close()};lb.onclick=e=>{if(e.target!==lb.querySelector('img'))close()};document.addEventListener('keydown',k);document.body.append(lb);store.fullURL(p).then(u=>{if(u)lb.querySelector('img').src=u}).catch(()=>{})}
store.onChange(k=>{if(k==='note')return;if(document.body.classList.contains('pastas-on'))render()});

// ---------- tab routing (hash) ----------
function route(){const h=location.hash;const on=h.startsWith('#/pastas');document.body.classList.toggle('pastas-on',on);
 document.querySelectorAll('.ttab').forEach(t=>t.classList.toggle('sel',t.dataset.tab===(on?'pastas':'mockup')));
 if(on){cur=h.split('/')[2]||null;render()}else dispatchEvent(new Event('resize'))}
document.querySelectorAll('.ttab').forEach(t=>t.onclick=()=>{location.hash=t.dataset.tab==='pastas'?(cur?'#/pastas/'+cur:'#/pastas'):'#/mockup'});
addEventListener('hashchange',route);route();
