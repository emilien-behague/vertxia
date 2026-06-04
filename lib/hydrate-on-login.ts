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

  // Skip si deja fait cette session (sauf force=true depuis un bouton "Resync")
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

    // Sync profil entreprise dans les deux sens :
    //   - Si profil local non vide -> push vers Supabase (alimente bloc
    //     "Technicien referent" /eq/[id])
    //   - Si profil local VIDE mais profil en BDD -> pull pour hydrater
    //     ce device (cas : nouveau navigateur / autre device)
    try {
      const profil = loadProfil();
      const hasLocal =
        profil.raisonSociale || profil.telephone || profil.email || profil.numeroAttestation;
      if (hasLocal) {
        // saveProfil va trigger le sync automatiquement vers Supabase
        saveProfil(profil);
      } else {
        // Local vide → tenter pull depuis Supabase
        const res = await fetch("/api/public/my-profile", {
          method: "GET",
          headers: { "cache-control": "no-store" },
        });
        if (res.ok) {
          const j = (await res.json()) as {
            data: {
              raisonSociale?: string;
              telephone?: string;
              email?: string;
              numeroAttestation?: string;
            } | null;
          };
          if (j.data && (j.data.raisonSociale || j.data.numeroAttestation)) {
            saveProfil({ ...profil, ...j.data });
          }
        }
      }
    } catch (e) {
      console.warn("[hydrate] profil sync failed:", e);
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
