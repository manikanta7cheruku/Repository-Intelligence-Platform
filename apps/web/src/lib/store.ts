import type { Report } from "@repolens/core/browser";

/** Reports live only in this browser (IndexedDB). Nothing is stored on a server. */
const DB = "rip-reports";
const STORE = "reports";

export interface StoredMeta {
  id: string;
  name: string;
  commit: string | null;
  savedAt: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export function newId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

export async function saveReport(report: Report): Promise<string> {
  const id = newId();
  await run("readwrite", (s) =>
    s.put({
      id,
      name: report.repository.name,
      commit: report.repository.commitSha,
      savedAt: new Date().toISOString(),
      report,
    }),
  );
  return id;
}

export async function loadReport(id: string): Promise<Report | null> {
  const row = (await run("readonly", (s) => s.get(id))) as { report: Report } | undefined;
  return row?.report ?? null;
}

export async function listReports(): Promise<StoredMeta[]> {
  const rows = (await run("readonly", (s) => s.getAll())) as (StoredMeta & { report: unknown })[];
  return rows
    .map(({ id, name, commit, savedAt }) => ({ id, name, commit, savedAt }))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function deleteReport(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
}

export async function clearReports(): Promise<void> {
  await run("readwrite", (s) => s.clear());
}
