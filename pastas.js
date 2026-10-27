// ===== Pastas: storage adapters + UI =====
// Data model: folders {id,name,parentId,createdAt}, photos {id,folderId,url|blob,note,createdAt}
const CFG=window.PASTAS_CONFIG||{};
const uid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));
// v12: persistent per-browser id (used for per-element 'unseen change' highlights and chat authorship)
const CLIENT_ID=localStorage.getItem('raglan-client-id')||(()=>{const v=uid();localStorage.setItem('raglan-client-id',v);return v})();
const lineHash=t=>{let h=5381;for(let i=0;i<t.length;i++)h=((h<<5)+h+t.charCodeAt(i))|0;return(h>>>0).toString(36)};
const noteLines=n=>String(n||'').split('\n').map(l=>l.trim()).filter(Boolean);

// ---------- shared in-memory cache (both adapters render from this) ----------
class BaseStore{
 constructor(){this.f=new Map();this.p=new Map();this.r=new Map();this.q=new Map();this.subs=new Set();this.urls=new Map()}
 onChange(cb){this.subs.add(cb);return()=>this.subs.delete(cb)}
 emit(kind='data'){this.subs.forEach(cb=>cb(kind))}
 folders(parentId=null){return[...this.f.values()].filter(x=>(x.parentId??null)===parentId).sort((a,b)=>a.createdAt-b.createdAt)}
 photos(folderId){return[...this.p.values()].filter(x=>x.folderId===folderId).sort((a,b)=>a.createdAt-b.createdAt)}
 related(parentId){return[...this.r.values()].filter(x=>x.parentId===parentId).sort((a,b)=>a.createdAt-b.createdAt)}
 queue(){return[...this.q.values()].filter(x=>this.p.has(x.photoId)).sort((a,b)=>a.order-b.order||a.addedAt-b.addedAt)}
 queued(photoId){return[...this.q.values()].find(x=>x.photoId===photoId)}
 /* v13: the (normal) folder a photo belongs to: its folder, or for a photo in a Histórico, its origin/parent folder */
 homeOf(photoId){const p=this.p.get(photoId);if(!p)return null;if(!this.isHist(p.folderId))return p.folderId;const o=p.originFolderId;return o&&this.f.has(o)&&!this.isHist(o)?o:this.f.get(p.folderId)?.parentId??null}
 /* queue entries carry folderId (origin folder) since v13; older entries derive it from the photo (no rewrite) */
 qFolder(x){return x.folderId&&this.f.has(x.folderId)?x.folderId:this.homeOf(x.photoId)}
 queueIn(folderId){if(this.isHist(folderId))folderId=this.f.get(folderId).parentId;return this.queue().filter(x=>this.qFolder(x)===folderId)}
 folder(id){return this.f.get(id)}
 photo(id){return this.p.get(id)}
 path(id){const out=[];let c=this.f.get(id);while(c){out.unshift(c);c=this.f.get(c.parentId)}return out}
 descendants(id){const out=[];const st=[id];while(st.length){const c=st.pop();for(const x of this.f.values())if(x.parentId===c){out.push(x.id);st.push(x.id)}}return out}
 isInside(id,targetId){return targetId===id||this.descendants(id).includes(targetId)}
 counts(id){return{folders:this.folders(id).filter(x=>!x.isHistory).length,photos:this.photos(id).length}}
 /* v13: every normal folder has one 'Histórico' subfolder (doc id hist_<folderId>, isHistory:true) */
 isHist(id){return!!(id&&this.f.get(id)?.isHistory)}
 histId(folderId){return'hist_'+folderId}
 hist(folderId){return this.f.get('hist_'+folderId)}
 histFields(folderId){const f=this.f.get(folderId);return{name:'Histórico',parentId:folderId,isHistory:true,createdAt:(f?.createdAt||0)+1}}
 needsHist(){const only=localStorage.getItem('raglan-autohist-only');return[...this.f.values()].filter(f=>!f.isHistory&&!this.f.has('hist_'+f.id)&&(!only||String(f.name).startsWith(only)))}
 /* where a queue row dropped back on the grid goes: the folder being viewed, else the photo's origin folder */
 restoreTarget(photoId,viewing){const p=this.p.get(photoId);if(!p)return null;if(viewing&&this.f.has(viewing)&&!this.isHist(viewing))return viewing;
  if(!this.isHist(p.folderId))return p.folderId;const o=p.originFolderId;if(o&&this.f.has(o)&&!this.isHist(o))return o;return this.f.get(p.folderId)?.parentId??null}
 photoURL(p){if(p.url)return p.url;if(p.thumb)return p.thumb;if(!p.blob)return'';let u=this.urls.get(p.id);if(!u){u=URL.createObjectURL(p.blob);this.urls.set(p.id,u)}return u}
 async fullURL(p){return this.photoURL(p)}
 _revoke(id){const u=this.urls.get(id);if(u){URL.revokeObjectURL(u);this.urls.delete(id)}}
}

