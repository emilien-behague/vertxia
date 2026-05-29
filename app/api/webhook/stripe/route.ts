/**
 * POST /api/webhook/stripe
 *
 * Endpoint Stripe Webhooks — recoit les events apres Checkout / Subscription / Payment.
 *
 * V0.8 fixes audit :
 *  [H4] Idempotence : table stripe_events_seen avec PK sur event_id. Si on
 *       a deja traite cet event, on skip (Stripe peut retry 3 jours).
 *  [M8] Logs : emails masques (PII / GDPR).
 *
 * Logique metier :
 *  - checkout.session.completed -> lie le Stripe customer_id au user.id (filet
 *    de securite si /api/checkout/confirm a echoue cote client).
 *  - autres events : log uniquement (V0.9 wired sur quota + status DB).
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { linkStripeCustomerToUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

function maskEmail(e: string | null | undefined): string {
  if (!e) return "(absent)";
  const at = e.indexOf("@");
  if (at < 2) return "***";
  return `${e.slice(0, 2)}***${e.slice(at)}`;
}

async function alreadyProcessed(eventId: string, eventType: string): Promise<boolean> {
  // INSERT ... ON CONFLICT DO NOTHING + check si une ligne a ete affectee
  const rows = (await db`
    INSERT INTO stripe_events_seen (event_id, event_type)
    VALUES (${eventId}, ${eventType})
    ON CONFLICT (event_id) DO NOTHING
    RETURNING event_id
  `) as unknown as Array<{ event_id: string }>;
  return rows.length === 0;
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret non configure" },
      { status: 400 }
    );
  }

  // Cap body size — defense contre payload DoS
  const lenHeader = req.headers.get("content-length");
  if (lenHeader && Number(lenHeader) > 1_000_000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    // eslint-disable-next-line no-console
    console.error("[webhook] Signature verification failed:", msg);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // [H4] Idempotence : si on a deja vu cet event_id, on skip
  try {
    if (await alreadyProcessed(event.id, event.type)) {
      // eslint-disable-next-line no-console
      console.log(`[webhook] Skip duplicate event: ${event.type} (${event.id})`);
      return NextResponse.json({ received: true, duplicate: true });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[webhook] Idempotency check failed:", err);
    // On continue : mieux vaut potentiellement traiter 2x que de manquer un event
  }

  // eslint-disable-next-line no-console
  console.log(`[webhook] Event: ${event.type} (id: ${event.id})`);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;
      const userId =
        session.client_reference_id ||
        session.metadata?.vertxia_user_id ||
        null;

      // eslint-disable-next-line no-console
      console.log("[webhook] Checkout completed:", {
        email: maskEmail(
          session.customer_email || session.customer_details?.email
        ),
        tier: session.metadata?.vertxia_tier,
        period: session.metadata?.vertxia_period,
        userId,
        customerId,
      });

      if (customerId?.startsWith("cus_") && userId) {
        try {
          const res = await linkStripeCustomerToUser(userId, customerId);
          if (!res.ok) {
            // eslint-disable-next-line no-console
            console.warn("[webhook] Link refused:", res.reason);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[webhook] Failed to link user/customer:", err);
        }
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      // eslint-disable-next-line no-console
      console.log(`[webhook] ${event.type}:`, {
        id: sub.id,
        status: sub.status,
        customer: sub.customer,
        tier: sub.metadata?.vertxia_tier,
        cancel_at_period_end: sub.cancel_at_period_end,
      });
      break;
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      // eslint-disable-next-line no-console
      console.log(`[webhook] ${event.type}:`, {
        id: invoice.id,
        customer: invoice.customer,
        amount_paid: invoice.amount_paid,
        amount_due: invoice.amount_due,
      });
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
