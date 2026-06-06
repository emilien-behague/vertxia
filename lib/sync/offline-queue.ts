// Queue IndexedDB minimale pour les opérations API qui plantent en offline.
// Quand une API call échoue parce qu'il n'y a pas de réseau, on enqueue l'opération
// et on la rejoue automatiquement dès que `navigator.onLine` repasse à true.
//
// Use cases prévus :
//  - POST /api/bsff/create (signature BSFF TrackDéchets)
//  - POST /api/vision/plaque (scan plaque IA)
//  - POST /api/transcribe (Whisper voix, V1.5)
//
// V1 simple : on stocke les payloads dans IndexedDB, sync au retour de connexion.
// V2 : gestion des conflits, déduplication, retry exponentiel, batch sync.

const DB_NAME = "vertxia-offline";
const DB_VERSION = 1;
const STORE = "queue";

export type QueuedOperation = {
  id: string;
  endpoint: string;
  method: "POST" | "PUT" | "DELETE";
  body: unknown;
  createdAt: string;
  retries: number;
  lastError?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponible"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function enqueueOperation(
  endpoint: string,
  method: "POST" | "PUT" | "DELETE",
  body: unknown
): Promise<QueuedOperation> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const op: QueuedOperation = {
      id: uuid(),
      endpoint,
      method,
      body,
      createdAt: new Date().toISOString(),
      retries: 0,
    };
    const req = tx.objectStore(STORE).add(op);
    req.onsuccess = () => resolve(op);
    req.onerror = () => reject(req.error);
  });
}

export async function listPendingOperations(): Promise<QueuedOperation[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as QueuedOperation[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function countPendingOperations(): Promise<number> {
  try {
    const ops = await listPendingOperations();
    return ops.length;
  } catch {
    return 0;
  }
}

async function deleteOperation(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function updateOperation(op: QueuedOperation): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(op);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Rejoue toutes les opérations en attente. Appelé automatiquement au retour de
 * connexion (event "online") + au mount initial de l'app. Retourne le nombre
 * d'opérations synchronisées avec succès.
 */
export async function flushQueue(): Promise<{ succeeded: number; failed: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { succeeded: 0, failed: 0 };
  }
  const ops = await listPendingOperations();
  let succeeded = 0;
  let failed = 0;

  for (const op of ops) {
    try {
      const response = await fetch(op.endpoint, {
        method: op.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(op.body),
      });
      if (response.ok) {
        await deleteOperation(op.id);
        succeeded++;
      } else {
        op.retries += 1;
        op.lastError = `HTTP ${response.status}`;
        await updateOperation(op);
        failed++;
      }
    } catch (e) {
      op.retries += 1;
      op.lastError = e instanceof Error ? e.message : String(e);
      await updateOperation(op);
      failed++;
    }
  }

  return { succeeded, failed };
}

/**
 * Wrapper smart : tente l'API en direct, et en cas d'échec (offline ou réseau pourri)
 * enqueue l'opération automatiquement. Retourne `{ status: "sent" | "queued" }`.
 */
export async function sendOrQueue(
  endpoint: string,
  method: "POST" | "PUT" | "DELETE",
  body: unknown
): Promise<{ status: "sent" | "queued"; data?: unknown; error?: string }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueOperation(endpoint, method, body);
    return { status: "queued" };
  }
  try {
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      await enqueueOperation(endpoint, method, body);
      return { status: "queued", error: `HTTP ${response.status}` };
    }
    const data = await response.json().catch(() => null);
    return { status: "sent", data };
  } catch (e) {
    await enqueueOperation(endpoint, method, body);
    return { status: "queued", error: e instanceof Error ? e.message : String(e) };
  }
}
