// Historique des diagnostics IA (Rank 11 brainstorm).
// Stocké en localStorage user-scoped (scopedKey "vertxia:diagnostics:<user-id>").
// Cap à 20 derniers diagnostics pour éviter de dépasser ~4MB
// (image compressée 2000px ~200 KB × 20 ≈ 4 MB, sous la limite iOS ~5 MB).

import { uuid } from "./uuid";
import { scopedKey } from "./user-scope";
import type { DiagnosticResult } from "./vision-diagnostic";

const STORAGE_KEY_BASE = "vertxia:diagnostics";
const MAX_STORED = 20;

function storageKey(): string {
  return scopedKey(STORAGE_KEY_BASE);
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export type StoredDiagnostic = {
  id: string;
  /** ISO date de création */
  createdAt: string;
  /** Data URL JPEG compressée (déjà 2000px max 80% qualité) */
  imageDataUrl: string;
  /** Note libre tapée par le technicien avant la capture (peut être vide) */
  contexteNote?: string;
  /** Résultat structuré renvoyé par /api/vision/diagnostic */
  result: DiagnosticResult;
};

export function listDiagnostics(): StoredDiagnostic[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredDiagnostic[];
    if (!Array.isArray(parsed)) return [];
    // Tri descending par date (plus récent en premier)
    return parsed.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export function saveDiagnostic(input: {
  imageDataUrl: string;
  contexteNote?: string;
  result: DiagnosticResult;
}): StoredDiagnostic {
  if (!isBrowser()) throw new Error("localStorage indisponible");
  const entry: StoredDiagnostic = {
    id: uuid(),
    createdAt: new Date().toISOString(),
    imageDataUrl: input.imageDataUrl,
    contexteNote: input.contexteNote,
    result: input.result,
  };
  const all = listDiagnostics();
  all.unshift(entry);
  // Cap FIFO : retire les plus anciens si > MAX_STORED
  const trimmed = all.slice(0, MAX_STORED);
  try {
    localStorage.setItem(storageKey(), JSON.stringify(trimmed));
  } catch (e) {
    // QuotaExceededError : on tente de retirer les 5 plus anciens et de re-save
    console.warn("[diagnostic-storage] storage full, trimming", e);
    const compact = trimmed.slice(0, Math.max(5, MAX_STORED - 5));
    try {
      localStorage.setItem(storageKey(), JSON.stringify(compact));
    } catch {
      // Tant pis, on ne sauve pas
    }
  }
  return entry;
}

export function getDiagnostic(id: string): StoredDiagnostic | null {
  return listDiagnostics().find((d) => d.id === id) ?? null;
}

export function deleteDiagnostic(id: string): void {
  if (!isBrowser()) return;
  const filtered = listDiagnostics().filter((d) => d.id !== id);
  try {
    localStorage.setItem(storageKey(), JSON.stringify(filtered));
  } catch {
    // Silencieux
  }
}

export function clearAllDiagnostics(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(storageKey());
  } catch {
    // Silencieux
  }
}