// ---------- IndexedDB adapter (local, default) ----------
class IndexedDBStore extends BaseStore{
 kind='local';
 async init(){
  this.db=await new Promise((res,rej)=>{const r=indexedDB.open('raglan-pastas',2);r.onupgradeneeded=()=>{const d=r.result;const has=n=>d.objectStoreNames.contains(n);if(!has('folders'))d.createObjectStore('folders',{keyPath:'id'});if(!has('photos')){const ps=d.createObjectStore('photos',{keyPath:'id'});ps.createIndex('folderId','folderId')}if(!has('related'))d.createObjectStore('related',{keyPath:'id'});if(!has('queue'))d.createObjectStore('queue',{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
  const all=s=>new Promise((res,rej)=>{const r=this.db.transaction(s).objectStore(s).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
  for(const x of await all('folders'))this.f.set(x.id,x);for(const x of await all('photos'))this.p.set(x.id,x);for(const x of await all('related'))this.r.set(x.id,x);for(const x of await all('queue'))this.q.set(x.id,x);return this}
 _tx(store,fn){return new Promise((res,rej)=>{const t=this.db.transaction(store,'readwrite');fn(t.objectStore(store));t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
 async createFolder(name,parentId=null){if(this.isHist(parentId))throw new Error('historico');const x={id:uid(),name,parentId,createdAt:Date.now()};this.f.set(x.id,x);const h={id:this.histId(x.id),...this.histFields(x.id)};this.f.set(h.id,h);await this._tx('folders',s=>{s.put(x);s.put(h)});this.emit();return x}
 async ensureHistory(){const need=this.needsHist();if(!need.length)return;const hs=need.map(f=>({id:this.histId(f.id),...this.histFields(f.id)}));await this._tx('folders',s=>hs.forEach(h=>s.put(h)));hs.forEach(h=>this.f.set(h.id,h));this.emit()}
 async toQueue(photoId,order){const p=this.p.get(photoId);const x={id:uid(),photoId,order,addedAt:Date.now(),folderId:this.homeOf(photoId)};await this._tx('queue',s=>s.put(x));this.q.set(x.id,x);
  if(p&&!this.isHist(p.folderId)){if(!this.hist(p.folderId))await this.ensureHistory();const y={...p,folderId:this.histId(p.folderId),originFolderId:p.folderId};await this._tx('photos',s=>s.put(y));this.p.set(y.id,y)}this.emit();return x}
 async restoreFromQueue(qid,folderId){const q=this.q.get(qid);await this._tx('queue',s=>s.delete(qid));this.q.delete(qid);const p=q&&this.p.get(q.photoId);
  if(p&&folderId){const y={...p,folderId,groupedAt:Date.now()};delete y.originFolderId;await this._tx('photos',s=>s.put(y));this.p.set(y.id,y)}this.emit()}
 async renameFolder(id,name){const x={...this.f.get(id),name};await this._tx('folders',s=>s.put(x));this.f.set(id,x);this.emit()}
 async moveFolder(id,parentId){if(parentId&&this.isInside(id,parentId))throw new Error('ciclo');const x={...this.f.get(id),parentId};await this._tx('folders',s=>s.put(x));this.f.set(id,x);this.emit()}
 async deleteFolder(id){const ids=[id,...this.descendants(id)];const ph=[...this.p.values()].filter(p=>ids.includes(p.folderId));
  await this._tx('folders',s=>ids.forEach(i=>s.delete(i)));for(const p of ph)await this._cascade(p.id);await this._tx('photos',s=>ph.forEach(p=>s.delete(p.id)));
  ids.forEach(i=>this.f.delete(i));ph.forEach(p=>{this._revoke(p.id);this.p.delete(p.id)});this.emit()}
 async _cascade(pid){const rel=this.related(pid),qs=[...this.q.values()].filter(x=>x.photoId===pid);
  await this._tx('related',s=>rel.forEach(x=>s.delete(x.id)));await this._tx('queue',s=>qs.forEach(x=>s.delete(x.id)));rel.forEach(x=>{this._revoke(x.id);this.r.delete(x.id)});qs.forEach(x=>this.q.delete(x.id))}
 async addRelated(parentId,blob,name=''){const x={id:uid(),parentId,blob,name,createdAt:Date.now()};await this._tx('related',s=>s.put(x));this.r.set(x.id,x);this.emit();return x}
 async addRelatedFile(parentId,file,kind,thumb){const x={id:uid(),parentId,file,name:file.name,kind,mime:file.type||'',size:file.size,createdAt:Date.now()};if(thumb)x.thumb=thumb;await this._tx('related',s=>s.put(x));this.r.set(x.id,x);this.emit();return x}
 async original(r){return r.file}
 async setTitle(kind,id,title){const m=kind==='related'?this.r:this.p,st=kind==='related'?'related':'photos';const x={...m.get(id),title};await this._tx(st,s=>s.put(x));m.set(id,x);this.emit()}
 async dupPhoto(src,folderId,title){const x={...src,id:uid(),folderId,createdAt:Date.now()};delete x.groupedAt;delete x.originFolderId;if(title!==undefined)x.title=title;await this._tx('photos',s=>s.put(x));this.p.set(x.id,x);this.emit();return x}
 async dupRelated(src,parentId,title){const x={...src,id:uid(),parentId,createdAt:Date.now()};if(title!==undefined)x.title=title;await this._tx('related',s=>s.put(x));this.r.set(x.id,x);this.emit();return x}
 chatListen(key,cb){this._ck=key;this._ccb=cb;cb(this._chat(key))}
 _chat(key){try{return JSON.parse(localStorage.getItem('raglan-chat-'+key)||'[]')}catch{return[]}}
 async chatSend(key,m){const l=this._chat(key);l.push({id:uid(),...m});localStorage.setItem('raglan-chat-'+key,JSON.stringify(l.slice(-100)));if(this._ck===key)this._ccb(this._chat(key))}
 async chatDelete(key,id){localStorage.setItem('raglan-chat-'+key,JSON.stringify(this._chat(key).filter(x=>x.id!==id)));if(this._ck===key)this._ccb(this._chat(key))}
 async deleteRelated(id){await this._tx('related',s=>s.delete(id));this._revoke(id);this.r.delete(id);this.emit()}
 async enqueue(photoId,order){const x={id:uid(),photoId,order,addedAt:Date.now(),folderId:this.homeOf(photoId)};await this._tx('queue',s=>s.put(x));this.q.set(x.id,x);this.emit();return x}
 async reorderQueue(id,order){const x={...this.q.get(id),order};await this._tx('queue',s=>s.put(x));this.q.set(id,x);this.emit()}
 async dequeue(id){await this._tx('queue',s=>s.delete(id));this.q.delete(id);this.emit()}
 async setQueueStatus(id,status){const x=this.q.get(id);if(!x||(x.status||'fila')===status)return;const y={...x,status};await this._tx('queue',s=>s.put(y));this.q.set(id,y);this.emit()}
 async addPhoto(folderId,blob,name=''){const x={id:uid(),folderId,blob,name,note:'',createdAt:Date.now()};await this._tx('photos',s=>s.put(x));this.p.set(x.id,x);this.emit();return x}
 async updateNote(id,note){const x={...this.p.get(id),note};this.p.set(id,x);await this._tx('photos',s=>s.put(x));this.emit('note')}
 async setTechniques(id,techniques,groupedAt){const x={...this.p.get(id),techniques};if(groupedAt)x.groupedAt=groupedAt;this.p.set(id,x);await this._tx('photos',s=>s.put(x));this.emit()}
 async movePhoto(id,folderId){const x={...this.p.get(id),folderId};await this._tx('photos',s=>s.put(x));this.p.set(id,x);this.emit()}
 async deletePhoto(id){await this._cascade(id);await this._tx('photos',s=>s.delete(id));this._revoke(id);this.p.delete(id);this.emit()}
}

// ---------- Firebase adapter (Firestore only, realtime; works on the free Spark plan) ----------
// Activated when PASTAS_CONFIG.firebase holds a firebaseConfig object. No Cloud Storage:
//  <prefix>folders/<id>   {name,parentId,createdAt}
//  <prefix>photos/<id>    {folderId,name,note,createdAt,thumb}   thumb = ~300px JPEG data URL (grid)
//  <prefix>photoData/<id> {data}                                 data  = full JPEG data URL (≤1200px, < ~850 KB), loaded lazily
//  v12 (additive, new collections only; existing docs untouched):
//  <prefix>relatedPhotos/<id> {parentId,name,createdAt,thumb}  full image in photoData/<id> (same limits as photos)
//  <prefix>printQueue/<id>    {photoId,order,addedAt}
//  per-element change marks (merged with dotted paths, only on v12 writes):
//    mods.<element> = {at: serverTimestamp, by: clientId}
//      folders: self (created/moved), name | photos: image (added/moved/pasted), title, tech_<dtf|bordado|serigrafia|sublimacao>, related (a related item was removed)
//      relatedPhotos: self, title | printQueue: self, order
//    photos.noteMods.<lineHash> = {at,by}  one entry per note line that was added/changed (lines are the trackable note units)
//  photos/<id>.techniques     optional string[] ('dtf'|'bordado'|'serigrafia'|'sublimacao'); missing = none
//  photos/<id>.groupedAt      optional ms timestamp of the last technique-group change (sort key; fallback createdAt)
//  photos/<id>.title          optional display name (original 'name' = file name is kept)
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
  this.db=fs.getFirestore(app);const pre=this.opts.prefix||'';this.cf=pre+'folders';this.cp=pre+'photos';this.cd=pre+'photoData';this.cr=pre+'relatedPhotos';this.cq=pre+'printQueue';
  const listen=(col,map)=>new Promise(res=>{let first=true;fs.onSnapshot(fs.collection(this.db,col),snap=>{let onlyNotes=true;
   snap.docChanges().forEach(ch=>{const d={id:ch.doc.id,...ch.doc.data()};if(ch.type==='removed'){map.delete(d.id);this.full.delete(d.id);onlyNotes=false}else{const old=map.get(d.id);if(!old||Object.keys(d).some(k=>k!=='note'&&d[k]!==old[k]))onlyNotes=false;map.set(d.id,d)}});
   if(first){first=false;res()}else this.emit(onlyNotes?'remote-note':'data')},err=>{console.warn('Firebase:',err.message);res()})});
  await Promise.all([listen(this.cf,this.f),listen(this.cp,this.p),listen(this.cr,this.r),listen(this.cq,this.q)]);this.onChange(k=>{if(k==='data')this.ensureHistory()});this.ensureHistory();return this}
 _d(col,id){return this.fs.doc(this.db,col,id)}
 _M(){return{at:this.fs.serverTimestamp(),by:CLIENT_ID}}
 _u(...els){const o={};for(const e of els)o['mods.'+e]=this._M();return o}
 async _batchDelete(refs){for(let i=0;i<refs.length;i+=450){const b=this.fs.writeBatch(this.db);refs.slice(i,i+450).forEach(r=>b.delete(r));await b.commit()}}
 photoURL(p){return p.thumb||this.full.get(p.id)||''}
 async fullURL(p){if(this.full.has(p.id))return this.full.get(p.id);if(p.chunks){/* v13: large originals (client orders) are chunked like related files */const parts=await Promise.all(Array.from({length:p.chunks},(_,i)=>this.fs.getDoc(this._d(this.cd,p.id+'_c'+i))));const u=parts.map(d=>d.exists()?d.data().data:'').join('')||p.thumb;this.full.set(p.id,u);return u}const s=await this.fs.getDoc(this._d(this.cd,p.id));const u=s.exists()?s.data().data:p.thumb;this.full.set(p.id,u);return u}
 async createFolder(name,parentId=null){if(this.isHist(parentId))throw new Error('historico');const x={name,parentId,createdAt:Date.now()};const id=uid();this.f.set(id,{id,...x});const hid=this.histId(id),h=this.histFields(id);this.f.set(hid,{id:hid,...h});this.emit();
  const b=this.fs.writeBatch(this.db);b.set(this._d(this.cf,id),{...x,mods:{self:this._M()}});b.set(this._d(this.cf,hid),h);await b.commit();return{id,...x}}
 /* lazily add the Histórico of folders created before v13. Deterministic id + identical content => two clients doing it at once write the same doc (no duplicates). No mods => no glow. */
 async ensureHistory(){if(this._eh)return;const need=this.needsHist().filter(f=>!this._ehDone?.has(f.id));if(!need.length)return;this._eh=true;this._ehDone??=new Set();
  try{const b=this.fs.writeBatch(this.db);for(const f of need.slice(0,400)){b.set(this._d(this.cf,this.histId(f.id)),this.histFields(f.id));this._ehDone.add(f.id)}await b.commit()}catch(e){console.warn('Histórico:',e.message)}finally{this._eh=false}}
 /* drag to the queue: one atomic batch = queue entry + photo moved into its folder's Histórico (only folderId/originFolderId change; data, related, notes stay linked by photo id) */
 async toQueue(photoId,order){const p=this.p.get(photoId);const id=uid();const x={photoId,order,addedAt:Date.now(),folderId:this.homeOf(photoId)};const b=this.fs.writeBatch(this.db);b.set(this._d(this.cq,id),{...x,mods:{self:this._M()}});
  if(p&&!this.isHist(p.folderId)){const hid=this.histId(p.folderId);if(!this.f.has(hid))b.set(this._d(this.cf,hid),this.histFields(p.folderId));b.update(this._d(this.cp,photoId),{folderId:hid,originFolderId:p.folderId,...this._u('image')})}
  await b.commit();return{id,...x}}
 /* drag a queue row back to the grid: leave the queue + leave Histórico (to folderId), newest in its technique group */
 async restoreFromQueue(qid,folderId){const q=this.q.get(qid);const b=this.fs.writeBatch(this.db);b.delete(this._d(this.cq,qid));const p=q&&this.p.get(q.photoId);
  if(p&&folderId)b.update(this._d(this.cp,p.id),{folderId,groupedAt:Date.now(),originFolderId:this.fs.deleteField(),...this._u('image')});await b.commit()}
 async renameFolder(id,name){const x=this.f.get(id);if(x&&x.name===name)return;if(x){this.f.set(id,{...x,name});this.emit()}await this.fs.updateDoc(this._d(this.cf,id),{name,...this._u('name')})}
 async moveFolder(id,parentId){if(parentId&&this.isInside(id,parentId))throw new Error('ciclo');await this.fs.updateDoc(this._d(this.cf,id),{parentId,...this._u('self')})}
 async deleteFolder(id){const ids=[id,...this.descendants(id)];const ph=[...this.p.values()].filter(p=>ids.includes(p.folderId));
  await this._batchDelete([...ph.flatMap(p=>[...this._cascadeRefs(p.id),...this._phRefs(p)]),...ids.map(i=>this._d(this.cf,i))])}
 _phRefs(p){return[this._d(this.cp,p.id),this._d(this.cd,p.id),...Array.from({length:p.chunks||0},(_,i)=>this._d(this.cd,p.id+'_c'+i))]}
 _relRefs(x){return[this._d(this.cr,x.id),this._d(this.cd,x.id),...Array.from({length:x.chunks||0},(_,i)=>this._d(this.cd,x.id+'_c'+i))]}
 // v12: original .svg/.cdr files kept intact, base64 split across photoData/<id>_c<i> docs (each < ~700 KB)
 async addRelatedFile(parentId,file,kind,thumb){const id=uid();const b64=await blobToDataURL(file);const CH=700000;const n=Math.max(1,Math.ceil(b64.length/CH));
  for(let i=0;i<n;i++)await this.fs.setDoc(this._d(this.cd,id+'_c'+i),{data:b64.slice(i*CH,(i+1)*CH),part:i,of:n});
  const x={parentId,name:file.name,createdAt:Date.now(),kind,mime:file.type||'',size:file.size,chunks:n};if(thumb)x.thumb=thumb;await this.fs.setDoc(this._d(this.cr,id),{...x,mods:{self:this._M()}});return{id,...x}}
 async original(r){this.orig=this.orig||new Map();if(this.orig.has(r.id))return this.orig.get(r.id);
  const parts=await Promise.all(Array.from({length:r.chunks||0},(_,i)=>this.fs.getDoc(this._d(this.cd,r.id+'_c'+i))));
  const blob=await (await fetch(parts.map(p=>p.exists()?p.data().data:'').join(''))).blob();const out=r.mime?new Blob([blob],{type:r.mime}):blob;this.orig.set(r.id,out);return out}
 _cascadeRefs(pid){return[...this.related(pid).flatMap(x=>this._relRefs(x)),...[...this.q.values()].filter(x=>x.photoId===pid).map(x=>this._d(this.cq,x.id))]}
 async addRelated(parentId,blob,name=''){const id=uid();const [data,thumb]=await Promise.all([fitDataURL(blob),encodeJPEG(blob,300,.7)]);
  await this.fs.setDoc(this._d(this.cd,id),{data});this.full.set(id,data);const x={parentId,name,createdAt:Date.now(),thumb};await this.fs.setDoc(this._d(this.cr,id),{...x,mods:{self:this._M()}});return{id,...x}}
 // v12: optional display name; original 'name' (file name) is kept
 async setTitle(kind,id,title){const m=kind==='related'?this.r:this.p;const x=m.get(id);if(x&&(x.title||'')===title)return;if(x){m.set(id,{...x,title});this.emit()}await this.fs.updateDoc(this._d(kind==='related'?this.cr:this.cp,id),{title,...this._u('title')})}
 _clean(src){const x={...src};delete x.id;return x}
 async dupPhoto(src,folderId,title){const id=uid();if(src.chunks){for(let i=0;i<src.chunks;i++){const c=await this.fs.getDoc(this._d(this.cd,src.id+'_c'+i));await this.fs.setDoc(this._d(this.cd,id+'_c'+i),c.exists()?c.data():{data:'',part:i,of:src.chunks})}}else{const data=await this.fullURL(src);await this.fs.setDoc(this._d(this.cd,id),{data});this.full.set(id,data)}
  const x={...this._clean(src),folderId,createdAt:Date.now()};delete x.groupedAt;delete x.noteMods;delete x.originFolderId;if(title!==undefined)x.title=title;x.mods={image:this._M()};await this.fs.setDoc(this._d(this.cp,id),x);return{id,...x}}
 async dupRelated(src,parentId,title){const id=uid();
  if(src.chunks){for(let i=0;i<src.chunks;i++){const c=await this.fs.getDoc(this._d(this.cd,src.id+'_c'+i));await this.fs.setDoc(this._d(this.cd,id+'_c'+i),c.exists()?c.data():{data:'',part:i,of:src.chunks})}}
  else{const data=await this.fullURL(src);await this.fs.setDoc(this._d(this.cd,id),{data})}
  const x={...this._clean(src),parentId,createdAt:Date.now()};if(title!==undefined)x.title=title;x.mods={self:this._M()};await this.fs.setDoc(this._d(this.cr,id),x);return{id,...x}}
 // v12 chat: <prefix>chats/<folderId|__root>/messages/<id> {folderId,author,authorId,text,createdAt}; last 100 per room
 _chatCol(key){return this.fs.collection(this.db,(this.opts.prefix||'')+'chats',key,'messages')}
 chatListen(key,cb){this._cu?.();const fs=this.fs;this._cu=fs.onSnapshot(fs.query(this._chatCol(key),fs.orderBy('createdAt','desc'),fs.limit(100)),snap=>cb(snap.docs.map(d=>({id:d.id,...d.data()})).reverse()),err=>{console.warn('Chat:',err.message);cb([])})}
 async chatSend(key,m){await this.fs.setDoc(this.fs.doc(this._chatCol(key),uid()),m)}
 async chatDelete(key,id){await this.fs.deleteDoc(this.fs.doc(this._chatCol(key),id))}
 async deleteRelated(id){const x=this.r.get(id)||{id};await this._batchDelete(this._relRefs(x));this.full.delete(id);if(x.parentId&&this.p.has(x.parentId))await this.fs.updateDoc(this._d(this.cp,x.parentId),this._u('related')).catch(()=>{})}
 async enqueue(photoId,order){const id=uid();const x={photoId,order,addedAt:Date.now(),folderId:this.homeOf(photoId)};await this.fs.setDoc(this._d(this.cq,id),{...x,mods:{self:this._M()}});return{id,...x}}
 async reorderQueue(id,order){const x=this.q.get(id);if(x&&x.order===order)return;if(x){this.q.set(id,{...x,order});this.emit()}await this.fs.updateDoc(this._d(this.cq,id),{order,...this._u('order')})}
 async dequeue(id){await this.fs.deleteDoc(this._d(this.cq,id))}
 async setQueueStatus(id,status){const x=this.q.get(id);if(!x||(x.status||'fila')===status)return;this.q.set(id,{...x,status});this.emit();await this.fs.updateDoc(this._d(this.cq,id),{status})}/* status is not a tracked modification: no mods.* write, no glow */
 async addPhoto(folderId,blob,name=''){const id=uid();const [data,thumb]=await Promise.all([fitDataURL(blob),encodeJPEG(blob,300,.7)]);
  await this.fs.setDoc(this._d(this.cd,id),{data});this.full.set(id,data);
  const x={folderId,name,note:'',createdAt:Date.now(),thumb};await this.fs.setDoc(this._d(this.cp,id),{...x,mods:{image:this._M()}});return{id,...x}}
 async updateNote(id,note){const x=this.p.get(id)||{};if((x.note||'')===note)return;const old=new Set(noteLines(x.note)),om=x.noteMods||{},nm={};
  for(const l of noteLines(note)){const h=lineHash(l);nm[h]=old.has(l)&&om[h]?om[h]:this._M()}
  this.p.set(id,{...x,note,noteMods:nm});await this.fs.updateDoc(this._d(this.cp,id),{note,noteMods:nm})}
 // v12: optional field on existing photo docs; updateDoc touches ONLY 'techniques'
 async setTechniques(id,techniques,groupedAt){const u={techniques};if(groupedAt)u.groupedAt=groupedAt;const x=this.p.get(id);const before=Array.isArray(x?.techniques)?x.techniques:[];const ch=['dtf','bordado','serigrafia','sublimacao'].filter(k=>before.includes(k)!==techniques.includes(k)).map(k=>'tech_'+k);if(!ch.length)return;
  if(x){this.p.set(id,{...x,...u});this.emit()}await this.fs.updateDoc(this._d(this.cp,id),{...u,...this._u(...ch)})}
 async movePhoto(id,folderId){await this.fs.updateDoc(this._d(this.cp,id),{folderId,...this._u('image')})}
 async deletePhoto(id){await this._batchDelete([...this._cascadeRefs(id),...this._phRefs(this.p.get(id)||{id})]);this.full.delete(id)}
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
const HIST_SVG=`<svg class="folder-ic hist-ic" viewBox="0 0 104 84"><defs><linearGradient id="hb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a96ab"/><stop offset="1" stop-color="#4d586b"/></linearGradient></defs><rect x="8" y="22" width="88" height="56" rx="8" fill="url(#hb)"/><rect x="4" y="10" width="96" height="16" rx="5" fill="#a9b4c6"/><rect x="40" y="32" width="24" height="6" rx="3" fill="#2b3343"/><circle cx="78" cy="62" r="15" fill="#1b2230" stroke="#cfe0f5" stroke-width="3"/><path d="M78 54v8l6 4" fill="none" stroke="#cfe0f5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const FOLDER_SVG=`<svg class="folder-ic" viewBox="0 0 104 84"><defs><linearGradient id="fb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4aa3ff"/><stop offset="1" stop-color="#1c62d6"/></linearGradient><linearGradient id="ff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5cb0ff"/><stop offset="1" stop-color="#2a74e8"/></linearGradient></defs>
<path d="M6 10a6 6 0 0 1 6-6h24l8 8h48a6 6 0 0 1 6 6v54a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6Z" fill="url(#fb)"/><rect x="12" y="16" width="80" height="22" rx="3" fill="#e8f1ff" opacity=".9"/>
<path d="M4 28a6 6 0 0 1 6-6h84a6 6 0 0 1 6 6l-4 44a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6Z" fill="url(#ff)"/><path d="M8 30h88" stroke="#fff" stroke-opacity=".25"/></svg>`;
const PLUS=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
const UPLOAD=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-4.5-4.5L8 19"/><path d="M17 3v6M14 6h6" stroke="#fff"/></svg>`;

function modal({title,text='',input=false,value='',ok='Salvar',danger=false,placeholder='Nome da pasta'}){return new Promise(res=>{
 const m=$(`<div class="m-back"><div class="modal glass" role="dialog"><h3>${esc(title)}</h3>${text?`<p>${esc(text)}</p>`:''}${input?`<input maxlength="80" placeholder="${esc(placeholder)}" value="${esc(value)}">`:''}
  <div class="m-btns"><button class="m-btn" data-a="c">Cancelar</button><button class="m-btn ${danger?'dan':'pri'}" data-a="s">${esc(ok)}</button></div></div></div>`);
 const inp=m.querySelector('input');const done=v=>{m.remove();document.removeEventListener('keydown',key,true);res(v)};
 const save=()=>{if(input){const v=inp.value.trim();if(!v){inp.focus();inp.style.borderColor='#ff6b6b';return}done(v)}else done(true)};
 const key=e=>{if(e.key==='Escape'){e.preventDefault();done(null)}else if(e.key==='Enter'){e.preventDefault();save()}};
 m.addEventListener('mousedown',e=>{if(e.target===m)done(null)});m.querySelector('[data-a=c]').onclick=()=>done(null);m.querySelector('[data-a=s]').onclick=save;
 document.addEventListener('keydown',key,true);document.body.append(m);(inp||m.querySelector('[data-a=s]')).focus()})}
function toast(t){const e=$(`<div class="toast glass">${esc(t)}</div>`);document.body.append(e);setTimeout(()=>e.remove(),2200)}

const store=await createStore();window.__pastasStore=store;if(store.kind==='local')store.ensureHistory();
const root=document.getElementById('pastas');let cur=null,lastView=undefined;
// v12: split view — left 80% folders/photos, right 20% "Fila de impressão"
const main=$(`<div class="p-main"></div>`);const qp=$(`<aside class="p-queue" aria-label="Fila de impressão"></aside>`);
const left=$(`<div class="p-left"></div>`);const chatEl=$(`<section class="chat glass" aria-label="Chat"></section>`);left.append(main,chatEl);const ordEl=$(`<aside class="p-orders" aria-label="Pedidos dos clientes"></aside>`);root.append(ordEl,left,qp);const closedNotes=new Set(JSON.parse(sessionStorage.getItem('raglan-notes-closed')||'[]'));const saveClosed=()=>sessionStorage.setItem('raglan-notes-closed',JSON.stringify([...closedNotes]));let drag=null;
const trash=document.getElementById('trash');

function go(id){cur=id||null;location.hash=cur?'#/pastas/'+cur:'#/pastas'}
function render(){
 if(cur&&!store.folder(cur))cur=null;
 const fa=document.activeElement,fid=fa?.dataset?.note,sel=fid?[fa.selectionStart,fa.selectionEnd]:null;const scroll=main.scrollTop;
 const path=store.path(cur);const c=store.counts(cur);if(!cur)c.folders=store.folders(null).filter(f=>!f.isHistory&&!f.isOrder).length;
 const oldR=new Map(),oldEl=new Map();if(!tdrag&&!drag)main.querySelectorAll('.ph[data-photo]').forEach(el=>{oldR.set(el.dataset.photo,el.getBoundingClientRect());oldEl.set(el.dataset.photo,el)});const sameView=lastView===cur;lastView=cur;const inHist=store.isHist(cur);
 main.innerHTML='';
 const head=$(`<div class="p-head">${cur?`<div class="p-back" title="Voltar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg></div>`:''}</div>`);
 const crumbs=[{id:null,name:'Minhas pastas'},...path];
 crumbs.forEach((x,i)=>{if(i)head.append($(`<span class="crumb-sep">›</span>`));const b=$(`<button class="crumb${i===crumbs.length-1?' cur':''}">${esc(x.name)}</button>`);
  if(i<crumbs.length-1){b.onclick=()=>go(x.id);dropTarget(b,x.id)}head.append(b)});
 head.append($(`<span class="p-info">${c.folders} pasta${c.folders===1?'':'s'} · ${c.photos} foto${c.photos===1?'':'s'}${store.kind==='firebase'?' · sincronizado':' · salvo neste navegador'}${matchMedia('(pointer:coarse)').matches?' · toque e segure para mover':''}</span>`));
 head.querySelector('.p-back')?.addEventListener('click',()=>go(path.length>1?path[path.length-2].id:null));
 main.append(head);
 const grid=$(`<div class="p-grid"></div>`);main.append(grid);
main.classList.toggle('in-hist',inHist);root.classList.toggle('at-root',!cur);/* v13: no Fila de impressão on the root screen */
 if(!inHist){const nt=$(`<div class="new-wrap"><div class="new-tile" title="Nova pasta">${PLUS}</div><div class="nm">Nova pasta</div></div>`);nt.querySelector('.new-tile').onclick=newFolder;grid.append(nt);
 if(cur&&!inHist){const up=$(`<div class="new-wrap"><div class="up-tile" title="Enviar fotos">${UPLOAD}</div><div class="nm">Enviar fotos</div></div>`);up.querySelector('.up-tile').onclick=()=>fileIn.click();grid.append(up)}}
 if(inHist)grid.append($(`<div class="hist-note">${HIST_SVG}<div><b>Histórico</b><span>Fotos enviadas para a Fila de impressão. Arraste um item da fila de volta para a tela principal para restaurá-lo.</span></div></div>`));
 const curF=store.folder(cur);
 if(curF?.isOrder){head.append(Object.assign($(`<button class="zip-btn" title="Baixar todos os arquivos do pedido"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 17v3h16v-3"/></svg>Baixar tudo (.zip)</button>`),{onclick:()=>zipOrder(cur)}));
  for(const fl of curF.files||[]){const t=$(`<div class="tile file-t" title="${esc(fl.name)}">${fl.name.endsWith('.csv')?CSV_IC:TXT_IC}<div class="nm">${esc(fl.name)}</div><div class="sub">${fl.name.endsWith('.csv')?'Planilha do pedido':'Informações'}</div></div>`);t.onclick=()=>viewFile(fl);grid.append(t)}}
 renderOrders();
 for(const f of [...store.folders(cur)].filter(f=>cur||!f.isOrder).sort((a,b)=>(b.isHistory?1:0)-(a.isHistory?1:0))){const n=store.counts(f.id);
  if(f.isHistory){const t=$(`<div class="tile hist" data-folder="${f.id}" title="Histórico — fotos enviadas para a fila">${HIST_SVG}<div class="nm">Histórico</div><div class="sub">${n.photos} foto${n.photos===1?'':'s'}</div></div>`);t.onclick=()=>{if(!editing)go(f.id)};grid.append(t);continue}
  const hn=store.hist(f.id)?store.photos(store.histId(f.id)).length:0;
  const t=$(`<div class="tile" draggable="true" data-folder="${f.id}" title="${esc(f.name)}">${FOLDER_SVG}<div class="nm">${esc(f.name)}</div><div class="sub">${n.photos} foto${n.photos===1?'':'s'}${n.folders?` · ${n.folders} pasta${n.folders===1?'':'s'}`:''}${hn?`<br><small>${hn} no histórico</small>`:''}</div></div>`);
  t.onclick=()=>{if(!editing)go(f.id)};dragSource(t,{type:'folder',id:f.id});dropTarget(t,f.id);grid.append(t)}
 // v12: display-only grouping by technique (DTF, Bordado, Serigrafia, Sublimação, then none); newest first inside each group (groupedAt || createdAt)
 const gi=p=>{const on=techOf(p);const i=TECH.findIndex(t=>on.includes(t.k));return i<0?TECH.length:i};
 const tk=p=>p.groupedAt||p.createdAt||0;const sorted=store.photos(cur).map((p,i)=>({p,i,g:gi(p)})).sort((a,b)=>a.g-b.g||tk(b.p)-tk(a.p)||b.i-a.i);const anyG=sorted.some(x=>x.g<TECH.length);let lastG=-1;
 for(const {p,g} of sorted){const open=!closedNotes.has(p.id);const grpLbl=anyG&&g!==lastG?(g<TECH.length?`<span class="grp-lbl" style="--tc:${TECH[g].c}"><i></i>${TECH[g].n}</span>`:`<span class="grp-lbl none"><i></i>Sem técnica</span>`):'';lastG=g;
  const e=$(`<div class="ph${grpLbl?' grp-start':''}" style="--gc:${g<TECH.length?TECH[g].c:'rgba(255,255,255,.18)'}" draggable="true" data-photo="${p.id}">${grpLbl}${techBar(p)}<div class="frame"><img alt="" loading="lazy" decoding="async" src="${store.photoURL(p)}"></div><button class="plus${open?' open':''}${p.note?' has':''}" title="Anotações (clique duplo para ampliar)">+</button>${relBtn(p.id)}
   <div class="pnm" title="${esc(dispName(p))}">${esc(dispName(p))}</div><div class="note${open?' open':''}"><div class="nwrap"><div class="nback" aria-hidden="true"></div><textarea data-note="${p.id}" placeholder="Anotações sobre a foto…">${esc(p.note||'')}</textarea></div><div class="saved"></div></div></div>`);
  e.querySelector('.frame').onclick=()=>{if(!editing)lightbox(p.id)};
  const pl=e.querySelector('.plus'),nb=e.querySelector('.note'),ta=e.querySelector('textarea'),sv=e.querySelector('.saved');
  const toggleNote=()=>{const o=closedNotes.has(p.id);o?closedNotes.delete(p.id):closedNotes.add(p.id);saveClosed();nb.classList.toggle('open',o);pl.classList.toggle('open',o);if(o)setTimeout(()=>ta.focus(),200)};
  /* single click toggles (delayed so a double click/tap does not also toggle); double click/tap opens the large note window */
  pl.onclick=ev=>{ev.stopPropagation();dblTap(pl,toggleNote,()=>noteBig(p.id))};pl.draggable=false;
  const nbk=e.querySelector('.nback');ta.addEventListener('scroll',()=>{nbk.scrollTop=ta.scrollTop});
  ta.addEventListener('click',()=>ackNoteLine(p.id,ta));
  let tm;ta.oninput=()=>{paintNote(p.id,ta,nbk);sv.textContent='…';clearTimeout(tm);tm=setTimeout(async()=>{await store.updateNote(p.id,ta.value);pl.classList.toggle('has',!!ta.value);sv.textContent='Salvo ✓'},400)};
  ta.draggable=false;ta.addEventListener('dragstart',ev=>ev.stopPropagation());
  e.querySelectorAll('.tech button').forEach(b=>{b.draggable=false;b.onclick=async ev=>{ev.stopPropagation();const k=b.dataset.t;const gk=p.id+'|'+k;
   if(b.classList.contains('unseen')){markSeen(p.id,'tech_'+k);techGrace.set(gk,Date.now()+800);return}
   if((techGrace.get(gk)||0)>Date.now()){techGrace.set(gk,Date.now()+800);return}/* burst of clicks used to stop the pulse: ignored, no write */const curT=Array.isArray(p.techniques)?p.techniques:[];
   const next=curT.includes(k)?curT.filter(x=>x!==k):TECH.map(t=>t.k).filter(x=>x===k||curT.includes(x));b.classList.toggle('on',next.includes(k));
   const grp=a=>{const i=TECH.findIndex(t=>a.includes(t.k));return i<0?TECH.length:i};
   try{await store.setTechniques(p.id,next,grp(next)!==grp(curT)?Date.now():0)}catch(err){console.warn(err);toast('Não foi possível salvar')}}});
  const rb=e.querySelector('.rel');rb.onclick=ev=>{ev.stopPropagation();relOpen===p.id?closeRel():openRel(p.id)};rb.draggable=false;
  dragSource(e,{type:'photo',id:p.id});grid.append(e)}
 if(!cur&&!store.folders(null).length)grid.append($(`<div class="p-empty">Crie sua primeira pasta clicando em “+”.</div>`));
 if(inHist&&!store.photos(cur).length)grid.append($(`<div class="p-empty">Nenhuma foto no histórico ainda.</div>`));
 if(cur&&!inHist&&!store.counts(cur).folders&&!store.photos(cur).length)grid.append($(`<div class="p-empty">Pasta vazia. Envie fotos pelo botão ou arraste imagens do computador para cá.</div>`));
 // OS file drop
 grid.addEventListener('dragover',ev=>{if(cur&&!inHist&&!drag&&[...ev.dataTransfer.types].includes('Files')){ev.preventDefault();grid.classList.add('filedrop')}});
 grid.addEventListener('dragleave',ev=>{if(!grid.contains(ev.relatedTarget))grid.classList.remove('filedrop')});
 grid.addEventListener('drop',ev=>{grid.classList.remove('filedrop');if(cur&&!inHist&&!drag&&ev.dataTransfer.files.length){ev.preventDefault();upload(ev.dataTransfer.files)}});
 main.scrollTop=scroll;chatSync();
 // FLIP: animate cards from their previous position (e.g. when a technique toggle regroups them)
 if(oldR.size&&!matchMedia('(prefers-reduced-motion: reduce)').matches)main.querySelectorAll('.ph[data-photo]').forEach(el=>{const o=oldR.get(el.dataset.photo);if(!o)return;const n=el.getBoundingClientRect();const dx=o.left-n.left,dy=o.top-n.top;
  if(Math.abs(dx)>1||Math.abs(dy)>1)el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:420,easing:'cubic-bezier(.2,.8,.2,1)'})});
 // v13: cards that left this view (e.g. sent to the queue -> Histórico) fly out instead of vanishing
 if(sameView&&oldEl.size&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const qr=qp.getBoundingClientRect();
  oldEl.forEach((el,id)=>{if(main.querySelector(`.ph[data-photo="${id}"]`))return;const r=oldR.get(id);const g=el.cloneNode(true);g.classList.add('leaving');Object.assign(g.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',margin:0,zIndex:60,pointerEvents:'none'});
   document.body.append(g);const toQ=store.queued(id)&&qr.width>0;const dx=toQ?qr.left+qr.width/2-(r.left+r.width/2):0,dy=toQ?Math.min(qr.top+80,qr.bottom-40)-(r.top+r.height/2):-20;
   g.animate([{transform:'none',opacity:1},{transform:`translate(${dx}px,${dy}px) scale(.25)`,opacity:0}],{duration:520,easing:'cubic-bezier(.4,0,.2,1)'}).onfinish=()=>g.remove()})}
 if(fid){const t=main.querySelector(`textarea[data-note="${fid}"]`);if(t){t.focus();t.setSelectionRange(...sel)}}}
function dragSource(el,item){
 el.addEventListener('dragstart',ev=>{drag=item;ev.dataTransfer.effectAllowed='move';ev.dataTransfer.setData('text/plain',item.type+':'+item.id);el.classList.add('dragging');document.body.classList.add('dnd')});
 el.addEventListener('dragend',()=>{drag=null;qClear();el.classList.remove('dragging');document.body.classList.remove('dnd');document.querySelectorAll('.drop').forEach(x=>x.classList.remove('drop'));trash.classList.remove('hot')});
 touchDrag(el,item)}
function canDrop(target){if(!drag)return false;
 if(drag.type==='q'){if(target==='__here')return!!store.q.get(drag.id)&&!!store.restoreTarget(store.q.get(drag.id).photoId,cur);return target!==null&&store.f.has(target)&&!store.isHist(target)}
 if(target==='__here'||store.isHist(target))return false;if(drag.type==='folder')return target!==drag.id&&!(target&&store.isInside(drag.id,target))&&store.folder(drag.id)?.parentId!==target;return target!==null&&store.photo(drag.id)?.folderId!==target}
async function restoreQ(qid,target){const q=store.q.get(qid);if(!q)return;const p=store.photo(q.photoId);const dest=target==='__here'?store.restoreTarget(q.photoId,cur):target;
 try{await store.restoreFromQueue(qid,dest&&p&&dest!==p.folderId?dest:(p&&dest===p.folderId?null:dest));toast(dest?`Restaurado em “${store.folder(dest)?.name||'pasta'}”`:'Removido da fila')}catch(e){console.warn(e);toast('Não foi possível restaurar')}}
async function doMove(d,target){if(d.type==='q')return restoreQ(d.id,target);try{if(d.type==='folder')await store.moveFolder(d.id,target);else await store.movePhoto(d.id,target);toast(`Movido para “${target?store.folder(target).name:'Minhas pastas'}”`)}catch(e){toast('Não foi possível mover')}}
async function doTrash(d){
 if(d.type==='q'){await store.dequeue(d.id);toast('Removido da fila');return}
 if(d.type==='folder'){const f=store.folder(d.id);const n=store.descendants(d.id).length,ph=[d.id,...store.descendants(d.id)].reduce((s,i)=>s+store.photos(i).length,0);
  if(await modal({title:'Excluir pasta?',text:`“${f.name}”${n||ph?` e todo o conteúdo (${n} subpasta${n===1?'':'s'}, ${ph} foto${ph===1?'':'s'})`:''} será excluída. Esta ação não pode ser desfeita.`,ok:'Excluir',danger:true}))await store.deleteFolder(d.id)}
 else{const nr=store.related(d.id).length;if(await modal({title:'Excluir foto?',text:nr?`A foto, suas anotações e ${nr} ite${nr===1?'m':'ns'} relacionado${nr===1?'':'s'} serão excluídos. Esta ação não pode ser desfeita.`:'A foto e suas anotações serão excluídas. Esta ação não pode ser desfeita.',ok:'Excluir',danger:true}))await store.deletePhoto(d.id)}}
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
 el.addEventListener('touchstart',ev=>{if(ev.touches.length!==1||ev.target.closest('textarea,.plus,.rel,.q-x,.q-st,.tech'))return;const t=ev.touches[0];const st={x:t.clientX,y:t.clientY};
  const timer=setTimeout(()=>{const r=el.getBoundingClientRect();const g=el.cloneNode(true);g.className+=' ghost';Object.assign(g.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',pointerEvents:'none',zIndex:200,opacity:.85,transform:'scale(1.06)'});
   document.body.append(g);tdrag={el,item,g,dx:st.x-r.left,dy:st.y-r.top,sx:st.x,sy:st.y,moved:false,over:null};drag=item;el.classList.add('dragging');document.body.classList.add('dnd');navigator.vibrate?.(15)},450);
  const cancel=()=>{clearTimeout(timer);el.removeEventListener('touchmove',mv);el.removeEventListener('touchend',cancel)};
  const mv=e=>{const q=e.touches[0];if(!tdrag&&Math.hypot(q.clientX-st.x,q.clientY-st.y)>10)cancel()};
  el.addEventListener('touchmove',mv,{passive:true});el.addEventListener('touchend',cancel)},{passive:true})}
document.addEventListener('touchmove',e=>{if(!tdrag)return;e.preventDefault();const q=e.touches[0];if(Math.hypot(q.clientX-tdrag.sx,q.clientY-tdrag.sy)>10)tdrag.moved=true;tdrag.g.style.left=(q.clientX-tdrag.dx)+'px';tdrag.g.style.top=(q.clientY-tdrag.dy)+'px';
 const hit=document.elementFromPoint(q.clientX,q.clientY);const tgt=hit?.closest('#trash,[data-drop]');document.querySelectorAll('.drop').forEach(x=>x.classList.remove('drop'));trash.classList.remove('hot');tdrag.over=null;
 document.querySelectorAll('.q-ins').forEach(x=>x.classList.remove('q-ins'));qp.classList.remove('q-hot');
 const qz=hit?.closest('.p-queue');if(qz&&(tdrag.item.type==='photo'||tdrag.item.type==='q')){if(qp.classList.contains('collapsed'))qp.classList.remove('collapsed');qMark(q.clientY);tdrag.over={queue:true,y:q.clientY}}
 else if(tgt===trash){trash.classList.add('hot');tdrag.over='trash'}else if(tgt&&tgt!==tdrag.el){const id=tgt.dataset.drop==='__root'?null:tgt.dataset.drop;if(canDrop(id)){tgt.classList.add('drop');tdrag.over={id}}}},{passive:false});
const endT=e=>{if(!tdrag)return;e.preventDefault();const t=tdrag;tdrag=null;drag=null;t.g.remove();t.el.classList.remove('dragging');document.body.classList.remove('dnd');document.querySelectorAll('.drop').forEach(x=>x.classList.remove('drop'));trash.classList.remove('hot');
 qClear();if(!t.moved){openMenuFor(t.item,t.sx,t.sy);return}if(t.over==='trash')doTrash(t.item);else if(t.over?.queue)qDrop(t.item,t.over.y);else if(t.over)doMove(t.item,t.over.id)};
document.addEventListener('touchend',endT,{passive:false});document.addEventListener('touchcancel',endT,{passive:false});
async function newFolder(){const name=await modal({title:'Nova pasta',input:true});if(name)await store.createFolder(name,cur)}
const fileIn=$(`<input type="file" accept="image/*" multiple hidden>`);document.body.append(fileIn);fileIn.onchange=()=>{upload(fileIn.files);fileIn.value=''};
async function upload(files){const list=[...files].filter(f=>f.type.startsWith('image/'));if(!list.length)return toast('Selecione arquivos de imagem');const target=cur;let ok=0;
 for(const f of list){try{await store.addPhoto(target,await compress(f),f.name);ok++}catch(e){console.warn(e)}}toast(`${ok} foto${ok===1?'':'s'} enviada${ok===1?'':'s'}`)}
function lightbox(id){const p=typeof id==='object'?id:store.photo(id);if(!p)return;const lb=$(`<div class="lb"><button class="x" title="Fechar">×</button><img src="${store.photoURL(p)}">${p.note?`<div class="cap">${esc(p.note)}</div>`:''}</div>`);
 const close=()=>{lb.remove();document.removeEventListener('keydown',k)};const k=e=>{if(e.key==='Escape')close()};lb.onclick=e=>{if(e.target!==lb.querySelector('img'))close()};document.addEventListener('keydown',k);document.body.append(lb);store.fullURL(p).then(u=>{if(u)lb.querySelector('img').src=u}).catch(()=>{})}

// ---------- v12: names, context menu (Copiar / Colar / Renomear / Excluir), inline rename, copy & paste ----------
const dispName=p=>(p&&(p.title||baseName(p.name)))||'Foto';
const relName=r=>(r&&(r.title||r.name))||'Foto';
let editing=false,pendingRender=false,clip=null,hoverEl=null,lastTouch=0;
function rerenderAll(){pendingRender=false;if(document.body.classList.contains('pastas-on')){render();renderQueue();renderRel();paintUnseen()}}
const ctx=$(`<div class="ctx glass" role="menu" hidden></div>`);document.body.append(ctx);
const MI={copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',paste:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h6"/>',
 ren:'<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',del:'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',open:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="m10 11 3 2-3 2"/>'};
function showMenu(items,x,y){ctx.innerHTML='';for(const it of items){const b=$(`<button role="menuitem"${it.dis?' disabled':''} class="${it.danger?'dan':''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${MI[it.ic]}</svg>${esc(it.label)}</button>`);
  b.onclick=()=>{closeCtx();if(!it.dis)it.act()};ctx.append(b)}
 ctx.hidden=false;const W=ctx.offsetWidth,H=ctx.offsetHeight;ctx.style.left=Math.max(6,Math.min(x,innerWidth-W-8))+'px';ctx.style.top=Math.max(6,Math.min(y,innerHeight-H-8))+'px'}
function closeCtx(){ctx.hidden=true}
['mousedown','touchstart'].forEach(t=>document.addEventListener(t,e=>{if(!ctx.hidden&&!ctx.contains(e.target))closeCtx()},{passive:true,capture:true}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!ctx.hidden)closeCtx()});addEventListener('resize',closeCtx);main.addEventListener('scroll',closeCtx,{passive:true});
ctx.addEventListener('contextmenu',e=>e.preventDefault());
function itemAt(el){let x;if(!el||!el.closest)return null;if(el.closest('input,textarea,.ctx,.m-back,.lb,.nov'))return null;
 if(x=el.closest('.c-msg'))return{type:'msg',id:x.dataset.m};if(el.closest('.chat'))return null;
 if(x=el.closest('.rp-it[data-r]'))return{type:'related',id:x.dataset.r};if(el.closest('.rp'))return{type:'rspace'};
 if(x=el.closest('.q-row'))return{type:'q',id:x.dataset.q};if(el.closest('.p-queue'))return{type:'qspace'};
 if(x=el.closest('.tile.hist[data-folder]'))return{type:'hist',id:x.dataset.folder};if(x=el.closest('.tile[data-folder]'))return{type:'folder',id:x.dataset.folder};if(x=el.closest('.ph[data-photo]'))return{type:'photo',id:x.dataset.photo};
 if(el.closest('.p-main'))return{type:'space'};return null}
const canPasteFP=()=>clip&&(clip.type==='folder'||clip.type==='photo');
function openMenuFor(it,x,y){if(!it)return;const C={label:'Copiar',ic:'copy',act:()=>copyItem(it)},items=[];
 if(it.type==='hist')items.push({label:'Abrir',ic:'open',act:()=>go(it.id)});
 else if(it.type==='folder'){items.push(C,{label:'Colar aqui',ic:'paste',dis:!canPasteFP(),act:()=>pasteInto(it.id)},{label:'Renomear',ic:'ren',act:()=>renameItem(it)},{label:'Excluir',ic:'del',danger:true,act:()=>doTrash(it)})}
 else if(it.type==='photo'){items.push(C);if(clip?.type==='related')items.push({label:'Colar como relacionada',ic:'paste',act:()=>pasteRelated(it.id)});else items.push({label:'Colar',ic:'paste',dis:!canPasteFP(),act:()=>pasteInto(cur)});
  items.push({label:'Renomear',ic:'ren',act:()=>renameItem(it)},{label:'Excluir',ic:'del',danger:true,act:()=>doTrash(it)})}
 else if(it.type==='related')items.push(C,{label:'Colar',ic:'paste',dis:clip?.type!=='related',act:()=>pasteRelated(relOpen)},{label:'Renomear',ic:'ren',act:()=>renameItem(it)},{label:'Excluir',ic:'del',danger:true,act:()=>delRelated(it.id)});
 else if(it.type==='rspace')items.push({label:'Colar',ic:'paste',dis:clip?.type!=='related',act:()=>pasteRelated(relOpen)});
 else if(it.type==='q')items.push(C,{label:'Colar',ic:'paste',dis:clip?.type!=='q',act:()=>pasteQueue(it.id)},{label:'Renomear',ic:'ren',act:()=>renameItem(it)},{label:'Remover da fila',ic:'del',danger:true,act:()=>delQueue(it.id)});
 else if(it.type==='qspace')items.push({label:'Colar',ic:'paste',dis:clip?.type!=='q',act:()=>pasteQueue(null)});
 else if(it.type==='space')items.push({label:'Colar',ic:'paste',dis:!canPasteFP(),act:()=>pasteInto(cur)});
 else if(it.type==='msg')items.push({label:'Copiar',ic:'copy',act:()=>copyMsg(it.id)},{label:'Excluir',ic:'del',danger:true,act:()=>delMsg(it.id)});
 if(items.length)showMenu(items,x,y)}
document.addEventListener('contextmenu',e=>{if(!document.body.classList.contains('pastas-on'))return;if(Date.now()-lastTouch<900){if(itemAt(e.target))e.preventDefault();return}
 const it=itemAt(e.target);if(!it)return;e.preventDefault();openMenuFor(it,e.clientX,e.clientY)});
// touch: long-press (still) on items that are not drag sources (drag sources open the menu from the drag code when released without moving)
{let lp=null,fired=false;
 document.addEventListener('touchstart',e=>{lastTouch=Date.now();if(!document.body.classList.contains('pastas-on')||e.touches.length!==1)return;const t=e.target;
  if(t.closest('[draggable="true"],button,a,input,textarea,.ctx'))return;const it=itemAt(t);if(!it)return;const q=e.touches[0],sx=q.clientX,sy=q.clientY;
  clearTimeout(lp?.tm);lp={sx,sy,tm:setTimeout(()=>{fired=true;navigator.vibrate?.(15);openMenuFor(it,sx,sy)},500)}},{passive:true});
 document.addEventListener('touchmove',e=>{if(lp&&Math.hypot(e.touches[0].clientX-lp.sx,e.touches[0].clientY-lp.sy)>10){clearTimeout(lp.tm);lp=null}},{passive:true});
 document.addEventListener('touchend',e=>{if(lp){clearTimeout(lp.tm);lp=null}if(fired){fired=false;if(e.cancelable)e.preventDefault()}},{passive:false});}
document.addEventListener('mouseover',e=>{hoverEl=e.target},{passive:true});
document.addEventListener('keydown',async e=>{if(!document.body.classList.contains('pastas-on')||!(e.ctrlKey||e.metaKey)||e.target.closest?.('input,textarea')||document.querySelector('.m-back'))return;const k=e.key.toLowerCase();
 if(k==='c'){const it=itemAt(hoverEl)||(qSel?{type:'q',id:qSel}:null);if(it&&['folder','photo','related','q'].includes(it.type)){e.preventDefault();copyItem(it)}else if(it?.type==='msg'){e.preventDefault();copyMsg(it.id)}}
 else if(k==='v'&&clip){e.preventDefault();const it=itemAt(hoverEl);
  if(clip.type==='q')pasteQueue(it?.type==='q'?it.id:null);else if(clip.type==='related'){const pid=it?.type==='photo'?it.id:relOpen;if(pid)pasteRelated(pid);else toast('Abra as fotos relacionadas de uma foto para colar')}
  else pasteInto(it?.type==='folder'?it.id:cur)}});
function copyItem(it){if(!['folder','photo','related','q'].includes(it.type))return;clip={type:it.type,id:it.id};toast('Copiado — use “Colar”')}
function uniqueName(name,taken){if(!taken.includes(name))return name;let n=name+' (cópia)',i=2;while(taken.includes(n))n=`${name} (cópia ${i++})`;return n}
function snapTree(id){return{f:{...store.folder(id)},photos:store.photos(id).map(p=>({p:{...p},rel:store.related(p.id).map(r=>({...r}))})),subs:store.folders(id).filter(c=>!c.isHistory).map(c=>snapTree(c.id))}}/* v13: a folder copy does not copy its Histórico content (the copy gets its own empty Histórico) */
async function dupFolderTree(t,parentId,top){const name=top?uniqueName(t.f.name,store.folders(parentId).map(x=>x.name)):t.f.name;const nf=await store.createFolder(name,parentId);
 for(const x of t.photos)await dupPhotoDeep(x,nf.id,false);for(const sub of t.subs)await dupFolderTree(sub,nf.id,false);return nf}
async function dupPhotoDeep(x,folderId,check){const want=dispName(x.p);const nm=check?uniqueName(want,store.photos(folderId).map(dispName)):want;
 const np=await store.dupPhoto(x.p,folderId,nm!==baseName(x.p.name)||x.p.title?nm:undefined);for(const r of x.rel)await store.dupRelated(r,np.id,r.title);return np}
let pasting=false;
async function busy(label,fn){if(pasting)return toast('Aguarde, colando…');pasting=true;const t=$(`<div class="toast glass">${esc(label)}</div>`);document.body.append(t);
 try{await fn()}catch(e){console.warn(e);toast('Não foi possível colar')}finally{pasting=false;t.remove()}}
async function pasteInto(folderId){if(!clip)return;if(store.isHist(folderId))folderId=store.folder(folderId).parentId;
 if(clip.type==='folder'){if(!store.folder(clip.id))return toast('O item copiado não existe mais');const tree=snapTree(clip.id);await busy('Colando pasta…',async()=>{await dupFolderTree(tree,folderId??null,true);toast('Pasta colada')})}
 else if(clip.type==='photo'){const p=store.photo(clip.id);if(!p)return toast('O item copiado não existe mais');if(!folderId)return toast('Abra uma pasta para colar fotos');
  const x={p:{...p},rel:store.related(p.id).map(r=>({...r}))};await busy('Colando foto…',async()=>{await dupPhotoDeep(x,folderId,true);toast('Foto colada')})}
 else if(clip.type==='related')toast('Abra as fotos relacionadas de uma foto para colar');else if(clip.type==='q')toast('Cole itens da fila na Fila de impressão')}
async function pasteRelated(pid){if(clip?.type!=='related'||!pid)return;const r=store.r.get(clip.id);if(!r)return toast('O item copiado não existe mais');
 const nm=uniqueName(relName(r),store.related(pid).map(relName));await busy('Colando…',async()=>{await store.dupRelated({...r},pid,nm!==relName(r)||r.title?nm:undefined);toast('Foto relacionada colada')})}
async function pasteQueue(afterId){if(clip?.type!=='q')return;const src=store.q.get(clip.id);if(!src||!store.photo(src.photoId))return toast('O item copiado não existe mais');
 const items=store.queueIn(cur);const i=afterId?items.findIndex(x=>x.id===afterId):items.length-1;const a=items[i]?.order,b=items[i+1]?.order;const order=a==null?(b==null?1:b-1):b==null?a+1:(a+b)/2;
 await store.enqueue(src.photoId,order);toast('Item duplicado na fila')}
async function delRelated(id){if(await modal({title:'Excluir foto relacionada?',text:'Esta foto/arquivo relacionado será excluído. Esta ação não pode ser desfeita.',ok:'Excluir',danger:true})){await store.deleteRelated(id);toast('Excluído')}}
async function delQueue(id){if(await modal({title:'Remover da fila?',text:'O item sai da Fila de impressão. A foto continua na pasta.',ok:'Remover',danger:true})){await store.dequeue(id);toast('Removido da fila')}}
function renameItem(it){
 if(it.type==='folder'){const f=store.folder(it.id),el=main.querySelector(`.tile[data-folder="${it.id}"] .nm`);if(f&&el)inlineEdit(el,f.name,v=>store.renameFolder(it.id,v))}
 else if(it.type==='photo'||it.type==='q'){const pid=it.type==='q'?store.q.get(it.id)?.photoId:it.id;const p=store.photo(pid);if(!p)return;
  const el=it.type==='q'?qp.querySelector(`.q-row[data-q="${it.id}"] .q-nm`):main.querySelector(`.ph[data-photo="${pid}"] .pnm`);if(el)inlineEdit(el,dispName(p),v=>store.setTitle('photo',pid,v))}
 else if(it.type==='related'){const r=store.r.get(it.id),el=pop.querySelector(`.rp-it[data-r="${it.id}"] .rp-cap`);if(r&&el)inlineEdit(el,relName(r),v=>store.setTitle('related',it.id,v))}}
function inlineEdit(el,value,save){editing=true;const inp=$(`<input class="ren" maxlength="80" aria-label="Novo nome">`);inp.value=value;el.classList.add('editing');el.replaceChildren(inp);
 const host=el.closest('[draggable]');const dr=host?.getAttribute('draggable');host?.setAttribute('draggable','false');
 let done=false;const fin=async ok=>{if(done)return;done=true;const v=inp.value.trim();editing=false;if(host&&dr)host.setAttribute('draggable',dr);
  if(ok&&v&&v!==value){try{await save(v);toast('Renomeado')}catch(e){console.warn(e);toast('Não foi possível renomear')}}rerenderAll()};
 inp.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();if(!inp.value.trim()){inp.classList.add('err');return}fin(true)}else if(e.key==='Escape'){e.preventDefault();fin(false)}};
 inp.onblur=()=>fin(!!inp.value.trim());
 ['click','mousedown','dblclick','touchstart','dragstart'].forEach(ev=>inp.addEventListener(ev,e=>e.stopPropagation()));
 requestAnimationFrame(()=>{inp.focus();inp.select()})}

// ---------- v12: chat per folder (Firestore chats/<folderId|__root>/messages) ----------
const CHAT_ME_KEY='raglan-chat-name',CHAT_ID_KEY='raglan-chat-id';
const cp1000=t=>Array.from(String(t||'')).slice(0,1000).join('');/* count by code points; never splits surrogate pairs */
const EMOJI_ONLY=/^(?:(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2})(?:\uFE0F|\p{Emoji_Modifier}|\u200D(?:\p{Extended_Pictographic})\uFE0F?)*\s*){1,3}$/u;
const chatId=localStorage.getItem(CHAT_ID_KEY)||CLIENT_ID;
let chatKey=null,chatMsgs=[];
chatEl.innerHTML=`<div class="c-head" role="button" tabindex="0"><svg class="c-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z"/></svg><b>Chat</b><span class="c-where"></span><span class="c-badge" hidden></span><button class="c-me" title="Alterar seu nome"></button><span class="c-chev" title="Minimizar"></span></div>
 <div class="c-body"><div class="c-list" aria-live="polite"></div><form class="c-form"><button class="c-emo" type="button" title="Emojis" aria-label="Emojis">😊</button><input class="c-in" maxlength="2000" placeholder="Escreva uma mensagem…" autocomplete="off"><button class="c-send" type="submit" title="Enviar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/></svg></button></form></div>`;
const cList=chatEl.querySelector('.c-list'),cIn=chatEl.querySelector('.c-in'),cMe=chatEl.querySelector('.c-me'),cBadge=chatEl.querySelector('.c-badge');
const cKey=matchMedia('(max-width:900px)').matches?'raglan-chat-collapsed-m':'raglan-chat-collapsed';
chatEl.classList.toggle('collapsed',(localStorage.getItem(cKey)??(matchMedia('(max-width:900px)').matches?'1':'0'))==='1');
let unread=0;
function setCollapsed(c){chatEl.classList.toggle('collapsed',c);if(!c&&matchMedia('(max-width:900px)').matches)qp.classList.add('collapsed');/* v13: phone drawers are exclusive */localStorage.setItem(cKey,c?'1':'0');if(!c){unread=0;cBadge.hidden=true;cList.scrollTop=cList.scrollHeight;cIn.focus({preventScroll:true})}}
chatEl.querySelector('.c-head').onclick=e=>{if(e.target.closest('.c-me'))return;setCollapsed(!chatEl.classList.contains('collapsed'))};
chatEl.querySelector('.c-head').onkeydown=e=>{if(e.key==='Enter'&&e.target===e.currentTarget)setCollapsed(!chatEl.classList.contains('collapsed'))};
function meName(){return localStorage.getItem(CHAT_ME_KEY)||''}
function paintMe(){const n=meName();cMe.textContent=n?n:'';cMe.hidden=!n}paintMe();
cMe.onclick=async e=>{e.stopPropagation();const n=await modal({title:'Seu nome no chat',input:true,value:meName(),placeholder:'Seu nome',ok:'Salvar'});if(n){localStorage.setItem(CHAT_ME_KEY,n.slice(0,40));paintMe()}};
const hhmm=t=>{const d=new Date(t),z=n=>String(n).padStart(2,'0');return`${z(d.getHours())}:${z(d.getMinutes())}`};
const linkify=t=>esc(t).replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g,u=>`<a href="${u}" target="_blank" rel="noopener noreferrer nofollow">${u}</a>`);
function paintChat(){const atBottom=cList.scrollHeight-cList.scrollTop-cList.clientHeight<40;const prevLast=cList.dataset.last;
 cList.innerHTML=chatMsgs.length?chatMsgs.map(m=>{const tx=cp1000(m.text);return`<div class="c-msg ${m.authorId===chatId?'me':'other'}${EMOJI_ONLY.test(tx.trim())?' big':''}" data-m="${esc(m.id)}"><div class="c-meta"><b>${esc(m.author||'Anônimo')}</b><time>${hhmm(m.createdAt)}</time></div><div class="c-txt">${linkify(tx)}</div></div>`}).join('')
  :`<div class="c-empty">Nenhuma mensagem ${chatKey==='__root'?'no chat geral':'nesta pasta'} ainda.</div>`;
 const last=chatMsgs[chatMsgs.length-1];cList.dataset.last=last?.id||'';
 if(atBottom||last?.authorId===chatId||!prevLast)cList.scrollTop=cList.scrollHeight;
 if(last&&prevLast&&last.id!==prevLast&&last.authorId!==chatId&&chatEl.classList.contains('collapsed')){unread++;cBadge.textContent=unread;cBadge.hidden=false}}
function chatSync(){const k=cur||'__root';const f=cur?store.folder(cur):null;chatEl.querySelector('.c-where').textContent=f?'· '+f.name:'· Geral';
 if(k===chatKey)return;chatKey=k;chatMsgs=[];unread=0;cBadge.hidden=true;cList.dataset.last='';paintChat();store.chatListen(k,list=>{if(chatKey!==k)return;chatMsgs=list;paintChat()})}
chatEl.querySelector('.c-form').onsubmit=async e=>{e.preventDefault();emoPop.hidden=true;const text=cp1000(cIn.value.trim());if(!text||!chatKey)return;
 let name=meName();if(!name){name=await modal({title:'Seu nome no chat',text:'Como você quer aparecer nas mensagens?',input:true,placeholder:'Seu nome',ok:'Salvar'});if(!name)return;name=name.slice(0,40);localStorage.setItem(CHAT_ME_KEY,name);paintMe()}
 cIn.value='';try{await store.chatSend(chatKey,{folderId:chatKey==='__root'?null:chatKey,author:name,authorId:chatId,text,createdAt:Date.now()})}catch(err){console.warn(err);cIn.value=text;toast('Não foi possível enviar')}cIn.focus()};
async function copyMsg(id){const m=chatMsgs.find(x=>x.id===id);if(!m)return;try{await navigator.clipboard.writeText(m.text)}catch{const t=$(`<textarea>`);t.value=m.text;document.body.append(t);t.select();document.execCommand('copy');t.remove()}toast('Mensagem copiada')}
async function delMsg(id){if(await modal({title:'Excluir mensagem?',text:'A mensagem será excluída para todos. Esta ação não pode ser desfeita.',ok:'Excluir',danger:true})){try{await store.chatDelete(chatKey,id)}catch(e){toast('Não foi possível excluir')}}}
window.__pastasChat={key:()=>chatKey};
// emoji picker (built-in, no external library)
const EMO={'Frequentes':'👍 ❤️ 😂 😊 🙏 🔥 ✅ ❌ 🎉 👏 😮 😢 📸 👕 🧵 🎨 🖨️ ⏰ 📦 💯 👀 🤝 💪 ⭐','Rostos':'😀 😃 😄 😁 😆 😅 🤣 😉 😍 🥰 😘 😎 🤩 🤔 🤨 😐 😴 😬 🙄 😳 😡 🥲 😭 🤗 🫡 😇','Gestos':'👍 👎 👌 ✌️ 🤞 👋 🙌 👐 🫶 👉 👈 👆 👇 ✋ 🤙 💅','Trabalho':'👕 👚 🧢 🧥 🧦 🎽 🧵 🪡 🧶 ✂️ 📏 🎨 🖌️ 🖍️ 🖨️ 📸 🖼️ 📦 🚚 💰 🧾 📅 ⏰ 📌 📎 ✏️ 📝 💻 📱','Símbolos':'✅ ☑️ ❌ ⚠️ ❗ ❓ 💬 🔔 ⭐ 🌟 ✨ 💥 💯 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ ➡️ ⬅️ 🔁 🆗 🆕'};
const emoPop=$(`<div class="c-emoji glass" hidden role="dialog" aria-label="Emojis">${Object.entries(EMO).map(([n,l])=>`<div class="ce-cat">${n}</div><div class="ce-grid">${l.split(' ').map(e=>`<button type="button" class="ce">${e}</button>`).join('')}</div>`).join('')}</div>`);
chatEl.append(emoPop);const cEmo=chatEl.querySelector('.c-emo');
cEmo.onclick=e=>{e.stopPropagation();emoPop.hidden=!emoPop.hidden;if(!emoPop.hidden){emoPop.scrollTop=0}};
emoPop.addEventListener('mousedown',e=>e.preventDefault());/* keep input caret */
emoPop.querySelectorAll('.ce').forEach(b=>b.onclick=()=>{const v=b.textContent;const st=cIn.selectionStart??cIn.value.length,en=cIn.selectionEnd??st;cIn.setRangeText(v,st,en,'end');cIn.focus();cIn.dispatchEvent(new Event('input'))});
document.addEventListener('mousedown',e=>{if(!emoPop.hidden&&!emoPop.contains(e.target)&&e.target!==cEmo)emoPop.hidden=true},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')emoPop.hidden=true});


// ---------- v12: per-element 'unseen change' highlight (seen map is local only; acknowledging never writes to Firestore) ----------
const techGrace=new Map();const SEEN_KEY='raglan-seen';const ms=v=>v?(v.toMillis?v.toMillis():typeof v==='number'?v:0):0;
let seen;try{seen=JSON.parse(localStorage.getItem(SEEN_KEY)||'null')}catch{seen=null}
const objOf=id=>store.f.get(id)||store.p.get(id)||store.r.get(id)||store.q.get(id);
const marks=x=>[...Object.entries(x?.mods||{}).map(([k,m])=>[k,m]),...Object.entries(x?.noteMods||{}).map(([h,m])=>['n_'+h,m])];
if(!seen){seen={};for(const x of [...store.f.values(),...store.p.values(),...store.r.values(),...store.q.values()])for(const [k,m] of marks(x)){const t=ms(m?.at);if(t)seen[x.id+'|'+k]=t}localStorage.setItem(SEEN_KEY,JSON.stringify(seen))}
const mOf=(x,el)=>el.startsWith('n_')?x?.noteMods?.[el.slice(2)]:x?.mods?.[el];
const U=(x,el)=>{const m=x&&mOf(x,el);return!!m&&!!m.by&&m.by!==CLIENT_ID&&ms(m.at)>(seen[x.id+'|'+el]||0)};
const anyU=x=>!!x&&marks(x).some(([k])=>U(x,k));
function markSeen(id,...els){const x=objOf(id);let ch=false;for(const el of els){const t=ms(mOf(x,el)?.at);if(t&&(seen[id+'|'+el]||0)<t){seen[id+'|'+el]=t;ch=true}}if(ch){localStorage.setItem(SEEN_KEY,JSON.stringify(seen));paintUnseen()}}
const DBL=280;
function dblTap(el,single,double){const now=Date.now();if(now-(el._lt||0)<DBL){clearTimeout(el._st);el._lt=0;double();return}el._lt=now;clearTimeout(el._st);el._st=setTimeout(()=>{el._lt=0;single()},DBL)}
let nov=null;
function ackAllNote(id){const p=store.p.get(id);if(p)markSeen(id,...noteLines(p.note).map(l=>'n_'+lineHash(l)))}
function noteBig(id){const p=store.photo(id);if(!p||nov)return;closeRel();const f=store.folder(p.folderId);
 const o=$(`<div class="nov" role="dialog" aria-label="Anotações"><div class="nov-p glass"><div class="nov-h"><img src="${store.photoURL(p)}" alt=""><div class="nov-t"><b>${esc(dispName(p))}</b><span>${esc(f?f.name:'')}</span></div><span class="nov-s"></span><button class="nov-x" title="Fechar">×</button></div>
 <textarea class="nov-ta" placeholder="Anotações sobre a foto…"></textarea><button class="plus open nov-plus" title="Fechar (clique duplo)">+</button></div></div>`);
 const ta=o.querySelector('textarea'),sv=o.querySelector('.nov-s');ta.value=p.note||'';document.body.append(o);ackAllNote(id);paintUnseen();
 let tm=null;const save=async()=>{clearTimeout(tm);tm=null;try{await store.updateNote(id,ta.value);sv.textContent='Salvo ✓'}catch(e){sv.textContent='Erro ao salvar'}};
 ta.oninput=()=>{sv.textContent='…';clearTimeout(tm);tm=setTimeout(save,400)};
 ta.addEventListener('dblclick',e=>e.stopPropagation());
 const off=store.onChange(()=>{const q=store.p.get(id);if(!q){close();return}if(!tm&&(q.note||'')!==ta.value){const a=ta.selectionStart,b=ta.selectionEnd;ta.value=q.note||'';ta.setSelectionRange(a,b)}ackAllNote(id)});
 async function close(){if(!nov)return;nov=null;removeEventListener('keydown',kd,true);if(typeof off==='function')off();o.remove();if(tm)await save();rerenderAll()}
 const kd=e=>{if(e.key==='Escape'){e.stopPropagation();close()}};addEventListener('keydown',kd,true);
 o.querySelector('.nov-x').onclick=close;
 const np=o.querySelector('.nov-plus');np.onclick=e=>{e.stopPropagation();dblTap(np,()=>ta.focus(),close)};
 o.addEventListener('click',e=>{if(e.target===o)close()});/* click (and so double click) on the backdrop closes */
 nov={id,close};setTimeout(()=>{ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length)},60)}
window.__noteBig=()=>nov;
function paintNote(id,ta,nbk){const p=store.p.get(id);nbk.innerHTML=esc(ta.value).split('\n').map(l=>{const t=l.trim();return t&&p&&U(p,'n_'+lineHash(t))?`<mark>${l||' '}</mark>`:l}).join('\n')+'\n';nbk.scrollTop=ta.scrollTop;
 ta.closest('.note')?.classList.toggle('has-unseen',nbk.querySelector('mark')!==null)}
function ackNoteLine(id,ta){const i=ta.value.slice(0,ta.selectionStart).split('\n').length-1;const t=(ta.value.split('\n')[i]||'').trim();if(t)markSeen(id,'n_'+lineHash(t))}
function paintUnseen(){const inF=new Set();const up=fid=>{let c=store.f.get(fid);while(c&&!inF.has(c.id)){inF.add(c.id);c=store.f.get(c.parentId)}};
 for(const p of store.p.values())if(anyU(p))up(p.folderId);for(const r of store.r.values())if(anyU(r)){const p=store.p.get(r.parentId);if(p)up(p.folderId)}
 for(const f of store.f.values())if(anyU(f))up(f.parentId);
 root.querySelectorAll('.tile[data-folder]').forEach(el=>{const f=store.f.get(el.dataset.folder);const a=U(f,'self'),b=U(f,'name');el.classList.toggle('unseen',a);el.querySelector('.nm')?.classList.toggle('unseen',b);el.classList.toggle('unseen-in',!a&&!b&&inF.has(el.dataset.folder))});
 main.querySelectorAll('.ph[data-photo]').forEach(el=>{const id=el.dataset.photo,p=store.p.get(id);
  el.querySelector('.frame')?.classList.toggle('unseen',U(p,'image'));el.querySelector('.pnm')?.classList.toggle('unseen',U(p,'title'));
  el.querySelectorAll('.tech button').forEach(b=>b.classList.toggle('unseen',U(p,'tech_'+b.dataset.t)));
  const rb=el.querySelector('.rel');rb?.classList.toggle('unseen',U(p,'related'));rb?.classList.toggle('unseen-in',!U(p,'related')&&store.related(id).some(anyU));
  const ta=el.querySelector('textarea'),nbk=el.querySelector('.nback');if(ta&&nbk)paintNote(id,ta,nbk)});
 pop.querySelectorAll('.rp-it[data-r]').forEach(el=>{const r=store.r.get(el.dataset.r);el.classList.toggle('unseen',U(r,'self'));el.querySelector('.rp-cap')?.classList.toggle('unseen',U(r,'title'))});
 qp.querySelectorAll('.q-row[data-q]').forEach(el=>{const q=store.q.get(el.dataset.q);el.classList.toggle('unseen',U(q,'self')||U(q,'order'))})}
// acknowledge exactly the element that was clicked/tapped
document.addEventListener('pointerdown',e=>{if(!document.body.classList.contains('pastas-on'))return;const t=e.target;if(!t.closest)return;let x;
 if(x=t.closest('.tile[data-folder]')){const id=x.dataset.folder;if(t.closest('.nm.unseen'))markSeen(id,'name');else if(x.classList.contains('unseen'))markSeen(id,'self');return}
 if(x=t.closest('.ph[data-photo]')){const id=x.dataset.photo;if(t.closest('.tech'))return;/* technique buttons: handled by their click */
  if(t.closest('.pnm.unseen'))markSeen(id,'title');else if(t.closest('.frame.unseen'))markSeen(id,'image');else if(t.closest('.rel.unseen'))markSeen(id,'related');return}
 if(x=t.closest('.rp-it[data-r]')){const id=x.dataset.r;if(t.closest('.rp-cap.unseen'))markSeen(id,'title');else if(x.classList.contains('unseen'))markSeen(id,'self');return}
 if(x=t.closest('.q-row[data-q]')){if(x.classList.contains('unseen'))markSeen(x.dataset.q,'self','order')}},true);
window.__unseen={U:(id,el)=>U(objOf(id),el),clientId:CLIENT_ID};

// ---------- v12: print techniques (DTF, Bordado, Serigrafia, Sublimação) ----------
const TI=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const TECH=[
 {k:'dtf',n:'DTF',c:'#2f8cff',i:TI('<path d="M6 8V3h12v5"/><rect x="3" y="8" width="18" height="7" rx="1.5"/><path d="M6.5 12.5h11"/><path d="M8 12.5v8.5h8v-8.5"/><path d="M10.5 16h3M10.5 18.5h3"/>')},
 {k:'bordado',n:'Bordado',c:'#22c55e',i:TI('<path d="M21 3 11.5 12.5"/><path d="M19.2 3.4l1.4 1.4"/><path d="M11.5 12.5 10 15"/><path d="M19.5 5.5c-3 1-5.5 3-7.2 5.6C10.7 13.7 9 15 7 15"/><path d="M3 21l2.5-3 2.5 3 2.5-3 2.5 3"/>')},
 {k:'serigrafia',n:'Serigrafia',c:'#ef4444',i:TI('<rect x="3" y="11" width="18" height="10" rx="1"/><rect x="6.5" y="14" width="11" height="4" rx=".5"/><path d="M6 8.5h12"/><path d="M12 8.5V3"/><path d="M9.5 3h5"/>')},
 {k:'sublimacao',n:'Sublimação',c:'#facc15',f:'#1f1a05',i:TI('<path d="M12 3v3"/><path d="M8.5 3h7"/><rect x="4" y="6" width="16" height="3.5" rx="1"/><path d="M3 20.5h18"/><path d="M7.5 18c-1-1 1-2 0-3.2M12 18c-1-1 1-2 0-3.2M16.5 18c-1-1 1-2 0-3.2"/>')}];
const techOf=p=>Array.isArray(p.techniques)?p.techniques:[];
function techBar(p){const on=techOf(p);return`<div class="tech" role="group" aria-label="Técnica">${TECH.map(t=>`<button class="${on.includes(t.k)?'on':''}" data-t="${t.k}" title="${t.n}" aria-label="${t.n}" aria-pressed="${on.includes(t.k)}" style="--tc:${t.c};--tf:${t.f||'#fff'}">${t.i}</button>`).join('')}</div>`}
const fName=id=>{const f=store.folder(id);if(!f)return'—';if(f.isHistory){const pa=store.folder(f.parentId);return(pa?pa.name+' › ':'')+'Histórico'}return f.name};
// ---------- v13: client orders (root right half, order folder files, zip) ----------
const CSV_IC=`<svg class="folder-ic file-ic" viewBox="0 0 104 84"><rect x="26" y="4" width="52" height="72" rx="7" fill="#1f7a46"/><path d="M62 4v16h16" fill="#2fa865"/><rect x="34" y="30" width="36" height="34" rx="2" fill="none" stroke="#d7f5e3" stroke-width="3"/><path d="M34 41h36M34 52h36M46 30v34M58 30v34" stroke="#d7f5e3" stroke-width="2.4"/></svg>`;
const TXT_IC=`<svg class="folder-ic file-ic" viewBox="0 0 104 84"><rect x="26" y="4" width="52" height="72" rx="7" fill="#3a4659"/><path d="M62 4v16h16" fill="#56647a"/><path d="M36 34h32M36 44h32M36 54h22" stroke="#dfe6f0" stroke-width="3.2" stroke-linecap="round"/></svg>`;
const ORD_SVG=`<svg class="folder-ic ord-ic" viewBox="0 0 104 84"><defs><linearGradient id="ob" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb547"/><stop offset="1" stop-color="#e07a12"/></linearGradient></defs><path d="M6 14a6 6 0 0 1 6-6h24l8 8h48a6 6 0 0 1 6 6v50a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6Z" fill="url(#ob)"/><rect x="34" y="30" width="36" height="40" rx="5" fill="#fff6e8"/><rect x="43" y="26" width="18" height="8" rx="3" fill="#7a3f00"/><path d="M41 44h22M41 52h22M41 60h14" stroke="#c46a0c" stroke-width="3" stroke-linecap="round"/></svg>`;
const fmtDT=t=>{const d=new Date(t),z=n=>String(n).padStart(2,'0');return`${z(d.getDate())}/${z(d.getMonth()+1)}/${d.getFullYear()} ${z(d.getHours())}:${z(d.getMinutes())}`};
function renderOrders(){if(cur){ordEl.innerHTML='';return}const list=store.folders(null).filter(f=>f.isOrder).sort((a,b)=>b.createdAt-a.createdAt);
 ordEl.innerHTML=`<div class="q-head"><h2>Pedidos dos clientes</h2><span class="q-n">${list.length} pedido${list.length===1?'':'s'}</span></div><div class="o-grid"></div>${list.length?'':'<div class="q-empty">Nenhum pedido ainda. Os pedidos enviados pelos clientes no Mockup aparecem aqui.</div>'}`;
 const g=ordEl.querySelector('.o-grid');for(const f of list){const n=store.counts(f.id);const t=$(`<div class="tile order" draggable="true" data-folder="${f.id}" title="${esc(f.name)}">${ORD_SVG}<div class="nm">${esc(f.name)}</div><div class="sub">${fmtDT(f.createdAt)} · ${n.photos} foto${n.photos===1?'':'s'}</div></div>`);
  t.onclick=()=>{if(!editing)go(f.id)};dragSource(t,{type:'folder',id:f.id});dropTarget(t,f.id);g.append(t)}}
function parseCSV(t){t=t.replace(/^\ufeff/,'');const rows=[];let row=[],c='',q=false;for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(ch==='"'){if(t[i+1]==='"'){c+='"';i++}else q=false}else c+=ch}else if(ch==='"')q=true;else if(ch===';'||ch===','&&!t.includes(';')){row.push(c);c=''}else if(ch==='\n'){row.push(c.replace(/\r$/,''));rows.push(row);row=[];c=''}else c+=ch}
 if(c||row.length){row.push(c.replace(/\r$/,''));rows.push(row)}return rows}
function dlBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}
function viewFile(fl){const isCsv=fl.name.endsWith('.csv');let body;if(isCsv){const r=parseCSV(fl.text||'');body=`<div class="fv-scroll"><table class="fv-t"><thead><tr>${(r[0]||[]).map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${r.slice(1).map(x=>`<tr>${x.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="9">Sem linhas preenchidas</td></tr>'}</tbody></table></div>`}
 else body=`<pre class="fv-pre">${esc(fl.text||'')}</pre>`;
 const m=$(`<div class="m-back"><div class="modal glass fv" role="dialog"><div class="fv-h"><h3>${esc(fl.name)}</h3><button class="nov-x" title="Fechar">×</button></div>${body}<div class="m-btns"><button class="m-btn" data-a="c">Fechar</button><button class="m-btn pri" data-a="s">Baixar</button></div></div></div>`);
 const close=()=>{m.remove();removeEventListener('keydown',k,true)};const k=e=>{if(e.key==='Escape'){e.stopPropagation();close()}};addEventListener('keydown',k,true);
 m.onclick=e=>{if(e.target===m)close()};m.querySelector('.nov-x').onclick=close;m.querySelector('[data-a=c]').onclick=close;
 m.querySelector('[data-a=s]').onclick=()=>dlBlob(new Blob([(isCsv&&!fl.text.startsWith('\ufeff')?'\ufeff':'')+fl.text],{type:(fl.mime||'text/plain')+';charset=utf-8'}),fl.name);document.body.append(m)}
async function zipOrder(fid){const f=store.folder(fid);if(!f)return;const t=$(`<div class="toast glass">Preparando .zip…</div>`);document.body.append(t);
 try{const {default:JSZip}=await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');const z=new JSZip();const base=f.name.replace(/[\\/:*?"<>|]+/g,'-');const root=z.folder(base);const used=new Set();
  const uname=n=>{let x=n,i=2;while(used.has(x)){x=n.replace(/(\.[^.]+)?$/,m=>` (${i++})${m}`)}used.add(x);return x};
  for(const fl of f.files||[])root.file(uname(fl.name),(fl.name.endsWith('.csv')&&!fl.text.startsWith('\ufeff')?'\ufeff':'')+fl.text);
  const phs=[...store.photos(fid),...(store.hist(fid)?store.photos(store.histId(fid)):[])];
  for(const p of phs){const u=await store.fullURL(p);if(!u)continue;const b=await (await fetch(u)).blob();let n=p.name||dispName(p);if(!/\.[a-z0-9]{2,5}$/i.test(n))n+=b.type==='image/png'?'.png':'.jpg';root.file(uname(n),b)}
  dlBlob(await z.generateAsync({type:'blob'}),base+'.zip')}catch(e){console.warn(e);toast('Não foi possível gerar o .zip')}finally{t.remove()}}
window.__orders={zipOrder,viewFile,parseCSV};
function techTags(p){const on=techOf(p);return TECH.filter(t=>on.includes(t.k)).map(t=>`<i class="q-tag" title="${t.n}" style="--tc:${t.c};--tf:${t.f||'#fff'}">${t.i}</i>`).join('')}

// ---------- v12: related photos (popover anchored to the photo card) ----------
const CLIP=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.4 11.1-8.9 8.9a5.5 5.5 0 0 1-7.8-7.8l8.9-8.9a3.7 3.7 0 0 1 5.2 5.2l-8.9 8.9a1.8 1.8 0 0 1-2.6-2.6l8.2-8.2"/></svg>`;
function relBtn(id){const n=store.related(id).length;return`<button class="rel${n?' has':''}${relOpen===id?' open':''}" title="Fotos relacionadas" aria-label="Fotos relacionadas">${CLIP}${n?`<span class="badge">${n}</span>`:''}</button>`}
let relOpen=null;const pop=$(`<div class="rp glass" role="dialog" aria-label="Fotos relacionadas" hidden></div>`);document.body.append(pop);
const relIn=$(`<input type="file" accept="image/*,.svg,.cdr" multiple hidden>`);document.body.append(relIn);relIn.onchange=()=>{if(relOpen)addRel(relOpen,relIn.files);relIn.value=''};
let relBusy=0;
const fileKind=f=>/\.cdr$/i.test(f.name)||/cdr|coreldraw/i.test(f.type)?'cdr':(/\.svg$/i.test(f.name)||f.type==='image/svg+xml')?'svg':f.type.startsWith('image/')?'img':null;
async function svgThumb(file){const u=URL.createObjectURL(file);try{const img=new Image();img.src=u;await img.decode();const w=img.naturalWidth||300,h=img.naturalHeight||300,k=300/Math.max(w,h);
 const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.8)}
 catch(e){return null}finally{URL.revokeObjectURL(u)}}
async function addOne(pid,f){const k=fileKind(f);if(k==='img')return store.addRelated(pid,await compress(f),f.name);return store.addRelatedFile(pid,f,k,k==='svg'?await svgThumb(f):null)}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name||'arquivo';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),10000)}
async function downloadRel(r){try{download(await store.original(r),r.name)}catch(e){console.warn(e);toast('Não foi possível baixar o arquivo')}}
function fileLightbox(r){const lb=$(`<div class="lb"><button class="x" title="Fechar">×</button>${r.thumb?`<img src="${r.thumb}" alt="">`:`<div class="lb-file">${CDR_IC}</div>`}<div class="cap">${esc(r.name||'')}</div><button class="m-btn pri lb-dl">Baixar arquivo</button></div>`);
 const close=()=>{lb.remove();document.removeEventListener('keydown',k);if(url)URL.revokeObjectURL(url)};const k=e=>{if(e.key==='Escape')close()};let url=null;
 lb.onclick=e=>{if(e.target===lb||e.target.closest('.x'))close()};lb.querySelector('.lb-dl').onclick=e=>{e.stopPropagation();downloadRel(r)};document.addEventListener('keydown',k);document.body.append(lb);
 if(r.kind==='svg')store.original(r).then(b=>{if(!lb.isConnected)return;url=URL.createObjectURL(new Blob([b],{type:'image/svg+xml'}));lb.querySelector('img').src=url}).catch(()=>{})}
