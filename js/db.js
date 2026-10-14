// Lokale opslag in IndexedDB (blijft op de telefoon, kan ook foto's bewaren).
// Alle tabellen worden nu al aangemaakt, zodat latere fases geen migratie nodig hebben.

const DB_NAME = 'compose';
const DB_VERSION = 1;

export const STORES = [
  'pieces',           // kledingstukken (heb ik / wil ik)
  'outfits',          // samengestelde outfits
  'board',            // moodboard-items
  'wishes',           // wishlist (alle categorieën)
  'budgetCategories', // budgetcategorieën met maandbedrag
  'expenses',         // uitgaven
  'images',           // foto's als Blob: { id, blob }
  'settings',         // losse instellingen: { id, value }
];

let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function run(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    let result;
    if (req) req.onsuccess = () => { result = req.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const db = {
  get: (store, id) => run(store, 'readonly', (s) => s.get(id)),
  all: (store) => run(store, 'readonly', (s) => s.getAll()),
  count: (store) => run(store, 'readonly', (s) => s.count()),
  put: (store, value) => run(store, 'readwrite', (s) => s.put(value)),
  del: (store, id) => run(store, 'readwrite', (s) => s.delete(id)),
};

export async function getSetting(id, fallback = null) {
  const rec = await db.get('settings', id);
  return rec ? rec.value : fallback;
}

export function setSetting(id, value) {
  return db.put('settings', { id, value });
}

export async function dumpAll() {
  const out = {};
  for (const name of STORES) out[name] = await db.all(name);
  return out;
}

// Vervangt álle gegevens in één transactie (voor het terugzetten van een back-up).
export async function replaceAll(data) {
  const conn = await open();
  return new Promise((resolve, reject) => {
    const t = conn.transaction(STORES, 'readwrite');
    for (const name of STORES) {
      const s = t.objectStore(name);
      s.clear();
      for (const rec of data[name] || []) s.put(rec);
    }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
