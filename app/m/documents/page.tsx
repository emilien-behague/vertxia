"use client";

// Bibliotheque de documents officiels reglementaires telecharges en local
// dans Vertxia (public/docs/officiels/). Sources verifiees : Legifrance,
// service-public.gouv.fr, ecologie.gouv.fr (DGEC), AFCE.
//
// Utilite pour le frigoriste : avoir sous la main, meme offline, les CERFA
// officiels + les modeles de registres + les guides ministere a montrer
// en cas de controle DREAL ou pour repondre a une question client.
//
// Ajout de nouveaux documents : voir lib/documents-officiels.ts (les fichiers
// PDF eux-memes sont dans public/docs/officiels/).

import { useMemo, useState } from "react";
import { MobileHeader } from "@/components/mobile/mobile-header";
import {
  DOCUMENTS_OFFICIELS,
  CATEGORIE_LABELS,
  formatTailleFichier,
  rechercheDocuments,
  groupByCategorie,
  type CategorieDocument,
  type DocumentOfficiel,
} from "@/lib/cerfa/documents-officiels";

export default function DocumentsOfficielsPage() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => rechercheDocuments(search), [search]);
  const byCategorie = useMemo(() => groupByCategorie(filtered), [filtered]);
  const totalDocs = DOCUMENTS_OFFICIELS.length;

  const categoriesOrder: CategorieDocument[] = [
    "cerfa",
    "registre_modele",
    "trackdechets_bsff",
    "syderep_ademe",
    "attestation_capacite",
    "guide_dgec",
    "decret_arrete_fr",
    "reglement_eu",
    "etiquette_tfe",
    "fluide_specifique",
    "fiche_fluide_specifique",
  ];

  return (
    <>
      <MobileHeader title="📄 Papiers officiels" backHref="/m/profil" largeTitle />

      <div className="px-4 mt-2">
        <input
          type="search"
          placeholder="Rechercher un CERFA, un fluide, un guide..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl bg-white ring-1 ring-black/[0.06] text-[15px] placeholder:text-black/35 focus:outline-none focus:ring-2 focus:ring-[#A16207]/30"
          style={{ WebkitAppearance: "none" }}
        />
        <div className="mt-2 px-1 text-[12px] text-black/50 leading-snug">
          {filtered.length} document{filtered.length > 1 ? "s" : ""} officiel
          {filtered.length > 1 ? "s" : ""}
          {filtered.length !== totalDocs && ` sur ${totalDocs}`} · sources vérifiées
          Légifrance, service-public.gouv.fr, ecologie.gouv.fr, AFCE
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="mx-5 mt-12 text-center">
          <div className="text-[15px] text-black/55 mb-1">Aucun document trouvé</div>
          <div className="text-[13px] text-black/40">
            Essaye « cerfa », « registre », « f-gas », « hfc », « fuite »...
          </div>
        </div>
      )}

      {categoriesOrder.map((cat) => {
        const docs = byCategorie[cat];
        if (!docs || docs.length === 0) return null;
        return (
          <section key={cat} className="px-4 mt-5">
            <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-black/45 mb-2 px-1">
              📂 {CATEGORIE_LABELS[cat]}
            </div>
            <div className="space-y-2">
              {docs.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} />
              ))}
            </div>
          </section>
        );
      })}

      <div className="mx-5 mt-8 mb-6 text-center text-[11px] text-black/40 leading-relaxed">
        Documents téléchargés depuis leur source primaire officielle.
        <br />
        Vertxia conserve une copie locale pour usage hors-ligne.
        <br />
        En cas de doute sur la version en vigueur, vérifier sur le site source
        (lien dans la fiche du document).
      </div>
    </>
  );
}

function DocumentCard({ doc }: { doc: DocumentOfficiel }) {
  const href = doc.disponibleOffline ? doc.fichierLocal : doc.sourceUrl;
  // Couleur bordure : ambre (offline) si cache local, gris (en ligne) sinon.
  // Icone : flecehe download (offline) ou lien externe (online).
  const borderColor = doc.disponibleOffline ? "#A16207" : "#94A3B8";
  const iconBg = doc.disponibleOffline ? "bg-[#A16207]/10" : "bg-slate-100";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl bg-white ring-1 ring-black/[0.05] px-4 py-3 active:bg-black/[0.02] transition-colors"
      style={{
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
        borderLeft: `5px solid ${borderColor}`,
      }}
    >
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center text-[20px]`}>
          📄
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <div className="text-[14.5px] text-[#111] font-bold leading-tight">
              {doc.titre}
            </div>
            {doc.disponibleOffline ? (
              <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider uppercase bg-[#A16207]/10 text-[#A16207]">
                Hors-ligne
              </span>
            ) : (
              <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wider uppercase bg-slate-100 text-slate-600">
                En ligne
              </span>
            )}
          </div>
          <div className="text-[12px] text-black/60 leading-snug mt-1">
            {doc.description}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono tracking-wider text-black/40 uppercase flex-wrap">
            <span>{doc.source}</span>
            <span>·</span>
            <span>{formatTailleFichier(doc.tailleKb)}</span>
            <span>·</span>
            <span>{doc.dateVerification}</span>
            {doc.fiabilite === "source_secondaire_fiable" && (
              <>
                <span>·</span>
                <span className="text-amber-700">source pro</span>
              </>
            )}
          </div>
        </div>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={borderColor}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 mt-1.5"
        >
          {doc.disponibleOffline ? (
            <>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </>
          ) : (
            <>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </>
          )}
        </svg>
      </div>
    </a>
  );
}
