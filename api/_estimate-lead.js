// "Request a Detailed Quote" from the instant estimator:
//  1) create (or reuse) a customer,
//  2) create a DRAFT proposal pre-filled from the estimate (ready to review/send),
//  3) notify the team.
// Everything writes with the service role (no anon-RLS dependency).
// Secrets from env: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY.
const notifyTeam = require("./_notify.js");
const crypto = require("crypto");
const { sbGet, sbInsert, genId, hasService } = require("./_supabase.js");

function esc(s) { return String(s == null ? "" : s).replace(/[<>&]/g, function (c) { return ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]; }); }
function money(n) { return "$" + Math.round(Number(n) || 0).toLocaleString("en-US"); }

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).end(); return; }
  if (!hasService()) { res.status(503).json({ error: "Not configured" }); return; }

  let b = req.body;
  try { if (typeof b === "string") b = JSON.parse(b || "{}"); } catch (e) { b = {}; }
  b = b || {};
  if (String(b.company || "").trim()) { res.status(200).json({ ok: true }); return; } // honeypot
  const name = String(b.name || "").trim();
  const phone = String(b.phone || "").trim();
  const email = String(b.email || "").trim().toLowerCase();
  const address = String(b.address || "").trim();
  const est = b.estimate || {};
  if (!name || (!phone && !email)) { res.status(400).json({ error: "Add a name and a phone or email." }); return; }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: "That email doesn't look right." }); return; }

  const today = new Date().toISOString().slice(0, 10);

  try {
    // 1) customer — reuse by email, else create
    let customerId = null;
    if (email) {
      const ex = await sbGet("customers?email=eq." + encodeURIComponent(email) + "&select=id&limit=1");
      if (ex && ex[0]) customerId = ex[0].id;
    }
    const chk = async (label, r) => { if (r && r.ok === false) { const t = await r.text(); throw new Error(label + ": " + t.slice(0, 300)); } };

    if (!customerId) {
      customerId = genId("c");
      await chk("customer", await sbInsert("customers", { id: customerId, name: name, phone: phone, email: email,
        city: String(est.city || "").trim(), address: address, member: false, notes: "From the instant roof estimate." }));
    }

    // 1b) drop a lead into the pipeline in the NEW stage
    const leadId = genId("l");
    await chk("lead", await sbInsert("leads", {
      id: leadId,
      name: name, phone: phone, email: email, city: String(est.city || "").trim(),
      service: "Roof Replacement — instant estimate", stage: "new",
      note: (est.costLow != null ? "Instant estimate " + money(est.costLow) + "–" + money(est.costHigh) + ". " : "") +
        (est.pitchBand ? est.pitchBand + ". " : "") + (address ? address + ". " : ""),
      created: today
    }));

    // 2) draft proposal pre-filled from the estimate
    const mid = (est.costLow != null && est.costHigh != null) ? Math.round((est.costLow + est.costHigh) / 2) : 0;
    const descBits = [];
    if (est.measuredSqFt) descBits.push(est.measuredSqFt + " sq ft measured / " + (est.quotedSqFt || "") + " quoted");
    if (est.pitchBand) descBits.push(est.pitchBand);
    if (est.material) descBits.push(est.material);
    const desc = "Roof replacement" + (descBits.length ? " — " + descBits.join(", ") : "");
    const token = crypto.randomBytes(16).toString("hex");
    const note = "Auto-created from the instant roof estimate." +
      (est.costLow != null ? " Estimated range " + money(est.costLow) + "–" + money(est.costHigh) + "." : "") +
      (est.custom ? " Steep pitch (9+/12) — needs a manual quote." : "") +
      (address ? " Property: " + address + "." : "") +
      " Review and adjust the line items before sending.";
    await chk("proposal", await sbInsert("proposals", {
      id: genId("p"), customerId: customerId, lead_id: leadId, title: "Roof replacement — instant estimate",
      items: [{ desc: desc, qty: 1, unit: mid }], amount: mid, status: "draft",
      token: token, note: note, created: today
    }));

    // 3) notify the team
    await notifyTeam("🏠 Instant estimate → draft proposal ready",
      "<h2 style='color:#1b3d26'>New instant-estimate request</h2>" +
      "<p><strong>" + esc(name) + "</strong>" + (phone ? " · " + esc(phone) : "") + (email ? " · " + esc(email) : "") + "</p>" +
      (address ? "<p><strong>Property:</strong> " + esc(address) + "</p>" : "") +
      (est.costLow != null ? "<p><strong>Estimated range:</strong> " + money(est.costLow) + "–" + money(est.costHigh) +
        " · " + esc(est.pitchBand || "") + " · " + (est.material || "asphalt") + "</p>" : "") +
      "<p>A <strong>draft proposal</strong> and customer record were created in the CRM. Open <strong>Proposals</strong> to review, adjust, and send — accepting it becomes a Stripe invoice automatically.</p>");

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "Could not save" });
  }
};
