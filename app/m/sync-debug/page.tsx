"use client";

// Page de diagnostic sync multi-device.
// Affiche en clair :
//   - statut connexion + user_id + email
//   - counts local (localStorage) vs serveur (Supabase BDD)
//   - diff -> ce qui devrait etre pulle ou pushe
//   - bouton "Forcer la sync maintenant" qui clear le flag session et force
//     un hydrate complet
//
// Objectif : sans cette page, debugger pourquoi un user n'a pas ses donnees
// sur un nouveau device demande de lire les logs ou les devtools, ce qui est
// impossible pour un frigoriste non-tech. Avec cette page, en 5 secondes
// on voit "ah ton ordi n'est pas connecte" ou "il y a 12 equipements en BDD
// mais 0 en local -> resync".

import { useEffect, useState } from "react";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { listEquipements } from "@/lib/equipement/equipement";
import { listInterventions } from "@/lib/intervention/intervention-storage";
import { listDiagnostics } from "@/lib/intervention/diagnostic-storage";
import { loadProfil } from "@/lib/profil";
import { getCurrentUserId } from "@/lib/auth/user-scope";
import {
  hydrateFromSupabaseIfNeeded,
  clearHydrationFlag,
  pullProfilIfLocalEmpty,
} from "@/lib/sync/hydrate-on-login";

type ServerDebug = {
  auth: {
    connected: boolean;
    userId?: string;
    email?: string | null;
    error?: string;
  };
  counts: {
    equipements: number;
    interventions: number;
    diagnostics: number;
  };
  errors?: {
    equipements?: string | null;
    interventions?: string | null;
    diagnostics?: string | null;
    profil?: string | null;
  };
  profil: {
    exists: boolean;
    hasData: boolean;
    raisonSociale?: string | null;
    telephone?: string | null;
    email?: string | null;
    numeroAttestation?: string | null;
  };
};

type LocalSnapshot = {
  userId: string;
  equipements: number;
  interventions: number;
  diagnostics: number;
  profilFilled: boolean;
  profilRaisonSociale: string;
};

function loadLocal(): LocalSnapshot {
  const profil = loadProfil();
  return {
    userId: getCurrentUserId(),
    equipements: listEquipements().length,
    interventions: listInterventions().length,
    diagnostics: listDiagnostics().length,
    profilFilled: Boolean(
      profil.raisonSociale ||
        profil.telephone ||
        profil.email ||
        profil.numeroAttestation
    ),
    profilRaisonSociale: profil.raisonSociale ?? "",
  };
}

