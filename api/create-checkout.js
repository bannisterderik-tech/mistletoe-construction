// Mistletoe Construction — Stripe Checkout session creator (Vercel serverless).
// Reads the secret ONLY from process.env.STRIPE_SECRET_KEY (set in Vercel env vars).
// The secret never appears in this file or anywhere in the repo.
const Stripe = require("stripe");

const ORIGIN = "https://mistletoeconstruction.com";

module.exports = async (req, res) => {
  // CORS (same-origin in practice; harmless to allow the site)
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) { res.status(503).json({ error: "Payments aren't switched on yet — add STRIPE_SECRET_KEY in Vercel." }); return; }

  let body = req.body;
  try { if (typeof body === "string") body = JSON.parse(body || "{}"); } catch (e) { body = {}; }
  body = body || {};

  const stripe = new Stripe(key);
  try {
    let session;

    if (body.kind === "membership") {
      // Recurring $49/month Home Care Membership
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: "Mistletoe Home Care Membership — Essential",
              description: "Annual roof & gutter inspection, seasonal debris checks, priority scheduling, 10% off repairs, photo reports, emergency tarping."
            },
            unit_amount: 4900,
            recurring: { interval: "month" }
          },
          quantity: 1
        }],
        customer_email: body.email || undefined,
        allow_promotion_codes: true,
        billing_address_collection: "auto",
        metadata: { kind: "membership", name: (body.name || "").slice(0, 200) },
        success_url: ORIGIN + "/membership.html?joined=1",
        cancel_url: ORIGIN + "/membership.html"
      });

    } else if (body.kind === "invoice") {
      const amount = Math.round(Number(body.amount) * 100);
      if (!Number.isFinite(amount) || amount < 100) { res.status(400).json({ error: "Invalid amount" }); return; }
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: (body.label || "Mistletoe Construction — invoice").slice(0, 250) },
            unit_amount: amount
          },
          quantity: 1
        }],
        customer_email: body.email || undefined,
        metadata: { kind: "invoice", invoiceId: (body.invoiceId || "").slice(0, 64) },
        success_url: ORIGIN + "/portal/index.html?paid=1",
        cancel_url: ORIGIN + "/portal/index.html"
      });

    } else {
      res.status(400).json({ error: "Unknown checkout kind" }); return;
    }

    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "Stripe error" });
  }
};
