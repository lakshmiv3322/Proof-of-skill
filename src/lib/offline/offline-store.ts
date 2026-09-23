// ─────────────────────────────────────────────────────────────
// src/lib/offline/offline-store.ts
// Lightweight IndexedDB persistence layer for offline resilience.
//
// When Supabase is unreachable (network failure, missing env vars),
// scoring results are queued here so the user never loses their
// assessment data. The UI shows an `isOfflineScore` indicator.
//
// Schema: DB = "proofofskill_v1", Store = "offline_submissions"
// ─────────────────────────────────────────────────────────────

export interface OfflineSubmission {
  id: string;                  // client-generated UUID
  submittedAt: string;         // ISO-8601
  traineeId: string;
  instituteId: string;
  tradeId: string;
  rubricId: string;
  overallScore: number;
  criteriaScores: Record<string, number>;
  feedback: string;            // JSON-serialised FullFeedback
  landmarkCount: number;
  isOfflineScore: true;
  syncedAt: string | null;     // null until Supabase ack
}

const DB_NAME    = 'proofofskill_v1';
const STORE_NAME = 'offline_submissions';
const DB_VERSION = 1;

// ── Open / init DB ────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('traineeId',   'traineeId',   { unique: false });
        store.createIndex('syncedAt',    'syncedAt',    { unique: false });
        store.createIndex('submittedAt', 'submittedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Save a submission result offline ─────────────────────────

export async function saveOfflineSubmission(sub: OfflineSubmission): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.put(sub);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch (e) {
    // If IndexedDB is unavailable (e.g. private browsing on some browsers),
    // fall back to localStorage — last resort.
    try {
      const existing = JSON.parse(localStorage.getItem('pos_offline_queue') ?? '[]') as OfflineSubmission[];
      existing.push(sub);
      localStorage.setItem('pos_offline_queue', JSON.stringify(existing));
    } catch {
      console.warn('[OfflineStore] All local storage mechanisms failed:', e);
    }
  }
}

// ── Get all unsynced submissions for a trainee ────────────────

export async function getOfflineSubmissions(traineeId: string): Promise<OfflineSubmission[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const idx   = store.index('traineeId');
      const req   = idx.getAll(traineeId);
      req.onsuccess = () => resolve((req.result ?? []) as OfflineSubmission[]);
      req.onerror   = () => reject(req.error);
    });
  } catch {
    // LocalStorage fallback read
    try {
      const all = JSON.parse(localStorage.getItem('pos_offline_queue') ?? '[]') as OfflineSubmission[];
      return all.filter((s) => s.traineeId === traineeId);
    } catch {
      return [];
    }
  }
}

// ── Mark a submission as synced after Supabase ack ───────────

export async function markSynced(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result as OfflineSubmission | undefined;
        if (!record) { resolve(); return; }
        record.syncedAt = new Date().toISOString();
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve();
        putReq.onerror   = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch {
    // Best-effort — not critical
  }
}

// ── Count unsynced queue length ───────────────────────────────

export async function countUnsyncedQueue(): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const idx   = store.index('syncedAt');
      const req   = idx.count(IDBKeyRange.only(null));
      req.onsuccess = () => resolve(req.result ?? 0);
      req.onerror   = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}
