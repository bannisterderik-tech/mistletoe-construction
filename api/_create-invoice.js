// Admin/sales-initiated invoice: creates a REAL Stripe invoice for a customer,
// finalizes + emails it, records it in the CRM invoices table, and Stripe sends
// reminders until paid. Authorizes the caller by their Supabase session role.
// Secrets from env only: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY.
const Stripe = require("stripe");
const { sbGet, sbInsert, genId, hasService } = require("./_supabase.js");
const { requireRole } = require("./_auth.js");

module.exports = async (req, res) => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!hasService() || !key) { res.status(503).json({ error: "Invoicing isn't fully switched on yet." }); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }

  // authorize: caller must be an admin or sales seat (verified against their JWT)
  const role = await requireRole(req, ["admin", "sales"]);
  if (!role) { res.status(403).json({ error: "Not allowed" }); return; }

  let body = req.body;
  try { if (typeof body === "string") body = JSON.parse(body || "{}"); } catch (e) { body = {}; }
  body = body || {};
  const customerId = String(body.customerId || "");
  const title = String(body.title || "Invoice").slice(0, 200);
  const items = Array.isArray(body.items) ? body.items : [];
  // A stable per-form request id makes double-clicks / retries idempotent in Stripe.
  const reqId = String(body.requestId || "").replace(/[^\w-]/g, "").slice(0, 80) || genId("inv");
  if (!customerId) { res.status(400).json({ error: "Missing customer" }); return; }
  if (!items.length) { res.status(400).json({ error: "Add at least one line item" }); return; }

  try {
    const cs = await sbGet("customers?id=eq." + encodeURIComponent(customerId) + "&select=name,email");
    const cust = cs && cs[0];
    if (!cust) { res.status(404).json({ error: "Customer not found" }); return; }
    const email = String(body.email || cust.email || "").trim();
    if (!email) { res.status(400).json({ error: "This customer has no email — add one first." }); return; }

    const stripe = new Stripe(key);
    const found = await stripe.customers.list({ email: email, limit: 1 });
    const customer = found.data[0] || await stripe.customers.create({ email: email, name: cust.name || "Customer" });

    // Ad-hoc invoice items (amount + description) — no throwaway Products/Prices.
    let total = 0, any = false, n = 0;
    for (const it of items) {
      const qty = Math.max(1, parseInt(it.qty || 1, 10));
      const unitCents = Math.round(Number(it.unit || 0) * 100);
      if (!(unitCents > 0)) continue;
      const amountCents = unitCents * qty;
      await stripe.invoiceItems.create({
        customer: customer.id, currency: "usd", amount: amountCents,
        description: (qty > 1 ? qty + " × " : "") + String(it.desc || "Roofing / construction service").slice(0, 250)
      }, { idempotencyKey: reqId + "-li-" + (n++) });
      total += amountCents / 100; any = true;
    }
    if (!any) { res.status(400).json({ error: "No billable line items." }); return; }

    const invoice = await stripe.invoices.create({
      customer: customer.id, collection_method: "send_invoice", days_until_due: 14,
      auto_advance: true, pending_invoice_items_behavior: "include", description: title,
      metadata: { crmCustomerId: customerId }
    }, { idempotencyKey: reqId + "-inv" });
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.sendInvoice(invoice.id);

    // record in the CRM (best-effort — never fail the request over a schema quirk)
    const today = new Date().toISOString().slice(0, 10);
    try {
      await sbInsert("invoices", {
        id: genId("i"), customerId: customerId, kind: "invoice",
        label: title, amount: total, status: "sent", date: today,
        stripe_invoice_id: invoice.id, hosted_invoice_url: finalized.hosted_invoice_url || null
      });
    } catch (e) { /* invoice exists in Stripe regardless */ }

    res.status(200).json({ url: finalized.hosted_invoice_url, id: invoice.id, amount: total });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "Could not create invoice" });
  }
};
