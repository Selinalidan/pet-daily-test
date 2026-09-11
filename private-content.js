const DB_NAME='pet-private-content-v1';
const PACK_STORE='packs';
const ASSET_STORE='assets';

function requestValue(request){
  return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}

function openDatabase(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){reject(new Error('当前浏览器不支持本机资料库。'));return;}
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(PACK_STORE))db.createObjectStore(PACK_STORE);
      if(!db.objectStoreNames.contains(ASSET_STORE))db.createObjectStore(ASSET_STORE);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

function finish(transaction){
  return new Promise((resolve,reject)=>{transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);});
}

export async function loadPrivateContent(){
  const db=await openDatabase();
  try{
    const transaction=db.transaction([PACK_STORE,ASSET_STORE],'readonly');
    const pack=await requestValue(transaction.objectStore(PACK_STORE).get('active'));
    const rows=await requestValue(transaction.objectStore(ASSET_STORE).getAll());
    await finish(transaction);
    return {pack:pack||null,assets:new Map(rows.map(row=>[row.key,row.blob]))};
  }finally{db.close();}
}

export async function savePrivateContent(pack,assets){
  const db=await openDatabase();
  try{
    const transaction=db.transaction([PACK_STORE,ASSET_STORE],'readwrite');
    const packs=transaction.objectStore(PACK_STORE),files=transaction.objectStore(ASSET_STORE);
    packs.put({...pack,installedAt:new Date().toISOString()},'active');
    files.clear();
    for(const asset of assets)files.put({key:asset.key,blob:asset.blob},asset.key);
    await finish(transaction);
  }finally{db.close();}
}

export async function clearPrivateContent(){
  const db=await openDatabase();
  try{
    const transaction=db.transaction([PACK_STORE,ASSET_STORE],'readwrite');
    transaction.objectStore(PACK_STORE).delete('active');
    transaction.objectStore(ASSET_STORE).clear();
    await finish(transaction);
  }finally{db.close();}
}
