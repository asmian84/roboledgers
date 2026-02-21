/**
 * StorageService — IndexedDB persistence with synchronous in-memory cache.
 *
 * Architecture:
 *   init()  → Opens IDB, migrates from localStorage, populates _cache
 *   get()   → SYNC read from _cache (fast, no await)
 *   set()   → SYNC _cache write + ASYNC IDB write (fire-and-forget)
 *   remove()→ SYNC _cache delete + ASYNC IDB delete
 *
 * This allows the rest of the app to keep its synchronous save/load pattern
 * while storing data in IndexedDB (virtually unlimited vs 5-10MB localStorage).
 */

const DB_NAME = 'roboledger';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const MIGRATION_FLAG = '_idb_migrated';

const StorageService = {
  _cache: {},
  _db: null,
  _ready: false,

  // ── Init: open IDB, migrate, populate cache ─────────────────────────────
  async init() {
    try {
      this._db = await this._openDB();
      const migrated = await this._idbGet(MIGRATION_FLAG);

      if (!migrated) {
        await this._migrateFromLocalStorage();
        await this._idbSet(MIGRATION_FLAG, Date.now());
        console.log('[STORAGE] Migration from localStorage → IndexedDB complete');
      }

      // Populate _cache from IDB
      await this._populateCache();
      this._ready = true;
      console.log(`[STORAGE] IndexedDB ready — ${Object.keys(this._cache).length} keys cached`);
    } catch (err) {
      console.warn('[STORAGE] IndexedDB unavailable, falling back to localStorage', err);
      this._populateCacheFromLocalStorage();
      this._ready = true;
    }
  },

  // ── SYNC get (from cache) ───────────────────────────────────────────────
  get(key) {
    if (!this._ready) {
      // Fallback before init — read localStorage directly
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      try { return JSON.parse(raw); } catch { return raw; }
    }
    const val = this._cache[key];
    return val !== undefined ? val : null;
  },

  // ── SYNC set (cache + async IDB) ───────────────────────────────────────
  set(key, value) {
    this._cache[key] = value;

    // Also write to localStorage as fallback (except large data)
    if (!this._isLargeKey(key)) {
      try {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      } catch (e) {
        // QuotaExceeded — that's why we're using IDB
        console.warn(`[STORAGE] localStorage quota exceeded for ${key}, IDB only`);
      }
    }

    // Async IDB write — fire and forget
    if (this._db) {
      this._idbSet(key, value).catch(err =>
        console.error(`[STORAGE] IDB write failed for ${key}:`, err)
      );
    }
  },

  // ── SYNC remove ─────────────────────────────────────────────────────────
  remove(key) {
    delete this._cache[key];
    localStorage.removeItem(key);

    if (this._db) {
      this._idbDelete(key).catch(err =>
        console.error(`[STORAGE] IDB delete failed for ${key}:`, err)
      );
    }
  },

  // ── List all keys ───────────────────────────────────────────────────────
  keys() {
    return Object.keys(this._cache);
  },

  // ── Clear all roboledger data ───────────────────────────────────────────
  async clearAll() {
    this._cache = {};
    // Clear localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('roboledger') || k.startsWith('rl_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Clear IDB
    if (this._db) {
      const tx = this._db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    }
    console.log('[STORAGE] All data cleared');
  },

  // ── Private: detect large keys that skip localStorage ───────────────────
  _isLargeKey(key) {
    return key.startsWith('roboledger_v5_data') ||
           key.startsWith('roboledger_files') ||
           key === 'roboledger_user_corrections' ||
           key === 'roboledger_categorization_rules';
  },

  // ── Private: open IndexedDB ─────────────────────────────────────────────
  _openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  // ── Private: IDB get ────────────────────────────────────────────────────
  _idbGet(key) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  },

  // ── Private: IDB set ────────────────────────────────────────────────────
  _idbSet(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  // ── Private: IDB delete ─────────────────────────────────────────────────
  _idbDelete(key) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  // ── Private: migrate all localStorage → IDB ────────────────────────────
  async _migrateFromLocalStorage() {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || (!key.startsWith('roboledger') && !key.startsWith('rl_'))) continue;

      const raw = localStorage.getItem(key);
      if (raw === null) continue;

      let value;
      try { value = JSON.parse(raw); } catch { value = raw; }

      await this._idbSet(key, value);
      count++;
    }
    console.log(`[STORAGE] Migrated ${count} keys from localStorage → IndexedDB`);
  },

  // ── Private: populate cache from IDB ────────────────────────────────────
  async _populateCache() {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();

      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          this._cache[cursor.key] = cursor.value;
          cursor.continue();
        }
      };

      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  // ── Private: fallback — populate cache from localStorage ────────────────
  _populateCacheFromLocalStorage() {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || (!key.startsWith('roboledger') && !key.startsWith('rl_'))) continue;
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      try { this._cache[key] = JSON.parse(raw); } catch { this._cache[key] = raw; }
    }
    console.log(`[STORAGE] Fallback: loaded ${Object.keys(this._cache).length} keys from localStorage`);
  },
};

// Export globally for non-module scripts
window.StorageService = StorageService;

export default StorageService;
