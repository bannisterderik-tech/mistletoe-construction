// Emails a proposal to the customer with a link to view + accept it.
// Secrets from env only: RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY.
const notifyTeam = require("./_notify.js");
const { sbGet, sbPatch, hasService } = require("./_supabase.js");

const FROM = "Mistletoe Construction <alex@hi.mistletoeconstruction.com>";
const REPLY_TO = "Mistletoeconstructionllc@gmail.com";
const SITE = "https://mistletoeconstruction.com";
const PHONE = "(541) 670-5005";
const CCB = "Oregon CCB #255729";

function money(n) { return "$" + Number(n || 0).toLocaleString("en-US"); }
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
  });
}

module.exports = async (req, res) => {
  const key = process.env.RESEND_API_KEY;
  if (!hasService()) { res.status(503).json({ error: "Server isn't fully configured (database key missing)." }); return; }
  if (!key) { res.status(503).json({ error: "Email isn't switched on yet — RESEND_API_KEY isn't set in Vercel." }); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }

  let body = req.body;
  try { if (typeof body === "string") body = JSON.parse(body || "{}"); } catch (e) { body = {}; }
  body = body || {};
  const token = String(body.token || "").trim();
  if (!token) { res.status(400).json({ error: "Missing proposal token" }); return; }

  try {
    const rows = await sbGet("proposals?token=eq." + encodeURIComponent(token) + "&select=*");
    const p = rows && rows[0];
    if (!p) { res.status(404).json({ error: "Proposal not found" }); return; }

    let email = "", name = "there";
    if (p.customerId) {
      const cs = await sbGet("customers?id=eq." + encodeURIComponent(p.customerId) + "&select=name,email");
      if (cs && cs[0]) { email = String(cs[0].email || "").trim(); name = cs[0].name || name; }
    }
    if (!email) { res.status(400).json({ error: "This customer has no email on file. Add one under Customers → Edit details." }); return; }

    const url = SITE + "/proposal.html?t=" + encodeURIComponent(p.token);
    const title = esc(p.title || "Your project");
    const items = Array.isArray(p.items) ? p.items : [];
    const lineRows = items.map(function (it) {
      return "<tr><td style='padding:6px 0;border-bottom:1px solid #eee'>" + esc(it.desc || "") +
        (it.qty ? " <span style='color:#6b7280'>× " + esc(it.qty) + "</span>" : "") +
        "</td><td style='padding:6px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap'>" +
        money((Number(it.qty) || 1) * (Number(it.unit) || 0)) + "</td></tr>";
    }).join("");

    const html =
      "<div style='font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937'>" +
      "<div style='background:#15321f;padding:22px 24px;border-radius:10px 10px 0 0'>" +
        "<div style='color:#fff;font-size:20px;font-weight:800;letter-spacing:.5px'>MISTLETOE CONSTRUCTION</div>" +
        "<div style='color:#c9a042;font-size:13px;margin-top:2px'>Family-owned roofing &amp; construction · Douglas County, OR</div>" +
      "</div>" +
      "<div style='border:1px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px;padding:24px'>" +
        "<p style='margin:0 0 12px;font-size:16px'>Hi " + esc(name) + ",</p>" +
        "<p style='margin:0 0 16px;font-size:15px;line-height:1.5'>Thanks for the opportunity! Here's your proposal for <strong>" + title + "</strong>. Review the full details, then accept and sign online whenever you're ready.</p>" +
        (lineRows ? "<table style='width:100%;border-collapse:collapse;font-size:14px;margin:0 0 8px'>" + lineRows + "</table>" : "") +
        "<p style='margin:6px 0 20px;font-size:18px;font-weight:800'>Total: " + money(p.amount) + "</p>" +
        "<a href='" + url + "' style='display:inline-block;background:#c9a042;color:#15321f;font-weight:800;text-decoration:none;padding:14px 26px;border-radius:8px;font-size:16px'>View &amp; Accept Your Proposal →</a>" +
        "<p style='margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.5'>Or paste this link into your browser:<br><a href='" + url + "' style='color:#15321f'>" + url + "</a></p>" +
        "<hr style='border:0;border-top:1px solid #e5e7eb;margin:22px 0'>" +
        "<p style='margin:0;font-size:13px;color:#6b7280;line-height:1.6'>Questions? Call or text <strong>" + PHONE + "</strong><br>" + CCB + " · Licensed &amp; insured · Owens Corning Certified</p>" +
      "</div></div>";

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM, to: [email], reply_to: REPLY_TO,
        subject: "Your proposal from Mistletoe Construction — " + (p.title || "your project"),
        html: html
      })
    });
    if (!r.ok) { const t = await r.text(); res.status(502).json({ error: "Email service rejected the send", detail: t.slice(0, 300) }); return; }

    try { await sbPatch("proposals", "id=eq." + encodeURIComponent(p.id), { status: "sent" }); } catch (e) { /* email already sent; status is best-effort */ }
    notifyTeam("Proposal sent — " + (p.title || "proposal"),
      "<h2 style='color:#15321f'>Proposal emailed</h2><p><strong>" + title + "</strong> (" + money(p.amount) + ") was emailed to " + esc(name) + " &lt;" + esc(email) + "&gt;.</p>");
    res.status(200).json({ ok: true, email: email });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "Could not send the proposal" });
  }
};
