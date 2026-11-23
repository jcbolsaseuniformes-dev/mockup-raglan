// v18i: "Firestore" do PC da loja (JC Pastas Servidor). Mesmas funções que o SDK do Firestore usa no site
// (doc, collection, onSnapshot, setDoc, updateDoc, getDoc, writeBatch, runTransaction...), mas os dados ficam no PC
// e chegam aos aparelhos da rede de casa pelo próprio endereço do PC (mesma origem: http://<PC>:8090/jc-api/...).
// Nada aqui apaga de verdade: o servidor move o que é "excluído" para a lixeira do PC.
const API='/jc-api/';
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
export class Timestamp{constructor(ms){this._ms=ms;this.seconds=Math.floor(ms/1000);this.nanoseconds=(ms%1000)*1e6}toMillis(){return this._ms}toDate(){return new Date(this._ms)}valueOf(){return this._ms}}
export const serverTimestamp=()=>({__jc:'ts'});
export const deleteField=()=>({__jc:'del'});
const decode=v=>{if(Array.isArray(v))return v.map(decode);if(v&&typeof v==='object'){if(v.__jc==='t')return new Timestamp(v.ms);const o={};for(const k in v)o[k]=decode(v[k]);return o}return v};
const encode=v=>{if(v instanceof Timestamp)return{__jc:'t',ms:v._ms};if(v instanceof Date)return{__jc:'t',ms:v.getTime()};if(Array.isArray(v))return v.map(encode);if(v&&typeof v==='object'&&!v.__jc){const o={};for(const k in v)if(v[k]!==undefined)o[k]=encode(v[k]);return o}return v};
const DB={type:'jc-lan'};
export const getFirestore=()=>DB;
export const connectFirestoreEmulator=()=>{};
export function collection(db,...s){const p=s.join('/');return{type:'collection',path:p,id:p.split('/').pop()}}
export function doc(a,...s){const p=a&&a.type==='collection'?a.path+'/'+(s.length?s.join('/'):uid()):s.join('/');const ps=p.split('/');return{type:'document',path:p,id:ps[ps.length-1],parent:{type:'collection',path:ps.slice(0,-1).join('/')}}}
export const query=(c,...cons)=>({type:'query',path:c.path,cons});
export const orderBy=(f,dir='asc')=>({k:'order',f,dir});
export const limit=n=>({k:'limit',n});
export const where=(f,op,v)=>({k:'where',f,op,v});
const get=(o,f)=>f.split('.').reduce((x,k)=>x==null?x:x[k],o);
const cmp=(a,b)=>{a=a?.toMillis?a.toMillis():a;b=b?.toMillis?b.toMillis():b;return a<b?-1:a>b?1:0};
class DocSnap{constructor(path,raw,v){this.ref=doc(DB,...path.split('/'));this.id=this.ref.id;this._raw=raw;this._v=v;this.metadata={hasPendingWrites:false,fromCache:false}}exists(){return this._raw!=null}data(){return this._raw==null?undefined:decode(this._raw)}get(f){return get(this.data(),f)}}
class QSnap{constructor(docs,changes){this.docs=docs;this.size=docs.length;this.empty=!docs.length;this._ch=changes||docs.map((d,i)=>({type:'added',doc:d,oldIndex:-1,newIndex:i}))}forEach(f){this.docs.forEach(f)}docChanges(){return this._ch}}
function applyQuery(snaps,cons=[]){let a=snaps;for(const c of cons)if(c.k==='where')a=a.filter(d=>{const x=get(d.data(),c.f);return c.op==='=='?cmp(x,c.v)===0:c.op==='!='?cmp(x,c.v)!==0:c.op==='<'?cmp(x,c.v)<0:c.op==='<='?cmp(x,c.v)<=0:c.op==='>'?cmp(x,c.v)>0:c.op==='>='?cmp(x,c.v)>=0:c.op==='in'?(c.v||[]).some(y=>cmp(x,y)===0):c.op==='array-contains'?Array.isArray(x)&&x.some(y=>cmp(y,c.v)===0):true});
 const os=cons.filter(c=>c.k==='order');if(os.length)a=[...a].sort((x,y)=>{for(const o of os){const r=cmp(get(x.data(),o.f),get(y.data(),o.f));if(r)return o.dir==='desc'?-r:r}return 0});
 const l=cons.find(c=>c.k==='limit');if(l)a=a.slice(0,l.n);return a}
