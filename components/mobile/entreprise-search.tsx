"use client";

// Autocomplete entreprise (nom OU SIRET) basé sur l'API publique
// recherche-entreprises.api.gouv.fr (data.gouv). Source = INSEE/SIRENE.
//
// Le user tape "Climalife" ou "31025920500014" → dropdown des établissements
// matchant → clic = callback onSelect avec l'établissement complet.
//
// Utilisé pour la sélection du centre de destination du BSFF dans /m/profil.

import { useEffect, useRef, useState } from "react";
import { searchEntreprises, type SiretLookupResult } from "@/lib/siret";

type Props = {
  onSelect: (result: SiretLookupResult) => void;
  placeholder?: string;
  /** Texte initial dans l'input (ex: nom de l'établissement déjà sélectionné) */
  initialValue?: string;
  /** ID input pour focus auto + label association */
  inputId?: string;
};

export function EntrepriseSearch({
  onSelect,
  placeholder = "Tape un nom (ex: Climalife) ou un SIRET",
  initialValue = "",
  inputId,
}: Props) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<SiretLookupResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const lastQueryRef = useRef<string>("");

  // Debounce search 300ms après dernière frappe
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      setBusy(false);
      return;
    }
    if (trimmed === lastQueryRef.current) return;

    const t = setTimeout(async () => {
      lastQueryRef.current = trimmed;
      setBusy(true);
      setError(null);
      try {
        const list = await searchEntreprises(trimmed, 8);
        // Ignore réponse si la query a changé entre-temps
        if (trimmed !== lastQueryRef.current) return;
        setResults(list);
      } catch (e) {
        if (trimmed !== lastQueryRef.current) return;
        setError(e instanceof Error ? e.message : "Erreur de connexion à l'annuaire.");
        setResults([]);
      } finally {
        if (trimmed === lastQueryRef.current) setBusy(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Fermer le dropdown au clic en dehors
  useEffect(() => {
    function onClick(e: MouseEvent | TouchEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("touchstart", onClick);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("touchstart", onClick);
    };
  }, []);

  function handleSelect(r: SiretLookupResult) {
    onSelect(r);
    setQuery(r.raisonSociale + (r.commune ? ` — ${r.commune}` : ""));
    setResults([]);
    setOpen(false);
  }

  const showDropdown = open && (busy || error || results.length > 0 || (query.trim().length >= 2 && !busy && results.length === 0));

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={inputId}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="input-mobile w-full"
      />
      {showDropdown && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-black/10 max-h-72 overflow-y-auto overscroll-contain">
          {busy && (
            <div className="px-4 py-3 text-[12px] text-black/55 flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-black/20 border-t-[#A16207] rounded-full animate-spin" />
              Recherche dans l&apos;annuaire officiel…
            </div>
          )}
          {!busy && error && (
            <div className="px-4 py-3 text-[12px] text-red-600">{error}</div>
          )}
          {!busy && !error && results.length === 0 && query.trim().length >= 2 && (
            <div className="px-4 py-3 text-[12px] text-black/45">
              Aucun établissement trouvé. Vérifie l&apos;orthographe ou tape un SIRET.
            </div>
          )}
          {!busy && !error && results.map((r) => (
            <button
              key={r.siret}
              type="button"
              onClick={() => handleSelect(r)}
              className="w-full text-left px-4 py-3 border-b border-black/[0.04] last:border-b-0 active:bg-black/[0.04] transition-colors"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <div className="text-[13px] font-medium text-[#111] leading-tight">
                {r.raisonSociale}
              </div>
              <div className="text-[11px] text-black/55 font-mono mt-0.5">
                SIRET {r.siret}
              </div>
              {(r.adresseRue || r.commune) && (
                <div className="text-[11px] text-black/45 mt-0.5 truncate">
                  {[r.adresseRue, r.commune].filter(Boolean).join(" — ")}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
