"use client";

// Page racine Vertxia Marketplace : catalogue pieces detachees frigoristes
// avec 25 fournisseurs FR verifies + ~30 pieces de demarrage. UI mobile-first
// iOS style. Recherche full-text + filtres par categorie.
//
// Modele economique Vertxia : commission 4-6% HT sur chaque piece achetee
// via la plateforme (modele affiliate). Le frigoriste gagne du temps
// (pas de recherche fournisseur), trouve le bon prix (compare 3+ sources),
// le client paie au frigoriste qui refacture la piece.
//
// IMPORTANT regle #26 CLAUDE.md : tous les prix affiches sont des
// ESTIMATIONS MARCHE FR 2026 (champ prixSource le precise). La V2 marketplace
// devra brancher les vraies APIs des distributeurs pour avoir des prix
// temps reel verifies.

import { useMemo, useState } from "react";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/ui/mobile-header";
import { InsetListSection } from "@/components/mobile/ui/inset-list";
import {
  PIECES_CATALOGUE,
  FOURNISSEURS,
  CATEGORIE_LABELS,
  STATS_CATALOGUE,
  getFournisseur,
  rechercherPieces,
  piecesParCategorie,
  calculerPrixAvecCommission,
  type CategoriePiece,
  type PieceDetachee,
} from "@/lib/marketplace-pieces";

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [categorieActive, setCategorieActive] = useState<CategoriePiece | "tout">("tout");

  const filtered = useMemo(() => {
    let list: PieceDetachee[] = search.trim() ? rechercherPieces(search) : PIECES_CATALOGUE;
    if (categorieActive !== "tout") {
      list = list.filter((p) => p.categorie === categorieActive);
    }
    return list;
  }, [search, categorieActive]);

  const categoriesAvecCompteur = useMemo(() => {
    const counts: Record<CategoriePiece | "tout", number> = {
      tout: PIECES_CATALOGUE.length,
    } as Record<CategoriePiece | "tout", number>;
    for (const cat of Object.keys(CATEGORIE_LABELS) as CategoriePiece[]) {
      counts[cat] = piecesParCategorie(cat).length;
    }
    return counts;
  }, []);

  return (
    <>
      <MobileHeader title="🛒 Pièces détachées" backHref="/m/profil" largeTitle />

      {/* Bandeau stat marketplace - argument de vente fort */}
      <div className="mx-4 mt-2 mb-3 px-5 py-4 rounded-2xl bg-gradient-to-br from-[#A16207]/10 to-[#A16207]/5 ring-1 ring-[#A16207]/15">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#A16207]/15">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A16207" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-[#111] leading-tight">
              {FOURNISSEURS.length} fournisseurs FR vérifiés
            </div>
            <div className="text-[12px] text-black/60 leading-snug mt-0.5">
              {STATS_CATALOGUE.totalPieces} pièces référencées · sources primaires
              vérifiées via WebFetch
            </div>
          </div>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="px-4 mb-2">
        <input
          type="search"
          placeholder="Rechercher pièce, marque, équipement..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl bg-white ring-1 ring-black/[0.06] text-[15px] placeholder:text-black/35 focus:outline-none focus:ring-2 focus:ring-[#A16207]/30"
          style={{ WebkitAppearance: "none" }}
        />
      </div>

      {/* Filtre categories - segmented horizontal scroll */}
      <div className="mt-2 mb-3 overflow-x-auto overscroll-x-contain">
        <div className="flex gap-2 px-4 pb-1 min-w-min">
          <CategoryChip
            label={`Tout (${categoriesAvecCompteur.tout})`}
            active={categorieActive === "tout"}
            onClick={() => setCategorieActive("tout")}
          />
          {(Object.keys(CATEGORIE_LABELS) as CategoriePiece[]).map((cat) => (
            <CategoryChip
              key={cat}
              label={`${CATEGORIE_LABELS[cat]} (${categoriesAvecCompteur[cat]})`}
              active={categorieActive === cat}
              onClick={() => setCategorieActive(cat)}
            />
          ))}
        </div>
      </div>

      {/* Compteur resultats */}
      <div className="px-5 mb-1 text-[12px] text-black/45">
        {filtered.length} pièce{filtered.length > 1 ? "s" : ""}
        {filtered.length !== PIECES_CATALOGUE.length && ` sur ${PIECES_CATALOGUE.length}`}
      </div>

      {/* Liste pieces */}
      {filtered.length === 0 ? (
        <div className="mx-5 mt-12 text-center text-[14px] text-black/50">
          Aucune pièce trouvée
          {search && ` pour "${search}"`}
        </div>
      ) : (
        <div className="px-4 mt-2 space-y-2">
          {filtered.map((piece) => (
            <PieceCard key={piece.id} piece={piece} />
          ))}
        </div>
      )}

      {/* Section fournisseurs en bas */}
      <InsetListSection
        title="Réseau fournisseurs Vertxia"
        footer="Top fournisseurs/constructeurs FR vérifiés sur sources primaires (Légifrance, sites officiels) lors du workflow cartographie du 04/06/2026. Liste complète : 102 acteurs identifiés."
      >
        {FOURNISSEURS.slice(0, 10).map((f) => (
          <div key={f.id} className="px-4 py-3 border-b border-black/[0.04] last:border-0">
            <div className="flex items-start gap-3">
              <span
                className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl ${
                  f.type === "constructeur" ? "bg-blue-50" : "bg-emerald-50"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={f.type === "constructeur" ? "#1d4ed8" : "#047857"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {f.type === "constructeur" ? (
                    <>
                      <path d="M12 2v20M2 12h20" />
                    </>
                  ) : (
                    <>
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18" />
                    </>
                  )}
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-[14px] font-semibold text-[#111] truncate">{f.nom}</div>
                  {f.urlConfirmee && (
                    <span className="shrink-0 text-[9px] font-mono tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      VÉRIFIÉ
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-black/60 leading-snug mt-0.5 line-clamp-2">
                  {f.specialite}
                </div>
                <div className="mt-1 text-[10.5px] font-mono tracking-wider text-black/40 flex items-center gap-2">
                  <span>{f.zonesLivraisonFr}</span>
                  <span>·</span>
                  <span>
                    Livraison {f.delaiLivraisonJoursEstimes.min}-{f.delaiLivraisonJoursEstimes.max}j
                  </span>
                </div>
                {f.urlOfficielle && (
                  <a
                    href={f.urlOfficielle}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-1.5 text-[11px] text-[#A16207] active:opacity-60"
                    style={{ WebkitTapHighlightColor: "transparent" }}
                  >
                    {f.urlOfficielle.replace(/^https?:\/\//, "").replace(/\/$/, "")} ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </InsetListSection>

      <div className="mx-5 mt-4 mb-8 text-center text-[10.5px] text-black/40 leading-relaxed">
        Vertxia Marketplace · V1 preview · Commission 4-6% HT par pièce vendue
        <br />
        Les prix affichés sont des estimations marché FR 2026
        <br />
        à reconfirmer sur les APIs fournisseurs lors de la commande.
      </div>
    </>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
        active
          ? "bg-[#111] text-white"
          : "bg-white text-black/70 ring-1 ring-black/[0.06] active:bg-black/[0.04]"
      }`}
      style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
    >
      {label}
    </button>
  );
}

function PieceCard({ piece }: { piece: PieceDetachee }) {
  const [open, setOpen] = useState(false);
  const fournisseursPiece = piece.fournisseurIds
    .map((id) => getFournisseur(id))
    .filter((f): f is NonNullable<typeof f> => Boolean(f));
  const fournisseurPrincipal = fournisseursPiece[0];
  const prixCalcule = fournisseurPrincipal
    ? calculerPrixAvecCommission(piece.prixEstimeHt, fournisseurPrincipal.tauxCommission)
    : { prixHt: piece.prixEstimeHt, commissionHt: 0, prixHtTotal: piece.prixEstimeHt };

  return (
    <div className="rounded-2xl bg-white ring-1 ring-black/[0.05] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left active:bg-black/[0.04] transition-colors"
        style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
      >
        <span className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#A16207]/8">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A16207" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-[#111] leading-tight">
            {piece.designation}
          </div>
          <div className="text-[11px] font-mono tracking-wider text-black/45 mt-0.5">
            {piece.marque} · réf {piece.reference}
          </div>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-bold text-[#111] tabular-nums">
              {prixCalcule.prixHtTotal.toFixed(2).replace(".", ",")} € HT
            </span>
            <span className="text-[10.5px] text-black/45">/ {piece.uniteVente}</span>
            {piece.enStock && (
              <span className="text-[9.5px] font-mono tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                EN STOCK
              </span>
            )}
          </div>
          {fournisseurPrincipal && (
            <div className="mt-1 text-[11px] text-black/55">
              via {fournisseurPrincipal.nom} · livraison{" "}
              {fournisseurPrincipal.delaiLivraisonJoursEstimes.min}-
              {fournisseurPrincipal.delaiLivraisonJoursEstimes.max}j
            </div>
          )}
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 mt-2 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-black/[0.05] px-4 py-3 bg-black/[0.02] space-y-3">
          <DetailRow label="Compatibilités" value={piece.compatibilitesEquipements.join(", ")} />
          <DetailRow
            label="Fluides compatibles"
            value={
              piece.fluidesCompatibles.includes("*")
                ? "Tous fluides"
                : piece.fluidesCompatibles.join(", ")
            }
          />
          {fournisseursPiece.length > 1 && (
            <DetailRow
              label="Autres fournisseurs"
              value={fournisseursPiece.slice(1).map((f) => f.nom).join(", ")}
            />
          )}
          <div className="pt-2 flex items-center justify-between text-[10.5px] text-black/45">
            <div>
              Prix HT brut : {piece.prixEstimeHt.toFixed(2).replace(".", ",")} €
              {" · "}commission Vertxia {prixCalcule.commissionHt.toFixed(2).replace(".", ",")} €
            </div>
          </div>
          <a
            href={`mailto:${fournisseurPrincipal?.urlOfficielle ? "contact@" + fournisseurPrincipal.urlOfficielle.replace(/^https?:\/\//, "").replace(/\/$/, "").split("/")[0] : "contact"}?cc=emilien@vertxia.com&subject=${encodeURIComponent(`Demande devis - ${piece.designation}`)}&body=${encodeURIComponent(
              `Bonjour,\n\nVia Vertxia, je souhaite obtenir un devis pour :\n\n- ${piece.designation}\n- Référence : ${piece.reference}\n- Marque : ${piece.marque}\n- Quantité : 1\n\nMerci de me confirmer disponibilité, prix HT et délai de livraison.\n\nCordialement`
            )}`}
            className="block w-full mt-2 px-4 py-3 rounded-xl bg-[#A16207] text-white text-[13px] font-medium text-center active:opacity-90 transition-opacity"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Demander un devis →
          </a>
          <div className="text-[10px] text-black/35 leading-snug text-center">
            Email envoyé au fournisseur, Vertxia en copie pour suivi commission
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-mono tracking-widest uppercase text-black/45 mb-0.5">
        {label}
      </div>
      <div className="text-[12.5px] text-black/75 leading-snug">{value}</div>
    </div>
  );
}
