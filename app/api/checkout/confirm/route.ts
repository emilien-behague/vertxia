/**
 * GET /api/checkout/confirm?session_id=cs_test_...
 *
 * Endpoint intermediaire entre Stripe Checkout et /checkout/success.
 *
 * [SECURITY H2/H3] :
 *  - Verifie que le user logge match le client_reference_id de la session Stripe.
 *    Empeche un attaquant de "voler" la liaison customer_id en exploitant un
 *    session_id leake.
 *  - `linkStripeCustomerToUser` est conditionnel (impl dans lib/auth.ts) :
 *    rejette si le customer_id appartient deja a un autre user, et n'ecrase
 *    pas un lien existant different.
 *
 * Si match : lie customer_id -> user.id.
 * Sinon : redirige sans lier (le webhook fera le lien de maniere fiable).
 */

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { linkStripeCustomerToUser } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  const origin = req.nextUrl.origin;

  if (!sessionId || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return NextResponse.redirect(`${origin}/checkout/success`);
  }

  try {
    const user = await getCurrentUser();
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id;
    const sessionUserId =
      session.client_reference_id ||
      session.metadata?.vertxia_user_id ||
      null;

    // [SECURITY H2] Lier seulement si le user logge MATCH le client_reference_id
    if (
      user &&
      sessionUserId &&
      user.id === sessionUserId &&
      customerId?.startsWith("cus_")
    ) {
      const res = await linkStripeCustomerToUser(user.id, customerId);
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.warn("[checkout/confirm] Link refused:", res.reason);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[checkout/confirm] Error:", err);
    // Pas bloquant — la page success rend, et le webhook rejouera le lien
  }

  return NextResponse.redirect(
    `${origin}/checkout/success?session_id=${sessionId}`
  );
}
