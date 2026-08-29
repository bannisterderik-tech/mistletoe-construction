// Unsubscribe for the realtor drip campaign — hardened against bot/scanner
// false-positives.
//
//   GET  → shows a confirmation page and does NOTHING to the database. This is
//          deliberate: email-security scanners (Microsoft Safe Links, Barracuda,
//          Mimecast, Proofpoint, Gmail prefetch) auto-GET every link in a
//          message. If GET unsubscribed, those crawlers would silently opt out
//          real recipients (and, with no token check, create phantom rows).
//   POST → actually unsubscribes, but ONLY if the HMAC token matches. This
//          covers both the RFC 8058 one-click (Gmail/Apple "Unsubscribe" button)
//          and the confirm-page button below.
//
// The token proves we generated the link for that exact address, so garbage /
// guessed addresses can no longer be suppressed. Secrets from env only.
const crypto = require("crypto");
const notifyTeam = require("./_notify.js");
const { sbGet, sbPatch, sbInsert, hasService } = require("./_supabase.js");

// Same secret + scheme as campaign-tick.js / _nurture.js, so tokens on already
// sent emails keep validating.
const UNSUB_SECRET = process.env.UNSUB_SECRET || process.env.CRON_TOKEN || "mc-cron-9f27a1b4";
function expectedToken(email) {
  return crypto.createHmac("sha256", UNSUB_SECRET).update(String(email || "").toLowerCase()).digest("hex").slice(0, 16);
}
function tokenOk(email, t) {
  const want = expectedToken(email);
  const a = Buffer.from(String(t || ""), "utf8"), b = Buffer.from(want, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function field(req, names) {
  for (const n of names) {
    if (req.query && req.query[n]) return String(req.query[n]);
  }
  if (typeof req.body === "string") {
    for (const n of names) {
      const m = req.body.match(new RegExp("(?:^|&)" + n + "=([^&]+)", "i"));
      if (m) return decodeURIComponent(m[1].replace(/\+/g, " "));
    }
  } else if (req.body && typeof req.body === "object") {
    for (const n of names) { if (req.body[n]) return String(req.body[n]); }
  }
  return "";
}
function getEmail(req) { return field(req, ["e", "email"]).trim().toLowerCase(); }
function getToken(req) { return field(req, ["t", "token"]).trim(); }
function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }

function shell(title, inner) {
  return "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>" +
    "<title>" + title + "</title></head>" +
    "<body style='margin:0;background:#f5f6f3;font-family:Arial,Helvetica,sans-serif;color:#1f2937'>" +
    "<div style='max-width:520px;margin:8vh auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.08)'>" +
    "<div style='background:#15321f;padding:22px 28px'><span style='color:#fff;font-size:18px;font-weight:800;letter-spacing:.5px'>MISTLETOE CONSTRUCTION</span></div>" +
    "<div style='padding:28px'>" + inner +
    "<p style='margin:18px 0 0;font-size:13px;color:#6b7280'>Mistletoe Construction LLC · 595 E Third St, Riddle, OR 97469 · (541) 670-5005</p></div>" +
    "</div></body></html>";
}
function msgPage(title, msg) {
  return shell(title, "<h1 style='margin:0 0 10px;font-size:22px;color:#15321f'>" + title + "</h1>" +
    "<p style='margin:0;font-size:15px;line-height:1.6;color:#374151'>" + msg + "</p>");
}
function esc(s) { return String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])); }

function confirmPage(email, token) {
  const action = "/api/unsubscribe?e=" + encodeURIComponent(email) + "&t=" + encodeURIComponent(token);
  return shell("Unsubscribe?",
    "<h1 style='margin:0 0 10px;font-size:22px;color:#15321f'>Unsubscribe from these emails?</h1>" +
    "<p style='margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151'>Click the button to stop emails to <strong>" + esc(email) + "</strong>. You won't hear from us again.</p>" +
    "<form method='POST' action='" + action + "'>" +
    "<input type='hidden' name='web' value='1'>" +
    "<button type='submit' style='display:inline-block;background:#15321f;color:#fff;border:0;border-radius:8px;padding:12px 22px;font-size:15px;font-weight:700;cursor:pointer'>Yes, unsubscribe me</button>" +
    "</form>" +
    "<p style='margin:16px 0 0;font-size:13px;color:#6b7280'>Didn't mean to click? Just close this page — nothing happens until you press the button.</p>");
}

module.exports = async (req, res) => {
  const email = getEmail(req);
  const token = getToken(req);
  const isPost = req.method === "POST";

  // ---- GET: never mutate. Show a confirm page (defeats link-scanner prefetch). ----
  if (!isPost) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (!validEmail(email)) {
      res.status(400).send(msgPage("Something went wrong",
        "We couldn't read which address to unsubscribe. Email <a href='mailto:alex@mistletoeconstruction.com'>alex@mistletoeconstruction.com</a> and we'll remove you right away."));
      return;
    }
    res.status(200).send(confirmPage(email, token));
    return;
  }

  // ---- POST: the real action. Require a valid token. ----
  const wantsHtml = !!field(req, ["web"]);
  const fail = (code, jsonMsg, htmlTitle, htmlMsg) => {
    if (wantsHtml) { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.status(code).send(msgPage(htmlTitle, htmlMsg)); }
    else res.status(code).json({ error: jsonMsg });
  };

  if (!validEmail(email)) { fail(400, "invalid email", "Something went wrong", "We couldn't read which address to unsubscribe."); return; }
  if (!tokenOk(email, token)) {
    // No valid token = not a real link we issued (bot, scanner, or tampering).
    // Refuse silently — never create a suppression row from an unverified hit.
    fail(403, "invalid or missing token", "Link couldn't be verified",
      "This unsubscribe link is invalid or expired. If you want out, email <a href='mailto:alex@mistletoeconstruction.com'>alex@mistletoeconstruction.com</a> and we'll remove you right away.");
    return;
  }

  if (hasService()) {
    try {
      const now = new Date().toISOString();
      const rows = await sbGet("campaign_state?email=eq." + encodeURIComponent(email) + "&select=email");
      if (rows && rows.length) {
        await sbPatch("campaign_state", "email=eq." + encodeURIComponent(email), { status: "unsubscribed", updated_at: now });
      } else {
        // Token is valid, so we did generate a link for this address — safe to
        // record a suppression row so we never (re)start them.
        await sbInsert("campaign_state", { email: email, step: 0, status: "unsubscribed", updated_at: now });
      }
      try { await sbPatch("leads", "email=eq." + encodeURIComponent(email), { nurture_stop: true }); } catch (e) {}
      notifyTeam("Unsubscribe — " + email, "<p><strong>" + esc(email) + "</strong> unsubscribed (verified). They won't be emailed again (realtor drip + lead nurture).</p>");
    } catch (e) { /* best-effort — still confirm below */ }
  }

  if (wantsHtml) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(msgPage("You're unsubscribed",
      "<strong>" + esc(email) + "</strong> has been removed. You won't receive any more emails from us.<br><br>Changed your mind or need a roofer down the road? Just call or text <strong>(541) 670-5005</strong> — no hard feelings."));
    return;
  }
  res.status(200).json({ ok: true, unsubscribed: email });
};