// ---------- conexão ----------
async function req(p,opt){const r=await fetch(API+p,{cache:'no-store',...opt});let j=null;try{j=await r.json()}catch(e){}if(!r.ok||!j||j.ok===false){const e=new Error(j?.erro||('O PC não respondeu ('+r.status+')'));e.code=j?.code||(r.status===409?'conflito':'unavailable');throw e}return j}
const S={boot:null,seq:0,cols:new Map(),docs:new Map(),busy:null,again:false,online:true,es:null,lastEv:0};
export const status={online:true,subs:new Set()};
function setOnline(v){if(status.online===v)return;status.online=v;status.subs.forEach(f=>{try{f(v)}catch(e){}})}
function colEntry(p){let e=S.cols.get(p);if(!e){e={path:p,docs:new Map(),ls:new Set(),loaded:null};S.cols.set(p,e)}return e}
function docEntry(p){let e=S.docs.get(p);if(!e){e={path:p,v:0,raw:null,ls:new Set(),loaded:null};S.docs.set(p,e)}return e}
function colSnaps(e){return[...e.docs].map(([id,x])=>new DocSnap(e.path+'/'+id,x.raw,x.v))}
function fireCol(e,changes){for(const l of e.ls){try{if(l.q){l.next(new QSnap(applyQuery(colSnaps(e),l.q)))}else l.next(new QSnap(colSnaps(e),changes))}catch(err){console.error(err)}}}
function fireDoc(e){const s=new DocSnap(e.path,e.raw,e.v);for(const l of e.ls){try{l.next(s)}catch(err){console.error(err)}}}
function noteBoot(j){if(S.boot===null){S.boot=j.boot;S.seq=j.seq}}
async function loadCol(e){const j=await req('col?path='+encodeURIComponent(e.path));noteBoot(j);
 const ch=[];const seen=new Set();for(const d of j.docs){seen.add(d.id);const o=e.docs.get(d.id);if(!o||o.v<d.v){e.docs.set(d.id,{v:d.v,raw:d.data});ch.push({type:o?'modified':'added',id:d.id})}}
 for(const id of [...e.docs.keys()])if(!seen.has(id)){e.docs.delete(id);ch.push({type:'removed',id})}return ch}
async function loadDoc(e){const j=await req('doc?path='+encodeURIComponent(e.path));noteBoot(j);const ch=j.v!==e.v||(!j.exists&&e.raw!=null);e.v=j.v;e.raw=j.exists?j.data:null;return ch}
const chObjs=(e,ch)=>ch.map(c=>{const x=e.docs.get(c.id);return{type:c.type,doc:new DocSnap(e.path+'/'+c.id,x?x.raw:null,x?x.v:0),oldIndex:-1,newIndex:-1}});
export async function sync(){if(S.busy){S.again=true;return S.busy}
 S.busy=(async()=>{do{S.again=false;try{
  const cols=[...S.cols.values()].filter(e=>e.loaded&&e.ls.size),docs=[...S.docs.values()].filter(e=>e.loaded&&e.ls.size);
  if(S.boot===null)break;
  const j=await req(`changes?since=${S.seq}&boot=${encodeURIComponent(S.boot)}&cols=${cols.map(e=>encodeURIComponent(e.path)).join(',')}&docs=${docs.map(e=>encodeURIComponent(e.path)).join(',')}`);
  if(j.reset){S.boot=j.boot;S.seq=j.seq;for(const e of cols){const ch=await loadCol(e);if(ch.length)fireCol(e,chObjs(e,ch))}for(const e of docs){if(await loadDoc(e))fireDoc(e)}}
  else{const by=new Map();for(const c of j.changes){const e=S.cols.get(c.col);if(e&&e.loaded){const o=e.docs.get(c.id);if(c.data===null){if(o){e.docs.delete(c.id);(by.get(e)||by.set(e,[]).get(e)).push({type:'removed',id:c.id,raw:o.raw,v:o.v})}}
     else if(!o||o.v<c.v){e.docs.set(c.id,{v:c.v,raw:c.data});(by.get(e)||by.set(e,[]).get(e)).push({type:o?'modified':'added',id:c.id})}}
    const d=S.docs.get(c.path);if(d&&d.loaded&&(c.data===null?d.raw!=null:d.v<c.v)){d.v=c.v;d.raw=c.data;fireDoc(d)}}
   for(const [e,ch] of by)fireCol(e,ch.map(c=>c.type==='removed'?{type:'removed',doc:new DocSnap(e.path+'/'+c.id,c.raw,c.v),oldIndex:-1,newIndex:-1}:chObjs(e,[c])[0]));S.seq=Math.max(S.seq,j.seq)}
  setOnline(true)}catch(e){setOnline(false);break}}while(S.again)})().finally(()=>{S.busy=null});return S.busy}
