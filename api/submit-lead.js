// Contact-form handler: writes the lead to Supabase with the service role
// (reliable — no dependency on anon RLS) and emails the team a notification.
// Secrets from env only: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY.
const { sbInsert, genId, hasService } = require("./_supabase.js");
const NOTIFY_TO = ["alex@mistletoeconstruction.com", "bannisterderik@gmail.com"];
const FROM = "Mistletoe Leads <alex@hi.mistletoeconstruction.com>";

function esc(s) { return String(s == null ? "" : s).replace(/[<>&]/g, function (c) { return ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]; }); }

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).end(); return; }
  if (!hasService()) { res.status(503).json({ error: "Not configured" }); return; }

  let b = req.body;
  try { if (typeof b === "string") b = JSON.parse(b || "{}"); } catch (e) { b = {}; }
  b = b || {};
  // Honeypot: real users never fill the hidden "company" field; bots do.
  if (String(b.company || "").trim()) { res.status(200).json({ ok: true }); return; }
  const name = String(b.name || "").trim();
  const phone = String(b.phone || "").trim();
  const email = String(b.email || "").trim();
  if (!name || (!phone && !email)) { res.status(400).json({ error: "Please include a name and a phone or email." }); return; }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: "That email doesn't look right." }); return; }

  const service = String(b.service || "Something else").trim();
  const city = String(b.city || "").trim();
  const message = String(b.message || b.note || "").trim();
  const note = message + (email ? "  [email: " + email + "]" : "");
  const lead = {
    id: genId("l"),
    name: name, phone: phone, city: city, service: service,
    note: note, stage: "new", created: new Date().toISOString().slice(0, 10)
  };

  // 1) write the lead (service role bypasses RLS)
  try {
    const r = await sbInsert("leads", lead);
    if (!r.ok) { const t = await r.text(); res.status(502).json({ error: "Could not save lead", detail: t.slice(0, 300) }); return; }
  } catch (e) {
    res.status(502).json({ error: "Could not reach the database" }); return;
  }

  // 2) notify the team (best-effort — never fail the lead over an email hiccup)
  const key = process.env.RESEND_API_KEY;
  if (key) {
    const html = "<div style='font-family:Arial,sans-serif;font-size:15px;color:#1f1f1f'>" +
      "<h2 style='color:#1b3d26;margin:0 0 12px'>New lead from the website</h2>" +
      "<p><strong>Name:</strong> " + esc(name) + "<br>" +
      "<strong>Phone:</strong> " + esc(phone || "—") + "<br>" +
      "<strong>Email:</strong> " + esc(email || "—") + "<br>" +
      "<strong>City:</strong> " + esc(city || "—") + "<br>" +
      "<strong>Service:</strong> " + esc(service) + "</p>" +
      (message ? "<p><strong>Message:</strong><br>" + esc(message) + "</p>" : "") +
      "<p style='color:#4a524c;font-size:13px'>Open the CRM → Leads to work it. This lead is saved as “new”.</p></div>";
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: NOTIFY_TO, reply_to: email || undefined,
          subject: "New lead: " + name + " — " + service, html: html })
      });
    } catch (e) { /* lead is already saved; ignore notify failure */ }
  }

  res.status(200).json({ ok: true });
};
