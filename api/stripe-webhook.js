// Mistletoe Construction — Stripe webhook (Vercel serverless).
// Marks invoices paid and records membership signups when Stripe confirms payment.
// Secrets read ONLY from env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
// SUPABASE_SERVICE_ROLE_KEY. Inert (returns 200) until those are set.
const Stripe = require("stripe");
const notifyTeam = require("./_notify.js");
const { sbGet, sbPatch, sbInsert, genId } = require("./_supabase.js");
const { sendReviewRequest } = require("./_review.js");
const sendReceipt = require("./_receipt-send.js");

function money(c) { return "$" + (Number(c || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 }); }

// Record a card payment + email our branded receipt. Idempotent: the Stripe id
// is stored as `reference`, so webhook retries never double-charge the ledger or
// re-send a receipt. Best-effort — the caller wraps it so a hiccup never blocks
// the webhook's 200.
async function recordCardPayment(o) {
  if (!o.stripeRef) return;
  const existing = await sbGet("payments?reference=eq." + encodeURIComponent(o.stripeRef) + "&select=id");
  if (Array.isArray(existing) && existing.length) return; // already recorded on an earlier delivery
  const r = await sbInsert("payments", {
    id: genId("pay"), customerId: o.customerId || null, invoice_id: o.crmInvoiceId || null,
    proposal_id: o.proposalId || null, amount: Math.round((Number(o.amountDollars) || 0) * 100) / 100,
    method: "card", reference: o.stripeRef, paid_on: new Date().toISOString().slice(0, 10),
    note: o.note || "Paid online by card"
  }, { returning: true });
  if (!r.ok) return;
  const rows = await r.json().catch(() => null);
  const pay = Array.isArray(rows) ? rows[0] : null;
  if (pay) { try { await sendReceipt(pay.id, { payment: pay, email: o.email || undefined }); } catch (e) {} }
}

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
      const md = inv.metadata || {};
      const proposalId = md.proposalId;
      const nowIso = new Date().toISOString();
      if (proposalId) {
        // Split-aware: deposit payment doesn't mark the whole deal paid; final/full does.
        let patch;
        if (md.kind === "deposit") patch = { deposit_paid_at: nowIso };
        else if (md.kind === "final") patch = { final_paid_at: nowIso, status: "paid" };
        else patch = { deposit_paid_at: nowIso, final_paid_at: nowIso, status: "paid" }; // 'full' / legacy
        try { await sbPatch("proposals", "id=eq." + encodeURIComponent(proposalId), patch); }
        catch (e) { await sbPatch("proposals", "id=eq." + encodeURIComponent(proposalId), { status: (md.kind === "deposit" ? "invoiced" : "paid") }); }
        // Deal fully paid (not just a deposit) → auto-send the review request (idempotent).
        if (md.kind !== "deposit") {
          try { const pr = await sbGet("proposals?id=eq." + encodeURIComponent(proposalId) + "&select=*"); if (pr && pr[0]) await sendReviewRequest(pr[0]); } catch (e) {}
        }
      }
      // Admin/sales invoices are recorded in the CRM with stripe_invoice_id.
      if (inv.id) await sbPatch("invoices", "stripe_invoice_id=eq." + encodeURIComponent(inv.id), { status: "paid" });
      // Record the card payment + email our branded receipt (idempotent).
      try {
        if (proposalId) {
          const pr = await sbGet("proposals?id=eq." + encodeURIComponent(proposalId) + "&select=customerId,title");
          const p = Array.isArray(pr) ? pr[0] : null;
          await recordCardPayment({ customerId: p && p.customerId, proposalId, amountDollars: (Number(inv.amount_paid) || 0) / 100, stripeRef: inv.id, email: inv.customer_email, note: p && p.title });
        } else if (inv.id) {
          const ci = await sbGet("invoices?stripe_invoice_id=eq." + encodeURIComponent(inv.id) + "&select=id,customerId,label");
          const c = Array.isArray(ci) ? ci[0] : null;
          if (c) await recordCardPayment({ customerId: c.customerId, crmInvoiceId: c.id, amountDollars: (Number(inv.amount_paid) || 0) / 100, stripeRef: inv.id, email: inv.customer_email, note: c.label });
        }
      } catch (e) { console.error("receipt (invoice.paid) failed:", e && e.message); }
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
          try {
            const ci = await sbGet("invoices?id=eq." + encodeURIComponent(md.invoiceId) + "&select=customerId,label");
            const c = Array.isArray(ci) ? ci[0] : null;
            await recordCardPayment({ customerId: c && c.customerId, crmInvoiceId: md.invoiceId, amountDollars: paid / 100, stripeRef: s.payment_intent || s.id, email, note: c && c.label });
          } catch (e) { console.error("receipt (checkout) failed:", e && e.message); }
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
