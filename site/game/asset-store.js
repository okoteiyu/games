/** Shared in-memory startup downloads. GLB parsers consume these exact buffers,
 * so preloading does not cause a second transfer when a scene is opened. */
const records=new Map(),invalidatedUrls=new Set();
let networkRequests=0,imageLoadRequests=0,totalDownloadedBytes=0;
const absolute=url=>new URL(String(url),import.meta.url).href;
const abortError=()=>new DOMException('アセットの取得を中止しました。','AbortError');
export class AssetLoadError extends Error{
 constructor(message,{url,label,cause}={}){super(message,{cause});this.name='AssetLoadError';this.assetUrl=url||null;this.assetLabel=label||null;}
}
function assetError(error,url,label){return error instanceof AssetLoadError?error:new AssetLoadError(`${label||'アセット'}を読み込めませんでした。通信状況を確認して再試行してください。`,{url,label,cause:error});}
function notify(record){for(const listener of record.listeners)listener({loaded:record.loaded,total:record.expectedBytes||record.contentLength||0,lengthComputable:Boolean(record.expectedBytes||record.contentLength)});}
function connectAbort(signal,controller){
 const abort=()=>controller.abort(signal.reason||abortError());
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 return ()=>signal?.removeEventListener('abort',abort);
}
async function fetchBytes(record,{signal,timeoutMs=30000}={}){
 const controller=new AbortController(),disconnect=connectAbort(signal,controller);record.abort=()=>controller.abort(abortError());let timer;
 const touch=()=>{clearTimeout(timer);if(timeoutMs>0)timer=setTimeout(()=>controller.abort(new Error('アセットの受信が停止したため、取得を中止しました。')),timeoutMs);};
 try{
  touch();networkRequests++;
  const cache=invalidatedUrls.delete(record.url)?'reload':record.type==='json'?'no-cache':'force-cache';
  const response=await fetch(record.url,{cache,signal:controller.signal});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  record.contentLength=response.headers.get('Content-Encoding')?0:Number(response.headers.get('Content-Length'))||0;notify(record);touch();
  let buffer;
  if(response.body?.getReader){
   const reader=response.body.getReader(),chunks=[];let length=0;
   try{while(true){const {value,done}=await reader.read();if(done)break;touch();if(value?.byteLength){chunks.push(value);length+=value.byteLength;record.loaded=length;totalDownloadedBytes+=value.byteLength;notify(record);}}}
   finally{reader.releaseLock();}
   const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}buffer=bytes.buffer;
  }else{buffer=await response.arrayBuffer();record.loaded=buffer.byteLength;totalDownloadedBytes+=buffer.byteLength;notify(record);}
  if(controller.signal.aborted)throw controller.signal.reason||abortError();
  if(record.expectedBytes&&buffer.byteLength!==record.expectedBytes)throw new Error('アセットの受信サイズが一致しませんでした。');
  return buffer;
 }finally{clearTimeout(timer);disconnect();}
}
function loadBrowserImage(record,{signal,timeoutMs=30000}={}){
 return new Promise((resolve,reject)=>{
  const image=new Image();let settled=false,timer;imageLoadRequests++;
  const clear=()=>{clearTimeout(timer);signal?.removeEventListener('abort',aborted);image.onload=image.onerror=null;};
  const finish=(error)=>{if(settled)return;settled=true;clear();if(error){image.src='';reject(error);}else{record.loaded=record.expectedBytes;record.image=image;notify(record);resolve(null);}};
  const aborted=()=>finish(signal?.reason||abortError());record.abort=()=>finish(abortError());
  if(signal?.aborted){aborted();return;}signal?.addEventListener('abort',aborted,{once:true});
  if(timeoutMs>0)timer=setTimeout(()=>finish(new Error('画像の取得に時間がかかっています。')),timeoutMs);
  image.onerror=()=>finish(new Error('画像を読み込めませんでした。'));
  image.onload=async()=>{try{await image.decode?.();}catch{}if(!image.naturalWidth)finish(new Error('画像を読み込めませんでした。'));else finish();};
  image.src=record.url;
 });
}
function getAsset(url,{label,type='binary',bytes=0,onProgress,signal,timeoutMs=30000}={}){
 const key=absolute(url);let record=records.get(key);
 if(!record){
  record={url:key,label:label||key.split('/').at(-1),type,expectedBytes:Number(bytes)||0,contentLength:0,loaded:0,status:'pending',listeners:new Set()};records.set(key,record);
  record.promise=(async()=>{
   try{
    const buffer=record.type==='image'&&typeof Image!=='undefined'?await loadBrowserImage(record,{signal,timeoutMs}):await fetchBytes(record,{signal,timeoutMs});
    if(record.type==='json')record.json=JSON.parse(new TextDecoder().decode(buffer));
    record.buffer=buffer;record.status='fulfilled';notify(record);return buffer;
   }catch(error){record.status='rejected';if(records.get(key)===record)records.delete(key);if(record.type!=='image')invalidatedUrls.add(key);throw assetError(error,key,record.label);}
  })();
 }
 if(onProgress){record.listeners.add(onProgress);onProgress({loaded:record.loaded,total:record.expectedBytes||record.contentLength||0,lengthComputable:Boolean(record.expectedBytes||record.contentLength)});}
 return record.promise.finally(()=>{if(onProgress)record.listeners.delete(onProgress);});
}
export async function loadAssetBuffer(url,{signal,onProgress}={}){
 return getAsset(absolute(url),{type:'binary',signal,onProgress});
}
export async function loadAssetJson(url,{signal}={}){
 const key=absolute(url);await getAsset(key,{type:'json',signal});const record=records.get(key);
 if(record.json===undefined){try{record.json=JSON.parse(new TextDecoder().decode(record.buffer));}catch(error){forgetAsset(key);throw assetError(error,key,'設定ファイル');}}
 return record.json;
}
export async function loadGLTFAsset(loader,url,{onProgress,signal}={}){
 const key=absolute(url),buffer=await getAsset(key,{type:'binary',onProgress,signal});
 try{return await loader.parseAsync(buffer,new URL('.',key).href);}catch(error){forgetAsset(key);throw assetError(error,key,'3Dモデル');}
}
function validateManifest(manifest,base){
 if(!manifest||manifest.schemaVersion!==1||!Array.isArray(manifest.files))throw new Error('アセット一覧の形式が正しくありません。');
 const seen=new Set();return manifest.files.map(entry=>{
  if(!entry||typeof entry.url!=='string'||!entry.url||!Number.isFinite(entry.bytes)||entry.bytes<0||!['binary','json','image'].includes(entry.type))throw new Error('アセット一覧の項目が正しくありません。');
  const url=new URL(entry.url,base).href;if(seen.has(url))throw new Error('アセット一覧に重複があります。');seen.add(url);return {...entry,url};
 }).sort((a,b)=>(a.priority||0)-(b.priority||0));
}
export async function preloadGameAssets({onProgress=()=>{},signal,manifestUrl=new URL('./asset-manifest.json',import.meta.url),concurrency=3,timeoutMs=30000}={}){
 let files;
 try{
  onProgress({loadedBytes:0,totalBytes:0,completed:0,totalFiles:0,ratio:0,label:'アセットの一覧を確認しています…',phase:'fetching'});
  const manifestRecord={url:absolute(manifestUrl),label:'アセット一覧',type:'json',loaded:0,expectedBytes:0,listeners:new Set()};
  const buffer=await fetchBytes(manifestRecord,{signal,timeoutMs});const manifest=JSON.parse(new TextDecoder().decode(buffer));files=validateManifest(manifest,manifestRecord.url);
 }catch(error){throw assetError(error,absolute(manifestUrl),'アセット一覧');}
 const totalBytes=files.reduce((sum,file)=>sum+file.bytes,0),controller=new AbortController(),disconnect=connectAbort(signal,controller);let cursor=0,firstError=null;
 const progress=(label,complete=false)=>{
  const completed=files.reduce((sum,file)=>sum+(records.get(file.url)?.status==='fulfilled'?1:0),0);
  const loadedBytes=files.reduce((sum,file)=>sum+Math.min(file.bytes,records.get(file.url)?.loaded||0),0);
  const detail={loadedBytes,totalBytes,completed,totalFiles:files.length,ratio:totalBytes?Math.min(1,loadedBytes/totalBytes):completed===files.length?1:0,label:label||'アセットを取得しています…',phase:complete?'complete':'fetching'};onProgress(detail);return detail;
 };
 progress();
 const worker=async()=>{while(cursor<files.length&&!controller.signal.aborted){const file=files[cursor++];try{await getAsset(file.url,{label:file.label,type:file.type,bytes:file.bytes,signal:controller.signal,timeoutMs,onProgress:()=>progress(file.label)});}catch(error){if(!firstError){firstError=error;controller.abort(error);}return;}}};
 try{
  await Promise.all(Array.from({length:Math.min(files.length,Math.max(1,Math.floor(concurrency)||1))},worker));
  if(firstError)throw firstError;if(controller.signal.aborted)throw controller.signal.reason||abortError();
  return progress('アセットの取得が完了しました。',true);
 }finally{disconnect();}
}
export function forgetAsset(url){const key=absolute(url),record=records.get(key);if(record?.status==='pending')record.abort?.();records.delete(key);invalidatedUrls.add(key);}
export function clearAssetStore(){for(const record of records.values())if(record.status==='pending')record.abort?.();records.clear();invalidatedUrls.clear();networkRequests=0;imageLoadRequests=0;totalDownloadedBytes=0;}
export function getAssetStoreDiagnostics(){return {cachedAssetCount:[...records.values()].filter(r=>r.status==='fulfilled').length,inFlightCount:[...records.values()].filter(r=>r.status==='pending').length,networkRequests,imageLoadRequests,totalDownloadedBytes,entries:[...records.values()].map(r=>({url:r.url,type:r.type,bytes:r.loaded,status:r.status}))};}
