// One-shot: emails all 14 realtor emails as a single branded preview to the
// owners (Derik + Alex) via Resend. Key read from env only. Token-guarded, and
// the recipient list is fixed to the owners so it can't be used to spam anyone.
const PREVIEW = require("./_email-preview.js");

const TOKEN = "mc-send-7c41a9f2e8";
const FROM = "Alex Smith - Mistletoe Construction <alex@hi.mistletoeconstruction.com>";
const REPLY_TO = "alex@mistletoeconstruction.com";
const TO = ["bannisterderik@gmail.com", "alex@mistletoeconstruction.com"];
const SUBJECT = "The Realtor Email Series - all 14 emails (preview)";

module.exports = async (req, res) => {
  const key = process.env.RESEND_API_KEY;
  if (!key) { res.status(503).json({ error: "RESEND_API_KEY is not set in Vercel yet." }); return; }
  const token = (req.query && req.query.token) || "";
  if (token !== TOKEN) { res.status(403).json({ error: "Missing or bad token." }); return; }

  const html = PREVIEW
    .replace(/{{first_name}}/g, "there")
    .replace(/{{city_or_glide}}/g, "Glide")
    .replace(/{{brokerage}}/g, "your brokerage")
    .replace(/{{city}}/g, "Roseburg");

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: TO, reply_to: REPLY_TO, subject: SUBJECT, html: html })
    });
    const data = await r.json();
    if (!r.ok) { res.status(r.status).json({ error: data }); return; }
    res.status(200).json({ sent: true, id: data.id, to: TO });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "send failed" });
  }
};
