// Log a manual payment (cash / check / card / other) against a customer and,
// optionally, a specific invoice — then email a branded PDF receipt.
// Admin/sales only (Bearer token verified via requireRole). Writes with the
// service role. Partial-payment aware: an invoice flips to "paid" only once the
// sum of its payments covers the amount.
const { requireRole } = require("./_auth.js");
const { sbGet, sbInsert, sbPatch, genId, hasService } = require("./_supabase.js");
const sendReceipt = require("./_receipt-send.js");
const { paidAgainstInvoice } = require("./_receipt-send.js");

const METHODS = ["cash", "check", "card", "other"];

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "method not allowed" }); return; }
  const role = await requireRole(req, ["admin", "sales"]);
  if (!role) { res.status(403).json({ error: "not authorized" }); return; }
  if (!hasService()) { res.status(503).json({ error: "not configured" }); return; }

  let b = req.body;
  try { if (typeof b === "string") b = JSON.parse(b || "{}"); } catch (e) { b = {}; }
  b = b || {};

  const customerId = String(b.customerId || "").trim();
  const amount = Math.round((Number(b.amount) || 0) * 100) / 100;
  const method = METHODS.indexOf(String(b.method || "").toLowerCase()) >= 0 ? String(b.method).toLowerCase() : "cash";
  const reference = String(b.reference || "").trim().slice(0, 60);
  const paidOn = /^\d{4}-\d{2}-\d{2}$/.test(String(b.paid_on || "")) ? b.paid_on : new Date().toISOString().slice(0, 10);
  const note = String(b.note || "").trim().slice(0, 300);
  const invoiceId = String(b.invoice_id || "").trim() || null;
  const proposalId = String(b.proposal_id || "").trim() || null;
  const wantReceipt = b.sendReceipt !== false; // default: send it
  const emailOverride = String(b.email || "").trim();

  if (!customerId) { res.status(400).json({ error: "Pick a customer." }); return; }
  if (!(amount > 0)) { res.status(400).json({ error: "Enter a payment amount greater than zero." }); return; }

  // 1) insert the payment; return=representation gives us the DB-assigned receipt_number
  let pay;
  try {
    const r = await sbInsert("payments", {
      id: genId("pay"), customerId, invoice_id: invoiceId, proposal_id: proposalId,
      amount, method, reference: reference || null, paid_on: paidOn, note: note || null
    }, { returning: true });
    if (!r.ok) { const t = await r.text(); res.status(500).json({ error: "Could not save the payment.", detail: t.slice(0, 200) }); return; }
    const rows = await r.json().catch(() => null);
    pay = Array.isArray(rows) ? rows[0] : null;
    if (!pay) { res.status(500).json({ error: "Payment saved but could not be read back." }); return; }
  } catch (e) { res.status(500).json({ error: "Could not reach the database." }); return; }

  // 2) if applied to an invoice, flip it to paid once fully covered
  let invoicePaid = false, balanceRemaining = null;
  if (invoiceId) {
    try {
      const inv = await sbGet("invoices?id=eq." + encodeURIComponent(invoiceId) + "&select=amount,status");
      const row = Array.isArray(inv) ? inv[0] : null;
      if (row) {
        const total = Number(row.amount) || 0;
        const paid = await paidAgainstInvoice(invoiceId); // includes the row we just inserted
        balanceRemaining = Math.max(0, total - paid);
        if (balanceRemaining <= 0.005 && row.status !== "paid") {
          await sbPatch("invoices", "id=eq." + encodeURIComponent(invoiceId), { status: "paid" });
          invoicePaid = true;
        }
      }
    } catch (e) { /* non-fatal */ }
  }

  // 3) email the receipt (best-effort — the payment is already recorded)
  let emailed = false, emailError = null, sentTo = null;
  if (wantReceipt) {
    const out = await sendReceipt(pay.id, { payment: pay, email: emailOverride || undefined });
    if (out && out.ok) { emailed = true; sentTo = out.email; if (out.balanceRemaining != null) balanceRemaining = out.balanceRemaining; }
    else emailError = (out && out.error) || "could not send receipt";
  }

  res.status(200).json({
    ok: true, payment: pay, receipt_number: pay.receipt_number,
    invoicePaid, balanceRemaining, emailed, sentTo, emailError
  });
};
