import crypto from "crypto";
import Stripe from "stripe";
import express from "express";
import db from "./db";

interface SettledInput {
  eventId: string;
  amount: number; // minor units (cents)
  currency?: string;
  campaign?: string;
  recurring?: number;
}

const insertDonation = db.prepare(`
  INSERT OR IGNORE INTO donations (id, amount, currency, campaign, recurring, status, source, settled_at)
  VALUES (?, ?, ?, ?, ?, 'settled', 'stripe_webhook', ?)
`);

const seenStmt = db.prepare("SELECT 1 FROM donation_events WHERE event_id = ?");
const markEventStmt = db.prepare("INSERT OR IGNORE INTO donation_events (event_id) VALUES (?)");

export function eventSeen(eventId: string): boolean {
  return !!seenStmt.get(eventId);
}

export function recordEvent(eventId: string): void {
  // INSERT OR IGNORE: a concurrent duplicate webhook for the same event must not
  // raise a UNIQUE error (which would surface as a spurious 500).
  markEventStmt.run(eventId);
}

export function recordSettledDonation(input: SettledInput): void {
  if (eventSeen(input.eventId)) return;
  const id = crypto.createHash("sha256").update(input.eventId).digest("hex").slice(0, 32);
  const settledAt = new Date().toISOString();
  insertDonation.run(id, input.amount, input.currency || "usd", input.campaign || "oncology", input.recurring || 0, settledAt);
  recordEvent(input.eventId);
}

export function getSettledDonationStats(): { totalDonations: number; settledUsd: number } {
  const row = db.prepare(`
    SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as cents
    FROM donations WHERE status = 'settled'
  `).get() as any;
  return { totalDonations: row.total, settledUsd: Math.round(row.cents / 100) };
}

export const donateRouter = express.Router();

donateRouter.post("/checkout", async (req, res) => {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return res.status(503).json({ error: "Donations not configured" });

  const amountMinor = Number(req.body?.amount);
  const recurring = Boolean(req.body?.recurring);
  if (!Number.isInteger(amountMinor) || amountMinor < 100) {
    return res.status(400).json({ error: "amount must be integer minor units >= 100" });
  }

  try {
    const stripe = new Stripe(secret);
    const appUrl = (
      process.env.APP_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
    ).trim();

    const params: Stripe.Checkout.SessionCreateParams = recurring
      ? {
          mode: "subscription",
          line_items: [{ price: process.env.STRIPE_PRICE_DONATE_RECURRING!, quantity: 1 }],
          metadata: { campaign: "oncology" },
          success_url: `${appUrl}/?donated=1`,
          cancel_url: `${appUrl}/`,
        }
      : {
          mode: "payment",
          line_items: [{ price_data: { currency: "usd", unit_amount: amountMinor, product_data: { name: "Donation to Overlay Oncology Research" } } }],
          metadata: { campaign: "oncology" },
          success_url: `${appUrl}/?donated=1`,
          cancel_url: `${appUrl}/`,
        };

    const session = await stripe.checkout.sessions.create(params);
    return res.json({ url: session.url });
  } catch (e: any) {
    console.error("Donation checkout error:", e);
    return res.status(500).json({ error: e?.message || "Checkout failed" });
  }
});

donateRouter.post("/webhook", async (req, res) => {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) return res.status(503).json({ error: "Donations not configured" });

  const sig = String(req.headers["stripe-signature"] || "");
  if (!sig) return res.status(400).json({ error: "Invalid signature" });

  try {
    const event = new Stripe(secret).webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    if (eventSeen(event.id)) return res.status(200).json({ received: true });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      // One-time payment mode records here. For subscriptions, Stripe also fires
      // checkout.session.completed AND invoice.paid for the first charge (with
      // different event ids), so only record subscription charges from
      // invoice.paid below to avoid double-counting the initial payment.
      if (session.mode !== "subscription") {
        recordSettledDonation({
          eventId: event.id,
          amount: session.amount_total || 0,
          currency: session.currency || "usd",
          campaign: session.metadata?.campaign || "oncology",
          recurring: 0,
        });
      }
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      recordSettledDonation({
        eventId: event.id,
        amount: invoice.amount_paid || 0,
        currency: invoice.currency || "usd",
        campaign: "oncology",
        recurring: 1,
      });
    }
    return res.status(200).json({ received: true });
  } catch (e) {
    console.error("Donation webhook error:", e);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

donateRouter.get("/stats", (req, res) => {
  res.json(getSettledDonationStats());
});
