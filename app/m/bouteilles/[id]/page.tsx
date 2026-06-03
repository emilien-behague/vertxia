"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { InsetListSection } from "@/components/mobile/inset-list";
import {
  getBouteille,
  listMouvementsForBouteille,
  createMouvement,
  updateBouteille,
  deleteBouteille,
} from "@/lib/bouteille-storage";
import {
  computeChargeActuelle,
  computePctRemplissage,
  computeNiveauAlerte,
  colorAlerte,
  labelAlerte,
  labelMouvement,
  estEntree,
  estSortie,
  quantiteDepuisPesee,
  type Bouteille,
  type Mouvement,
  type MouvementType,
} from "@/lib/bouteille";

const MOUVEMENT_TYPES_RECHARGE: MouvementType[] = ["remplissage_initial", "sortie", "retour_fournisseur", "calibrage"];
const MOUVEMENT_TYPES_RECUPERATION: MouvementType[] = ["entree", "cession_traitement", "calibrage"];

export default function BouteilleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [bouteille, setBouteille] = useState<Bouteille | null>(null);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [showAddMvmt, setShowAddMvmt] = useState(false);

  // Formulaire ajout mouvement
  const [mvmtType, setMvmtType] = useState<MouvementType>("sortie");
  const [mvmtDate, setMvmtDate] = useState(new Date().toISOString().split("T")[0]);
  const [mvmtMethode, setMvmtMethode] = useState<"balance" | "declarative">("declarative");
  const [poidsAvant, setPoidsAvant] = useState("");
  const [poidsApres, setPoidsApres] = useState("");
  const [quantite, setQuantite] = useState("");
  const [mvmtNotes, setMvmtNotes] = useState("");
  const [mvmtError, setMvmtError] = useState<string | null>(null);

  function reload() {
    if (!id) return;
    setBouteille(getBouteille(id) ?? null);
    setMouvements(listMouvementsForBouteille(id));
  }

  useEffect(() => {
    reload();
  }, [id]);

  const chargeActuelle = useMemo(() => {
    if (!bouteille) return 0;
    return computeChargeActuelle(bouteille, mouvements);
  }, [bouteille, mouvements]);

  const pct = useMemo(() => {
    if (!bouteille) return 0;
    return computePctRemplissage(bouteille, chargeActuelle);
  }, [bouteille, chargeActuelle]);

  const niveau = useMemo(() => computeNiveauAlerte(pct), [pct]);
  const colors = useMemo(() => colorAlerte(niveau), [niveau]);

  // Auto-set type par défaut selon le type de bouteille
  useEffect(() => {
    if (!bouteille) return;
    if (bouteille.type === "recharge" && !MOUVEMENT_TYPES_RECHARGE.includes(mvmtType)) {
      setMvmtType("sortie");
    }
    if (bouteille.type === "recuperation" && !MOUVEMENT_TYPES_RECUPERATION.includes(mvmtType)) {
      setMvmtType("entree");
    }
  }, [bouteille, mvmtType]);

  if (!bouteille) {
    return (
      <>
        <MobileHeader title="Bouteille" backHref="/m/bouteilles" />
        <div className="px-5 py-12 text-center text-[14px] text-black/50">
          Bouteille introuvable.
        </div>
      </>
    );
  }

  const types = bouteille.type === "recharge" ? MOUVEMENT_TYPES_RECHARGE : MOUVEMENT_TYPES_RECUPERATION;

  function handleAddMouvement() {
    setMvmtError(null);
    let qte: number;
    let pa: number | undefined;
    let pap: number | undefined;

    if (mvmtMethode === "balance") {
      pa = parseFloat(poidsAvant.replace(",", "."));
      pap = parseFloat(poidsApres.replace(",", "."));
      if (!Number.isFinite(pa) || !Number.isFinite(pap)) {
        setMvmtError("Saisis le poids avant ET après la pesée.");
        return;
      }
      qte = quantiteDepuisPesee(pa, pap);
    } else {
      qte = parseFloat(quantite.replace(",", "."));
      if (!Number.isFinite(qte) || qte <= 0) {
        setMvmtError("La quantité doit être positive (kg).");
        return;
      }
    }

    if (qte <= 0) {
      setMvmtError("La quantité calculée est nulle — vérifie tes saisies.");
      return;
    }

    // Garde-fou seuil 80% pour entrée
    if (mvmtType === "entree" || mvmtType === "remplissage_initial") {
      const futur = chargeActuelle + qte;
      const pctFutur = (futur / bouteille.capaciteMaxKg) * 100;
      if (pctFutur > 80) {
        setMvmtError(
          `⚠ Ce mouvement amènerait la bouteille à ${pctFutur.toFixed(0)}% — dépasse le seuil sécurité 80%. Utilise une autre bouteille.`
        );
        return;
      }
    }

    // Garde-fou stock pour sortie
    if (mvmtType === "sortie" && qte > chargeActuelle) {
      setMvmtError(`Stock insuffisant : ${chargeActuelle.toFixed(3)} kg disponible.`);
      return;
    }

    createMouvement({
      dateMouvementISO: mvmtDate ? new Date(mvmtDate).toISOString() : new Date().toISOString(),
      bouteilleId: bouteille.id,
      type: mvmtType,
      quantiteKg: qte,
      methode: mvmtMethode,
      poidsAvantKg: pa,
      poidsApresKg: pap,
      notes: mvmtNotes.trim() || undefined,
    });

    // Reset form
    setPoidsAvant("");
    setPoidsApres("");
    setQuantite("");
    setMvmtNotes("");
    setShowAddMvmt(false);
    reload();
  }

  function handleArchive() {
    if (!confirm("Archiver cette bouteille ? Elle ne sera plus proposée dans les sélecteurs d'intervention.")) return;
    updateBouteille(bouteille.id, { statut: "archivee" });
    reload();
  }

  function handleReactivate() {
    updateBouteille(bouteille.id, { statut: "active" });
    reload();
  }

  function handleDelete() {
    if (!confirm("Supprimer définitivement cette bouteille ET tous ses mouvements ? Action irréversible.")) return;
    deleteBouteille(bouteille.id);
    router.push("/m/bouteilles");
  }

  return (
    <>
      <MobileHeader
        title={bouteille.fluide?.code ?? "Mélangé"}
        largeTitle
        backHref="/m/bouteilles"
      />

      {/* Gauge principale */}
      <div className="mx-4 mt-2 mb-3 px-5 py-5 rounded-2xl bg-white border border-black/[0.07]">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="text-[10px] font-mono tracking-widest uppercase text-black/40">
              Charge actuelle
            </div>
            <div className="text-[28px] font-light tracking-tight text-[#111] mt-0.5">
              {chargeActuelle.toFixed(2)} <span className="text-[16px] text-black/45">kg</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono tracking-widest uppercase text-black/40">
              Capacité max
            </div>
            <div className="text-[16px] text-[#111] mt-0.5">{bouteille.capaciteMaxKg.toFixed(2)} kg</div>
          </div>
        </div>
        <div className="relative w-full h-3 rounded-full bg-black/[0.06] overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 ${colors.barFill} transition-all`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
          {bouteille.type === "recuperation" && (
            <div className="absolute inset-y-0 w-0.5 bg-red-600" style={{ left: "80%" }} />
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className={colors.text}>
            {pct.toFixed(0)}% · {labelAlerte(niveau)}
          </span>
          {bouteille.type === "recuperation" && (
            <span className="text-black/40">Seuil sécurité 80%</span>
          )}
        </div>
      </div>

      {/* Bouton ajout mouvement */}
      {bouteille.statut === "active" && (
        <div className="px-4 mb-3">
          <button
            type="button"
            onClick={() => setShowAddMvmt((v) => !v)}
            className="w-full px-5 py-3 rounded-2xl bg-[#111] text-white text-[14px] font-medium active:bg-black/90 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            {showAddMvmt ? "Annuler" : "+ Ajouter un mouvement"}
          </button>
        </div>
      )}

      {/* Formulaire ajout mouvement (repliable) */}
      {showAddMvmt && (
        <InsetListSection title="Nouveau mouvement">
          <div className="px-4 py-3">
            <label className="block text-[11px] tracking-widest uppercase font-mono text-black/40 mb-2">
              Type de mouvement
            </label>
            <select
              value={mvmtType}
              onChange={(e) => setMvmtType(e.target.value as MouvementType)}
              className="input-mobile"
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {labelMouvement(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="px-4 py-2 border-t border-black/[0.06]">
            <label className="block text-[11px] tracking-widest uppercase font-mono text-black/40 mb-1">
              Date du mouvement
            </label>
            <input
              type="date"
              value={mvmtDate}
              onChange={(e) => setMvmtDate(e.target.value)}
              className="input-mobile"
            />
          </div>
          <div className="px-4 py-3 border-t border-black/[0.06]">
            <label className="block text-[11px] tracking-widest uppercase font-mono text-black/40 mb-2">
              Méthode de saisie
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMvmtMethode("balance")}
                className={`px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                  mvmtMethode === "balance"
                    ? "bg-[#111] text-white"
                    : "bg-black/[0.04] text-[#111] active:bg-black/[0.08]"
                }`}
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                Pesée balance
              </button>
              <button
                type="button"
                onClick={() => setMvmtMethode("declarative")}
                className={`px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                  mvmtMethode === "declarative"
                    ? "bg-[#111] text-white"
                    : "bg-black/[0.04] text-[#111] active:bg-black/[0.08]"
                }`}
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                Quantité directe
              </button>
            </div>
          </div>
          {mvmtMethode === "balance" ? (
            <>
              <div className="px-4 py-2 border-t border-black/[0.06]">
                <label className="block text-[11px] tracking-widest uppercase font-mono text-black/40 mb-1">
                  Poids brut AVANT (kg)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={poidsAvant}
                  onChange={(e) => setPoidsAvant(e.target.value)}
                  placeholder="Poids bouteille avant intervention"
                  inputMode="decimal"
                  className="input-mobile"
                />
              </div>
              <div className="px-4 py-2 border-t border-black/[0.06]">
                <label className="block text-[11px] tracking-widest uppercase font-mono text-black/40 mb-1">
                  Poids brut APRÈS (kg)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={poidsApres}
                  onChange={(e) => setPoidsApres(e.target.value)}
                  placeholder="Poids bouteille après intervention"
                  inputMode="decimal"
                  className="input-mobile"
                />
              </div>
              {poidsAvant && poidsApres && (
                <div className="px-4 py-2 border-t border-black/[0.06] text-[12px] text-emerald-700">
                  Delta : {Math.abs(parseFloat(poidsApres) - parseFloat(poidsAvant)).toFixed(3)} kg
                </div>
              )}
            </>
          ) : (
            <div className="px-4 py-2 border-t border-black/[0.06]">
              <label className="block text-[11px] tracking-widest uppercase font-mono text-black/40 mb-1">
                Quantité (kg)
              </label>
              <input
                type="number"
                step="0.001"
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                placeholder="Ex : 0.5"
                inputMode="decimal"
                className="input-mobile"
              />
            </div>
          )}
          <div className="px-4 py-2 border-t border-black/[0.06]">
            <label className="block text-[11px] tracking-widest uppercase font-mono text-black/40 mb-1">
              Notes (optionnel)
            </label>
            <textarea
              value={mvmtNotes}
              onChange={(e) => setMvmtNotes(e.target.value)}
              placeholder="Client, équipement, particularité…"
              rows={2}
              className="input-mobile resize-none"
            />
          </div>
          {mvmtError && (
            <div className="px-4 py-2 text-[13px] text-red-700 bg-red-50">{mvmtError}</div>
          )}
          <div className="px-4 py-3 border-t border-black/[0.06]">
            <button
              type="button"
              onClick={handleAddMouvement}
              className="w-full px-5 py-3 rounded-2xl bg-emerald-600 text-white text-[14px] font-medium active:bg-emerald-700 transition-colors"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              Enregistrer le mouvement
            </button>
          </div>
        </InsetListSection>
      )}

      {/* Infos bouteille */}
      <InsetListSection title="Informations">
        <InfoRow label="Type" value={bouteille.type === "recharge" ? "Recharge" : "Récupération"} />
        <InfoRow label="N° de série" value={bouteille.numeroSerie} mono />
        <InfoRow label="Fluide" value={bouteille.fluide?.label ?? "Mélangé / déchet"} />
        <InfoRow label="Tare (vide)" value={`${bouteille.tareKg.toFixed(2)} kg`} />
        <InfoRow label="Capacité max" value={`${bouteille.capaciteMaxKg.toFixed(2)} kg`} />
        {bouteille.fournisseur && <InfoRow label="Fournisseur" value={bouteille.fournisseur} />}
        {bouteille.dateAchatISO && (
          <InfoRow
            label="Achat"
            value={new Date(bouteille.dateAchatISO).toLocaleDateString("fr-FR")}
          />
        )}
        <InfoRow
          label="Compat. inflammable"
          value={bouteille.compatibleInflammable ? "Oui" : "Non"}
        />
        <InfoRow label="Statut" value={bouteille.statut === "active" ? "Active" : bouteille.statut === "transit_retour" ? "En transit" : "Archivée"} />
      </InsetListSection>

      {/* Historique mouvements */}
      <InsetListSection
        title={`Historique (${mouvements.length})`}
        footer="Mouvements classés du plus récent au plus ancien."
      >
        {mouvements.length === 0 && (
          <div className="px-4 py-6 text-center text-[13px] text-black/45">
            Aucun mouvement enregistré pour cette bouteille.
          </div>
        )}
        {mouvements.map((m) => (
          <MouvementRow key={m.id} m={m} />
        ))}
      </InsetListSection>

      {/* Notes */}
      {bouteille.notes && (
        <InsetListSection title="Notes">
          <div className="px-4 py-3 text-[14px] text-black/70 whitespace-pre-wrap">
            {bouteille.notes}
          </div>
        </InsetListSection>
      )}

      {/* Actions */}
      <div className="px-4 mt-6 mb-8 space-y-2">
        {bouteille.statut === "active" ? (
          <button
            type="button"
            onClick={handleArchive}
            className="w-full px-5 py-3 rounded-2xl bg-white border border-black/15 text-[#111] text-[14px] active:bg-black/[0.03] transition-colors"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            Archiver la bouteille
          </button>
        ) : (
          <button
            type="button"
            onClick={handleReactivate}
            className="w-full px-5 py-3 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800 text-[14px] active:bg-emerald-100 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            Réactiver la bouteille
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          className="w-full px-5 py-3 rounded-2xl bg-red-50 ring-1 ring-red-200 text-red-700 text-[14px] active:bg-red-100 transition-colors"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          Supprimer définitivement
        </button>
      </div>

      <style jsx global>{`
        .input-mobile {
          width: 100%; padding: 10px 0; background: transparent; border: none;
          font-size: 16px; color: #111; outline: none; font-family: inherit;
        }
        .input-mobile::placeholder { color: rgba(0,0,0,0.3); }
        select.input-mobile {
          -webkit-appearance: none; appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='rgba(0,0,0,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
          background-repeat: no-repeat; background-position: right 4px center; padding-right: 24px;
        }
      `}</style>
    </>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-4 py-2.5 border-b border-black/[0.06] last:border-b-0 flex items-center justify-between gap-3">
      <span className="text-[13px] text-black/55">{label}</span>
      <span className={`text-[14px] text-[#111] text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function MouvementRow({ m }: { m: Mouvement }) {
  const sign = estEntree(m.type) ? "+" : estSortie(m.type) ? "−" : "=";
  const color = estEntree(m.type) ? "text-emerald-700" : estSortie(m.type) ? "text-red-700" : "text-black/55";
  return (
    <div className="px-4 py-3 border-b border-black/[0.06] last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium text-[#111]">{labelMouvement(m.type)}</div>
          <div className="text-[12px] text-black/45 mt-0.5">
            {new Date(m.dateMouvementISO).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
            {m.methode === "balance" && m.poidsAvantKg !== undefined && m.poidsApresKg !== undefined && (
              <span className="ml-2 text-[11px] font-mono">
                ({m.poidsAvantKg.toFixed(2)}→{m.poidsApresKg.toFixed(2)} kg)
              </span>
            )}
          </div>
          {m.notes && (
            <div className="text-[12px] text-black/55 mt-1 italic">{m.notes}</div>
          )}
        </div>
        <span className={`text-[15px] font-mono font-medium ${color} whitespace-nowrap`}>
          {sign} {m.quantiteKg.toFixed(3)} kg
        </span>
      </div>
    </div>
  );
}