export default function SyncDebugPage() {
  const [local, setLocal] = useState<LocalSnapshot | null>(null);
  const [server, setServer] = useState<ServerDebug | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resyncing, setResyncing] = useState(false);
  const [resyncResult, setResyncResult] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setServerError(null);
    setLocal(loadLocal());
    try {
      const res = await fetch("/api/sync/debug", {
        method: "GET",
        headers: { "cache-control": "no-store" },
      });
      if (!res.ok) {
        setServerError(`HTTP ${res.status}`);
        setServer(null);
      } else {
        const json = (await res.json()) as ServerDebug;
        setServer(json);
      }
    } catch (e) {
      setServerError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleForceResync() {
    setResyncing(true);
    setResyncResult(null);
    try {
      clearHydrationFlag();
      await pullProfilIfLocalEmpty();
      const result = await hydrateFromSupabaseIfNeeded({ force: true });
      if (result.ok) {
        setResyncResult(
          `✓ Resync OK : ${result.equipementsAdded} équipement(s) + ${result.interventionsAdded} intervention(s) récupéré(s)`
        );
      } else {
        setResyncResult(`⚠ Resync impossible : ${result.error ?? "raison inconnue"}`);
      }
      // Refresh des affichages local/serveur après le pull
      await refresh();
    } catch (e) {
      setResyncResult(`❌ Erreur : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setResyncing(false);
    }
  }

  const authConnected = server?.auth.connected ?? false;
  const isAnon = local?.userId === "anon";

  return (
    <>
      <MobileHeader title="Diagnostic sync" largeTitle backHref="/m/profil" />

      <div className="px-5 mt-4 space-y-4 pb-32">
        {/* Bloc 1 : connexion */}
        <div
          className={`rounded-2xl p-4 ring-1 ${
            authConnected
              ? "bg-emerald-50 ring-emerald-200"
              : "bg-red-50 ring-red-200"
          }`}
        >
          <div className="text-[10px] uppercase tracking-wider font-semibold text-black/55 mb-1">
            Connexion compte
          </div>
          {loading ? (
            <div className="text-[14px] text-black/60">Chargement…</div>
          ) : authConnected ? (
            <>
              <div className="text-[15px] font-semibold text-emerald-800">
                ✓ Connecté
              </div>
              <div className="text-[12px] text-emerald-900/80 mt-1 break-all font-mono">
                {server?.auth.email ?? "(email indisponible)"}
              </div>
              <div className="text-[10px] text-emerald-900/60 mt-1 font-mono break-all">
                User ID : {server?.auth.userId}
              </div>
            </>
          ) : (
            <>
              <div className="text-[15px] font-semibold text-red-800">
                ✗ Pas connecté sur ce device
              </div>
              <div className="text-[12px] text-red-900/80 mt-1 leading-snug">
                Aucune session Vertxia active. Va sur{" "}
                <Link href="/login" className="underline">
                  /login
                </Link>{" "}
                pour te connecter avec le même compte Google que ton iPhone.
              </div>
              {server?.auth.error && (
                <div className="text-[11px] text-red-900/60 mt-1 font-mono">
                  {server.auth.error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Bloc 2 : namespace local */}
        <div className="rounded-2xl p-4 ring-1 bg-white ring-black/[0.08]">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-black/55 mb-2">
            Namespace localStorage
          </div>
          <div className="text-[12px] font-mono text-black/70 break-all">
            {local?.userId ?? "—"}
          </div>
          {isAnon && (
            <div className="mt-2 text-[12px] text-amber-700 leading-snug">
              ⚠ Tu es en mode anonyme. Les données locales ne sont pas reliées
              à ton compte — c&apos;est probablement pour ça que tu vois du vide.
            </div>
          )}
          {!isAnon && authConnected && server?.auth.userId !== local?.userId && (
            <div className="mt-2 text-[12px] text-amber-700 leading-snug">
              ⚠ Le namespace local ({local?.userId?.slice(0, 8)}…) ne correspond
              pas au compte connecté ({server?.auth.userId?.slice(0, 8)}…).
              Tu es connecté avec un compte différent que celui qui a créé les
              données locales.
            </div>
          )}
        </div>

        {/* Bloc 3 : comparaison local vs serveur */}
        <div className="rounded-2xl bg-white ring-1 ring-black/[0.08] overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.06]">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-black/55">
              Données local vs serveur
            </div>
          </div>
          <SyncRow
            label="Profil rempli"
            localVal={local?.profilFilled ? "Oui" : "Non"}
            serverVal={server?.profil.hasData ? "Oui" : "Non"}
            mismatch={Boolean(local && server && local.profilFilled !== server.profil.hasData)}
          />
          <SyncRow
            label="Équipements"
            localVal={String(local?.equipements ?? 0)}
            serverVal={String(server?.counts.equipements ?? 0)}
            mismatch={Boolean(local && server && local.equipements !== server.counts.equipements)}
          />
          <SyncRow
            label="Interventions"
            localVal={String(local?.interventions ?? 0)}
            serverVal={String(server?.counts.interventions ?? 0)}
            mismatch={Boolean(local && server && local.interventions !== server.counts.interventions)}
          />
          <SyncRow
            label="Diagnostics IA"
            localVal={String(local?.diagnostics ?? 0)}
            serverVal={String(server?.counts.diagnostics ?? 0)}
            mismatch={Boolean(local && server && local.diagnostics !== server.counts.diagnostics)}
            note={
              server?.errors?.diagnostics
                ? "(non synchronisé · table absente ou RLS)"
                : undefined
            }
          />
        </div>

        {/* Bloc 4 : action resync */}
        <div className="rounded-2xl p-4 bg-[#A16207]/[0.06] ring-1 ring-[#A16207]/30">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[#A16207] mb-1">
            Action
          </div>
          <div className="text-[14px] text-black/80 leading-relaxed mb-3">
            Si le serveur a plus de données que le local, force la
            synchronisation maintenant pour récupérer tout sur ce device.
          </div>
          <button
            type="button"
            onClick={handleForceResync}
            disabled={resyncing || !authConnected}
            className="w-full px-5 py-3 rounded-2xl bg-[#A16207] text-white text-[14px] font-medium active:bg-[#8a5206] disabled:opacity-50 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            {resyncing ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Synchronisation…
              </span>
            ) : (
              "🔄 Forcer la synchronisation maintenant"
            )}
          </button>
          {resyncResult && (
            <div className="mt-3 text-[13px] text-black/80 leading-relaxed">
              {resyncResult}
            </div>
          )}
          {!authConnected && (
            <div className="mt-2 text-[11px] text-black/55 leading-snug">
              Tu dois être connecté pour pouvoir synchroniser.
            </div>
          )}
        </div>

        {/* Bloc 5 : erreurs serveur eventuelles */}
        {serverError && (
          <div className="rounded-2xl p-4 bg-red-50 ring-1 ring-red-200">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-red-700 mb-1">
              Erreur serveur
            </div>
            <div className="text-[12px] text-red-800 font-mono break-all">
              {serverError}
            </div>
          </div>
        )}

        {server?.errors && Object.values(server.errors).some(Boolean) && (
          <div className="rounded-2xl p-4 bg-amber-50 ring-1 ring-amber-200">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-amber-800 mb-2">
              Erreurs de lecture serveur
            </div>
            <ul className="text-[11px] text-amber-900 font-mono space-y-1">
              {server.errors.equipements && <li>équipements : {server.errors.equipements}</li>}
              {server.errors.interventions && <li>interventions : {server.errors.interventions}</li>}
              {server.errors.diagnostics && <li>diagnostics : {server.errors.diagnostics}</li>}
              {server.errors.profil && <li>profil : {server.errors.profil}</li>}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

function SyncRow({
  label,
  localVal,
  serverVal,
  mismatch,
  note,
}: {
  label: string;
  localVal: string;
  serverVal: string;
  mismatch: boolean;
  note?: string;
}) {
  return (
    <div className="px-4 py-3 flex items-center justify-between border-b border-black/[0.04] last:border-0">
      <div className="text-[13px] text-black/70 min-w-0">
        {label}
        {note && (
          <span className="block text-[10px] text-black/45 mt-0.5">{note}</span>
        )}
      </div>
      <div className="flex items-center gap-3 text-[13px] font-mono shrink-0">
        <div className="text-right">
          <div className="text-[10px] text-black/45 leading-none mb-1">LOCAL</div>
          <div className={mismatch ? "text-amber-700 font-bold" : "text-black/80"}>
            {localVal}
          </div>
        </div>
        <div className={mismatch ? "text-amber-500" : "text-black/30"}>→</div>
        <div className="text-right">
          <div className="text-[10px] text-black/45 leading-none mb-1">SERVEUR</div>
          <div className={mismatch ? "text-amber-700 font-bold" : "text-black/80"}>
            {serverVal}
          </div>
        </div>
      </div>
    </div>
  );
}
