// Mistletoe Construction — Stripe webhook (Vercel serverless).
// Marks invoices paid and records membership signups when Stripe confirms payment.
// Secrets read ONLY from env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
// SUPABASE_SERVICE_ROLE_KEY. Inert (returns 200) until those are set.
const Stripe = require("stripe");

const SUPABASE_URL = "https://touydwcbxgrigmxvwnvx.supabase.co";

// Raw body is required for Stripe signature verification.
module.exports.config = { api: { bodyParser: false } };

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(typeof c === "string" ? Buffer.from(c) : c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function sbPatch(table, filter, patch) {
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svc) return;
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: { "apikey": svc, "Authorization": "Bearer " + svc, "Content-Type": "application/json", "Prefer": "return=minimal" },
    body: JSON.stringify(patch)
  });
}
async function sbInsert(table, row) {
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svc) return;
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { "apikey": svc, "Authorization": "Bearer " + svc, "Content-Type": "application/json", "Prefer": "return=minimal" },
    body: JSON.stringify(row)
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).end(); return; }
  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !whSecret) { res.status(200).json({ ok: true, note: "webhook not fully configured yet" }); return; }

  let event;
  try {
    const raw = await readRaw(req);
    const stripe = new Stripe(secret);
    event = stripe.webhooks.constructEvent(raw, req.headers["stripe-signature"], whSecret);
  } catch (e) {
    res.status(400).json({ error: "signature verification failed" }); return;
  }

  try {
    if (event.type === "invoice.paid") {
      // A Stripe-invoiced proposal got paid → flip the proposal to paid.
      const inv = event.data.object;
      const proposalId = inv.metadata && inv.metadata.proposalId;
      if (proposalId) await sbPatch("proposals", "id=eq." + encodeURIComponent(proposalId), { status: "paid" });
    } else if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      const md = s.metadata || {};
      if (md.kind === "invoice" && md.invoiceId) {
        await sbPatch("invoices", "id=eq." + encodeURIComponent(md.invoiceId), { status: "paid" });
      } else if (md.kind === "membership") {
        // Public membership signup — drop into the pipeline for onboarding + record.
        await sbInsert("leads", {
          id: "m" + Date.now().toString(36),
          name: (md.name || s.customer_details && s.customer_details.name || "New member") + " (paid membership)",
          city: "",
          service: "Home Care Membership",
          note: "PAID via Stripe · " + (s.customer_details && s.customer_details.email || s.customer_email || "") + " · onboard & link to a customer record",
          stage: "won"
        });
      }
    }
  } catch (e) {
    // Log but still 200 so Stripe doesn't retry-storm on a transient DB blip.
    console.error("webhook handler error:", e && e.message);
  }
  res.status(200).json({ received: true });
};
