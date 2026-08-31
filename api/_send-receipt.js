// Re-send (or send) the branded PDF receipt for an existing payment.
// Admin/sales only. The heavy lifting lives in _receipt-send.js.
const { requireRole } = require("./_auth.js");
const { hasService } = require("./_supabase.js");
const sendReceipt = require("./_receipt-send.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "method not allowed" }); return; }
  const role = await requireRole(req, ["admin", "sales"]);
  if (!role) { res.status(403).json({ error: "not authorized" }); return; }
  if (!hasService()) { res.status(503).json({ error: "not configured" }); return; }

  let b = req.body;
  try { if (typeof b === "string") b = JSON.parse(b || "{}"); } catch (e) { b = {}; }
  b = b || {};
  const paymentId = String(b.paymentId || b.id || "").trim();
  const email = String(b.email || "").trim();
  if (!paymentId) { res.status(400).json({ error: "Missing payment id." }); return; }

  const out = await sendReceipt(paymentId, { email: email || undefined });
  if (!out || !out.ok) { res.status(502).json({ error: (out && out.error) || "could not send receipt" }); return; }
  res.status(200).json({ ok: true, email: out.email, receipt_number: out.receipt_number });
};
