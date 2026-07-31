// Shared Zernio helper + admin-auth gate for the social endpoints.
// Zernio API: base https://zernio.com/api, Bearer auth. Secret from env: ZERNIO_API_KEY.
const { requireRole } = require("./_auth.js");
const ZERNIO_BASE = "https://zernio.com/api";

// Verify the caller is a signed-in admin. Returns true/false. Never throws.
async function requireAdmin(req) {
  return !!(await requireRole(req, ["admin"]));
}

// Call the Zernio API. Returns { ok, status, data }.
async function zernio(path, opts) {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) return { ok: false, status: 503, data: { error: "ZERNIO_API_KEY not configured" } };
  opts = opts || {};
  const headers = Object.assign({
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
    Accept: "application/json"
  }, opts.headers || {});
  try {
    const r = await fetch(ZERNIO_BASE + path, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? (typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body)) : undefined
    });
    let data = null;
    try { data = await r.json(); } catch (e) { data = null; }
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 502, data: { error: (e && e.message) || "Zernio request failed" } };
  }
}

const SITE_URL = "https://mistletoeconstruction.com";

// Drop lines that are entirely hashtags (Google Business posts read spammy with them).
function stripHashtags(t) {
  return String(t || "").split("\n").filter(function (line) {
    var s = line.trim();
    if (!s) return true;
    return !/^#[\w]+(\s+#[\w]+)*$/.test(s);
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Build the Zernio platforms[] array from a simple accounts list, applying
// per-platform rules. Google Business Profile only allows ONE image per post
// and does better without hashtags, so we override its media/content there.
function buildPlatforms(accounts, mediaItems, content, scheduledFor, publishNow) {
  return (accounts || []).map(function (a) {
    var p = { platform: a.platform, accountId: a.accountId };
    if (scheduledFor && !publishNow) p.scheduledFor = scheduledFor;
    if (a.platform === "googlebusiness") {
      if (mediaItems && mediaItems.length) p.customMedia = [mediaItems[0]];
      var gc = stripHashtags(content);
      if (gc && gc !== String(content || "").trim()) p.customContent = gc;
      p.platformSpecificData = { topicType: "STANDARD", callToAction: { type: "LEARN_MORE", url: SITE_URL } };
    }
    return p;
  });
}

module.exports = { zernio, requireAdmin, buildPlatforms, stripHashtags, ZERNIO_BASE, SITE_URL };
