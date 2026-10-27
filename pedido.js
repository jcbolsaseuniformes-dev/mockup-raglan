// v13: client order upload (Mockup page). Loaded only when a client clicks "Salvar pedido".
// Creates a root folder {isOrder:true, source:'cliente'} + its Histórico, one photo per render / uploaded art
// (thumb on the photo doc, full file chunked in photoData/<id>_c<i>, ~700k chars per doc), and keeps pedido.csv / info.txt as text on the folder doc.
const CH=700000;
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const toDataURL=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(b)});
async function thumbOf(blob,max=300){try{const bmp=await createImageBitmap(blob);const s=Math.min(1,max/Math.max(bmp.width,bmp.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(bmp.width*s));c.height=Math.max(1,Math.round(bmp.height*s));
 c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);bmp.close?.();let u=c.toDataURL('image/webp',.82);if(!u.startsWith('data:image/webp'))u=c.toDataURL('image/png');return u}catch(e){return''}}
export async function sendOrder({company,csv,info,images,onProgress=()=>{}}){
 const cfg=window.PASTAS_CONFIG?.firebase;if(!cfg?.apiKey)throw new Error('sem configuração');
 const V=window.PASTAS_CONFIG.firebaseOptions?.sdkVersion||'10.12.2',B=`https://www.gstatic.com/firebasejs/${V}/`;
 const [{initializeApp,getApps},fs]=await Promise.all([import(B+'firebase-app.js'),import(B+'firebase-firestore.js')]);
 const app=getApps().find(a=>a.name==='pedido')||initializeApp(cfg,'pedido');const db=fs.getFirestore(app);const pre=window.PASTAS_CONFIG.firebaseOptions?.prefix||'';
 const d=(c,id)=>fs.doc(db,pre+c,id);const by='cliente-'+uid();const M=()=>({at:fs.serverTimestamp(),by});
 // unique folder name
 let name=company;const z=n=>String(n).padStart(2,'0');const now=new Date();
 try{const ex=await fs.getDocs(fs.query(fs.collection(db,pre+'folders'),fs.where('name','==',company)));if(!ex.empty)name=`${company} – ${z(now.getDate())}/${z(now.getMonth()+1)}/${now.getFullYear()} ${z(now.getHours())}:${z(now.getMinutes())}`}catch(e){}
 const fid=uid(),t0=Date.now();let done=0;const total=images.length+1;
 for(const [i,im] of images.entries()){const id=uid();const b64=await toDataURL(im.blob);const n=Math.max(1,Math.ceil(b64.length/CH));
  for(let k=0;k<n;k++)await fs.setDoc(d('photoData',id+'_c'+k),{data:b64.slice(k*CH,(k+1)*CH),part:k,of:n});
  const x={folderId:fid,name:im.name,note:'',createdAt:t0+images.length-i,thumb:await thumbOf(im.blob),chunks:n,mime:im.blob.type||'',size:im.blob.size,source:'cliente',mods:{image:M()}};
  await fs.setDoc(d('photos',id),x);onProgress(++done,total)}
 const b=fs.writeBatch(db);
 b.set(d('folders',fid),{name,parentId:null,createdAt:t0,isOrder:true,source:'cliente',company,files:[{name:'pedido.csv',mime:'text/csv',text:csv},{name:'info.txt',mime:'text/plain',text:info}],mods:{self:M()}});
 b.set(d('folders','hist_'+fid),{name:'Histórico',parentId:fid,isHistory:true,createdAt:t0+1});
 await b.commit();onProgress(++done,total);return{id:fid,name}}
