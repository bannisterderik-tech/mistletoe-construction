// Customer accepts a proposal -> creates a REAL Stripe invoice (ad-hoc line items),
// finalizes + emails it, and Stripe then auto-sends payment reminders until it's paid.
// Secrets from env only: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY.
const Stripe = require("stripe");
const notifyTeam = require("./_notify.js");
const { sbGet, sbPatch, hasService } = require("./_supabase.js");

module.exports = async (req, res) => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!hasService() || !key) { res.status(503).json({ error: "Invoicing isn't fully switched on yet." }); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }

  let body = req.body;
  try { if (typeof body === "string") body = JSON.parse(body || "{}"); } catch (e) { body = {}; }
  body = body || {};
  const token = String(body.token || "").replace(/[^a-f0-9]/gi, "");
  if (!token) { res.status(400).json({ error: "Missing token" }); return; }

  try {
    const rows = await sbGet("proposals?token=eq." + token + "&select=*");
    const p = rows && rows[0];
    if (!p) { res.status(404).json({ error: "Proposal not found" }); return; }
    if (p.status === "invoiced" || p.status === "paid") { res.status(200).json({ url: p.stripe_invoice_url, already: true }); return; }
    // Require a signed Master Construction Agreement before invoicing.
    if (!p.agreement_signed_at) { res.status(409).json({ error: "Please sign the agreement first.", needsSignature: true }); return; }

    let email = String(body.email || "").trim(), name = "Customer";
    if (p.customerId) {
      const cs = await sbGet("customers?id=eq." + encodeURIComponent(p.customerId) + "&select=name,email");
      if (cs && cs[0]) { email = email || cs[0].email; name = cs[0].name || name; }
    }
    if (!email) { res.status(400).json({ error: "We need an email to send the invoice." }); return; }

    const stripe = new Stripe(key);

    // Customer (reuse by email)
    const found = await stripe.customers.list({ email: email, limit: 1 });
    const customer = found.data[0] || await stripe.customers.create({ email: email, name: name });

    // Ad-hoc invoice items (amount + description) — no throwaway Products/Prices.
    const items = Array.isArray(p.items) ? p.items : [];
    let any = false, n = 0;
    for (const it of items) {
      const qty = Math.max(1, parseInt(it.qty || 1, 10));
      const unitCents = Math.round(Number(it.unit || 0) * 100);
      if (!(unitCents > 0)) continue;
      await stripe.invoiceItems.create({
        customer: customer.id, currency: "usd", amount: unitCents * qty,
        description: (qty > 1 ? qty + " × " : "") + String(it.desc || "Roofing / construction service").slice(0, 250)
      }, { idempotencyKey: "prop-" + p.id + "-li-" + (n++) });
      any = true;
    }
    if (!any) { res.status(400).json({ error: "Proposal has no billable items." }); return; }

    // Invoice: emailed by Stripe, auto-reminders per your Stripe dashboard settings
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: "send_invoice",
      days_until_due: 14,
      auto_advance: true,
      pending_invoice_items_behavior: "include",
      description: p.title,
      metadata: { proposalId: p.id }
    }, { idempotencyKey: "prop-" + p.id + "-inv" });
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.sendInvoice(invoice.id);

    await sbPatch("proposals", "id=eq." + encodeURIComponent(p.id), {
      status: "invoiced",
      stripe_invoice_id: invoice.id,
      stripe_invoice_url: finalized.hosted_invoice_url || null,
      stripe_invoice_pdf: finalized.invoice_pdf || null
    });
    // Milestone timestamps (best-effort — tolerate a not-yet-migrated DB).
    try {
      const nowIso = new Date().toISOString();
      await sbPatch("proposals", "id=eq." + encodeURIComponent(p.id), {
        accepted_at: p.accepted_at || nowIso,
        deposit_invoiced_at: p.deposit_invoiced_at || nowIso,
        deposit_invoice_id: invoice.id
      });
    } catch (e) { /* columns arrive with the deal-pipeline migration */ }

    await notifyTeam("✍️ Proposal accepted — " + (p.title || "proposal"),
      "<h2 style='color:#1b3d26'>Proposal accepted</h2><p><strong>" + (name || email) + "</strong> accepted <strong>" +
      (p.title || "a proposal") + "</strong>. A Stripe invoice was created and emailed to " + email +
      "; Stripe will send reminders until it's paid.</p>" +
      (finalized.hosted_invoice_url ? "<p><a href='" + finalized.hosted_invoice_url + "'>View invoice</a></p>" : ""));

    res.status(200).json({ url: finalized.hosted_invoice_url });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "Could not create invoice" });
  }
};
