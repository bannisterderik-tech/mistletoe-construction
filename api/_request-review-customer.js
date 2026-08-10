// Admin "Request review" from the customer record — emails the customer a Google
// review ask keyed on their customer id (works for cash/check jobs with no
// proposal). Requires an admin/sales Supabase session (Bearer JWT), same auth
// model as create-invoice.
const { hasService } = require("./_supabase.js");
const { requireRole } = require("./_auth.js");
const { sendReviewToCustomer } = require("./_review.js");

module.exports = async (req, res) => {
  if (!hasService()) { res.status(503).json({ error: "Not configured" }); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }
  const role = await requireRole(req, ["admin", "sales"]);
  if (!role) { res.status(401).json({ error: "Not authorized" }); return; }
  let body = req.body;
  try { if (typeof body === "string") body = JSON.parse(body || "{}"); } catch (e) { body = {}; }
  body = body || {};
  const customerId = String(body.customerId || "");
  if (!customerId) { res.status(400).json({ error: "Missing customerId" }); return; }
  try {
    const r = await sendReviewToCustomer(customerId, { force: !!body.force });
    if (r.error) { res.status(400).json(r); return; }
    res.status(200).json(r);
  } catch (e) { res.status(500).json({ error: (e && e.message) || "Could not send review request" }); }
};
