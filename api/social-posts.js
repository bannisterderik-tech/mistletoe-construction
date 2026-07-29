// Admin-only: list posts from Zernio (GET /v1/posts) for the history/queue view.
const { zernio, requireAdmin } = require("./_zernio.js");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!(await requireAdmin(req))) { res.status(403).json({ error: "Admins only" }); return; }
  const status = (req.query && req.query.status) ? String(req.query.status) : "";
  const qs = new URLSearchParams({ limit: "50", sortBy: "scheduledFor" });
  if (status) qs.set("status", status);
  const r = await zernio("/v1/posts?" + qs.toString());
  if (!r.ok) { res.status(r.status).json(r.data || { error: "Could not load posts" }); return; }
  const posts = (r.data && (r.data.posts || r.data.data || r.data)) || [];
  res.status(200).json({ posts: Array.isArray(posts) ? posts : [], pagination: (r.data && r.data.pagination) || null });
};