const CDR_IC=`<svg viewBox="0 0 48 56"><path d="M6 2h26l12 12v38a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" fill="#1b2433" stroke="#5aa6ff" stroke-width="1.6"/><path d="M32 2v12h12" fill="none" stroke="#5aa6ff" stroke-width="1.6"/><circle cx="24" cy="30" r="9" fill="none" stroke="#3ccf6e" stroke-width="2.4"/><path d="M24 21c4 3 4 15 0 18" fill="none" stroke="#3ccf6e" stroke-width="2"/><text x="24" y="50" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="800" font-size="9" fill="#cfe0f5">CDR</text></svg>`;
async function addRel(pid,files){const list=[...files].filter(f=>fileKind(f));if(!list.length)return toast('Selecione arquivos de imagem');relBusy+=list.length;renderRel();let ok=0;
 for(const f of list){try{await addOne(pid,f);ok++}catch(e){console.warn(e)}finally{relBusy--;renderRel()}}
 toast(`${ok} foto${ok===1?'':'s'} relacionada${ok===1?'':'s'} adicionada${ok===1?'':'s'}`)}
function openRel(id){relOpen=id;pop.hidden=false;render();renderRel();paintUnseen()}
function closeRel(){if(!relOpen)return;relOpen=null;pop.hidden=true;document.querySelectorAll('.ph .rel.open').forEach(b=>b.classList.remove('open'))}
function renderRel(){if(!relOpen)return;const p=store.photo(relOpen);if(!p||!document.body.classList.contains('pastas-on')){closeRel();return}
 const rel=store.related(p.id);
 pop.innerHTML=`<div class="rp-h"><b>Fotos relacionadas</b><span class="rp-n">${rel.length}</span><button class="rp-x" title="Fechar">×</button></div>
 <div class="rp-main" title="Ver foto inicial"><img src="${store.photoURL(p)}" alt=""><div><small>Foto inicial</small><div class="rp-nm">${esc(dispName(p))}</div></div></div>
 <div class="rp-grid">${rel.map(r=>`<div class="rp-it${r.kind==='cdr'||(r.kind&&!r.thumb)?' file':''}" data-r="${r.id}" title="${esc(relName(r))}">${r.kind==='cdr'||(r.kind&&!r.thumb)?`<div class="rp-file">${CDR_IC}</div>`:`<img src="${store.photoURL(r)}" alt="">`}<div class="rp-cap">${esc(relName(r))}</div><button class="rp-del" title="Remover">×</button></div>`).join('')}
 ${Array.from({length:relBusy},()=>`<div class="rp-it busy"><span></span></div>`).join('')}
 <button class="rp-add" title="Adicionar fotos relacionadas">${PLUS}<span>Adicionar</span></button></div>
 <div class="rp-hint">${matchMedia('(pointer:coarse)').matches?'Toque em uma foto para ampliar':'Arraste imagens aqui · clique para ampliar'}</div>`;
 pop.querySelector('.rp-x').onclick=closeRel;pop.querySelector('.rp-add').onclick=()=>relIn.click();
 pop.querySelector('.rp-main').onclick=()=>lightbox(p.id);
 pop.querySelectorAll('.rp-it[data-r]').forEach(el=>{const r=store.r.get(el.dataset.r);
  el.onclick=()=>{if(editing)return;if(r.kind==='cdr'||(r.kind&&!r.thumb))downloadRel(r);else if(r.kind==='svg')fileLightbox(r);else lightbox(r)};
  el.querySelector('.rp-del').onclick=async ev=>{ev.stopPropagation();if(await modal({title:'Remover foto relacionada?',text:'Esta foto relacionada será excluída. Esta ação não pode ser desfeita.',ok:'Remover',danger:true})){await store.deleteRelated(r.id);toast('Foto relacionada removida')}}});
 placeRel()}
