"use client";

// Bandeau "Generer le CERFA 15498*02 (contrat assemblage / mise en service)"
// affiche sur la page intervention/nouvelle uniquement pour les types
// `mise_service` et `assemblage` (les seuls cas ou un equipement precharge
// est concerne par ce contrat — R.543-84 du Code de l'environnement).
//
// V0.5 (06/06/2026) : le pro tape un bouton, choisit la date de livraison
// (l'autre date = mise en service auto = aujourd'hui), et telecharge un PDF
// pre-rempli avec toutes les donnees Vertxia (acheteur + installateur +
// equipement). Les 2 cadres signature sont vides — signature manuelle hors
// app (impression, Adobe Sign). V1 : signature in-app comme pour le 15497.

import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { loadProfil, type Profil } from "@/lib/profil";

type Props = {
  typeIntervention: string;
  acheteur: {
    nomOuRaisonSociale: string;
    siret?: string;
    adresse?: string;
    telephone?: string;
    email?: string;
  };
  equipement: {
    modele: string;
    numeroSerie: string;
    fluideCode: string;
    fluideLabel?: string;
    chargeKg: number;
    gwp: number;
    marque?: string;
    typeMateriel?: string;
  };
  lieuInstallation?: string;
};

const TYPES_APPLICABLES = new Set(["mise_service", "assemblage"]);

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function Cerfa15498Banner({ typeIntervention, acheteur, equipement, lieuInstallation }: Props) {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [open, setOpen] = useState(false);
  const [dateLivraisonISO, setDateLivraisonISO] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProfil(loadProfil());
  }, []);

  if (!TYPES_APPLICABLES.has(typeIntervention)) return null;

  const profilIncomplet =
    !profil?.raisonSociale ||
    !profil?.siret ||
    !profil?.numeroAttestation ||
    !profil?.adresseRue;
  const equipementIncomplet = !equipement.modele || !equipement.numeroSerie || !equipement.fluideCode || !equipement.chargeKg;

  async function handleDownload() {
    if (!profil) return;
    setBusy(true);
    setError(null);
    try {
      const installateurAdresse = [profil.adresseRue, [profil.adresseCp, profil.adresseVille].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ");
      const body = {
        acheteur,
        installateur: {
          raisonSociale: profil.raisonSociale,
          siret: profil.siret,
          adresse: installateurAdresse,
          telephone: profil.telephone,
          email: profil.email,
          numeroAttestation: profil.numeroAttestation,
          categorieAttestation: profil.categorieAttestation || "",
          organismeAgree: profil.organismeAgree || "",
          dateExpirationAttestation: profil.dateExpirationAttestation || "",
        },
        equipement: {
          ...equipement,
          tCO2eq: (equipement.chargeKg * equipement.gwp) / 1000,
        },
        dateLivraisonISO,
        dateMiseEnServiceISO: todayISO(),
        lieuInstallation: lieuInstallation || acheteur.adresse,
      };
      const res = await fetch("/api/cerfa/15498", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeModele = equipement.modele.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
      a.href = url;
      a.download = `CERFA_15498-02_${safeModele}_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur reseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mx-4 mt-3 rounded-2xl p-4 ring-1 ring-violet-200 bg-violet-50/60">
        <div className="flex items-start gap-3">
          <div
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold"
            style={{ background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)" }}
            aria-hidden
          >
            📜
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono tracking-widest uppercase text-violet-700 mb-1">
              Equipement precharge ?
            </div>
            <div className="text-[14px] font-semibold text-[#111] leading-snug">
              CERFA 15498*02 — Contrat d&apos;assemblage et mise en service
            </div>
            <p className="text-[12px] text-black/65 leading-snug mt-1">
              Obligatoire (R.543-84 du Code env.) entre toi et l&apos;acheteur pour tout équipement préchargé en fluide. Vertxia te le génère pré-rempli depuis le profil + l&apos;équipement.
            </p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-3 w-full px-4 py-2.5 rounded-xl bg-violet-700 text-white text-[13px] font-semibold active:bg-violet-800 transition-colors"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              Générer le contrat 15498
            </button>
          </div>
        </div>
      </div>

      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Drawer.Content
            className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl pt-2 pb-8"
            style={{ maxHeight: "92vh" }}
          >
            <Drawer.Title className="sr-only">Générer le CERFA 15498</Drawer.Title>
            <Drawer.Description className="sr-only">
              Téléchargement du contrat d&apos;assemblage et de mise en service pré-rempli
            </Drawer.Description>
            <div className="mx-auto w-12 h-1.5 rounded-full bg-black/15 mb-3" />
            <div className="px-5 overflow-y-auto" style={{ maxHeight: "calc(92vh - 32px)" }}>
              <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-violet-700 mb-1">
                · Contrat 15498*02
              </div>
              <h2 className="text-[22px] font-bold leading-tight text-[#111]">
                Génération du contrat
              </h2>

              {profilIncomplet && (
                <div className="mt-4 px-3 py-2.5 rounded-xl bg-red-50 ring-1 ring-red-200 text-[12.5px] text-red-900 leading-snug">
                  <strong>Profil incomplet.</strong> Ton profil Vertxia doit contenir raison sociale + SIRET + n° attestation + adresse pour générer le contrat.
                  <a href="/m/profil" className="block mt-1 underline font-medium">
                    Compléter le profil →
                  </a>
                </div>
              )}

              {equipementIncomplet && !profilIncomplet && (
                <div className="mt-4 px-3 py-2.5 rounded-xl bg-amber-50 ring-1 ring-amber-200 text-[12.5px] text-amber-900 leading-snug">
                  <strong>Équipement incomplet.</strong> Renseigne le modèle, le n° de série, le fluide et la charge avant de générer le contrat.
                </div>
              )}

              {/* Récap acheteur */}
              <div className="mt-4 rounded-2xl bg-black/[0.025] px-4 py-3">
                <div className="text-[10px] font-mono tracking-widest uppercase text-black/55 mb-1">
                  Acheteur (détenteur)
                </div>
                <div className="text-[14px] font-medium text-[#111]">
                  {acheteur.nomOuRaisonSociale || "—"}
                </div>
                {acheteur.adresse && (
                  <div className="text-[12px] text-black/60 mt-0.5">{acheteur.adresse}</div>
                )}
              </div>

              {/* Récap installateur */}
              <div className="mt-2 rounded-2xl bg-black/[0.025] px-4 py-3">
                <div className="text-[10px] font-mono tracking-widest uppercase text-black/55 mb-1">
                  Installateur attesté
                </div>
                <div className="text-[14px] font-medium text-[#111]">
                  {profil?.raisonSociale || "—"}
                </div>
                <div className="text-[12px] text-black/60 mt-0.5">
                  N° {profil?.numeroAttestation || "—"} (cat. {profil?.categorieAttestation || "—"})
                </div>
              </div>

              {/* Récap équipement */}
              <div className="mt-2 rounded-2xl bg-black/[0.025] px-4 py-3">
                <div className="text-[10px] font-mono tracking-widest uppercase text-black/55 mb-1">
                  Équipement préchargé
                </div>
                <div className="text-[14px] font-medium text-[#111]">
                  {equipement.modele || "—"}
                </div>
                <div className="text-[12px] text-black/60 mt-0.5">
                  N° série {equipement.numeroSerie || "—"} · {equipement.fluideCode || "—"} · {equipement.chargeKg.toFixed(2).replace(".", ",")} kg
                </div>
              </div>

              {/* Date livraison */}
              <div className="mt-4">
                <label className="block text-[11px] font-mono tracking-widest uppercase text-black/55 mb-1.5">
                  Date de livraison de l&apos;équipement
                </label>
                <input
                  type="date"
                  value={dateLivraisonISO}
                  onChange={(e) => setDateLivraisonISO(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/[0.04] text-[15px] outline-none focus:bg-black/[0.06]"
                />
                <div className="text-[11px] text-black/45 mt-1">
                  La date de mise en service sera aujourd&apos;hui ({new Date().toLocaleDateString("fr-FR")}).
                </div>
              </div>

              {error && (
                <div className="mt-3 px-3 py-2 rounded-xl bg-red-50 ring-1 ring-red-200 text-[12px] text-red-800 leading-snug">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleDownload}
                disabled={busy || profilIncomplet || equipementIncomplet}
                className="mt-4 w-full px-4 py-3.5 rounded-2xl bg-[#111] text-white text-[15px] font-semibold active:bg-black/85 transition-colors disabled:opacity-40"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                {busy ? "Génération…" : "Télécharger le PDF pré-rempli"}
              </button>

              <p className="mt-3 text-[11px] text-black/45 leading-snug">
                Tu reçois un PDF Vertxia conforme au contenu réglementaire (R.543-84). Les 2 cadres signature sont vides — fais signer l&apos;acheteur manuellement (impression, Adobe Sign, etc.). Conserve une copie 5 ans minimum.
              </p>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
