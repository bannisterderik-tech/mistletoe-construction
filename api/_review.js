// Send a Google-review request to a customer — automatically after a paid deal,
// or manually from the customer record. The "Leave a review" button routes
// through /api/review-click (tracks the click, then 302s to the real Google
// review URL); an open pixel hits /api/review-open. Tracking keys on either
// ?p=<proposalId> (proposal flow) or ?c=<customerId> (customer flow).
// Secrets from env: RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_REVIEW_URL.
const { sbGet, sbPatch } = require("./_supabase.js");

const FROM = "Mistletoe Construction <alex@hi.mistletoeconstruction.com>";
const REPLY_TO = "Mistletoeconstructionllc@gmail.com";
const SITE = "https://mistletoeconstruction.com";
const PHONE = "(541) 670-5005";
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

function reviewHtml(name, clickUrl, pixelUrl) {
  return "<div style='font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1f2937'>" +
    "<div style='background:#15321f;padding:20px 24px;border-radius:10px 10px 0 0'><span style='color:#fff;font-size:18px;font-weight:800;letter-spacing:.5px'>MISTLETOE CONSTRUCTION</span></div>" +
    "<div style='border:1px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px;padding:24px'>" +
      "<p style='margin:0 0 12px;font-size:16px'>Hi " + esc(name) + ",</p>" +
      "<p style='margin:0 0 16px;font-size:15px;line-height:1.6'>Thank you for trusting our family with your home — it means the world to a small Douglas County crew. If we earned it, a quick Google review would genuinely help other neighbors find us. It takes about 30 seconds.</p>" +
      "<a href='" + clickUrl + "' style='display:inline-block;background:#c9a042;color:#15321f;font-weight:800;text-decoration:none;padding:14px 26px;border-radius:8px;font-size:16px'>Leave a Quick Review &#9733;</a>" +
      "<p style='margin:20px 0 0;font-size:14px;line-height:1.6;color:#374151'><strong>If anything wasn't perfect</strong>, please just reply to this email or call/text <strong>" + PHONE + "</strong> first — we'd rather make it right than have you leave unhappy.</p>" +
      "<hr style='border:0;border-top:1px solid #e5e7eb;margin:20px 0'>" +
      "<p style='margin:0;font-size:13px;color:#6b7280'>Mistletoe Construction LLC · Oregon CCB #255729 · " + PHONE + "</p>" +
    "</div>" +
    "<img src='" + pixelUrl + "' width='1' height='1' alt='' style='display:none'>" +
    "</div>";
}

async function sendEmail(email, name, trackKey) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { error: "email not configured" };
  const clickUrl = SITE + "/api/review-click?" + trackKey;
  const pixelUrl = SITE + "/api/review-open?" + trackKey;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [email], reply_to: REPLY_TO, subject: "How'd we do? A quick favor 🙏", html: reviewHtml(name, clickUrl, pixelUrl) })
  });
  if (!r.ok) { const t = await r.text(); return { error: "email failed: " + t.slice(0, 200) }; }
  return { ok: true };
}

// Proposal-based (auto on paid + Reviews tab). Unchanged behavior.
async function sendReviewRequest(p, opts) {
  opts = opts || {};
  if (p.review_requested_at && !opts.force) return { ok: true, already: true };
  let email = "", name = "there";
  if (p.customerId) {
    const cs = await sbGet("customers?id=eq." + encodeURIComponent(p.customerId) + "&select=name,email");
    if (cs && cs[0]) { email = String(cs[0].email || "").trim(); name = String(cs[0].name || "there").split(" ")[0]; }
  }
  if (!email) return { error: "no customer email" };
  const sent = await sendEmail(email, name, "p=" + encodeURIComponent(p.id));
  if (sent.error) return sent;
  try { await sbPatch("proposals", "id=eq." + encodeURIComponent(p.id), { review_requested_at: new Date().toISOString() }); } catch (e) {}
  return { ok: true, email: email };
}

// Customer-based (manual, from the customer record — for cash/check jobs with no proposal).
async function sendReviewToCustomer(customerId, opts) {
  opts = opts || {};
  if (!customerId) return { error: "no customer" };
  const cs = await sbGet("customers?id=eq." + encodeURIComponent(customerId) + "&select=name,email,review_requested_at");
  const c = cs && cs[0];
  if (!c) return { error: "customer not found" };
  if (c.review_requested_at && !opts.force) return { ok: true, already: true };
  const email = String(c.email || "").trim();
  if (!email) return { error: "no customer email" };
  const name = String(c.name || "there").split(" ")[0];
  const sent = await sendEmail(email, name, "c=" + encodeURIComponent(customerId));
  if (sent.error) return sent;
  try { await sbPatch("customers", "id=eq." + encodeURIComponent(customerId), { review_requested_at: new Date().toISOString() }); } catch (e) {}
  return { ok: true, email: email };
}

module.exports = { sendReviewRequest, sendReviewToCustomer };
