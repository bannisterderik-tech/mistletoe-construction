// Admin-only: start an OAuth connection for a platform. Looks up the default
// Zernio profile, then asks Zernio for the hosted connect URL and returns it.
// The admin page opens that URL; Zernio redirects back when done.
const { zernio, requireAdmin } = require("./_zernio.js");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!(await requireAdmin(req))) { res.status(403).json({ error: "Admins only" }); return; }

  const platform = (req.query && req.query.platform ? String(req.query.platform) : "").toLowerCase();
  const allowed = ["facebook", "instagram", "linkedin", "twitter", "tiktok", "youtube",
    "threads", "reddit", "pinterest", "bluesky", "googlebusiness"];
  if (allowed.indexOf(platform) < 0) { res.status(400).json({ error: "Unsupported platform" }); return; }

  // 1) default profile
  const prof = await zernio("/v1/profiles");
  if (!prof.ok) { res.status(prof.status).json(prof.data || { error: "Could not load profile" }); return; }
  const profiles = (prof.data && (prof.data.profiles || prof.data.data || prof.data)) || [];
  const chosen = (Array.isArray(profiles) && (profiles.find(function (p) { return p.isDefault; }) || profiles[0])) || null;
  const profileId = chosen && (chosen._id || chosen.id);
  if (!profileId) { res.status(502).json({ error: "No Zernio profile found — create one at zernio.com first." }); return; }

  // 2) hosted connect URL, redirecting back to the admin Social page
  const proto = (req.headers["x-forwarded-proto"] || "https");
  const host = req.headers.host || "mistletoeconstruction.com";
  const redirect = proto + "://" + host + "/admin/social.html?connected=1";
  const qs = new URLSearchParams({ profileId: profileId, redirect_url: redirect });
  const r = await zernio("/v1/connect/" + platform + "?" + qs.toString());
  if (!r.ok) { res.status(r.status).json(r.data || { error: "Could not start connection" }); return; }
  const authUrl = r.data && (r.data.authUrl || r.data.url);
  if (!authUrl) { res.status(502).json({ error: "Zernio did not return a connect URL" }); return; }
  res.status(200).json({ authUrl: authUrl });
};
