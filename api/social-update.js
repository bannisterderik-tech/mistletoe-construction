// Admin-only: edit an existing post via Zernio (PUT /v1/posts/{postId}).
// Body: { postId, content, mediaUrls:[], accounts:[{platform,accountId}], scheduledFor, timezone, isDraft }
const { zernio, requireAdmin, buildPlatforms } = require("./_zernio.js");

function mediaType(url) {
  const u = String(url || "").toLowerCase().split("?")[0];
  if (/\.(mp4|mov|webm|m4v)$/.test(u)) return "video";
  return "image";
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST" && req.method !== "PUT") { res.status(405).end(); return; }
  if (!(await requireAdmin(req))) { res.status(403).json({ error: "Admins only" }); return; }

  let b = req.body;
  try { if (typeof b === "string") b = JSON.parse(b || "{}"); } catch (e) { b = {}; }
  b = b || {};

  const postId = String(b.postId || "").trim();
  if (!postId) { res.status(400).json({ error: "Missing postId" }); return; }

  const payload = {};
  if (typeof b.content === "string") payload.content = b.content.trim();
  if (Array.isArray(b.mediaUrls)) {
    payload.mediaItems = b.mediaUrls.filter(Boolean).map((url) => ({ url: String(url), type: mediaType(url) }));
  }
  const scheduledFor = b.scheduledFor ? String(b.scheduledFor) : null;
  if (scheduledFor) payload.scheduledFor = scheduledFor;
  if (typeof b.timezone === "string") payload.timezone = b.timezone;
  if (typeof b.isDraft === "boolean") payload.isDraft = b.isDraft;

  if (Array.isArray(b.accounts) && b.accounts.length) {
    const accts = b.accounts.filter((a) => a && a.accountId);
    payload.platforms = buildPlatforms(accts, payload.mediaItems || [], payload.content || "", scheduledFor, false);
  }

  const r = await zernio("/v1/posts/" + encodeURIComponent(postId), { method: "PUT", body: payload });
  if (!r.ok) {
    const msg = (r.data && (r.data.error || r.data.message)) || "Zernio rejected the edit";
    res.status(r.status).json({ error: msg, detail: r.data || null });
    return;
  }
  res.status(200).json({ ok: true, post: (r.data && (r.data.post || r.data.data || r.data)) || null });
};