function placeRel(){if(!relOpen||pop.hidden)return;const b=main.querySelector(`.ph[data-photo="${relOpen}"] .rel`);
 if(matchMedia('(max-width:900px)').matches){pop.classList.add('sheet');pop.style.left=pop.style.top='';return}pop.classList.remove('sheet');
 if(!b){pop.style.left='-9999px';return}const r=b.getBoundingClientRect(),W=pop.offsetWidth,H=pop.offsetHeight;
 let x=r.right+10,y=r.top+r.height/2-46;if(x+W>innerWidth-8)x=r.left-W-140;x=Math.max(8,x);y=Math.max(62,Math.min(y,innerHeight-H-10));pop.style.left=x+'px';pop.style.top=y+'px'}
main.addEventListener('scroll',placeRel,{passive:true});addEventListener('resize',placeRel);
document.addEventListener('mousedown',e=>{if(relOpen&&!pop.contains(e.target)&&!e.target.closest('.rel,.m-back,.lb,.toast,.ctx'))closeRel()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&relOpen&&!document.querySelector('.m-back,.lb'))closeRel()});
pop.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();e.stopPropagation();pop.classList.add('filedrop')}});
pop.addEventListener('dragleave',e=>{if(!pop.contains(e.relatedTarget))pop.classList.remove('filedrop')});
pop.addEventListener('drop',e=>{pop.classList.remove('filedrop');if(relOpen&&e.dataTransfer.files.length){e.preventDefault();e.stopPropagation();addRel(relOpen,e.dataTransfer.files)}});

