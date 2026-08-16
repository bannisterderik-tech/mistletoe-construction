// Referral submission — a customer refers a neighbor. Creates a warm lead for
// the friend (who gets $500 off), attributes it to the referrer (who earns $250
// when the roof is installed), notifies the team, and confirms to the referrer.
// Public endpoint (honeypot-protected). Writes with the service role.
const notifyTeam = require("./_notify.js");
const { sbGet, sbInsert, genId, hasService } = require("./_supabase.js");
function esc(s) { return String(s == null ? "" : s).replace(/[<>&]/g, function (c) { return ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]; }); }

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).end(); return; }
  if (!hasService()) { res.status(503).json({ error: "Not configured" }); return; }
  let b = req.body; try { if (typeof b === "string") b = JSON.parse(b || "{}"); } catch (e) { b = {}; }
  b = b || {};
  if (String(b.company || "").trim()) { res.status(200).json({ ok: true }); return; } // honeypot

  const refName = String(b.referrerName || "").trim();
  const refEmail = String(b.referrerEmail || "").trim();
  const refId = String(b.ref || "").trim();
  const fName = String(b.friendName || "").trim();
  const fPhone = String(b.friendPhone || "").trim();
  const fEmail = String(b.friendEmail || "").trim();
  const fAddr = String(b.friendAddress || "").trim();
  const msg = String(b.message || "").trim();
  if (!fName || (!fPhone && !fEmail)) { res.status(400).json({ error: "Add your neighbor's name and a phone or email." }); return; }
  if (!refName && !refId) { res.status(400).json({ error: "Please add your name so we can credit you." }); return; }

  let referrer = refName;
  try { if (refId) { const cs = await sbGet("customers?id=eq." + encodeURIComponent(refId) + "&select=name,email"); if (cs && cs[0]) referrer = cs[0].name || refName || "a customer"; } } catch (e) {}

  const today = new Date().toISOString().slice(0, 10);
  const note = "🎁 REFERRAL — referred by " + (referrer || "(name not given)") + (refEmail ? " (" + refEmail + ")" : "") + (refId ? " [ref:" + refId + "]" : "") +
    ". Friend gets $500 off; referrer earns $250 when the roof is installed." + (fAddr ? " Property: " + fAddr + "." : "") + (msg ? " Note: " + msg : "");
  try {
    const r = await sbInsert("leads", { id: genId("l"), name: fName, phone: fPhone, email: fEmail, address: fAddr, city: "", service: "Referral — new roof", stage: "new", note: note, created: today });
    if (r && r.ok === false) {
      const noAddr = { id: genId("l"), name: fName, phone: fPhone, email: fEmail, city: "", service: "Referral — new roof", stage: "new", note: note + (fAddr ? " (" + fAddr + ")" : ""), created: today };
      const r2 = await sbInsert("leads", noAddr); // retry without address col if migration 005 not run
      if (r2 && r2.ok === false) { const t = await r2.text(); res.status(500).json({ error: t.slice(0, 200) }); return; }
    }
  } catch (e) { res.status(500).json({ error: "Could not save" }); return; }

  try {
    await notifyTeam("🎁 New referral — " + esc(fName),
      "<h2 style='color:#1b3d26'>New referral</h2>" +
      "<p><strong>" + esc(referrer || "Someone") + "</strong> referred <strong>" + esc(fName) + "</strong>" + (fPhone ? " · " + esc(fPhone) : "") + (fEmail ? " · " + esc(fEmail) : "") + "</p>" +
      (fAddr ? "<p><strong>Property:</strong> " + esc(fAddr) + "</p>" : "") + (msg ? "<p><strong>Note:</strong> " + esc(msg) + "</p>" : "") +
      "<p>Friend gets <strong>$500 off</strong>; referrer earns <strong>$250</strong> on completion. Call them soon — referrals close fast.</p>");
  } catch (e) {}

  const key = process.env.RESEND_API_KEY;
  if (key && refEmail && /.+@.+\..+/.test(refEmail)) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Mistletoe Construction <alex@hi.mistletoeconstruction.com>", to: [refEmail], reply_to: "Mistletoeconstructionllc@gmail.com",
          subject: "Thanks for the referral! 🎁",
          html: "<div style='font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937'><div style='background:#15321f;padding:18px 22px;border-radius:10px 10px 0 0'><span style='color:#fff;font-weight:800'>MISTLETOE CONSTRUCTION</span></div><div style='border:1px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px;padding:22px'><p>Hi " + esc(referrer || "there") + ",</p><p>Thank you for referring <strong>" + esc(fName) + "</strong> — that means the world to a small family crew.</p><p>We'll reach out to them soon. When their new roof is installed, <strong>you get $250</strong> as our thanks, and they get <strong>$500 off</strong>. Refer as many neighbors as you like!</p><p style='color:#6b7280;font-size:13px'>The Mistletoe Construction family · (541) 670-5005 · Oregon CCB #255729</p></div></div>"
        })
      });
    } catch (e) {}
  }
  res.status(200).json({ ok: true });
};
