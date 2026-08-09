// Admin "Request review" — emails the customer a Google-review ask for a proposal.
// Token-gated (proposal token = capability, same model as send-proposal).
const { sbGet, hasService } = require("./_supabase.js");
const { sendReviewRequest } = require("./_review.js");

module.exports = async (req, res) => {
  if (!hasService()) { res.status(503).json({ error: "Not configured" }); return; }
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
    const r = await sendReviewRequest(p, { force: !!body.force });
    if (r.error) { res.status(400).json(r); return; }
    res.status(200).json(r);
  } catch (e) { res.status(500).json({ error: (e && e.message) || "Could not send review request" }); }
};
