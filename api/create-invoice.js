// Admin/sales-initiated invoice: creates a REAL Stripe invoice for a customer,
// finalizes + emails it, records it in the CRM invoices table, and Stripe sends
// reminders until paid. Authorizes the caller by their Supabase session role.
// Secrets from env only: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY.
const Stripe = require("stripe");
const SUPABASE_URL = "https://touydwcbxgrigmxvwnvx.supabase.co";
const SUPABASE_PUBLISHABLE = "sb_publishable_a2Y-G20spk5ql2fP0nGnAw_WukuyKnF";

module.exports = async (req, res) => {
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!svc || !key) { res.status(503).json({ error: "Invoicing isn't fully switched on yet." }); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }

  // --- authorize: caller must be an admin or sales seat (verified against their JWT) ---
  const authz = req.headers.authorization || "";
  if (!/^Bearer\s+.+/i.test(authz)) { res.status(401).json({ error: "Sign in required" }); return; }
  let role = null;
  try {
    const rr = await fetch(SUPABASE_URL + "/rest/v1/rpc/my_role", {
      method: "POST",
      headers: { apikey: SUPABASE_PUBLISHABLE, Authorization: authz, "Content-Type": "application/json" },
      body: "{}"
    });
    role = await rr.json();
  } catch (e) { role = null; }
  if (role !== "admin" && role !== "sales") { res.status(403).json({ error: "Not allowed" }); return; }

  let body = req.body;
  try { if (typeof body === "string") body = JSON.parse(body || "{}"); } catch (e) { body = {}; }
  body = body || {};
  const customerId = String(body.customerId || "");
  const title = String(body.title || "Invoice").slice(0, 200);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!customerId) { res.status(400).json({ error: "Missing customer" }); return; }
  if (!items.length) { res.status(400).json({ error: "Add at least one line item" }); return; }

  const h = { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json" };
  const sbGet = (q) => fetch(SUPABASE_URL + "/rest/v1/" + q, { headers: h }).then((r) => r.json());

  try {
    const cs = await sbGet("customers?id=eq." + encodeURIComponent(customerId) + "&select=name,email");
    const cust = cs && cs[0];
    if (!cust) { res.status(404).json({ error: "Customer not found" }); return; }
    const email = String(body.email || cust.email || "").trim();
    if (!email) { res.status(400).json({ error: "This customer has no email — add one first." }); return; }

    const stripe = new Stripe(key);
    const found = await stripe.customers.list({ email: email, limit: 1 });
    const customer = found.data[0] || await stripe.customers.create({ email: email, name: cust.name || "Customer" });

    let total = 0, any = false;
    for (const it of items) {
      const qty = Math.max(1, parseInt(it.qty || 1, 10));
      const unitCents = Math.round(Number(it.unit || 0) * 100);
      if (!(unitCents > 0)) continue;
      const price = await stripe.prices.create({
        currency: "usd", unit_amount: unitCents,
        product_data: { name: String(it.desc || "Roofing / construction service").slice(0, 250) }
      });
      await stripe.invoiceItems.create({ customer: customer.id, price: price.id, quantity: qty });
      total += (unitCents * qty) / 100; any = true;
    }
    if (!any) { res.status(400).json({ error: "No billable line items." }); return; }

    const invoice = await stripe.invoices.create({
      customer: customer.id, collection_method: "send_invoice", days_until_due: 14,
      auto_advance: true, pending_invoice_items_behavior: "include", description: title,
      metadata: { crmCustomerId: customerId }
    });
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.sendInvoice(invoice.id);

    // record in the CRM (best-effort — never fail the request over a schema quirk)
    const today = new Date().toISOString().slice(0, 10);
    try {
      await fetch(SUPABASE_URL + "/rest/v1/invoices", {
        method: "POST",
        headers: Object.assign({ Prefer: "return=minimal" }, h),
        body: JSON.stringify({
          id: "i" + Date.now().toString(36), customerId: customerId, kind: "invoice",
          label: title, amount: total, status: "sent", date: today,
          stripe_invoice_id: invoice.id, hosted_invoice_url: finalized.hosted_invoice_url || null
        })
      });
    } catch (e) { /* invoice exists in Stripe regardless */ }

    res.status(200).json({ url: finalized.hosted_invoice_url, id: invoice.id, amount: total });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "Could not create invoice" });
  }
};
