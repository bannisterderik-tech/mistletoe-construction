// Admin-only: create/schedule/publish a social post via Zernio (POST /v1/posts).
// Body: { content, mediaUrls:[], accounts:[{platform,accountId}], scheduledFor, timezone, publishNow, isDraft, tags:[] }
const { zernio, requireAdmin } = require("./_zernio.js");

function mediaType(url) {
  const u = String(url || "").toLowerCase().split("?")[0];
  if (/\.(mp4|mov|webm|m4v)$/.test(u)) return "video";
  return "image";
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).end(); return; }
  if (!(await requireAdmin(req))) { res.status(403).json({ error: "Admins only" }); return; }

  let b = req.body;
  try { if (typeof b === "string") b = JSON.parse(b || "{}"); } catch (e) { b = {}; }
  b = b || {};

  const content = String(b.content || "").trim();
  const mediaUrls = Array.isArray(b.mediaUrls) ? b.mediaUrls.filter(Boolean) : [];
  const accounts = Array.isArray(b.accounts) ? b.accounts.filter((a) => a && a.accountId) : [];
  if (!content && !mediaUrls.length) { res.status(400).json({ error: "Add a caption or an image." }); return; }
  if (!accounts.length) { res.status(400).json({ error: "Pick at least one account to post to." }); return; }

  const publishNow = !!b.publishNow;
  const isDraft = !!b.isDraft;
  const scheduledFor = b.scheduledFor ? String(b.scheduledFor) : null;
  if (!publishNow && !isDraft && !scheduledFor) {
    res.status(400).json({ error: "Pick a schedule time, or choose Post now / Save draft." });
    return;
  }

  const mediaItems = mediaUrls.map((url) => ({ url: String(url), type: mediaType(url) }));
  const platforms = accounts.map((a) => {
    const p = { platform: a.platform, accountId: a.accountId };
    if (scheduledFor && !publishNow) p.scheduledFor = scheduledFor;
    return p;
  });

  const payload = {
    content,
    mediaItems,
    platforms,
    timezone: b.timezone || "America/Los_Angeles",
    publishNow,
    isDraft,
    tags: Array.isArray(b.tags) ? b.tags : []
  };
  if (scheduledFor && !publishNow) payload.scheduledFor = scheduledFor;

  const r = await zernio("/v1/posts", { method: "POST", body: payload });
  if (!r.ok) {
    const msg = (r.data && (r.data.error || r.data.message)) || "Zernio rejected the post";
    res.status(r.status).json({ error: msg, detail: r.data || null });
    return;
  }
  res.status(200).json({ ok: true, post: (r.data && (r.data.post || r.data.data || r.data)) || null });
};
