// Address-only lead capture from the instant quote. Fires as soon as the roof
// estimate renders — BEFORE the visitor enters name/phone/email — so an
// abandoned quiz still becomes a mailable prospect (the owner can direct-mail
// the address). Deduped by exact address so repeat runs / later form completion
// don't spawn duplicates. Writes with the service role.
const { sbGet, sbInsert, genId, hasService } = require("./_supabase.js");
function money(n) { return "$" + Math.round(Number(n) || 0).toLocaleString("en-US"); }

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).end(); return; }
  if (!hasService()) { res.status(503).json({ error: "Not configured" }); return; }
  let b = req.body;
  try { if (typeof b === "string") b = JSON.parse(b || "{}"); } catch (e) { b = {}; }
  b = b || {};
  if (String(b.company || "").trim()) { res.status(200).json({ ok: true }); return; } // honeypot
  const address = String(b.address || "").trim();
  if (address.length < 5) { res.status(400).json({ error: "no address" }); return; }
  const est = b.estimate || {};
  const today = new Date().toISOString().slice(0, 10);
  try {
    // Reuse an existing lead for this exact address (any stage) — no duplicates.
    const ex = await sbGet("leads?address=eq." + encodeURIComponent(address) + "&select=id&limit=1");
    if (Array.isArray(ex) && ex[0]) { res.status(200).json({ ok: true, leadId: ex[0].id, existing: true }); return; }
    const leadId = genId("l");
    const note = "📬 Address-only lead from the instant quote — no contact submitted yet (direct-mail candidate). " +
      (est.costLow != null ? "Est. " + money(est.costLow) + "–" + money(est.costHigh) + ". " : "") +
      (est.pitchBand ? est.pitchBand + ". " : "");
    const base = { id: leadId, name: "", phone: "", email: "", city: String(est.city || "").trim(),
      service: "Instant quote — address only", stage: "new", created: today };
    let r = await sbInsert("leads", Object.assign({ address: address, note: note }, base));
    if (r && r.ok === false) {
      // leads.address may not exist yet (migration 005) — keep the address in the note.
      r = await sbInsert("leads", Object.assign({ note: note + address + "." }, base));
    }
    if (r && r.ok === false) { const t = await r.text(); res.status(500).json({ error: t.slice(0, 200) }); return; }
    res.status(200).json({ ok: true, leadId: leadId });
  } catch (e) { res.status(500).json({ error: (e && e.message) || "Could not save" }); }
};
