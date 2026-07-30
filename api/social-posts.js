// Admin-only: list posts from Zernio (GET /v1/posts) for the queue/history view.
const { zernio, requireAdmin } = require("./_zernio.js");

const SORTS = ["scheduled-desc", "scheduled-asc", "created-desc", "created-asc", "status", "platform"];

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!(await requireAdmin(req))) { res.status(403).json({ error: "Admins only" }); return; }
  const q = req.query || {};
  const status = q.status ? String(q.status) : "";
  const search = q.search ? String(q.search) : "";
  const sortBy = SORTS.indexOf(String(q.sortBy)) >= 0 ? String(q.sortBy) : "scheduled-desc";
  const limit = Math.min(Math.max(parseInt(q.limit || "24", 10) || 24, 1), 100);
  const skip = Math.max(parseInt(q.skip || "0", 10) || 0, 0);

  const qs = new URLSearchParams({ limit: String(limit), skip: String(skip), sortBy: sortBy });
  if (status) qs.set("status", status);
  if (search) qs.set("search", search);

  const r = await zernio("/v1/posts?" + qs.toString());
  if (!r.ok) { res.status(r.status).json(r.data || { error: "Could not load posts" }); return; }
  const posts = (r.data && (r.data.posts || r.data.data || r.data)) || [];
  const pg = (r.data && r.data.pagination) || null;
  const total = pg && (pg.total != null ? pg.total : (pg.totalCount != null ? pg.totalCount : null));
  res.status(200).json({
    posts: Array.isArray(posts) ? posts : [],
    pagination: pg, total: total, limit: limit, skip: skip
  });
};
