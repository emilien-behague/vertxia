// Hydratation localStorage depuis Supabase au login sur un nouveau device.
//
// Probleme resolu : l'app stocke equipements + interventions en localStorage
// user-scoped. localStorage est PAR NAVIGATEUR, pas par compte. Donc quand
// l'user se connecte sur ordi avec le meme compte qu'au telephone, il voit
// du vide tant qu'on ne fetch pas explicitement depuis la BDD.
//
// Strategie merge :
// - Au mount du dashboard /m, on appelle hydrateFromSupabaseIfNeeded()
// - Si deja fait cette session (sessionStorage flag), skip pour pas spam le serveur
// - Sinon fetch equipements + interventions Supabase en parallele
// - Merge par ID : on ajoute les rows serveur dont l'ID n'est pas deja en local
//   (on ne touche PAS aux locaux pour ne pas ecraser des modifs offline)
// - Marque la session comme hydratee
//
// V1 : equipements + interventions uniquement.
// V2 (plus tard) : diagnostics, profil, bouteilles.

import { listEquipements } from "@/lib/equipement";
import { listInterventions } from "@/lib/intervention-storage";
import { fetchMyEquipements, fetchMyInterventions } from "@/lib/public-sync";
import { scopedKey } from "@/lib/user-scope";
import { loadProfil, saveProfil } from "@/lib/profil";
import type { StoredEquipement } from "@/lib/equipement";
import type { StoredIntervention } from "@/lib/intervention-storage";

const SESSION_FLAG = "vertxia:hydrated";
const EQUIP_KEY_BASE = "vertxia:equipements";
const INT_KEY_BASE = "vertxia:interventions";

export type HydrationResult = {
  /** True si on a tente l'hydratation (pas skip cache). */
  attempted: boolean;
  /** True si l'hydratation s'est faite sans erreur. */
  ok: boolean;
  equipementsAdded: number;
  interventionsAdded: number;
  error?: string;
};

const EMPTY: HydrationResult = {
  attempted: false,
  ok: false,
  equipementsAdded: 0,
  interventionsAdded: 0,
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export async function hydrateFromSupabaseIfNeeded(
  options: { force?: boolean } = {}
): Promise<HydrationResult> {
  if (!isBrowser()) return EMPTY;

  // PULL PROFIL : toujours tente si local vide, independamment du flag
  // de session. Le profil est leger (1 row, 4 colonnes) et critique pour
  // la generation CERFA / rapport / etiquette. Pas de cache session ici
  // → si tu te connectes sur un nouveau device, le profil arrive au mount.
  await pullProfilIfLocalEmpty();

  // Skip equipements + interventions si deja fait cette session (sauf force).
  if (!options.force && sessionStorage.getItem(SESSION_FLAG) === "done") {
    return EMPTY;
  }

  try {
    sessionStorage.setItem(SESSION_FLAG, "in-progress");

    const [serverEqs, serverInts] = await Promise.all([
      fetchMyEquipements(),
      fetchMyInterventions(),
    ]);

    let equipementsAdded = 0;
    let interventionsAdded = 0;

    // Merge equipements par ID (local prioritaire)
    if (Array.isArray(serverEqs) && serverEqs.length > 0) {
      const localEqs = listEquipements();
      const localIds = new Set(localEqs.map((e) => e.id));
      const newEqs = serverEqs.filter((e) => !localIds.has(e.id));
      if (newEqs.length > 0) {
        const merged: StoredEquipement[] = [...localEqs, ...newEqs];
        try {
          localStorage.setItem(scopedKey(EQUIP_KEY_BASE), JSON.stringify(merged));
          equipementsAdded = newEqs.length;
        } catch (e) {
          console.warn("[hydrate] write equipements failed:", e);
        }
      }
    }

    // Merge interventions par ID
    if (Array.isArray(serverInts) && serverInts.length > 0) {
      const localInts = listInterventions();
      const localIds = new Set(localInts.map((i) => i.id));
      const newInts = serverInts.filter((i) => !localIds.has(i.id));
      if (newInts.length > 0) {
        const merged: StoredIntervention[] = [...localInts, ...newInts].sort(
          (a, b) => b.createdAt.localeCompare(a.createdAt)
        );
        try {
          localStorage.setItem(scopedKey(INT_KEY_BASE), JSON.stringify(merged));
          interventionsAdded = newInts.length;
        } catch (e) {
          console.warn("[hydrate] write interventions failed:", e);
        }
      }
    }

    // Push profil entreprise vers Supabase une fois par session.
    // (Le PULL profil est gere separement par pullProfilIfLocalEmpty()
    // appele tout en haut, sans dependre du flag de session.)
    try {
      const profil = loadProfil();
      if (profil.raisonSociale || profil.telephone || profil.email || profil.numeroAttestation) {
        saveProfil(profil);
      }
    } catch (e) {
      console.warn("[hydrate] profil push failed:", e);
    }

    sessionStorage.setItem(SESSION_FLAG, "done");

    return {
      attempted: true,
      ok: true,
      equipementsAdded,
      interventionsAdded,
    };
  } catch (e) {
    sessionStorage.removeItem(SESSION_FLAG);
    return {
      attempted: true,
      ok: false,
      equipementsAdded: 0,
      interventionsAdded: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Reset le flag pour forcer une re-hydratation au prochain mount.
 *  Utile depuis un bouton "Resynchroniser" sur la page Profil. */
export function clearHydrationFlag(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(SESSION_FLAG);
}

/** Pull le profil depuis Supabase si le local est vide. Independant du
 *  flag de session : appele systematiquement au mount du dashboard pour
 *  qu'un user qui se connecte sur un nouveau navigateur recupere son
 *  profil automatiquement (raison sociale + tel + email + n° attestation
 *  + categorie + organisme + dates). Silent fail si offline / pas auth. */
export async function pullProfilIfLocalEmpty(): Promise<boolean> {
  if (!isBrowser()) return false;
  try {
    const current = loadProfil();
    if (current.raisonSociale || current.telephone || current.email || current.numeroAttestation) {
      return false; // local non vide, rien a faire
    }
    const res = await fetch("/api/public/my-profile", {
      method: "GET",
      headers: { "cache-control": "no-store" },
    });
    if (!res.ok) return false;
    const j = (await res.json()) as {
      data: {
        raisonSociale?: string;
        telephone?: string;
        email?: string;
        numeroAttestation?: string;
      } | null;
    };
    if (!j.data || (!j.data.raisonSociale && !j.data.numeroAttestation)) return false;
    saveProfil({ ...current, ...j.data });
    return true;
  } catch (e) {
    console.warn("[hydrate] pullProfilIfLocalEmpty failed:", e);
    return false;
  }
}
