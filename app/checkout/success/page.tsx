/**
 * /checkout/success — page d'arrivee apres Stripe Checkout reussi.
 *
 * Stripe redirige ici avec ?session_id=cs_test_... (CHECKOUT_SESSION_ID).
 * On lit la session cote serveur pour afficher email + tier achetes et confirmer.
 *
 * V0 : pas d'auth user encore, donc on affiche juste un "merci, email envoye"
 *      avec lien direct vers /app pour commencer immediatement.
 *      Le webhook (V0.8) traitera la creation du compte user automatiquement.
 */

import Link from "next/link";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const { session_id } = await searchParams;

  let email: string | null = null;
  let tierLabel: string | null = null;
  let amount: number | null = null;
  let currency = "eur";

  if (session_id && /^cs_(test|live)_[A-Za-z0-9]+$/.test(session_id)) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ["line_items"],
      });
      email = session.customer_email || session.customer_details?.email || null;
      const tierMeta = session.metadata?.vertxia_tier;
      const periodMeta = session.metadata?.vertxia_period;
      if (tierMeta && periodMeta) {
        tierLabel = `${tierMeta.charAt(0).toUpperCase()}${tierMeta.slice(1)} · ${
          periodMeta === "annual" ? "Annuel" : "Mensuel"
        }`;
      }
      amount = session.amount_total ?? null;
      currency = session.currency || "eur";
      // Note : le cookie vertxia_customer_id est set par /api/checkout/confirm
      // (route handler appele AVANT la redirection vers cette page).
    } catch {
      // ignore — fallback message generique
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white antialiased relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% -10%, rgba(214,185,110,0.10) 0%, transparent 65%), radial-gradient(ellipse 50% 30% at 50% 110%, rgba(101,229,165,0.08) 0%, transparent 60%)",
        }}
      />

      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-8 text-center">
        {/* Logo */}
        <Link href="/" className="mb-12" aria-label="Vertxia">
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

        {/* Success icon */}
        <div
          className="w-14 h-14 rounded-full grid place-items-center mb-6"
          style={{
            background: "rgba(101,229,165,0.12)",
            border: "1px solid rgba(101,229,165,0.35)",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgb(101,229,165)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <p className="text-[11px] tracking-[0.22em] uppercase font-medium text-[#D6B96E]/85 mb-3">
          Paiement validé
        </p>
        <h1
          className="text-[36px] md:text-[48px] font-semibold tracking-[-0.025em] leading-[1.05] mb-6"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          Bienvenue dans Vertxia.
        </h1>

        <p className="text-[15px] text-white/65 leading-relaxed max-w-md">
          Ton essai 7 jours démarre maintenant.
          {email && (
            <>
              {" "}
              Nous avons envoyé un email de confirmation à{" "}
              <span className="text-white">{email}</span>.
            </>
          )}
        </p>

        {(tierLabel || amount) && (
          <div className="mt-8 inline-flex flex-col items-center gap-1 px-5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            {tierLabel && (
              <p className="text-[12px] text-white/55 tracking-wide">
                Plan : <span className="text-white font-medium">{tierLabel}</span>
              </p>
            )}
            {amount !== null && (
              <p className="text-[12px] text-white/55 tracking-wide">
                Montant :{" "}
                <span className="text-white font-medium">
                  {(amount / 100).toFixed(2)}{" "}
                  {currency.toUpperCase()}
                </span>
              </p>
            )}
          </div>
        )}

        <Link
          href="/app"
          className="mt-10 inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-white text-black text-[14px] font-medium hover:scale-[1.02] active:scale-[0.98] transition"
        >
          Lancer mon premier site →
        </Link>

        <p className="mt-6 text-[11.5px] text-white/35">
          Une question ? Réponds à l'email de confirmation ou écris à{" "}
          <a
            href="mailto:emilien@vertxia.com"
            className="text-white/55 underline underline-offset-2 decoration-white/20 hover:decoration-white"
          >
            emilien@vertxia.com
          </a>
        </p>
      </main>
    </div>
  );
}
