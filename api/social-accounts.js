// Admin-only: list the social accounts connected to Zernio (GET /v1/accounts).
const { zernio, requireAdmin } = require("./_zernio.js");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!(await requireAdmin(req))) { res.status(403).json({ error: "Admins only" }); return; }
  const r = await zernio("/v1/accounts");
  if (!r.ok) { res.status(r.status).json(r.data || { error: "Could not load accounts" }); return; }
  const accounts = (r.data && (r.data.accounts || r.data.data || r.data)) || [];
  res.status(200).json({ accounts: Array.isArray(accounts) ? accounts : [] });
};
