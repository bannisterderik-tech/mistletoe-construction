// Shared: create + send the balance (final) invoice for a proposal.
// Used by the admin "Send balance invoice" button and the scheduled cron.
// Secrets from env: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY.
const Stripe = require("stripe");
const notifyTeam = require("./_notify.js");
const { sbGet, sbPatch } = require("./_supabase.js");

async function createFinalInvoice(p) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Stripe isn't configured." };
  if (p.final_invoice_id || p.final_invoiced_at) return { ok: true, already: true };

  const items = Array.isArray(p.items) ? p.items : [];
  const totalCents = items.reduce(function (s, it) {
    const u = Math.round(Number(it.unit || 0) * 100), q = Math.max(1, parseInt(it.qty || 1, 10));
    return s + (u > 0 ? u * q : 0);
  }, 0);
  const depositPct = Math.min(100, Math.max(0, Number(p.deposit_pct) || 100));
  const remainderCents = totalCents - Math.round(totalCents * depositPct / 100);
  if (remainderCents <= 0) return { error: "No balance remaining (this was a full-payment proposal)." };

  let email = "", name = "Customer";
  if (p.customerId) {
    const cs = await sbGet("customers?id=eq." + encodeURIComponent(p.customerId) + "&select=name,email");
    if (cs && cs[0]) { email = String(cs[0].email || "").trim(); name = cs[0].name || name; }
  }
  if (!email) return { error: "Customer has no email for the balance invoice." };

  const stripe = new Stripe(key);
  const found = await stripe.customers.list({ email: email, limit: 1 });
  const customer = found.data[0] || await stripe.customers.create({ email: email, name: name });

  await stripe.invoiceItems.create({
    customer: customer.id, currency: "usd", amount: remainderCents,
    description: "Final balance — " + String(p.title || "project").slice(0, 240)
  }, { idempotencyKey: "prop-" + p.id + "-fin-" + remainderCents });

  const invoice = await stripe.invoices.create({
    customer: customer.id, collection_method: "send_invoice", days_until_due: 14, auto_advance: true,
    pending_invoice_items_behavior: "include", description: "Final balance — " + p.title,
    metadata: { proposalId: p.id, kind: "final" }
  }, { idempotencyKey: "prop-" + p.id + "-fininv" });
  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  await stripe.invoices.sendInvoice(invoice.id);

  await sbPatch("proposals", "id=eq." + encodeURIComponent(p.id), {
    final_invoice_id: invoice.id,
    final_invoiced_at: new Date().toISOString(),
    stripe_invoice_url: finalized.hosted_invoice_url || p.stripe_invoice_url || null,
    stripe_invoice_pdf: finalized.invoice_pdf || p.stripe_invoice_pdf || null
  });
  await notifyTeam("Balance invoice sent — " + (p.title || "proposal"),
    "<h2 style='color:#1b3d26'>Balance invoiced</h2><p>Final balance <strong>$" + (remainderCents / 100).toLocaleString("en-US") +
    "</strong> was emailed to " + name + " &lt;" + email + "&gt;. Stripe will send reminders until it's paid.</p>");
  return { ok: true, url: finalized.hosted_invoice_url, amount: remainderCents / 100 };
}

module.exports = { createFinalInvoice };
