// Records a review-link click, then 302s to the real Google review URL.
// Set GOOGLE_REVIEW_URL in Vercel to your Business Profile "write a review" link.
const { sbGet, sbPatch, hasService } = require("./_supabase.js");
const REVIEW_URL = process.env.GOOGLE_REVIEW_URL ||
  "https://www.google.com/search?q=Mistletoe+Construction+LLC+Riddle+Oregon+reviews";

module.exports = async (req, res) => {
  const id = String((req.query && req.query.p) || "");
  if (hasService() && id) {
    try {
      const rows = await sbGet("proposals?id=eq." + encodeURIComponent(id) + "&select=review_clicked_at,review_click_count");
      const p = rows && rows[0];
      if (p) await sbPatch("proposals", "id=eq." + encodeURIComponent(id), {
        review_clicked_at: p.review_clicked_at || new Date().toISOString(),
        review_click_count: (Number(p.review_click_count) || 0) + 1
      });
    } catch (e) {}
  }
  res.writeHead(302, { Location: REVIEW_URL, "Cache-Control": "no-store" });
  res.end();
};
