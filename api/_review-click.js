// Records a review-link click, then 302s to the real Google review URL.
// Set GOOGLE_REVIEW_URL in Vercel to your Business Profile "write a review" link.
// Keys on ?c=<customerId> (customer flow) or ?p=<proposalId> (proposal flow).
const { sbGet, sbPatch, hasService } = require("./_supabase.js");
// Direct "write a review" link from the Google Business Profile (g.page short
// link). Env var still wins if set; this default means it works without it.
const REVIEW_URL = process.env.GOOGLE_REVIEW_URL ||
  "https://g.page/r/CYxQiWWU9vkMEBM/review";

module.exports = async (req, res) => {
  const q = req.query || {};
  const table = q.c ? "customers" : "proposals";
  const id = String(q.c || q.p || "");
  if (hasService() && id) {
    try {
      const rows = await sbGet(table + "?id=eq." + encodeURIComponent(id) + "&select=review_clicked_at,review_click_count");
      const row = rows && rows[0];
      if (row) await sbPatch(table, "id=eq." + encodeURIComponent(id), {
        review_clicked_at: row.review_clicked_at || new Date().toISOString(),
        review_click_count: (Number(row.review_click_count) || 0) + 1
      });
    } catch (e) {}
  }
  res.writeHead(302, { Location: REVIEW_URL, "Cache-Control": "no-store" });
  res.end();
};