function startEvents(){if(S.es)return;try{const es=new EventSource(API+'eventos');S.es=es;es.onmessage=ev=>{S.lastEv=Date.now();let j;try{j=JSON.parse(ev.data)}catch(e){return}setOnline(true);if(j.boot!==S.boot||j.seq>S.seq)sync()};es.onerror=()=>{if(es.readyState===2){S.es=null;setTimeout(startEvents,3000)}}}catch(e){}}
setInterval(()=>{if(document.hidden)return;if(!S.es||S.es.readyState!==1||Date.now()-S.lastEv>40000)sync()},4000);/* rede de segurança se o SSE cair */
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
export function onSnapshot(t,next,err){startEvents();if(typeof next==='object'&&next){err=next.error;next=next.next}
 if(t.type==='document'){const e=docEntry(t.path);const l={next,err};e.ls.add(l);(e.loaded||(e.loaded=loadDoc(e))).then(()=>{if(e.ls.has(l))next(new DocSnap(e.path,e.raw,e.v))},x=>{e.loaded=null;err?.(x)});return()=>e.ls.delete(l)}
 const e=colEntry(t.path);const l={next,err,q:t.type==='query'?t.cons:null};e.ls.add(l);
 (e.loaded||(e.loaded=loadCol(e))).then(()=>{if(!e.ls.has(l))return;l.q?next(new QSnap(applyQuery(colSnaps(e),l.q))):next(new QSnap(colSnaps(e)))},x=>{e.loaded=null;err?.(x)});return()=>e.ls.delete(l)}
// ---------- escrita ----------
const CLIENT=(()=>{try{return localStorage.getItem('raglan-client-id')||''}catch(e){return''}})();
async function commitOps(ops,pre){const j=await req('commit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ops:ops.map(o=>o.data?{...o,data:encode(o.data)}:o),pre,cliente:CLIENT})});setOnline(true);await sync();return j}
export const setDoc=(ref,data,opt)=>commitOps([{op:'set',path:ref.path,data,merge:!!opt?.merge}]).then(()=>{});
export const updateDoc=(ref,data,...rest)=>{if(typeof data==='string'){const o={};const a=[data,...rest];for(let i=0;i<a.length;i+=2)o[a[i]]=a[i+1];data=o}return commitOps([{op:'update',path:ref.path,data}]).then(()=>{})};
export const deleteDoc=ref=>commitOps([{op:'delete',path:ref.path}]).then(()=>{});
export const addDoc=async(c,data)=>{const r=doc(c);await setDoc(r,data);return r};
export async function getDoc(ref){const j=await req('doc?path='+encodeURIComponent(ref.path));noteBoot(j);return new DocSnap(ref.path,j.exists?j.data:null,j.v)}
export async function getDocs(q){const j=await req('col?path='+encodeURIComponent(q.path));noteBoot(j);return new QSnap(applyQuery(j.docs.map(d=>new DocSnap(q.path+'/'+d.id,d.data,d.v)),q.cons||[]))}
export function writeBatch(){const ops=[];const b={set(r,d,o){ops.push({op:'set',path:r.path,data:d,merge:!!o?.merge});return b},update(r,d){ops.push({op:'update',path:r.path,data:d});return b},delete(r){ops.push({op:'delete',path:r.path});return b},commit:()=>ops.length?commitOps(ops).then(()=>{}):Promise.resolve()};return b}
export async function runTransaction(db,fn){for(let i=0;;i++){const reads=new Map(),ops=[];
  const tx={async get(r){const j=await req('doc?path='+encodeURIComponent(r.path));noteBoot(j);reads.set(r.path,j.v||0);return new DocSnap(r.path,j.exists?j.data:null,j.v)},set(r,d,o){ops.push({op:'set',path:r.path,data:d,merge:!!o?.merge});return tx},update(r,d){ops.push({op:'update',path:r.path,data:d});return tx},delete(r){ops.push({op:'delete',path:r.path});return tx}};
  const out=await fn(tx);if(!ops.length)return out;
  try{await commitOps(ops,[...reads].map(([path,v])=>({path,v})));return out}catch(e){if(e.code!=='conflito'||i>=5)throw e;await new Promise(r=>setTimeout(r,80*(i+1)))}}}
export async function info(){return req('info')}