// ---------- v12: print queue (Firestore printQueue) — photos enter ONLY by dragging a card onto the panel ----------
let qSel=null;const qMobile=()=>matchMedia('(max-width:900px)').matches;
if(qMobile())qp.classList.add('collapsed');
const fmtD=t=>{const d=new Date(t),z=n=>String(n).padStart(2,'0');return`${z(d.getDate())}/${z(d.getMonth()+1)} ${z(d.getHours())}:${z(d.getMinutes())}`};
const baseName=n=>String(n||'Foto').replace(/\.[a-z0-9]{2,5}$/i,'');
const QST=[{k:'fila',l:'Na fila'},{k:'imprimindo',l:'Imprimindo'},{k:'impresso',l:'Impresso'}];
const qst=x=>QST.find(s=>s.k===x?.status)||QST[0];
const stBtn=x=>{const s=qst(x);return`<button type="button" class="q-st st-${s.k}" draggable="false" title="Status de impressão" aria-haspopup="listbox">${s.l}<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>`};
const stDD=$(`<div class="q-dd glass" role="listbox" hidden></div>`);document.body.append(stDD);let stFor=null;
function stClose(){stDD.hidden=true;stFor=null}
function stOpen(btn,id){if(stFor===id&&!stDD.hidden)return stClose();stFor=id;const cur=qst(store.q.get(id)).k;
 stDD.innerHTML=QST.map(s=>`<button type="button" role="option" class="q-do st-${s.k}${s.k===cur?' cur':''}" data-s="${s.k}"><i></i>${s.l}</button>`).join('');stDD.hidden=false;
 const b=btn.getBoundingClientRect(),w=stDD.offsetWidth,h=stDD.offsetHeight;let left=Math.min(b.right-w,innerWidth-w-6);left=Math.max(6,left);let top=b.bottom+4;if(top+h>innerHeight-6)top=b.top-h-4;stDD.style.left=left+'px';stDD.style.top=top+'px';
 stDD.querySelectorAll('.q-do').forEach(o=>o.onclick=async e=>{e.stopPropagation();const v=o.dataset.s;stClose();try{await store.setQueueStatus(id,v)}catch(err){console.warn(err);toast('Não foi possível alterar o status')}})}
