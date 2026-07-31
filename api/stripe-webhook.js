// Mistletoe Construction — Stripe webhook (Vercel serverless).
// Marks invoices paid and records membership signups when Stripe confirms payment.
// Secrets read ONLY from env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
// SUPABASE_SERVICE_ROLE_KEY. Inert (returns 200) until those are set.
const Stripe = require("stripe");
const notifyTeam = require("./_notify.js");
const { sbPatch, sbInsert, genId } = require("./_supabase.js");

function money(c) { return "$" + (Number(c || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 }); }

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
      // A Stripe invoice got paid → flip the matching proposal AND/OR CRM invoice to paid.
      const inv = event.data.object;
      const proposalId = inv.metadata && inv.metadata.proposalId;
      if (proposalId) await sbPatch("proposals", "id=eq." + encodeURIComponent(proposalId), { status: "paid" });
      // Admin/sales invoices are recorded in the CRM with stripe_invoice_id.
      if (inv.id) await sbPatch("invoices", "stripe_invoice_id=eq." + encodeURIComponent(inv.id), { status: "paid" });
      await notifyTeam("💰 Invoice paid — " + money(inv.amount_paid),
        "<h2 style='color:#1b3d26'>Invoice paid</h2><p><strong>" + money(inv.amount_paid) + "</strong> from " +
        (inv.customer_email || (inv.customer_name || "a customer")) + ".</p>" +
        (inv.hosted_invoice_url ? "<p><a href='" + inv.hosted_invoice_url + "'>View invoice</a></p>" : ""));
    } else if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      const md = s.metadata || {};
      const email = (s.customer_details && s.customer_details.email) || s.customer_email || "";
      if (md.kind === "invoice" && md.invoiceId) {
        // Only mark paid if the amount collected covers what the invoice actually owed.
        const paid = Number(s.amount_total || 0);
        const expected = Number(md.expectedCents || 0);
        if (s.payment_status === "paid" && (!expected || paid >= expected)) {
          await sbPatch("invoices", "id=eq." + encodeURIComponent(md.invoiceId), { status: "paid" });
          await notifyTeam("💰 Invoice paid via checkout", "<h2 style='color:#1b3d26'>Invoice paid</h2><p>Invoice " + md.invoiceId + " was paid" + (email ? " by " + email : "") + ".</p>");
        } else {
          await notifyTeam("⚠️ Checkout amount mismatch — NOT marked paid",
            "<p>Checkout for invoice <strong>" + md.invoiceId + "</strong> collected " + money(paid) + " but expected " + money(expected) + ". Left unpaid for review.</p>");
        }
      } else if (md.kind === "membership") {
        await notifyTeam("🎉 New Home Care Membership signup",
          "<h2 style='color:#1b3d26'>New paid membership</h2><p><strong>" + (email || "New member") + "</strong> just started a Home Care Membership. Onboard them + link to a customer record (added to Leads as “won”).</p>");
        // Public membership signup — drop into the pipeline for onboarding + record.
        await sbInsert("leads", {
          id: genId("m"),
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
    // Alert the team so a genuinely-lost "paid" record doesn't go unnoticed.
    console.error("webhook handler error:", e && e.message);
    try {
      await notifyTeam("⚠️ Stripe webhook failed to record an event",
        "<p>Event <strong>" + (event && event.type) + "</strong> (" + (event && event.id) + ") errored while updating the database: " +
        ((e && e.message) || "unknown") + ". Please check the payment manually.</p>");
    } catch (e2) { /* nothing more we can do */ }
  }
  res.status(200).json({ received: true });
};
