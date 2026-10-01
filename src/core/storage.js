function localStorageTarget() {
  try {
    return typeof globalThis !== "undefined" && globalThis.localStorage ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

export function readStorage(key, fallback = null) {
  try {
    const store = localStorageTarget();
    const value = store?.getItem(String(key));
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  try {
    const store = localStorageTarget();
    if (!store) return false;
    store.setItem(String(key), String(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key) {
  try {
    localStorageTarget()?.removeItem(String(key));
    return true;
  } catch {
    return false;
  }
}

export function readJSON(key, fallback = null) {
  const raw = readStorage(key, null);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    return writeStorage(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function openIndexedDB({ name, version, upgrade, requiredStores = [] }) {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is not available"));
  return new Promise((resolve, reject) => {
    const request = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
    request.onupgradeneeded = (event) => {
      try { upgrade?.(event.target.result, event); }
      catch (error) { request.transaction?.abort(); reject(error); }
    };
    request.onsuccess = () => {
      const db = request.result;
      const missing = requiredStores.filter((store) => !db.objectStoreNames.contains(store));
      if (missing.length) {
        db.close();
        reject(new Error("IndexedDB is missing stores: " + missing.join(", ")));
        return;
      }
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
    request.onblocked = () => console.warn("IndexedDB open blocked by another tab");
  });
}

export function idbPut(db, store, value) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(store, "readwrite");
      transaction.objectStore(store).put(value);
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = () => reject(transaction.error);
    } catch (error) { reject(error); }
  });
}

export function idbGet(db, store, key) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(store, "readonly");
      const request = transaction.objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (error) { reject(error); }
  });
}

export function idbGetAll(db, store, indexName, query) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(store, "readonly");
      const objectStore = transaction.objectStore(store);
      const request = indexName && query !== undefined
        ? objectStore.index(indexName).getAll(query)
        : objectStore.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    } catch (error) { reject(error); }
  });
}

export function idbDelete(db, store, key) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(store, "readwrite");
      transaction.objectStore(store).delete(key);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    } catch (error) { reject(error); }
  });
}