document.addEventListener('pointerdown',e=>{if(!stDD.hidden&&!stDD.contains(e.target)&&!e.target.closest('.q-st'))stClose()},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!stDD.hidden)stClose()});
addEventListener('resize',()=>stDD.hidden||stClose());
function renderQueue(){const items=store.queueIn(cur);const sc=qp.querySelector('.q-list')?.scrollTop||0;
 qp.innerHTML=`<div class="q-head"><h2>Fila de impressão</h2><span class="q-n">${items.length} ${items.length===1?'item':'itens'}</span><span class="q-chev"></span></div>
 <div class="q-body"><div class="q-cols"><span>Nome</span><span>Status</span></div><div class="q-list">${items.map((x,i)=>{const p=store.photo(x.photoId);const f=store.folder(p.folderId);
  return`<div class="q-row${qSel===x.id?' sel':''}" draggable="true" data-q="${x.id}" title="${esc(dispName(p))}${p.note?'\n'+esc(p.note):''}"><span class="q-i">${i+1}</span><img class="q-th" loading="lazy" decoding="async" src="${store.photoURL(p)}" alt=""><div class="q-tx"><div class="q-nm">${esc(dispName(p))}</div><div class="q-sub">${techTags(p)}<span>${esc(fName(p.folderId))}</span></div><div class="q-dt">${fmtD(x.addedAt)}</div></div>${stBtn(x)}<button class="q-x" title="Remover da fila">×</button></div>`}).join('')}</div>
 <div class="q-empty${items.length?' hide':''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/></svg>Arraste fotos para cá para adicioná-las à fila${matchMedia('(pointer:coarse)').matches?' (toque e segure a foto)':''}.</div></div>`;
 qp.querySelector('.q-list').scrollTop=sc;if(stFor&&!store.q.get(stFor))stClose();
 qp.querySelector('.q-head').onclick=()=>{if(qMobile()){qp.classList.toggle('collapsed');if(!qp.classList.contains('collapsed')&&!chatEl.classList.contains('collapsed'))chatEl.classList.add('collapsed')}};
 qp.querySelectorAll('.q-row').forEach(row=>{const x=store.q.get(row.dataset.q);
  row.onclick=e=>{if(e.target.closest('.q-x,.q-st')||editing)return;qSel=qSel===x.id?null:x.id;qp.querySelectorAll('.q-row').forEach(r=>r.classList.toggle('sel',r.dataset.q===qSel))};
  row.ondblclick=()=>lightbox(x.photoId);
  const sb=row.querySelector('.q-st');sb.onclick=e=>{e.stopPropagation();if(editing)return;stOpen(sb,x.id)};sb.addEventListener('pointerdown',()=>{row.draggable=false;const r=()=>{row.draggable=true;removeEventListener('pointerup',r,true);removeEventListener('pointercancel',r,true)};addEventListener('pointerup',r,true);addEventListener('pointercancel',r,true)});
  row.querySelector('.q-x').onclick=async e=>{e.stopPropagation();await store.dequeue(x.id);toast('Removido da fila')};
  dragSource(row,{type:'q',id:x.id})})}
