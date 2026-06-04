"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { InsetListSection } from "@/components/mobile/inset-list";
import { useUser } from "@/lib/supabase/use-user";
import {
  loadProfil,
  saveProfil,
  ORGANISMES_AGREES,
  type Profil,
  type CategorieAttestation,
  EMPTY_PROFIL,
} from "@/lib/profil";
import { lookupSiret, isValidSiretFormat, type SiretLookupResult } from "@/lib/siret";
import { EntrepriseSearch } from "@/components/mobile/entreprise-search";

const CATEGORIES: { value: CategorieAttestation; label: string }[] = [
  { value: "I", label: "Cat. I — Tous équipements" },
  { value: "II", label: "Cat. II — < 2 kg + contrôle" },
  { value: "III", label: "Cat. III — Récup < 2 kg" },
  { value: "IV", label: "Cat. IV — Contrôle uniquement" },
  { value: "V", label: "Cat. V — Véhicules" },
];

const MAX_LOGO_SIZE = 500 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function MobileProfilPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut, configured } = useUser();
  const [profil, setProfil] = useState<Profil>(EMPTY_PROFIL);
  const [savedFlash, setSavedFlash] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [tdJustConnected, setTdJustConnected] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setProfil(loadProfil());
  }, []);

  // Détection retour OAuth TrackDéchets (?td_connected=1 injecté par /callback)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("td_connected") === "1") {
      setTdJustConnected(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("td_connected");
      window.history.replaceState({}, "", url.toString());
      // Recharge le profil pour récupérer le token + entreprise injectés par /callback
      setProfil(loadProfil());
      const t = setTimeout(() => setTdJustConnected(false), 4000);
      return () => clearTimeout(t);
    }
  }, []);

  function handleConnectTrackDechets() {
    // Sauve les modifs en cours du profil pour pas les perdre pendant
    // la navigation OAuth (le user va quitter la page vers TrackDéchets).
    saveProfil({ ...profil, trackdechetsMode: "production" });
    window.location.href = "/api/trackdechets/oauth/start";
  }

  function handleDisconnectTrackDechets() {
    const ok = window.confirm(
      "Déconnecter ton compte TrackDéchets ?\n\nTu pourras te reconnecter à tout moment via le même bouton."
    );
    if (!ok) return;
    const next: Profil = { ...profil, trackdechetsToken: "", trackdechetsMode: "sandbox" };
    setProfil(next);
    saveProfil(next);
  }

  // ─── Lookup SIRET utilisateur (auto-fill raison sociale + adresse) ─────
  const [userLookupBusy, setUserLookupBusy] = useState(false);
  const [userLookupError, setUserLookupError] = useState<string | null>(null);
  const [userLookupOk, setUserLookupOk] = useState(false);

  async function handleLookupUserSiret() {
    const siret = (profil.siret || "").replace(/\D+/g, "");
    setUserLookupError(null);
    setUserLookupOk(false);
    if (!isValidSiretFormat(siret)) {
      setUserLookupError("SIRET invalide : 14 chiffres attendus.");
      return;
    }
    setUserLookupBusy(true);
    try {
      const result = await lookupSiret(siret);
      if (!result) {
        setUserLookupError("Aucun établissement trouvé pour ce SIRET dans l'annuaire officiel.");
        return;
      }
      setProfil((p) => ({
        ...p,
        siret: result.siret,
        raisonSociale: result.raisonSociale,
        adresseRue: result.adresseRue,
        adresseCp: result.codePostal,
        adresseVille: result.commune,
      }));
      setUserLookupOk(true);
      setTimeout(() => setUserLookupOk(false), 3000);
    } catch (e) {
      setUserLookupError(e instanceof Error ? e.message : "Erreur de connexion à l'annuaire.");
    } finally {
      setUserLookupBusy(false);
    }
  }

  // ─── Centre destination — autocomplete par nom OU SIRET ──────────────
  // `editingDest` ouvre/ferme le formulaire de recherche. Quand un centre
  // est déjà sélectionné, on affiche une card lecture seule + bouton "Changer"
  // qui passe editingDest à true.
  const [editingDest, setEditingDest] = useState(false);

  function handleSelectDestEntreprise(result: SiretLookupResult) {
    setProfil((p) => ({
      ...p,
      bsffDestinationSiret: result.siret,
      bsffDestinationName: result.raisonSociale,
      bsffDestinationAddress: result.adresseComplete,
    }));
    setEditingDest(false);
  }

  async function handleSignOut() {
    if (signingOut) return;
    const ok = window.confirm(
      "Te déconnecter de Vertxia ?\n\nTes équipements et interventions restent sur cet appareil. Tu peux te reconnecter avec le même compte ou un autre."
    );
    if (!ok) return;
    setSigningOut(true);
    try {
      await signOut();
      router.push("/m/login");
    } catch (e) {
      console.warn("[signOut] failed:", e);
      setSigningOut(false);
    }
  }

  function update<K extends keyof Profil>(key: K, value: Profil[K]) {
    setProfil((p) => ({ ...p, [key]: value }));
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (file.size > MAX_LOGO_SIZE) {
      setUploadError(`Logo trop lourd (${(file.size / 1024).toFixed(0)} KB). Max 500 KB.`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setUploadError("Format invalide. PNG, JPG ou SVG attendu.");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      update("logoDataUrl", dataUrl);
    } catch {
      setUploadError("Impossible de lire le fichier.");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveProfil(profil);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  }

  return (
    <>
      <MobileHeader title="Profil" largeTitle />

      {tdJustConnected && (
        <div
          role="status"
          aria-live="polite"
          className="mx-4 mb-3 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span>Connecté à TrackDéchets. Tes BSFF sont maintenant officiels.</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Logo */}
        <InsetListSection title="Logo entreprise" footer="PNG, JPG ou SVG · max 500 KB · apparaît sur tous les PDF générés.">
          <div className="px-4 py-3 flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-black/[0.04] flex items-center justify-center overflow-hidden shrink-0">
              {profil.logoDataUrl ? (
                <img src={profil.logoDataUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                id="logo-input"
              />
              <label
                htmlFor="logo-input"
                className="inline-block px-4 py-2 rounded-xl bg-[#A16207]/10 text-[#A16207] text-[13px] font-medium active:bg-[#A16207]/20 transition-colors cursor-pointer"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                {profil.logoDataUrl ? "Changer le logo" : "Choisir un logo"}
              </label>
              {profil.logoDataUrl && (
                <button
                  type="button"
                  onClick={() => update("logoDataUrl", undefined)}
                  className="ml-2 text-[13px] text-red-600 active:opacity-60"
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                >
                  Supprimer
                </button>
              )}
            </div>
          </div>
          {uploadError && (
            <div className="px-4 py-2 text-[12px] text-red-700 bg-red-50 border-t border-red-200">
              {uploadError}
            </div>
          )}
        </InsetListSection>

        {/* Identité légale */}
        <InsetListSection
          title="Identité légale"
          footer="Tape ton SIRET et clique Rechercher : raison sociale + adresse pré-remplies automatiquement depuis l'annuaire officiel gouv.fr."
        >
          <FormRow label="SIRET">
            <div className="flex gap-2">
              <input
                type="text"
                value={profil.siret}
                onChange={(e) => {
                  setUserLookupError(null);
                  setUserLookupOk(false);
                  update("siret", e.target.value.replace(/\s+/g, "").slice(0, 14));
                }}
                placeholder="14 chiffres"
                inputMode="numeric"
                maxLength={14}
                className="input-mobile font-mono flex-1 min-w-0"
              />
              <button
                type="button"
                onClick={handleLookupUserSiret}
                disabled={userLookupBusy || !profil.siret}
                className="px-3 py-2 rounded-xl bg-[#A16207] text-white text-[13px] font-medium active:opacity-90 disabled:opacity-40 disabled:active:opacity-40 transition-opacity shrink-0"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                {userLookupBusy ? "…" : "Rechercher"}
              </button>
            </div>
            {userLookupOk && (
              <div className="mt-1.5 text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                Trouvé — raison sociale et adresse pré-remplies.
              </div>
            )}
            {userLookupError && (
              <div className="mt-1.5 text-[11px] text-red-600 leading-snug">
                {userLookupError}
              </div>
            )}
          </FormRow>
          <FormRow label="Raison sociale">
            <input
              type="text"
              value={profil.raisonSociale}
              onChange={(e) => update("raisonSociale", e.target.value)}
              placeholder="Ex : Vertxia Frigorifique"
              className="input-mobile"
            />
          </FormRow>
        </InsetListSection>

        {/* Adresse */}
        <InsetListSection title="Adresse">
          <FormRow label="Rue">
            <input
              type="text"
              value={profil.adresseRue}
              onChange={(e) => update("adresseRue", e.target.value)}
              placeholder="Ex : 12 avenue de la République"
              className="input-mobile"
            />
          </FormRow>
          <FormRow label="Code postal">
            <input
              type="text"
              value={profil.adresseCp}
              onChange={(e) => update("adresseCp", e.target.value)}
              placeholder="83000"
              inputMode="numeric"
              maxLength={5}
              className="input-mobile font-mono"
            />
          </FormRow>
          <FormRow label="Ville">
            <input
              type="text"
              value={profil.adresseVille}
              onChange={(e) => update("adresseVille", e.target.value)}
              placeholder="Toulon"
              className="input-mobile"
            />
          </FormRow>
        </InsetListSection>

        {/* Contact */}
        <InsetListSection title="Contact">
          <FormRow label="Téléphone">
            <input
              type="tel"
              value={profil.telephone}
              onChange={(e) => update("telephone", e.target.value)}
              placeholder="04 94 00 00 00"
              inputMode="tel"
              className="input-mobile"
            />
          </FormRow>
          <FormRow label="Email">
            <input
              type="email"
              value={profil.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="contact@vertxia.com"
              inputMode="email"
              className="input-mobile"
            />
          </FormRow>
          <FormRow label="Site web">
            <input
              type="url"
              value={profil.siteWeb || ""}
              onChange={(e) => update("siteWeb", e.target.value)}
              placeholder="https://vertxia.com"
              inputMode="url"
              className="input-mobile"
            />
          </FormRow>
        </InsetListSection>

        {/* Attestation F-Gas */}
        <InsetListSection title="Attestation F-Gas">
          <FormRow label="Numéro d'attestation">
            <input
              type="text"
              value={profil.numeroAttestation}
              onChange={(e) => update("numeroAttestation", e.target.value)}
              placeholder="FR-CAT1-XXXXX"
              className="input-mobile font-mono"
            />
          </FormRow>
          <FormRow label="Catégorie">
            <select
              value={profil.categorieAttestation}
              onChange={(e) =>
                update("categorieAttestation", e.target.value as CategorieAttestation | "")
              }
              className="input-mobile"
            >
              <option value="">— Sélectionner —</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Organisme agréé">
            <select
              value={profil.organismeAgree}
              onChange={(e) =>
                update("organismeAgree", e.target.value as (typeof ORGANISMES_AGREES)[number] | "")
              }
              className="input-mobile"
            >
              <option value="">— Sélectionner —</option>
              {ORGANISMES_AGREES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Date d'expiration">
            <input
              type="date"
              value={profil.dateExpirationAttestation?.slice(0, 10) || ""}
              onChange={(e) =>
                update(
                  "dateExpirationAttestation",
                  e.target.value ? new Date(e.target.value).toISOString() : ""
                )
              }
              className="input-mobile"
            />
          </FormRow>
        </InsetListSection>

        {/* Transport déchets */}
        <InsetListSection
          title="Transport de déchets dangereux"
          footer="Facultatif. Requis uniquement si vous transportez vous-même vos fluides récupérés vers le centre de traitement."
        >
          <FormRow label="N° de récépissé préfectoral">
            <input
              type="text"
              value={profil.numeroRecepisseTransport || ""}
              onChange={(e) => update("numeroRecepisseTransport", e.target.value)}
              placeholder="TVD-83-2026-XXXX"
              className="input-mobile font-mono"
            />
          </FormRow>
          <FormRow label="Immatriculation véhicule">
            <input
              type="text"
              value={profil.immatriculationVehicule || ""}
              onChange={(e) =>
                update("immatriculationVehicule", e.target.value.toUpperCase().replace(/\s+/g, ""))
              }
              placeholder="AB-123-CD"
              maxLength={10}
              className="input-mobile font-mono"
            />
          </FormRow>
        </InsetListSection>

        {/* BSFF officiel TrackDéchets — opt-in pour passer du mode démo
            sandbox au BSFF signé Ministère opposable légalement */}
        <InsetListSection
          title="BSFF officiel TrackDéchets"
          footer="Active le mode officiel pour que tes BSFF soient signés au Ministère (valeur légale). Sinon mode démo Vertxia (sandbox, gratuit, sans valeur légale)."
        >
          <div className="px-4 py-3 border-b border-black/[0.04]">
            <label className="text-[10px] uppercase tracking-wide text-black/45 font-medium">
              Mode
            </label>
            <select
              value={profil.trackdechetsMode || "sandbox"}
              onChange={(e) =>
                update("trackdechetsMode", e.target.value as "sandbox" | "production")
              }
              className="input-mobile mt-1 w-full"
            >
              <option value="sandbox">🧪 Démo (sandbox)</option>
              <option value="production">⚖️ Officiel Ministère</option>
            </select>
          </div>
          {profil.trackdechetsMode === "production" && (
            <>
              {/* OAuth2 TrackDéchets — bouton Connect / état Connecté */}
              <div className="px-4 py-3 border-b border-black/[0.04]">
                {profil.trackdechetsToken ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-emerald-700">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      Connecté à TrackDéchets
                    </div>
                    {(profil.raisonSociale || profil.siret) && (
                      <div className="text-[12px] text-black/55 leading-snug">
                        {profil.raisonSociale}
                        {profil.raisonSociale && profil.siret && " · "}
                        {profil.siret && `SIRET ${profil.siret}`}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleDisconnectTrackDechets}
                      className="text-[12px] text-red-600 underline active:opacity-60"
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      Déconnecter
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleConnectTrackDechets}
                      className="w-full px-4 py-3 rounded-xl bg-[#A16207] text-white text-[14px] font-medium active:opacity-90 transition-opacity flex items-center justify-center gap-2"
                      style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h6v6" />
                        <path d="M10 14L21 3" />
                        <path d="M21 14v7H3V3h7" />
                      </svg>
                      Connecter mon compte TrackDéchets
                    </button>
                    <div className="text-[11px] text-black/45 leading-relaxed">
                      Tu seras redirigé vers app.trackdechets.beta.gouv.fr pour autoriser Vertxia. Aucun copier-coller de token, l&apos;identité de ton entreprise est récupérée automatiquement.
                    </div>
                  </div>
                )}
              </div>
              <div className="px-4 py-3 border-b border-black/[0.04]">
                <label className="text-[10px] uppercase tracking-wide text-black/45 font-medium block mb-2">
                  Centre destination (régénération HFC)
                </label>
                {profil.bsffDestinationSiret && profil.bsffDestinationName && !editingDest ? (
                  <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-[#111] leading-snug">
                          {profil.bsffDestinationName}
                        </div>
                        <div className="text-[11px] text-black/55 font-mono mt-0.5">
                          SIRET {profil.bsffDestinationSiret}
                        </div>
                        {profil.bsffDestinationAddress && (
                          <div className="text-[11px] text-black/55 mt-0.5 leading-snug">
                            {profil.bsffDestinationAddress}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingDest(true)}
                        className="text-[12px] text-[#A16207] font-medium underline active:opacity-60 shrink-0"
                        style={{ WebkitTapHighlightColor: "transparent" }}
                      >
                        Changer
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <EntrepriseSearch
                      onSelect={handleSelectDestEntreprise}
                      placeholder="Tape un nom (ex: Climalife) ou un SIRET"
                    />
                    <div className="text-[11px] text-black/45 mt-1.5 leading-relaxed">
                      Recherche dans l&apos;annuaire officiel gouv.fr (INSEE). Choisis le site exact qui réceptionne tes bouteilles HFC.
                      {editingDest && profil.bsffDestinationSiret && (
                        <>
                          {" "}
                          <button
                            type="button"
                            onClick={() => setEditingDest(false)}
                            className="text-[#A16207] underline"
                            style={{ WebkitTapHighlightColor: "transparent" }}
                          >
                            Annuler
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </InsetListSection>

        {/* Submit + lien désktop pour signature */}
        <div className="px-4 mt-8 mb-4 space-y-2">
          <button
            type="submit"
            className="w-full px-6 py-4 rounded-2xl bg-[#111] text-white text-[15px] font-medium active:bg-black/90 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            {savedFlash ? "✓ Profil enregistré" : "Enregistrer le profil"}
          </button>
          {!profil.signatureDataUrl && (
            <a
              href="/m/profil/signature"
              className="block w-full px-6 py-3 rounded-2xl bg-white border border-black/10 text-black/70 text-[13px] font-medium text-center active:bg-black/[0.03] transition-colors"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              ✍️ Ajouter ma signature
            </a>
          )}
        </div>

        {profil.signatureDataUrl && (
          <div className="px-4 mb-4">
            <div className="rounded-2xl bg-white ring-1 ring-black/[0.04] px-4 py-3">
              <div className="text-[11px] font-medium text-black/45 uppercase tracking-wide mb-2">
                Signature enregistrée
              </div>
              <img
                src={profil.signatureDataUrl}
                alt="Signature"
                className="max-h-[60px] object-contain"
              />
              <a
                href="/m/profil/signature"
                className="inline-block mt-2 text-[12px] text-[#A16207] active:opacity-60"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                Modifier la signature →
              </a>
            </div>
          </div>
        )}

        {/* Outils admin */}
        {/* Compte connecté Vertxia (Supabase Auth). Permet de se déconnecter
            pour tester la fiche partagée publique avec un autre compte. */}
        {configured && (
          <InsetListSection
            title="Compte Vertxia"
            footer={
              user
                ? "Tes données restent sur cet appareil après déconnexion. Tu peux te reconnecter avec un autre compte Google."
                : authLoading
                  ? "Vérification de la session…"
                  : "Connecte-toi pour synchroniser tes équipements et bouteilles sur tous tes appareils, et activer le partage de fiches."
            }
          >
            {authLoading ? (
              <div className="px-4 py-5 flex items-center gap-3 text-black/45">
                <div className="w-4 h-4 rounded-full border-2 border-black/15 border-t-black/55 animate-spin" />
                <span className="text-[14px]">Chargement de la session…</span>
              </div>
            ) : user ? (
              <>
                <div className="px-4 py-3">
                  <div className="text-[11px] tracking-widest uppercase font-mono text-black/40 mb-1">
                    · Connecté
                  </div>
                  <div className="text-[15px] text-[#111] break-all">
                    {signingOut ? "Déconnexion…" : user.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="w-full px-4 py-3.5 text-left text-[15px] font-medium text-red-600 active:bg-red-50 transition-colors disabled:opacity-60 border-t border-black/[0.06]"
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                >
                  {signingOut ? "Déconnexion…" : "Se déconnecter"}
                </button>
              </>
            ) : (
              <>
                <div className="px-4 py-3">
                  <div className="text-[11px] tracking-widest uppercase font-mono text-black/40 mb-1">
                    · Non connecté
                  </div>
                  <div className="text-[13px] text-black/55">
                    Tes données restent sur cet appareil.
                  </div>
                </div>
                <a
                  href="/m/login"
                  className="block w-full px-4 py-3.5 text-left text-[15px] font-medium text-[#111] active:bg-black/[0.04] transition-colors border-t border-black/[0.06] inline-flex items-center gap-3"
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                >
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#111]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                  </span>
                  <span>Se connecter avec Google</span>
                </a>
              </>
            )}
          </InsetListSection>
        )}

      </form>

      <style jsx global>{`
        .input-mobile {
          width: 100%;
          padding: 10px 0;
          background: transparent;
          border: none;
          font-size: 16px;
          color: #111;
          outline: none;
          font-family: inherit;
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

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5">
      <div className="text-[11px] font-medium text-black/45 uppercase tracking-wide mb-0.5">
        {label}
      </div>
      {children}
    </div>
  );
}
