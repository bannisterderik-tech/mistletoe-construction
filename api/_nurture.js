// Lead-nurture drip. Open leads that don't close in the first day or two get a
// short, friendly email sequence ($500-off reminder + gentle seasonal urgency)
// until they reply, convert, unsubscribe, or the 3-email sequence finishes.
// Called once a day from campaign-tick.js so it costs no extra Vercel function.
// No-op until migration 006 adds the nurture_* columns (never sends untracked).
// Secrets from env: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY.
const crypto = require("crypto");
const { sbGet, sbPatch, hasService } = require("./_supabase.js");

const UNSUB_SECRET = process.env.UNSUB_SECRET || process.env.CRON_TOKEN || "mc-cron-9f27a1b4";
const FROM = "Mistletoe Construction <alex@hi.mistletoeconstruction.com>";
const REPLY_TO = "Mistletoeconstructionllc@gmail.com";
const MAX_PER_RUN = 60;

// Days-since-created at which each stage's email goes out. Stage N uses OFFSETS[N].
const OFFSETS = [2, 5, 12];
// Leads in these stages are resolved — never nurture them.
const STOP_STAGES = new Set(["won", "lost", "closed", "dead", "customer", "unqualified", "junk", "spam", "duplicate"]);

function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }
function firstName(name) { const n = String(name || "").trim(); if (!n) return "there"; const w = n.split(/\s+/)[0]; return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }
function unsubToken(email) { return crypto.createHmac("sha256", UNSUB_SECRET).update(String(email || "").toLowerCase()).digest("hex").slice(0, 16); }
function unsubUrl(email) { return "https://mistletoeconstruction.com/api/unsubscribe?e=" + encodeURIComponent(email) + "&t=" + unsubToken(email); }
function daysBetween(a, b) { return Math.floor((a - b) / 86400000); }

const EMAILS = [
  {
    subject: "Still thinking about your roof? Your $500 off is still good 🏠",
    body: function (fn) { return "<p>Hi " + fn + ",</p><p>Just following up on your roof. No pressure at all — a new roof is a big decision, and we'd rather answer your questions than rush you.</p><p>Your <strong>$500 off</strong> is still on the table, and a roof inspection is always free. If it turns out you only need a small repair, we'll tell you that too — we're not here to sell you a roof you don't need.</p><p>Want to talk it through? Just reply to this email, or call/text <strong>(541) 670-5005</strong> — you'll reach the family, not a call center.</p>"; }
  },
  {
    subject: "Oregon rain doesn't wait — a quick word before fall ☔",
    body: function (fn) { return "<p>Hi " + fn + ",</p><p>Quick one: the dry months are the best time to replace a roof in Douglas County. Once the fall rains set in, small leaks turn into ceiling stains and schedules fill up fast.</p><p>If your roof's been on your mind, now's the smart time. You've still got <strong>$500 off</strong> waiting, plus a free, no-obligation inspection — with photos, so you can see exactly what's going on up there.</p><p><a href='https://mistletoeconstruction.com/instant-quote.html' style='color:#1b6b3a;font-weight:700'>Get your instant estimate →</a> &nbsp;or call/text <strong>(541) 670-5005</strong>.</p>"; }
  },
  {
    subject: "Last call on your $500 off 🎁",
    body: function (fn) { return "<p>Hi " + fn + ",</p><p>I don't want to keep filling your inbox, so this is my last note about your roof.</p><p>Your <strong>$500 off</strong> is still good if you'd like to move forward. We're a small, family-owned crew — licensed and insured, Oregon CCB #255729 — and we treat every roof like it's on our own house.</p><p>If the timing isn't right, no worries at all. Keep our number for whenever you need us: <strong>(541) 670-5005</strong>. And if you'd like that estimate, <a href='https://mistletoeconstruction.com/instant-quote.html' style='color:#1b6b3a;font-weight:700'>it takes about 60 seconds here</a>.</p><p>Thanks for considering us. — The Mistletoe Construction family</p>"; }
  }
];