function qClear(){qp.classList.remove('q-hot');qp.querySelectorAll('.q-ins,.q-ins-end').forEach(x=>x.classList.remove('q-ins','q-ins-end'))}
function qBefore(y){for(const r of qp.querySelectorAll('.q-row')){const b=r.getBoundingClientRect();if(y<b.top+b.height/2)return r}return null}
function qMark(y){qClear();qp.classList.add('q-hot');const r=qBefore(y);if(r)r.classList.add('q-ins');else qp.querySelector('.q-list')?.classList.add('q-ins-end')}
async function qDrop(item,y){const before=qBefore(y);const items=store.queueIn(cur);const bi=before?items.findIndex(x=>x.id===before.dataset.q):items.length;
 const list=item.type==='q'?items.filter(x=>x.id!==item.id):items;const idx=item.type==='q'?list.findIndex(x=>x.id===before?.dataset.q):bi;const at=idx<0?list.length:idx;
 const prev=list[at-1]?.order,next=list[at]?.order;const order=prev==null&&next==null?1:prev==null?next-1:next==null?prev+1:(prev+next)/2;
 try{if(item.type==='photo'){if(store.queued(item.id))return toast('Esta foto já está na fila');await store.toQueue(item.id,order);toast('Adicionado à fila de impressão')}
  else if(item.type==='q'&&before?.dataset.q!==item.id)await store.reorderQueue(item.id,order)}catch(e){console.warn(e);toast('Não foi possível atualizar a fila')}}
