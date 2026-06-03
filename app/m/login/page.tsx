"use client";

/**
 * /m/login — Connexion compte Vertxia mobile.
 *
 * Auth via Supabase :
 *  - Google OAuth (1 clic)
 *  - Magic link email (fallback)
 *
 * Mode hybride : si l'utilisateur ne se connecte PAS, /m/* reste utilisable
 * avec localStorage uniquement (mode démo libre). Le compte sert à la sync
 * cross-device et à la persistance long terme.
 */

// Force dynamic : empêche Next.js de pré-rendre cette page côté serveur
// au build (sinon createClient throw si env vars Supabase absentes).
export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

function MobileLoginInner() {
  const configured = isSupabaseConfigured();
  // Pas d'env vars Supabase → affiche un message au lieu de planter
  if (!configured) {
    return (
      <>
        <MobileHeader title="Connexion" largeTitle backHref="/m" />
        <div className="px-5 mt-6">
          <div className="px-5 py-6 rounded-2xl bg-amber-50 ring-1 ring-amber-200">
            <div className="text-[10px] tracking-widest uppercase font-mono text-amber-800 mb-2">
              · Auth non configurée
            </div>
            <h2 className="text-[18px] font-semibold text-amber-900 mb-2">
              La connexion n&apos;est pas encore activée
            </h2>
            <p className="text-[13px] text-amber-800 leading-relaxed mb-4">
              Le système de compte est en cours de configuration. Tu peux continuer à utiliser l&apos;app en mode démo : tes données restent sur ton téléphone.
            </p>
            <Link
              href="/m"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#111] text-white text-[14px] font-medium"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              ← Retour à l&apos;app
            </Link>
          </div>
        </div>
      </>
    );
  }
  const supabase = createClient();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const fromPath = searchParams.get("from") || "/m";

  const [email, setEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(fromPath)}`,
      },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
    // Si OK, navigateur redirige automatiquement vers Google
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(fromPath)}`,
      },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    setMagicSent(true);
    setBusy(false);
  }

  return (
    <>
      <MobileHeader title="Connexion" largeTitle backHref="/m" />

      <div className="px-5 mt-2">
        <p className="text-[14px] text-black/55 leading-relaxed mb-6">
          Connecte-toi pour synchroniser tes équipements, bouteilles et interventions sur tous tes appareils (iPhone, ordi, iPad). Sinon, tu peux continuer en mode démo libre — tes données restent sur ton téléphone.
        </p>

        {urlError && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 ring-1 ring-red-200 text-[13px] text-red-700">
            ❌ {urlError}
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 ring-1 ring-red-200 text-[13px] text-red-700">
            ❌ {error}
          </div>
        )}

        {magicSent ? (
          <div className="px-5 py-6 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200">
            <div className="text-[10px] tracking-widest uppercase font-mono text-emerald-700 mb-2">
              · Email envoyé
            </div>
            <h2 className="text-[18px] font-semibold text-emerald-900 mb-2">
              Vérifie ta boîte mail
            </h2>
            <p className="text-[13px] text-emerald-800 leading-relaxed">
              On t&apos;a envoyé un lien à <strong>{email}</strong>. Clique dessus depuis ce même téléphone pour te connecter automatiquement.
            </p>
            <button
              type="button"
              onClick={() => {
                setMagicSent(false);
                setEmail("");
              }}
              className="mt-4 text-[12px] text-emerald-700 underline"
            >
              Utiliser une autre adresse
            </button>
          </div>
        ) : (
          <>
            {/* Bouton Google — primary CTA */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="w-full px-6 py-4 rounded-2xl bg-white border border-black/15 text-[#111] text-[15px] font-medium flex items-center justify-center gap-3 active:bg-black/[0.03] transition-colors disabled:opacity-60"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              <GoogleLogo />
              <span>Continuer avec Google</span>
            </button>

            {/* Séparateur */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-black/10" />
              <span className="text-[10px] tracking-widest uppercase font-mono text-black/35">
                ou
              </span>
              <div className="flex-1 h-px bg-black/10" />
            </div>

            {/* Magic link email */}
            <form onSubmit={handleMagicLink}>
              <label className="block text-[11px] tracking-widest uppercase font-mono text-black/40 mb-2">
                Lien magique par email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.com"
                required
                disabled={busy}
                className="w-full px-4 py-3 rounded-2xl border border-black/15 text-[15px] text-[#111] bg-white outline-none focus:border-black/40 transition-colors mb-3"
                style={{ WebkitTapHighlightColor: "transparent" }}
              />
              <button
                type="submit"
                disabled={busy || !email.trim()}
                className="w-full px-6 py-4 rounded-2xl bg-[#111] text-white text-[15px] font-medium active:bg-black/90 transition-colors disabled:opacity-60"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                {busy ? "Envoi…" : "Recevoir mon lien"}
              </button>
            </form>

            {/* Pas d'échappatoire — la connexion est obligatoire pour
                accéder à l'app. Tu peux retourner au site principal. */}
            <div className="mt-8 text-center">
              <Link
                href="/"
                className="text-[12px] text-black/45 underline underline-offset-4"
              >
                ← Retour au site
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function MobileLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="px-5 py-20 text-center">
          <div className="inline-block w-8 h-8 border-2 border-black/15 border-t-[#111] rounded-full animate-spin" />
        </div>
      }
    >
      <MobileLoginInner />
    </Suspense>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
