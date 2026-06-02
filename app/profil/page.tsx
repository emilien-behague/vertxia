"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import SignatureCanvas from "react-signature-canvas";
import {
  loadProfil,
  saveProfil,
  ORGANISMES_AGREES,
  type Profil,
  type CategorieAttestation,
} from "@/lib/profil";

const CATEGORIES: { value: CategorieAttestation; label: string; desc: string }[] = [
  { value: "I", label: "I", desc: "Tous équipements, toutes opérations" },
  { value: "II", label: "II", desc: "Équipements < 2 kg + contrôle d'étanchéité tous équipements" },
  { value: "III", label: "III", desc: "Récupération des fluides < 2 kg" },
  { value: "IV", label: "IV", desc: "Contrôle d'étanchéité uniquement" },
  { value: "V", label: "V", desc: "Climatisation véhicules" },
];

const MAX_LOGO_SIZE = 500 * 1024; // 500 KB

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ProfilPage() {
  const [mounted, setMounted] = useState(false);
  const [profil, setProfil] = useState<Profil>(loadProfil());
  const [savedFlash, setSavedFlash] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const sigRef = useRef<SignatureCanvas | null>(null);

  useEffect(() => {
    setMounted(true);
    setProfil(loadProfil());
  }, []);

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
      setUploadError("Le logo doit être une image (PNG, JPG, SVG).");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      update("logoDataUrl", dataUrl);
    } catch {
      setUploadError("Impossible de lire le fichier.");
    }
  }

  function handleSignatureValidate() {
    const canvas = sigRef.current;
    if (!canvas) return;
    if (canvas.isEmpty()) {
      setUploadError("La signature est vide. Trace-la d'abord.");
      return;
    }
    setUploadError(null);
    // toDataURL("image/png") sur le getCanvas() évite le bug "white background"
    // du wrapper getTrimmedCanvas qui modifie l'aspect ratio.
    const dataUrl = canvas.getCanvas().toDataURL("image/png");
    update("signatureDataUrl", dataUrl);
    setSigning(false);
  }

  function handleSignatureClear() {
    sigRef.current?.clear();
    setUploadError(null);
  }

  function handleSignatureReset() {
    update("signatureDataUrl", undefined);
    setSigning(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveProfil(profil);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#111] font-sans antialiased">
      <div className="max-w-4xl mx-auto px-6 md:px-8 py-12 md:py-16">
        {/* Header nav */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-between mb-10"
        >
          <a
            href="/dashboard"
            className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors"
          >
            ← TABLEAU DE BORD
          </a>
          <div className="flex items-center gap-5">
            <a href="/bsff" className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors">
              NOUVELLE INTERVENTION
            </a>
          </div>
        </motion.div>

        <h1 className="text-4xl md:text-5xl font-light leading-[1.05] tracking-tight">
          Profil entreprise
        </h1>
        <p className="mt-3 text-sm text-black/50 leading-relaxed max-w-2xl">
          Ces informations apparaissent sur tous vos documents générés par Vertxia :
          BSFF, CERFA, rapports d&apos;intervention, déclaration SYDEREP. Plus elles
          sont complètes, plus vos livrables paraissent professionnels à vos clients.
        </p>

        {/* Bandeau OAuth2 — info pre-remplissage futur */}
        <div className="mt-6 rounded-xl border border-blue-200/50 bg-blue-50/50 px-5 py-3">
          <div className="flex items-start gap-3">
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-blue-700 mt-0.5">
              ROADMAP
            </span>
            <p className="text-xs text-blue-900/80 leading-relaxed">
              Quand l&apos;intégration OAuth2 TrackDéchets sera prête, SIRET, raison
              sociale et adresse seront pré-remplis automatiquement depuis votre
              compte TrackDéchets — vous n&apos;aurez plus qu&apos;à compléter la
              partie F-Gas et le logo.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 space-y-10">
          {/* Section 1 — Identité légale */}
          <Section title="Identité légale" subtitle="Apparaîtra dans l'en-tête de tous vos PDF.">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Raison sociale *">
                <input
                  required
                  value={profil.raisonSociale}
                  onChange={(e) => update("raisonSociale", e.target.value)}
                  placeholder="Ex : Froid Méditerranée SARL"
                  className="input-vertxia"
                />
              </Field>
              <Field label="SIRET *">
                <input
                  required
                  pattern="[0-9 ]{14,17}"
                  value={profil.siret}
                  onChange={(e) => update("siret", e.target.value)}
                  placeholder="123 456 789 00012"
                  className="input-vertxia font-mono"
                />
              </Field>
            </div>
            <Field label="Adresse — rue *">
              <input
                required
                value={profil.adresseRue}
                onChange={(e) => update("adresseRue", e.target.value)}
                placeholder="14 avenue de la République"
                className="input-vertxia"
              />
            </Field>
            <div className="grid md:grid-cols-3 gap-4">
              <Field label="Code postal *">
                <input
                  required
                  pattern="[0-9]{5}"
                  maxLength={5}
                  value={profil.adresseCp}
                  onChange={(e) => update("adresseCp", e.target.value)}
                  placeholder="83000"
                  className="input-vertxia font-mono"
                />
              </Field>
              <Field label="Ville *">
                <input
                  required
                  value={profil.adresseVille}
                  onChange={(e) => update("adresseVille", e.target.value)}
                  placeholder="Toulon"
                  className="input-vertxia md:col-span-2"
                />
              </Field>
              <Field label="Téléphone">
                <input
                  type="tel"
                  value={profil.telephone}
                  onChange={(e) => update("telephone", e.target.value)}
                  placeholder="04 94 00 00 00"
                  className="input-vertxia font-mono"
                />
              </Field>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Email pro">
                <input
                  type="email"
                  value={profil.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="contact@froidmed.fr"
                  className="input-vertxia"
                />
              </Field>
              <Field label="Site web (optionnel)">
                <input
                  type="url"
                  value={profil.siteWeb}
                  onChange={(e) => update("siteWeb", e.target.value)}
                  placeholder="https://froidmed.fr"
                  className="input-vertxia"
                />
              </Field>
            </div>
          </Section>

          {/* Section 2 — Attestation F-Gas */}
          <Section
            title="Attestation de capacité F-Gas"
            subtitle="Numéro et catégorie obligatoires pour tout BSFF et CERFA officiel."
          >
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Numéro d'attestation *">
                <input
                  required
                  value={profil.numeroAttestation}
                  onChange={(e) => update("numeroAttestation", e.target.value)}
                  placeholder="Ex : 123456-1"
                  className="input-vertxia font-mono"
                />
              </Field>
              <Field label="Date d'expiration">
                <input
                  type="date"
                  value={profil.dateExpirationAttestation}
                  onChange={(e) => update("dateExpirationAttestation", e.target.value)}
                  className="input-vertxia"
                />
              </Field>
            </div>
            <Field label="Catégorie *">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                {CATEGORIES.map((cat) => (
                  <label
                    key={cat.value}
                    className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                      profil.categorieAttestation === cat.value
                        ? "border-black bg-black/[0.04]"
                        : "border-black/10 bg-white hover:border-black/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="categorie"
                      value={cat.value}
                      checked={profil.categorieAttestation === cat.value}
                      onChange={() => update("categorieAttestation", cat.value)}
                      className="sr-only"
                    />
                    <div className="text-2xl font-light">{cat.label}</div>
                    <div className="text-[10px] text-black/50 mt-1 leading-tight">
                      {cat.desc}
                    </div>
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Organisme certificateur">
              <select
                value={profil.organismeAgree}
                onChange={(e) =>
                  update("organismeAgree", e.target.value as Profil["organismeAgree"])
                }
                className="input-vertxia"
              >
                <option value="">— Choisir —</option>
                {ORGANISMES_AGREES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          {/* Section 3 — Transport déchets dangereux */}
          <Section
            title="Transport de déchets dangereux"
            subtitle="Optionnel — pour les BSFF si vous transportez vous-même les bouteilles de fluide récupéré."
          >
            <Field label="Numéro de récépissé de transport ADR">
              <input
                value={profil.numeroRecepisseTransport}
                onChange={(e) => update("numeroRecepisseTransport", e.target.value)}
                placeholder="Ex : 2024/83/00123"
                className="input-vertxia font-mono"
              />
            </Field>
          </Section>

          {/* Section 4 — Logo et signature */}
          <Section
            title="Logo et signature"
            subtitle="Le logo apparaît sur l'en-tête de vos PDF, la signature est apposée automatiquement sur les rapports d'intervention."
          >
            {uploadError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-800">
                {uploadError}
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-6">
              <Field label="Logo (PNG/JPG/SVG, max 500 KB)">
                <div className="space-y-3">
                  {profil.logoDataUrl ? (
                    <div className="rounded-xl border border-black/10 bg-white p-4 flex items-center justify-center min-h-[120px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={profil.logoDataUrl}
                        alt="Logo entreprise"
                        className="max-h-24 max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-black/15 bg-white/40 p-6 text-center min-h-[120px] flex items-center justify-center">
                      <span className="text-xs text-black/40">Aucun logo</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer px-4 py-2 rounded-lg bg-white border border-black/10 hover:border-black/30 text-xs font-mono tracking-widest uppercase transition-colors">
                      Choisir un logo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="sr-only"
                      />
                    </label>
                    {profil.logoDataUrl && (
                      <button
                        type="button"
                        onClick={() => update("logoDataUrl", undefined)}
                        className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-mono tracking-widest uppercase transition-colors"
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                </div>
              </Field>

              <Field label="Signature du gérant — trace-la directement">
                <div className="space-y-3">
                  {profil.signatureDataUrl && !signing ? (
                    <>
                      <div className="rounded-xl border border-black/10 bg-white p-4 flex items-center justify-center min-h-[180px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={profil.signatureDataUrl}
                          alt="Signature gérant"
                          className="max-h-32 max-w-full object-contain"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSignatureReset}
                          className="px-4 py-2 rounded-lg bg-white border border-black/10 hover:border-black/30 text-xs font-mono tracking-widest uppercase transition-colors"
                        >
                          Re-signer
                        </button>
                        <button
                          type="button"
                          onClick={() => update("signatureDataUrl", undefined)}
                          className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-mono tracking-widest uppercase transition-colors"
                        >
                          Retirer
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="border-2 border-black/15 rounded-xl bg-white overflow-hidden">
                        <SignatureCanvas
                          ref={sigRef}
                          penColor="#111"
                          canvasProps={{
                            width: 460,
                            height: 180,
                            className: "w-full h-[180px] touch-none cursor-crosshair",
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSignatureValidate}
                          className="px-4 py-2 rounded-lg bg-[#111] hover:bg-[#333] text-white text-xs font-mono tracking-widest uppercase transition-colors"
                        >
                          Enregistrer la signature
                        </button>
                        <button
                          type="button"
                          onClick={handleSignatureClear}
                          className="px-3 py-2 rounded-lg bg-white border border-black/10 hover:border-black/30 text-xs font-mono tracking-widest uppercase transition-colors"
                        >
                          Effacer
                        </button>
                        {profil.signatureDataUrl && (
                          <button
                            type="button"
                            onClick={() => setSigning(false)}
                            className="px-3 py-2 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-xs font-mono tracking-widest uppercase transition-colors"
                          >
                            Annuler
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-black/40 leading-relaxed">
                        Signe au doigt sur mobile / tablette ou à la souris.
                        Cette signature sera apposée automatiquement sur les rapports d&apos;intervention.
                      </p>
                    </>
                  )}
                </div>
              </Field>
            </div>
          </Section>

          {/* Submit */}
          <div className="sticky bottom-4 z-10 flex items-center justify-end gap-4 pt-6 border-t border-black/[0.06]">
            {savedFlash && (
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="font-mono text-[10px] tracking-[0.2em] uppercase text-emerald-700"
              >
                ✓ Enregistré
              </motion.span>
            )}
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-[#111] text-white text-xs font-mono tracking-widest uppercase hover:bg-[#333] transition-colors"
            >
              Enregistrer le profil
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        .input-vertxia {
          width: 100%;
          padding: 0.625rem 0.875rem;
          background: white;
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          color: #111;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input-vertxia:focus {
          outline: none;
          border-color: rgba(0, 0, 0, 0.5);
          box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.05);
        }
        .input-vertxia::placeholder {
          color: rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-black/50 mt-1">{subtitle}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/40 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
