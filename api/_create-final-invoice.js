// Admin "Send balance invoice now" — creates + sends the final invoice for a proposal.
// Token-gated (proposal token = capability, same model as accept-proposal).
const { sbGet, hasService } = require("./_supabase.js");
const { createFinalInvoice } = require("./_final-invoice.js");

module.exports = async (req, res) => {
  if (!hasService()) { res.status(503).json({ error: "Not configured yet." }); return; }
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
    if (!p.deposit_paid_at) { res.status(409).json({ error: "The deposit hasn't been paid yet — collect the deposit before the balance." }); return; }
    const r = await createFinalInvoice(p);
    if (r.error) { res.status(400).json(r); return; }
    res.status(200).json(r);
  } catch (e) { res.status(500).json({ error: (e && e.message) || "Could not create the balance invoice" }); }
};
