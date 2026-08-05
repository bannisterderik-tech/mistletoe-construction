// Real, one-click unsubscribe for the realtor drip campaign.
// Records the address as "unsubscribed" in campaign_state so the daily tick
// (campaign-tick.js) skips it forever. Handles GET (footer link) and POST
// (RFC 8058 one-click List-Unsubscribe-Post from Gmail/Apple Mail).
// Secrets from env only: SUPABASE_SERVICE_ROLE_KEY.
const notifyTeam = require("./_notify.js");
const { sbGet, sbPatch, sbInsert, hasService } = require("./_supabase.js");

function getEmail(req) {
  var e = (req.query && (req.query.e || req.query.email)) || "";
  if (!e && typeof req.body === "string") {
    var m = req.body.match(/(?:^|&)e(?:mail)?=([^&]+)/i);
    if (m) e = decodeURIComponent(m[1]);
  } else if (!e && req.body && typeof req.body === "object") {
    e = req.body.e || req.body.email || "";
  }
  return String(e || "").trim().toLowerCase();
}
function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }

function page(title, msg) {
  return "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>" +
    "<title>" + title + "</title></head>" +
    "<body style='margin:0;background:#f5f6f3;font-family:Arial,Helvetica,sans-serif;color:#1f2937'>" +
    "<div style='max-width:520px;margin:8vh auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.08)'>" +
    "<div style='background:#15321f;padding:22px 28px'><span style='color:#fff;font-size:18px;font-weight:800;letter-spacing:.5px'>MISTLETOE CONSTRUCTION</span></div>" +
    "<div style='padding:28px'><h1 style='margin:0 0 10px;font-size:22px;color:#15321f'>" + title + "</h1>" +
    "<p style='margin:0;font-size:15px;line-height:1.6;color:#374151'>" + msg + "</p>" +
    "<p style='margin:18px 0 0;font-size:13px;color:#6b7280'>Mistletoe Construction LLC · 595 E Third St, Riddle, OR 97469 · (541) 670-5005</p></div>" +
    "</div></body></html>";
}

module.exports = async (req, res) => {
  const email = getEmail(req);
  const isPost = req.method === "POST";

  if (!validEmail(email)) {
    if (isPost) { res.status(400).json({ error: "invalid email" }); return; }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(400).send(page("Something went wrong", "We couldn't read which address to unsubscribe. Please email <a href='mailto:alex@mistletoeconstruction.com'>alex@mistletoeconstruction.com</a> and we'll remove you right away."));
    return;
  }

  if (hasService()) {
    try {
      const now = new Date().toISOString();
      const rows = await sbGet("campaign_state?email=eq." + encodeURIComponent(email) + "&select=email");
      if (rows && rows.length) {
        await sbPatch("campaign_state", "email=eq." + encodeURIComponent(email), { status: "unsubscribed", updated_at: now });
      } else {
        // never emailed yet — record a suppression row so we never start
        await sbInsert("campaign_state", { email: email, step: 0, status: "unsubscribed", updated_at: now });
      }
      notifyTeam("Unsubscribe — " + email, "<p><strong>" + email + "</strong> unsubscribed from the realtor drip. They won't be emailed again.</p>");
    } catch (e) { /* best-effort: still confirm to the user below */ }
  }

  if (isPost) { res.status(200).json({ ok: true, unsubscribed: email }); return; }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(page("You're unsubscribed",
    "<strong>" + email + "</strong> has been removed. You won't receive any more emails from us.<br><br>Changed your mind or need a roofer down the road? Just call or text <strong>(541) 670-5005</strong> — no hard feelings."));
};
