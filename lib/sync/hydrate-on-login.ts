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

import { listEquipements } from "@/lib/equipement/equipement";
import { listInterventions } from "@/lib/intervention/intervention-storage";
import { fetchMyEquipements, fetchMyInterventions } from "@/lib/sync/public-sync";
import { scopedKey } from "@/lib/auth/user-scope";
import { loadProfil, saveProfil } from "@/lib/profil";
import type { StoredEquipement } from "@/lib/equipement/equipement";
import type { StoredIntervention } from "@/lib/intervention/intervention-storage";

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

  // SYNC PROFIL bidirectionnel, decouple du SESSION_FLAG :
  //   - pullProfilIfLocalEmpty : si local vide -> pull depuis Supabase
  //   - pushProfilIfLocalNotEmpty : si local rempli -> push vers Supabase
  // Les deux sont legers (1 row, ~12 colonnes) et idempotents (onConflict:
  // user_id). Pas de cache de session : a chaque ouverture de /m, le profil
  // est resynchronise dans le bon sens. Critique pour multi-device :
  // l'iPhone qui ajoute un n° d'attestation pousse aussitot vers Supabase
  // au prochain mount, et l'ordi qui n'a rien pull le pousse en local.
  await pullProfilIfLocalEmpty();
  await pushProfilIfLocalNotEmpty();

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

    // Le sync profil (push + pull) est gere par pullProfilIfLocalEmpty +
    // pushProfilIfLocalNotEmpty appeles tout en haut, decouples du flag.

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

/** Type du payload retourne par /api/public/my-profile — aligne sur tous
 *  les champs supportes par la table profils. */
type ServerProfilPayload = {
  raisonSociale?: string;
  siret?: string;
  adresseRue?: string;
  adresseCp?: string;
  adresseVille?: string;
  telephone?: string;
  email?: string;
  categorieAttestation?: string;
  numeroAttestation?: string;
  immatriculationVehicule?: string;
  signatureDataUrl?: string;
  logoDataUrl?: string;
};

/** Pull le profil depuis Supabase si le local est vide. Independant du
 *  flag de session : appele systematiquement au mount du dashboard pour
 *  qu'un user qui se connecte sur un nouveau navigateur recupere son
 *  profil automatiquement (TOUS les champs : raison sociale, SIRET,
 *  adresse, attestation, signature, logo, immatriculation vehicule).
 *  Silent fail si offline / pas auth. */
export async function pullProfilIfLocalEmpty(): Promise<boolean> {
  if (!isBrowser()) return false;
  try {
    const current = loadProfil();
    if (
      current.raisonSociale ||
      current.telephone ||
      current.email ||
      current.numeroAttestation ||
      current.siret ||
      current.signatureDataUrl
    ) {
      return false; // local non vide, rien a faire
    }
    const res = await fetch("/api/public/my-profile", {
      method: "GET",
      headers: { "cache-control": "no-store" },
    });
    if (!res.ok) return false;
    const j = (await res.json()) as { data: ServerProfilPayload | null };
    if (!j.data) return false;
    const hasAny =
      j.data.raisonSociale ||
      j.data.numeroAttestation ||
      j.data.siret ||
      j.data.telephone ||
      j.data.signatureDataUrl;
    if (!hasAny) return false;
    // Merge tous les champs serveur dans le profil local. Cast force
    // necessaire car le serveur renvoie categorieAttestation en string
    // generique alors que le type Profil l'attend en union litterale
    // ("" | "I" | ... | "V"). Si la valeur serveur n'est pas dans l'union,
    // le saveProfil l'acceptera quand meme (juste affichage UI moins
    // strict ensuite).
    saveProfil({ ...current, ...j.data } as Parameters<typeof saveProfil>[0]);
    return true;
  } catch (e) {
    console.warn("[hydrate] pullProfilIfLocalEmpty failed:", e);
    return false;
  }
}

/** Push le profil local vers Supabase si non vide. Independant du flag de
 *  session : appele systematiquement au mount du dashboard pour que les
 *  modifs profil iPhone remontent aussitot en BDD et soient pull-ables
 *  sur d'autres devices. Idempotent grace a onConflict:user_id cote BDD. */
export async function pushProfilIfLocalNotEmpty(): Promise<boolean> {
  if (!isBrowser()) return false;
  try {
    const current = loadProfil();
    const hasAny =
      current.raisonSociale ||
      current.telephone ||
      current.email ||
      current.numeroAttestation ||
      current.siret ||
      current.signatureDataUrl;
    if (!hasAny) return false;
    // saveProfil declenche le push via syncProfilToSupabase en background.
    // On le rappelle ici pour forcer le push meme si l'utilisateur n'a pas
    // re-clique "Enregistrer" depuis le dernier deploy.
    saveProfil(current);
    return true;
  } catch (e) {
    console.warn("[hydrate] pushProfilIfLocalNotEmpty failed:", e);
    return false;
  }
}