qp.addEventListener('dragover',e=>{if(drag&&(drag.type==='photo'||drag.type==='q')){e.preventDefault();e.dataTransfer.dropEffect='move';qMark(e.clientY)}});
qp.addEventListener('dragleave',e=>{if(!qp.contains(e.relatedTarget))qClear()});
qp.addEventListener('drop',e=>{const d=drag;qClear();if(!d||(d.type!=='photo'&&d.type!=='q'))return;e.preventDefault();e.stopPropagation();drag=null;qDrop(d,e.clientY)});
window.__pastasQueue={qDrop};
dropTarget(main,'__here');
store.onChange(k=>{if(k==='note')return;if(editing){pendingRender=true;return}if(document.body.classList.contains('pastas-on')){render();renderQueue();renderRel();paintUnseen()}});

// ---------- tab routing (hash) ----------
function route(){const h=location.hash;const on=h.startsWith('#/pastas');document.body.classList.toggle('pastas-on',on);
 document.querySelectorAll('.ttab').forEach(t=>t.classList.toggle('sel',t.dataset.tab===(on?'pastas':'mockup')));
 if(on){cur=h.split('/')[2]||null;render();renderQueue();renderRel();paintUnseen()}else{closeRel();dispatchEvent(new Event('resize'))}}
document.querySelectorAll('.ttab').forEach(t=>t.onclick=()=>{location.hash=t.dataset.tab==='pastas'?(cur?'#/pastas/'+cur:'#/pastas'):'#/mockup'});
addEventListener('hashchange',route);route();

// ---------- v13: phones — queue drawer height for the chat offset, on-screen keyboard (visualViewport) ----------
{const de=document.documentElement;const setQ=()=>{const r=qp.getBoundingClientRect();de.style.setProperty('--qh',(getComputedStyle(qp).display==='none'?0:Math.round(r.height))+'px')};if(window.ResizeObserver)new ResizeObserver(setQ).observe(qp);setQ();store.onChange(()=>requestAnimationFrame(setQ));addEventListener('hashchange',()=>requestAnimationFrame(setQ));
 const vv=window.visualViewport;if(vv){const kb=()=>{const h=Math.max(0,innerHeight-vv.height-vv.offsetTop);const open=h>80&&matchMedia('(max-width:900px)').matches;de.style.setProperty('--kb',h+'px');document.body.classList.toggle('kb-open',open);
   if(open){const a=document.activeElement;if(a&&a.matches('textarea,input')&&!a.closest('.chat'))setTimeout(()=>a.scrollIntoView({block:'center',behavior:'smooth'}),60)}};vv.addEventListener('resize',kb,{passive:true});vv.addEventListener('scroll',kb,{passive:true})}}
