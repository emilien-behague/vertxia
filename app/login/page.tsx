"use client";

/**
 * /login — page d'auth magic link.
 *
 * State machine :
 *   - idle  : form email
 *   - sent  : message "verifie ton email"
 *   - error : message + retry
 *
 * UI premium dark cohereent avec /pricing et /checkout/success.
 */

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginInner() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const errorMessage = (() => {
    if (error) return error;
    if (urlError === "expired") return "Lien expire. Demande un nouveau lien.";
    if (urlError === "already_used") return "Ce lien a deja ete utilise.";
    if (urlError === "invalid") return "Lien invalide. Demande un nouveau lien.";
    if (urlError === "google_denied") return "Connexion Google annulee.";
    if (urlError === "google_state") return "Session Google expiree. Reessaye.";
    if (urlError === "google_exchange") return "Echec d'echange Google. Reessaye.";
    if (urlError === "google_unverified")
      return "Email Google non verifie. Utilise un autre compte ou le magic link.";
    if (urlError === "google_invalid") return "Reponse Google invalide. Reessaye.";
    return null;
  })();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setState("sending");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(json.error || "Erreur lors de l'envoi");
        setState("idle");
        return;
      }
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur reseau");
      setState("idle");
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white antialiased relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% -10%, rgba(214,185,110,0.08) 0%, transparent 65%), radial-gradient(ellipse 50% 30% at 50% 110%, rgba(138,92,255,0.06) 0%, transparent 60%)",
        }}
      />

      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-8">
        {/* Logo */}
        <Link href="/" className="mb-10" aria-label="Vertxia">
          <div
            className="w-10 h-10 rounded-lg grid place-items-center text-black font-black text-[15px] mx-auto"
            style={{
              background:
                "linear-gradient(135deg, #FFC533 0%, #FF7A3D 40%, #FF5A8A 100%)",
            }}
          >
            V
          </div>
        </Link>

        <div className="w-full max-w-[380px]">
          {state === "sent" ? (
            <SentState email={email} />
          ) : (
            <>
              <p className="text-[11px] tracking-[0.22em] uppercase font-medium text-[#D6B96E]/85 mb-3 text-center">
                Connexion
              </p>
              <h1
                className="text-[28px] md:text-[32px] font-semibold tracking-[-0.025em] leading-[1.1] mb-2 text-center"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                Connecte-toi a Vertxia.
              </h1>
              <p className="text-[13.5px] text-white/55 leading-relaxed text-center mb-8">
                On t&apos;envoie un lien magique par email — pas de mot de passe a
                retenir.
              </p>

              {/* Google sign-in (bouton primaire haut) */}
              <a
                href="/api/auth/google"
                className="w-full h-11 rounded-xl bg-white text-black text-[14px] font-medium transition hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3 mb-4"
              >
                <GoogleIcon />
                Continuer avec Google
              </a>

              {/* Separator */}
              <div className="relative my-5 flex items-center" aria-hidden>
                <div className="flex-1 h-px bg-white/[0.08]" />
                <span className="px-3 text-[10.5px] tracking-[0.18em] uppercase text-white/35">
                  ou avec ton email
                </span>
                <div className="flex-1 h-px bg-white/[0.08]" />
              </div>

              {/* Magic link form */}
              <form onSubmit={onSubmit} className="space-y-3">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ton@email.com"
                  disabled={state === "sending"}
                  className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-white/[0.25] outline-none text-[14px] text-white placeholder:text-white/35 transition disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={state === "sending" || !email.trim()}
                  className="w-full h-11 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white text-[14px] font-medium transition hover:bg-white/[0.10] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {state === "sending"
                    ? "Envoi en cours..."
                    : "Recevoir un lien magique"}
                </button>
              </form>

              {errorMessage && (
                <p className="mt-4 text-[12.5px] text-red-300/85 text-center">
                  {errorMessage}
                </p>
              )}

              <p className="mt-8 text-[11.5px] text-white/35 text-center leading-relaxed">
                Pas encore de compte ? Saisis ton email — il sera cree
                automatiquement.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function SentState({ email }: { email: string }) {
  return (
    <div className="text-center">
      <div
        className="w-14 h-14 rounded-full mx-auto mb-6 grid place-items-center"
        style={{
          background: "rgba(101,229,165,0.12)",
          border: "1px solid rgba(101,229,165,0.35)",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgb(101,229,165)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <polyline points="3,7 12,13 21,7" />
        </svg>
      </div>
      <p className="text-[11px] tracking-[0.22em] uppercase font-medium text-[#D6B96E]/85 mb-3">
        Verifie ta boite mail
      </p>
      <h1
        className="text-[26px] font-semibold tracking-[-0.02em] leading-[1.15] mb-3"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        On t&apos;a envoye un lien.
      </h1>
      <p className="text-[13.5px] text-white/55 leading-relaxed max-w-sm mx-auto">
        Clique sur le lien dans l&apos;email envoye a{" "}
        <span className="text-white">{email}</span> pour te connecter. Le lien
        expire dans 15 minutes.
      </p>
      <p className="mt-8 text-[11.5px] text-white/35">
        Pas recu ?{" "}
        <Link
          href="/login"
          className="text-white/55 underline underline-offset-2 decoration-white/20 hover:decoration-white"
        >
          Reessaye
        </Link>
        {" — verifie aussi tes spams."}
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-[#050505]" />}
    >
      <LoginInner />
    </Suspense>
  );
}
