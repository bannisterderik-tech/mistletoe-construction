// Admin/ops helper: create a DRAFT proposal for an existing lead/customer
// (found by email, else name), linked via lead_id. Token-gated (CRON_TOKEN).
// Secrets from env: SUPABASE_SERVICE_ROLE_KEY.
const crypto = require("crypto");
const notifyTeam = require("./_notify.js");
const { sbGet, sbInsert, genId, hasService } = require("./_supabase.js");

const TOKEN = process.env.CRON_TOKEN || "mc-cron-9f27a1b4";

module.exports = async (req, res) => {
  if (!hasService()) { res.status(503).json({ error: "Not configured" }); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }
  let b = req.body;
  try { if (typeof b === "string") b = JSON.parse(b || "{}"); } catch (e) { b = {}; }
  b = b || {};
  if (String(b.token || "") !== TOKEN) { res.status(403).json({ error: "forbidden" }); return; }

  const email = String(b.email || "").trim().toLowerCase();
  const name = String(b.name || "").trim();
  const amount = Math.round(Number(b.amount) || 0);
  const title = String(b.title || "Roof replacement").slice(0, 120);
  const desc = String(b.desc || title).slice(0, 250);
  const note = String(b.note || "");
  if (!email && !name) { res.status(400).json({ error: "need email or name" }); return; }

  const chk = async (label, r) => { if (r && r.ok === false) { const t = await r.text(); throw new Error(label + ": " + t.slice(0, 300)); } };

  try {
    // customer (find by email, then name; else create)
    let customerId = null, custName = name;
    if (email) { const cs = await sbGet("customers?email=eq." + encodeURIComponent(email) + "&select=id,name&limit=1"); if (cs && cs[0]) { customerId = cs[0].id; custName = cs[0].name || custName; } }
    if (!customerId && name) { const cs = await sbGet("customers?name=eq." + encodeURIComponent(name) + "&select=id,name&limit=1"); if (cs && cs[0]) { customerId = cs[0].id; } }
    if (!customerId) { customerId = genId("c"); await chk("customer", await sbInsert("customers", { id: customerId, name: name || email, email: email, notes: "Created for a manual proposal." })); }

    // lead (find by email, then name)
    let leadId = null;
    if (email) { const ls = await sbGet("leads?email=eq." + encodeURIComponent(email) + "&select=id&limit=1"); if (ls && ls[0]) leadId = ls[0].id; }
    if (!leadId && name) { const ls = await sbGet("leads?name=eq." + encodeURIComponent(name) + "&select=id&limit=1"); if (ls && ls[0]) leadId = ls[0].id; }

    // draft proposal
    const token = crypto.randomBytes(16).toString("hex");
    const pid = genId("p");
    await chk("proposal", await sbInsert("proposals", {
      id: pid, customerId: customerId, lead_id: leadId || null, title: title,
      items: [{ desc: desc, qty: 1, unit: amount }], amount: amount, status: "draft",
      token: token, note: note, created: new Date().toISOString().slice(0, 10)
    }));

    await notifyTeam("Draft proposal created — " + title,
      "<h2 style='color:#1b3d26'>Draft proposal ready</h2><p>A draft proposal for <strong>" + (custName || email) +
      "</strong> ($" + amount.toLocaleString("en-US") + ") was created and linked to their lead. Review, adjust the line items, and send it from the CRM → <strong>Proposals</strong>.</p>");
    res.status(200).json({ ok: true, proposalId: pid, token: token, customerId: customerId, leadId: leadId, amount: amount });
  } catch (e) { res.status(500).json({ error: (e && e.message) || "failed" }); }
};
