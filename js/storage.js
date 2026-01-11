
const DB_NAME='facturation_db';
const DB_VERSION=1;
function openDb(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const db=r.result;db.createObjectStore('files');db.createObjectStore('state')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function saveState(s){const db=await openDb();const tx=db.transaction('state','readwrite');tx.objectStore('state').put(s,'current')}
async function loadState(){const db=await openDb();return new Promise(ok=>{const tx=db.transaction('state','readonly');const r=tx.objectStore('state').get('current');r.onsuccess=()=>ok(r.result)})}
