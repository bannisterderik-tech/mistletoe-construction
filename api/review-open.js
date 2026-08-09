// 1x1 tracking pixel for review-request emails. Best-effort — Apple Mail Privacy
// Protection and Gmail image proxy pre-load images, so "opens" are approximate.
const { sbGet, sbPatch, hasService } = require("./_supabase.js");
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

module.exports = async (req, res) => {
  const id = String((req.query && req.query.p) || "");
  if (hasService() && id) {
    try {
      const rows = await sbGet("proposals?id=eq." + encodeURIComponent(id) + "&select=review_opened_at,review_open_count");
      const p = rows && rows[0];
      if (p) await sbPatch("proposals", "id=eq." + encodeURIComponent(id), {
        review_opened_at: p.review_opened_at || new Date().toISOString(),
        review_open_count: (Number(p.review_open_count) || 0) + 1
      });
    } catch (e) {}
  }
  res.writeHead(200, { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" });
  res.end(GIF);
};
