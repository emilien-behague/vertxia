"use client";

// /m/profil/tarification — configuration tarification complete du pro.
//
// Validation terrain (climaticien, 06/06/2026) : chaque pro a SES prix,
// son perimetre, son materiel. Vertxia ne fixe pas de prix, il MULTIPLIE
// ce que le pro configure ici.
//
// Sections :
// - Main d'oeuvre (horaire / journalier)
// - Deplacement (forfait OU au km + perimetre departemental + majoration)
// - Materiel d'acces (echelle / nacelle 3-7m / nacelle >7m / sous-traitance)
// - Marge pieces (multiplicateur)
// - TVA defaut (10 ou 20%)
//
// Tout est enregistre dans profil.tarification (localStorage) et resolveTarification()
// est utilise par lib/devis.ts pour generer les devis avec SES valeurs.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileHeader } from "@/components/mobile/ui/mobile-header";
import { InsetListSection } from "@/components/mobile/ui/inset-list";
import {
  loadProfil,
  saveProfil,
  EMPTY_TARIFICATION,
  type TarificationProfil,
} from "@/lib/profil";

// ─── Form helpers ─────────────────────────────────────────────────────────
function FormRow({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 border-b border-black/[0.04] last:border-b-0">
      <label className="block text-[12px] font-medium text-black/55 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
      {help && <p className="mt-1.5 text-[11.5px] text-black/45 leading-snug">{help}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="px-4 py-3 border-b border-black/[0.04] last:border-b-0 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-[#111]">{label}</div>
        {help && <p className="text-[11.5px] text-black/45 leading-snug mt-0.5">{help}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`shrink-0 w-12 h-7 rounded-full transition-colors relative ${
          checked ? "bg-emerald-500" : "bg-black/15"
        }`}
        style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        aria-pressed={checked}
        aria-label={label}
      >
        <span
          className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

// Parse "31, 82,65 \n 09" → ["31","82","65","09"], deduped, only valid 2-digit codes
function parseDeptCodes(raw: string): string[] {
  const tokens = raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  const set = new Set<string>();
  for (const t of tokens) {
    if (/^\d{2,3}$/.test(t)) set.add(t);
  }
  return Array.from(set);
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function TarificationPage() {
  const router = useRouter();
  const [tarif, setTarif] = useState<TarificationProfil>(EMPTY_TARIFICATION);
  const [deptInput, setDeptInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const p = loadProfil();
    const t = p.tarification ?? EMPTY_TARIFICATION;
    // Si pas de tarification mais legacy tauxHoraireDevisHT, on l'injecte.
    if (!p.tarification && p.tauxHoraireDevisHT && p.tauxHoraireDevisHT > 0) {
      setTarif({ ...t, tauxHoraireHT: p.tauxHoraireDevisHT });
    } else {
      setTarif(t);
    }
    setDeptInput((t.departementsPerimetre ?? []).join(", "));
    setLoaded(true);
  }, []);

  function update<K extends keyof TarificationProfil>(key: K, value: TarificationProfil[K]) {
    setTarif((prev) => ({ ...prev, [key]: value }));
  }

  function setAcces<K extends keyof TarificationProfil["acces"]>(
    key: K,
    value: TarificationProfil["acces"][K]
  ) {
    setTarif((prev) => ({ ...prev, acces: { ...prev.acces, [key]: value } }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = loadProfil();
    const cleanedDepts = parseDeptCodes(deptInput);
    const next: TarificationProfil = {
      ...tarif,
      departementsPerimetre: cleanedDepts.length > 0 ? cleanedDepts : undefined,
    };
    saveProfil({
      ...p,
      tarification: next,
      // On synchronise aussi le legacy pour compat avec le code existant
      tauxHoraireDevisHT: next.tauxHoraireHT,
    });
    setTarif(next);
    setDeptInput(cleanedDepts.join(", "));
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  }

  if (!loaded) {
    return (
      <main className="min-h-screen bg-[#fafaf8]">
        <MobileHeader title="Tarification" backHref="/m/profil" />
        <div className="px-4 py-10 text-center text-black/45 text-[13px]">Chargement…</div>
      </main>
    );
  }

  const isForfait = tarif.deplacement.mode === "forfait";

  return (
    <main className="min-h-screen bg-[#fafaf8] pb-20">
      <MobileHeader title="Tarification" backHref="/m/profil" />

      <form onSubmit={handleSubmit} className="pt-4">
        {/* ─── Main d'oeuvre ─────────────────────────────────── */}
        <InsetListSection
          title="Main d'œuvre"
          footer="Valeurs typiques frigoriste FR 2026 : 55 à 95 €/h HT selon zone et expérience."
        >
          <FormRow
            label="Taux horaire HT (€/h)"
            help="Tarif facturé pour 1h d'intervention sur site."
          >
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              value={tarif.tauxHoraireHT}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                update("tauxHoraireHT", !isNaN(v) && v > 0 ? v : 0);
              }}
              placeholder="65"
              className="input-mobile"
            />
          </FormRow>
          <FormRow
            label="Taux journalier HT (€/jour) — optionnel"
            help="Si vous facturez aussi à la journée pour les chantiers longs (installation, gros entretien)."
          >
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="10"
              value={tarif.tauxJournalierHT ?? ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                update("tauxJournalierHT", !isNaN(v) && v > 0 ? v : undefined);
              }}
              placeholder="ex : 480"
              className="input-mobile"
            />
          </FormRow>
        </InsetListSection>

        {/* ─── Déplacement ──────────────────────────────────── */}
        <InsetListSection
          title="Frais de déplacement"
          footer="Choisissez la méthode que vous appliquez réellement : forfait fixe (le plus simple) ou tarification au kilomètre (plus juste pour les longues distances)."
        >
          {/* Toggle mode */}
          <div className="px-4 py-3 border-b border-black/[0.04]">
            <div className="text-[12px] font-medium text-black/55 uppercase tracking-wide mb-2">
              Méthode
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  update("deplacement", {
                    mode: "forfait",
                    forfaitHT:
                      tarif.deplacement.mode === "forfait" ? tarif.deplacement.forfaitHT : 60,
                  })
                }
                className={`flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                  isForfait
                    ? "bg-emerald-600 text-white"
                    : "bg-black/[0.04] text-black/65 active:bg-black/[0.08]"
                }`}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                Forfait fixe
              </button>
              <button
                type="button"
                onClick={() =>
                  update("deplacement", {
                    mode: "km",
                    prixKmHT: tarif.deplacement.mode === "km" ? tarif.deplacement.prixKmHT : 0.65,
                    perimetreOffertKm:
                      tarif.deplacement.mode === "km"
                        ? tarif.deplacement.perimetreOffertKm
                        : undefined,
                    majorationHorsPerimetrePct:
                      tarif.deplacement.mode === "km"
                        ? tarif.deplacement.majorationHorsPerimetrePct
                        : undefined,
                  })
                }
                className={`flex-1 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                  !isForfait
                    ? "bg-emerald-600 text-white"
                    : "bg-black/[0.04] text-black/65 active:bg-black/[0.08]"
                }`}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                Au km
              </button>
            </div>
          </div>

          {isForfait && tarif.deplacement.mode === "forfait" && (
            <FormRow label="Forfait déplacement HT (€)" help="Appliqué à chaque intervention, peu importe la distance.">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="5"
                value={tarif.deplacement.forfaitHT}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  update("deplacement", {
                    mode: "forfait",
                    forfaitHT: !isNaN(v) && v >= 0 ? v : 0,
                  });
                }}
                placeholder="60"
                className="input-mobile"
              />
            </FormRow>
          )}

          {!isForfait && tarif.deplacement.mode === "km" && (
            <>
              <FormRow label="Prix au km HT (€/km)" help="Multiplié par la distance aller-retour calculée depuis votre adresse.">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.05"
                  value={tarif.deplacement.prixKmHT}
                  onChange={(e) => {
                    if (tarif.deplacement.mode !== "km") return;
                    const v = parseFloat(e.target.value);
                    update("deplacement", {
                      ...tarif.deplacement,
                      prixKmHT: !isNaN(v) && v >= 0 ? v : 0,
                    });
                  }}
                  placeholder="0.65"
                  className="input-mobile"
                />
              </FormRow>
              <FormRow
                label="Périmètre offert (km) — optionnel"
                help="Distance aller-retour inclus dans le forfait intervention. Au-delà, on facture le delta en km."
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="5"
                  value={tarif.deplacement.perimetreOffertKm ?? ""}
                  onChange={(e) => {
                    if (tarif.deplacement.mode !== "km") return;
                    const v = parseInt(e.target.value, 10);
                    update("deplacement", {
                      ...tarif.deplacement,
                      perimetreOffertKm: !isNaN(v) && v > 0 ? v : undefined,
                    });
                  }}
                  placeholder="ex : 30"
                  className="input-mobile"
                />
              </FormRow>
              <FormRow
                label="Majoration hors périmètre départemental (%)"
                help="Si client hors de vos départements (section ci-dessous) : majoration % appliquée au total HT. Laisser vide pour pas de majoration."
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="100"
                  step="5"
                  value={tarif.deplacement.majorationHorsPerimetrePct ?? ""}
                  onChange={(e) => {
                    if (tarif.deplacement.mode !== "km") return;
                    const v = parseInt(e.target.value, 10);
                    update("deplacement", {
                      ...tarif.deplacement,
                      majorationHorsPerimetrePct: !isNaN(v) && v > 0 ? v : undefined,
                    });
                  }}
                  placeholder="ex : 30"
                  className="input-mobile"
                />
              </FormRow>
            </>
          )}
        </InsetListSection>

        {/* ─── Périmètre départemental ─────────────────────── */}
        <InsetListSection
          title="Périmètre départemental"
          footer="Liste des départements où vous intervenez habituellement (codes 2 chiffres). Utilisé pour déclencher la majoration hors périmètre."
        >
          <FormRow label="Codes département (séparés par virgules)" help="Ex : 31, 82, 65, 09, 11">
            <input
              type="text"
              value={deptInput}
              onChange={(e) => setDeptInput(e.target.value)}
              placeholder="31, 82, 65"
              className="input-mobile font-mono"
            />
          </FormRow>
        </InsetListSection>

        {/* ─── Matériel d'accès ────────────────────────────── */}
        <InsetListSection
          title="Matériel d'accès"
          footer="Activez seulement le matériel que vous utilisez ou louez. Le prix journalier sera ajouté en ligne séparée dans les devis quand vous le sélectionnerez sur l'intervention."
        >
          <ToggleRow
            label="Échelle incluse dans la main d'œuvre"
            help="Pas de ligne séparée — coût absorbé dans le taux horaire (recommandé)."
            checked={tarif.acces.echelleInclusMO}
            onChange={(v) => setAcces("echelleInclusMO", v)}
          />

          <ToggleRow
            label="Nacelle articulée 3-7m"
            help="Typique extérieur niveau 1, comble bas."
            checked={tarif.acces.nacelle3a7m.active}
            onChange={(v) =>
              setAcces("nacelle3a7m", { ...tarif.acces.nacelle3a7m, active: v })
            }
          />
          {tarif.acces.nacelle3a7m.active && (
            <FormRow label="Prix journalier nacelle 3-7m HT (€)">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="10"
                value={tarif.acces.nacelle3a7m.prixJourHT}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setAcces("nacelle3a7m", {
                    ...tarif.acces.nacelle3a7m,
                    prixJourHT: !isNaN(v) && v > 0 ? v : 0,
                  });
                }}
                placeholder="150"
                className="input-mobile"
              />
            </FormRow>
          )}

          <ToggleRow
            label="Nacelle télescopique > 7m"
            help="Toiture, équipement haut, climatisation industrielle."
            checked={tarif.acces.nacelle7mPlus.active}
            onChange={(v) =>
              setAcces("nacelle7mPlus", { ...tarif.acces.nacelle7mPlus, active: v })
            }
          />
          {tarif.acces.nacelle7mPlus.active && (
            <FormRow label="Prix journalier nacelle > 7m HT (€)">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="10"
                value={tarif.acces.nacelle7mPlus.prixJourHT}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setAcces("nacelle7mPlus", {
                    ...tarif.acces.nacelle7mPlus,
                    prixJourHT: !isNaN(v) && v > 0 ? v : 0,
                  });
                }}
                placeholder="280"
                className="input-mobile"
              />
            </FormRow>
          )}

          <ToggleRow
            label="Sous-traitance nacelle externe"
            help="Si vous louez nacelle + chauffeur en sous-traitance."
            checked={tarif.acces.sousTraitanceNacelle.active}
            onChange={(v) =>
              setAcces("sousTraitanceNacelle", {
                ...tarif.acces.sousTraitanceNacelle,
                active: v,
              })
            }
          />
          {tarif.acces.sousTraitanceNacelle.active && (
            <FormRow label="Prix journalier sous-traitance HT (€)">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="10"
                value={tarif.acces.sousTraitanceNacelle.prixJourHT}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setAcces("sousTraitanceNacelle", {
                    ...tarif.acces.sousTraitanceNacelle,
                    prixJourHT: !isNaN(v) && v > 0 ? v : 0,
                  });
                }}
                placeholder="500"
                className="input-mobile"
              />
            </FormRow>
          )}
        </InsetListSection>

        {/* ─── Marge pièces ────────────────────────────────── */}
        <InsetListSection
          title="Marge pièces"
          footer="Multiplicateur appliqué au prix d'achat des pièces pour la marge brute. 1.3 = +30% (standard frigoriste FR), 1.5 = +50%."
        >
          <FormRow label="Multiplicateur de marge">
            <input
              type="number"
              inputMode="decimal"
              min="1"
              max="3"
              step="0.05"
              value={tarif.margePiecesMultiplicateur}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                update(
                  "margePiecesMultiplicateur",
                  !isNaN(v) && v >= 1 ? v : 1
                );
              }}
              placeholder="1.3"
              className="input-mobile"
            />
          </FormRow>
        </InsetListSection>

        {/* ─── TVA ─────────────────────────────────────────── */}
        <InsetListSection
          title="TVA par défaut"
          footer="10% pour rénovation/entretien résidentiel >2 ans, 20% pour neuf et professionnel. Modifiable par devis."
        >
          <div className="px-4 py-3">
            <div className="flex gap-2">
              {[10, 20].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => update("tvaParDefautPct", pct as 10 | 20)}
                  className={`flex-1 px-4 py-3 rounded-xl text-[15px] font-semibold transition-colors ${
                    tarif.tvaParDefautPct === pct
                      ? "bg-emerald-600 text-white"
                      : "bg-black/[0.04] text-black/65 active:bg-black/[0.08]"
                  }`}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                  aria-pressed={tarif.tvaParDefautPct === pct}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        </InsetListSection>

        {/* ─── Submit ──────────────────────────────────────── */}
        <div className="px-4 mt-6 mb-4 space-y-3">
          <button
            type="submit"
            className="relative block w-full text-left rounded-3xl shadow-lg shadow-black/10 active:scale-[0.98] transition-transform overflow-hidden px-5 py-5"
            style={{
              background: savedFlash
                ? "linear-gradient(135deg, #10b981 0%, #047857 100%)"
                : "linear-gradient(135deg, #10b981 0%, #0f766e 100%)",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl leading-none drop-shadow shrink-0">
                {savedFlash ? "✅" : "💾"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[17px] font-bold uppercase tracking-wide text-white leading-tight">
                  {savedFlash ? "Tarification enregistrée" : "Enregistrer la tarification"}
                </div>
                <div className="text-[12px] text-white/85 mt-0.5">
                  {savedFlash
                    ? "Vos devis utiliseront ces valeurs"
                    : "Appliqué à tous vos prochains devis"}
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.push("/m/profil")}
            className="block w-full text-center text-[13px] font-medium text-black/55 active:text-black/85 py-3"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            ← Retour au profil
          </button>
        </div>
      </form>
    </main>
  );
}
