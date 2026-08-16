// Daily realtor-drip tick (Vercel Cron). Strategy: send the current email to
// up to 50 contacts/day; only advance to the next email once EVERYONE has the
// current one (column-by-column). State in Supabase campaign_state. Never >50/day.
// Secrets from env: RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY.
const crypto = require("crypto");
const CONTACTS = require("./_campaign-contacts.js");
const EM = require("./_campaign-emails.js");

const SUPABASE_URL = "https://touydwcbxgrigmxvwnvx.supabase.co";
const TOKEN = process.env.CRON_TOKEN || "mc-cron-9f27a1b4";
const UNSUB_SECRET = process.env.UNSUB_SECRET || TOKEN;
const DAILY_CAP = 50;

// Hard suppression — never email these, regardless of campaign_state (belt-and-suspenders).
const ALWAYS_SUPPRESS = new Set(["kim@theoregonlife.com"]);

function unsubToken(email) {
  return crypto.createHmac("sha256", UNSUB_SECRET).update(String(email || "").toLowerCase()).digest("hex").slice(0, 16);
}
function unsubUrl(email) {
  return "https://mistletoeconstruction.com/api/unsubscribe?e=" + encodeURIComponent(email) + "&t=" + unsubToken(email);
}

module.exports.config = { maxDuration: 60 };

function firstName(name) {
  const n = String(name || "").replace(/\(#?\d+\)/g, "").trim();
  if (!n) return "there";
  const w = n.split(/\s+/)[0];
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}
function render(inner, c) {
  const city = (c.city || "Roseburg").trim() || "Roseburg";
  const body = inner
    .replace(/{{first_name}}/g, firstName(c.name))
    .replace(/{{brokerage}}/g, c.brokerage || "your brokerage")
    .replace(/{{city_or_glide}}/g, city.toLowerCase() !== "roseburg" ? city : "Glide")
    .replace(/{{city}}/g, city);
  return EM.wrapper.replace("{BODY}", body)
    .replace(/{UNSUB}/g, EM.unsub)
    .replace(/{UNSUB_TOKEN}/g, unsubToken(c.email))
    .replace(/{EMAIL_ENC}/g, encodeURIComponent(c.email));
}

module.exports = async (req, res) => {
  const isCron = !!(req.headers && req.headers["x-vercel-cron"]);
  const token = (req.query && req.query.token) || "";
  if (!isCron && token !== TOKEN) { res.status(403).json({ error: "forbidden" }); return; }

  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = process.env.RESEND_API_KEY;
  if (!svc || !key) { res.status(503).json({ error: "not configured" }); return; }
  const dry = !!(req.query && (req.query.dry === "1" || req.query.dry === "true"));

  // Lead-nurture drip rides along on this daily cron (no extra Vercel function).
  // Skipped on dry runs; never lets a nurture error break the realtor tick.
  let nurture = null;
  try { nurture = await require("./_nurture.js")(dry ? { peek: true } : undefined); } catch (e) { nurture = { error: (e && e.message) || "nurture failed" }; }

  const h = { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json" };
  const today = new Date().toISOString().slice(0, 10);
  const NSTEPS = EM.steps.length;

  try {
    // load state
    const state = {};
    const r = await fetch(SUPABASE_URL + "/rest/v1/campaign_state?select=email,step,last_sent,status", { headers: h });
    (await r.json() || []).forEach((row) => { state[(row.email || "").toLowerCase()] = row; });

    const stateRows = Object.values(state);
    const sentToday = stateRows.filter((s) => s.last_sent === today).length;
    const budget = Math.max(0, DAILY_CAP - sentToday);
    // lifetime totals
    const totalSent = stateRows.reduce((a, s) => a + (s.step || 0), 0);
    const contactsStarted = stateRows.length;
    const unsubscribed = stateRows.filter((s) => s.status === "unsubscribed").length;
    const byStep = {};
    stateRows.forEach((s) => { var k = s.step || 0; byStep[k] = (byStep[k] || 0) + 1; });

    // eligible = active, not finished
    const eligible = CONTACTS.map((c) => {
      const s = state[(c.email || "").toLowerCase()] || { step: 0, status: "active" };
      return { c: c, step: s.step || 0, status: s.status || "active" };
    }).filter((x) => x.status !== "unsubscribed" && x.step < NSTEPS && !ALWAYS_SUPPRESS.has((x.c.email || "").toLowerCase()));

    if (!eligible.length) { res.status(200).json({ done: true, message: "all contacts completed all 14 emails", nurture: nurture }); return; }

    const minStep = Math.min.apply(null, eligible.map((x) => x.step));
    const column = eligible.filter((x) => x.step === minStep);
    const batch = budget > 0 ? column.slice(0, budget) : [];

    const summary = {
      today, currentEmail: minStep + 1, currentSubject: EM.steps[minStep].subject,
      sentToday, cap: DAILY_CAP, remainingBudget: budget,
      waitingInColumn: column.length, toSendNow: batch.length, dry,
      totalSent, contactsStarted, contactsTotal: CONTACTS.length, unsubscribed, byStep, nurture
    };
    if (dry) { summary.preview = batch.slice(0, 5).map((x) => x.c.email); res.status(200).json(summary); return; }
    if (!batch.length) { res.status(200).json(Object.assign({ sent: 0 }, summary)); return; }

    // send as one Resend batch call
    const step = EM.steps[minStep];
    const payload = batch.map((x) => ({
      from: EM.from, to: [x.c.email], reply_to: EM.reply_to, subject: step.subject,
      html: render(step.inner, x.c),
      headers: {
        "List-Unsubscribe": "<" + unsubUrl(x.c.email) + ">, <mailto:" + EM.unsub + "?subject=Unsubscribe>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
      }
    }));
    const send = await fetch("https://api.resend.com/emails/batch", {
      method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!send.ok) { const t = await send.text(); res.status(502).json({ error: "resend batch failed", detail: t.slice(0, 400) }); return; }

    // record state (upsert)
    const rows = batch.map((x) => ({
      email: x.c.email, name: x.c.name, step: minStep + 1, last_sent: today, status: "active", updated_at: new Date().toISOString()
    }));
    await fetch(SUPABASE_URL + "/rest/v1/campaign_state", {
      method: "POST",
      headers: Object.assign({ Prefer: "resolution=merge-duplicates,return=minimal" }, h),
      body: JSON.stringify(rows)
    });

    res.status(200).json(Object.assign({ sent: batch.length }, summary));
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "tick failed" });
  }
};
