// Tiny IndexedDB wrapper (no dependencies). Falls back to memory if IndexedDB is unavailable.
const DB_NAME = 'outbound';
const DB_VERSION = 2;
export const STORES = ['settings', 'activities', 'scriptUsage'];
const KEYS = { settings: 'key', activities: 'id', scriptUsage: 'scriptId' };

let dbPromise = null;
let memory = null; // used when IndexedDB is not available

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexedDB'));
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { return reject(e); }
    req.onupgradeneeded = () => {
      const db = req.result;
      // v2: contacts and tasks are gone (Pipedrive is the CRM)
      for (const old of ['contacts', 'tasks']) if (db.objectStoreNames.contains(old)) db.deleteObjectStore(old);
      for (const s of STORES) {
        if (db.objectStoreNames.contains(s)) continue;
        const store = db.createObjectStore(s, { keyPath: KEYS[s] });
        if (s === 'activities') store.createIndex('timestamp', 'timestamp');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  }).catch((e) => {
    console.warn('IndexedDB unavailable, using memory store', e);
    memory = Object.fromEntries(STORES.map((s) => [s, new Map()]));
    return null;
  });
  return dbPromise;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(store, mode, fn) {
  const db = await open();
  if (!db) return fn(null, memory[store]);
  const tx = db.transaction(store, mode);
  const done = new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  const result = await fn(tx.objectStore(store), null);
  await done;
  return result;
}

export const db = {
  init: () => open(),
  get: (store, key) => run(store, 'readonly', (s, m) => (m ? m.get(key) : wrap(s.get(key)))),
  all: (store) => run(store, 'readonly', (s, m) => (m ? [...m.values()] : wrap(s.getAll()))),
  put: (store, value) => run(store, 'readwrite', (s, m) => {
    if (m) { m.set(value[KEYS[store]], value); return value; }
    return wrap(s.put(value)).then(() => value);
  }),
  putMany: (store, values) => run(store, 'readwrite', async (s, m) => {
    for (const v of values) {
      if (m) m.set(v[KEYS[store]], v);
      else s.put(v);
    }
    return values;
  }),
  del: (store, key) => run(store, 'readwrite', (s, m) => (m ? m.delete(key) : wrap(s.delete(key)))),
  delMany: (store, keys) => run(store, 'readwrite', async (s, m) => {
    for (const k of keys) { if (m) m.delete(k); else s.delete(k); }
  }),
  clear: (store) => run(store, 'readwrite', (s, m) => (m ? m.clear() : wrap(s.clear()))),
  byIndex: (store, index, value) => run(store, 'readonly', (s, m) => {
    if (m) return [...m.values()].filter((v) => v[index] === value);
    return wrap(s.index(index).getAll(value));
  }),
  async exportAll() {
    const out = { app: 'outbound', exportedAt: new Date().toISOString(), version: 1 };
    for (const s of STORES) out[s] = await db.all(s);
    return out;
  },
  async importAll(data) {
    if (!data || data.app !== 'outbound') throw new Error('Not an Outbound backup file');
    for (const s of STORES) {
      await db.clear(s);
      if (Array.isArray(data[s]) && data[s].length) await db.putMany(s, data[s]);
    }
  },
  async clearAll() { for (const s of STORES) await db.clear(s); },
};
