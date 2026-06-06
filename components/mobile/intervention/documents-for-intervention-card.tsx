"use client";

// Carte affichee en haut de la page de saisie d'une intervention,
// listant les documents officiels (CERFA, modeles AFCE, guides DGEC)
// pertinents pour le type d'intervention en cours.
//
// Objectif UX : le frigoriste a sous les yeux, en 1 tap, le CERFA officiel
// + le modele de registre + la note pedagogique DGEC dont il a besoin
// pour CE type d'intervention specifiquement. Pas besoin d'aller
// chercher dans la biblio /m/documents.
//
// Pliable par defaut (replie pour ne pas polluer) avec un compteur
// visible ("3 documents officiels pour cette intervention").

import { useState } from "react";
import {
  getDocumentsForIntervention,
  formatTailleFichier,
  type TypeIntervention,
} from "@/lib/cerfa/documents-officiels";

type Props = {
  type: TypeIntervention;
  defaultExpanded?: boolean;
};

export function DocumentsForInterventionCard({ type, defaultExpanded = false }: Props) {
  const docs = getDocumentsForIntervention(type);
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (docs.length === 0) return null;

  return (
    <div className="mx-4 mt-3 mb-1 rounded-2xl bg-white ring-1 ring-black/[0.05] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-4 py-3 active:bg-black/[0.04] transition-colors"
        style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
      >
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#A16207]/10 shrink-0">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#A16207"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </span>
        <span className="flex-1 text-left min-w-0">
          <span className="block text-[13.5px] font-medium text-[#111] leading-tight">
            {docs.length} document{docs.length > 1 ? "s" : ""} officiel
            {docs.length > 1 ? "s" : ""}
          </span>
          <span className="block text-[11.5px] text-black/55 leading-snug mt-0.5">
            CERFA, modèles, guides DGEC · offline
          </span>
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(0,0,0,0.4)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-black/[0.05] divide-y divide-black/[0.04]">
          {docs.map((doc) => (
            <a
              key={doc.id}
              href={doc.fichierLocal}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 px-4 py-3 active:bg-black/[0.04] transition-colors"
              style={{
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              <div className="shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-[#A16207]/8 flex items-center justify-center">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#A16207"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-[#111] font-medium leading-tight">
                  {doc.titre}
                </div>
                <div className="text-[11.5px] text-black/55 leading-snug mt-0.5">
                  {doc.source} · {formatTailleFichier(doc.tailleKb)}
                </div>
              </div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(0,0,0,0.35)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 mt-1.5"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
          ))}
          <a
            href="/m/documents"
            className="block text-center px-4 py-2.5 text-[12px] text-[#A16207] font-medium active:bg-black/[0.04] transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Voir tous les documents officiels →
          </a>
        </div>
      )}
    </div>
  );
}
