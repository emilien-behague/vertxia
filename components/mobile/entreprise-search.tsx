"use client";

// Autocomplete entreprise (nom OU SIRET) basé sur l'API publique
// recherche-entreprises.api.gouv.fr (data.gouv). Source = INSEE/SIRENE.
//
// Le user tape "Climalife" ou "31025920500014" → dropdown des établissements
// matchant → clic = callback onSelect avec l'établissement complet.
//
// Le dropdown est porté via createPortal vers document.body avec position
// fixed pour sortir des overflow:hidden des ancêtres (InsetListSection clip
// sinon les résultats à 50% sous le footer de la section).

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { searchEntreprises, type SiretLookupResult } from "@/lib/siret";

type Props = {
  onSelect: (result: SiretLookupResult) => void;
  placeholder?: string;
  initialValue?: string;
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
  const [mounted, setMounted] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const lastQueryRef = useRef<string>("");

  useEffect(() => setMounted(true), []);

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

  // Calcule la position du dropdown sous l'input à chaque ouverture / scroll / resize.
  // Important : on utilise position:fixed pour échapper aux overflow:hidden des ancêtres
  // (notamment <InsetListSection> qui clipperait sinon).
  useEffect(() => {
    if (!open) return;
    function updatePosition() {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 1000,
        maxHeight: Math.min(320, window.innerHeight - rect.bottom - 16),
      });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, results.length, busy, error]);

  // Fermer le dropdown au clic en dehors (input ET dropdown)
  useEffect(() => {
    function onClick(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (inputRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
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

  const trimmed = query.trim();
  const showDropdown =
    open &&
    (busy ||
      Boolean(error) ||
      results.length > 0 ||
      (trimmed.length >= 2 && !busy && results.length === 0));

  const dropdown = showDropdown && mounted ? (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-white rounded-2xl shadow-2xl border border-black/10 overflow-y-auto overscroll-contain"
    >
      {busy && (
        <div className="px-4 py-3 text-[12px] text-black/55 flex items-center gap-2">
          <span className="inline-block w-3 h-3 border-2 border-black/20 border-t-[#A16207] rounded-full animate-spin" />
          Recherche dans l&apos;annuaire officiel…
        </div>
      )}
      {!busy && error && (
        <div className="px-4 py-3 text-[12px] text-red-600">{error}</div>
      )}
      {!busy && !error && results.length === 0 && trimmed.length >= 2 && (
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
  ) : null;

  return (
    <>
      <input
        ref={inputRef}
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
      {dropdown && mounted && createPortal(dropdown, document.body)}
    </>
  );
}
