// Public, token-gated read of a single proposal (for the customer accept page).
// Uses the Supabase service role server-side so the proposals table stays admin-only in RLS.
const { sbGet, hasService } = require("./_supabase.js");

module.exports = async (req, res) => {
  if (!hasService()) { res.status(503).json({ error: "Not configured yet" }); return; }
  const token = (req.query && req.query.t ? String(req.query.t) : "").replace(/[^a-f0-9]/gi, "");
  if (!token) { res.status(400).json({ error: "Missing token" }); return; }

  try {
    const rows = await sbGet("proposals?token=eq." + token + "&select=*");
    const p = rows && rows[0];
    if (!p) { res.status(404).json({ error: "Proposal not found" }); return; }

    let customer = null;
    if (p.customerId) {
      const cs = await sbGet("customers?id=eq." + encodeURIComponent(p.customerId) + "&select=name,email,phone,address,city");
      customer = cs && cs[0] || null;
    }
    res.status(200).json({
      id: p.id, title: p.title, items: p.items || [], amount: p.amount,
      created: p.created || null,
      status: p.status, stripe_invoice_url: p.stripe_invoice_url || null,
      stripe_invoice_pdf: p.stripe_invoice_pdf || null,
      note: p.note || "", customer: customer,
      signed: !!p.agreement_signed_at,
      agreement_signer: p.agreement_signer || null,
      agreement_signed_at: p.agreement_signed_at || null,
      agreement_version: p.agreement_version || null
    });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "Error" });
  }
};