function wrap(inner, email) {
  return "<div style='font-family:Arial,Helvetica,sans-serif;max-width:540px;margin:0 auto;color:#1f2937'>" +
    "<div style='background:#15321f;padding:18px 24px;border-radius:10px 10px 0 0'><span style='color:#fff;font-weight:800;letter-spacing:.5px'>MISTLETOE CONSTRUCTION</span></div>" +
    "<div style='border:1px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px;padding:22px 24px;font-size:15px;line-height:1.6'>" + inner +
    "<hr style='border:none;border-top:1px solid #eee;margin:20px 0 12px'>" +
    "<p style='font-size:12px;color:#9ca3af;margin:0'>Mistletoe Construction LLC · 595 E Third St, Riddle, OR 97469 · Oregon CCB #255729<br>" +
    "Prefer not to get these? <a href='" + unsubUrl(email) + "' style='color:#9ca3af'>Unsubscribe</a>.</p></div></div>";
}

async function runNurture(opts) {
  const peek = !!(opts && opts.peek); // read-only: count who's due, send nothing
  if (!hasService()) return { skipped: "no service key" };
  const key = process.env.RESEND_API_KEY;
  if (!key && !peek) return { skipped: "no resend key" };
  const now = new Date();

  // Global suppression: anyone who unsubscribed from any list.
  const suppressed = new Set();
  try {
    const s = await sbGet("campaign_state?status=eq.unsubscribed&select=email");
    if (Array.isArray(s)) s.forEach(function (r) { suppressed.add(String(r.email || "").toLowerCase()); });
  } catch (e) {}

  // Candidate leads. If the nurture_* columns aren't there yet (migration 006
  // not run), this returns a PostgREST error object — bail so we NEVER send an
  // untracked email that would repeat every day.
  const leads = await sbGet("leads?nurture_stop=is.false&select=id,name,email,stage,created,nurture_stage,nurture_last_at,service&order=created.asc&limit=500");
  if (!Array.isArray(leads)) return { skipped: "nurture columns not present (run migration 006)" };

  const due = [];
  for (const l of leads) {
    const email = String(l.email || "").trim().toLowerCase();
    if (!validEmail(email) || suppressed.has(email)) continue;
    if (l.nurture_stop === true) continue;
    if (STOP_STAGES.has(String(l.stage || "").toLowerCase())) continue;
    if (/^referral/i.test(String(l.service || ""))) continue; // referred friends didn't opt into a drip
    const nst = Number(l.nurture_stage || 0);
    if (nst >= EMAILS.length) continue;
    const created = l.created ? new Date(l.created + "T12:00:00Z") : null;
    if (!created || isNaN(created)) continue;
    const ageDays = daysBetween(now, created);
    if (ageDays > 45) continue;              // too old — don't resurrect
    if (ageDays < OFFSETS[nst]) continue;    // not time for the next email yet
    if (l.nurture_last_at) { const last = new Date(l.nurture_last_at); if (!isNaN(last) && daysBetween(now, last) < 2) continue; } // never double-send
    due.push({ l: l, email: email, nst: nst });
    if (due.length >= MAX_PER_RUN) break;
  }

  if (peek) return { ready: true, due: due.length, scanned: leads.length };

  let sent = 0, failed = 0;
  for (const d of due) {
    const em = EMAILS[d.nst];
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM, to: [d.email], reply_to: REPLY_TO, subject: em.subject, html: wrap(em.body(firstName(d.l.name)), d.email),
          headers: { "List-Unsubscribe": "<" + unsubUrl(d.email) + ">, <mailto:" + REPLY_TO + "?subject=Unsubscribe>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
        })
      });
      if (!r.ok) { failed++; continue; }
      sent++;
      await sbPatch("leads", "id=eq." + encodeURIComponent(d.l.id), { nurture_stage: d.nst + 1, nurture_last_at: now.toISOString() });
    } catch (e) { failed++; }
  }
  return { candidates: due.length, sent: sent, failed: failed };
}

module.exports = runNurture;
module.exports.runNurture = runNurture;
