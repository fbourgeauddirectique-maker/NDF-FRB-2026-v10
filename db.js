const DB_NAME = 'notes-frais-pro-v1-1';
const DB_VERSION = 1;
const STORE_DAYS = 'days';
const STORE_ADVANCES = 'advances';
const STORE_SETTINGS = 'settings';

const defaultSettings = {
  lunch: 12,
  dinner: 15,
  hotelLow: 58,
  hotelHigh: 68,
};

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_DAYS)) {
        const days = db.createObjectStore(STORE_DAYS, { keyPath: 'date' });
        days.createIndex('byDate', 'date', { unique: true });
      }
      if (!db.objectStoreNames.contains(STORE_ADVANCES)) {
        const advances = db.createObjectStore(STORE_ADVANCES, { keyPath: 'id' });
        advances.createIndex('byYearWeek', ['year', 'week'], { unique: true });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, callback) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = callback(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error('Transaction IndexedDB échouée'));
    tx.onabort = () => reject(tx.error || new Error('Transaction annulée'));
  });
}

async function getSettings() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const store = tx.objectStore(STORE_SETTINGS);
    const request = store.get('forfaits');
    request.onsuccess = () => resolve({ ...defaultSettings, ...(request.result?.values || {}) });
    request.onerror = () => reject(request.error);
  });
}

async function saveSettings(values) {
  return withStore(STORE_SETTINGS, 'readwrite', store => {
    store.put({ id: 'forfaits', values });
  });
}

async function saveDay(day) {
  return withStore(STORE_DAYS, 'readwrite', store => {
    store.put(day);
  });
}

async function getDay(date) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DAYS, 'readonly');
    const store = tx.objectStore(STORE_DAYS);
    const request = store.get(date);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function getAllDays() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DAYS, 'readonly');
    const store = tx.objectStore(STORE_DAYS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function saveAdvance(advance) {
  return withStore(STORE_ADVANCES, 'readwrite', store => {
    store.put({ ...advance, id: `${advance.year}-${String(advance.week).padStart(2, '0')}` });
  });
}

async function getAdvance(year, week) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ADVANCES, 'readonly');
    const index = tx.objectStore(STORE_ADVANCES).index('byYearWeek');
    const request = index.get([year, week]);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function getAllAdvances() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ADVANCES, 'readonly');
    const store = tx.objectStore(STORE_ADVANCES);
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result || []).sort((a, b) => `${b.year}-${b.week}`.localeCompare(`${a.year}-${a.week}`)));
    request.onerror = () => reject(request.error);
  });
}
