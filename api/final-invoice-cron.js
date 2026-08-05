// Daily Vercel cron: notify the admin a few days before a scheduled 2nd payment,
// then auto-create + send the balance invoice on the due date.
// Guards: only when auto_final_enabled, not on hold, deposit already paid, not yet
// finalized. The admin can change the price / push the date / hold it before it fires.
// Secrets from env: RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY.
const notifyTeam = require("./_notify.js");
const { sbGet, sbPatch, hasService } = require("./_supabase.js");
const { createFinalInvoice } = require("./_final-invoice.js");

const TOKEN = process.env.CRON_TOKEN || "mc-cron-9f27a1b4";
const NOTICE_DAYS = 3;

module.exports.config = { maxDuration: 60 };

module.exports = async (req, res) => {
  const isCron = !!(req.headers && req.headers["x-vercel-cron"]);
  const token = (req.query && req.query.token) || "";
  if (!isCron && token !== TOKEN) { res.status(403).json({ error: "forbidden" }); return; }
  if (!hasService()) { res.status(503).json({ error: "not configured" }); return; }

  const today = new Date().toISOString().slice(0, 10);
  function daysBetween(a, b) { return Math.round((new Date(a + "T12:00:00Z").getTime() - new Date(b + "T12:00:00Z").getTime()) / 86400000); }

  async function markNoticed(p) { try { await sbPatch("proposals", "id=eq." + encodeURIComponent(p.id), { final_notice_at: new Date().toISOString() }); } catch (e) {} }

  try {
    // Both trigger modes: a set second_payment_due_at = DATE mode; no due date = JOB-COMPLETE mode.
    const q = "proposals?auto_final_enabled=eq.true&final_hold=eq.false&final_invoiced_at=is.null&deposit_paid_at=not.is.null&select=*";
    const rows = await sbGet(q) || [];
    let noticed = 0, sent = 0, reminders = 0, errors = [];
    for (const p of rows) {
      if (p.second_payment_due_at) {
        // ---- DATE MODE ----
        const due = String(p.second_payment_due_at).slice(0, 10);
        const daysUntil = daysBetween(due, today);
        if (daysUntil <= 0) {
          const r = await createFinalInvoice(p);
          if (r && r.ok && !r.already) sent++; else if (r && r.error) errors.push(p.id + ": " + r.error);
        } else if (daysUntil <= NOTICE_DAYS && !p.final_notice_at) {
          await notifyTeam("Heads up — balance invoice auto-sends " + due,
            "<h2 style='color:#1b3d26'>Balance invoice scheduled</h2><p>The balance invoice for <strong>" + (p.title || "a proposal") +
            "</strong> will auto-send on <strong>" + due + "</strong> (" + daysUntil + " day" + (daysUntil === 1 ? "" : "s") + ").</p>" +
            "<p>Change the price, push the date, or hold it in the CRM → <strong>Timeline → Billing &amp; schedule</strong>.</p>");
          await markNoticed(p); noticed++;
        }
      } else {
        // ---- JOB-COMPLETE MODE ----
        if (p.job_completed_at) {
          const r = await createFinalInvoice(p);
          if (r && r.ok && !r.already) sent++; else if (r && r.error) errors.push(p.id + ": " + r.error);
        } else {
          const endPassed = p.project_end_at && String(p.project_end_at).slice(0, 10) < today;
          const depOld = p.deposit_paid_at && daysBetween(today, String(p.deposit_paid_at).slice(0, 10)) >= 14;
          if ((endPassed || depOld) && !p.final_notice_at) {
            await notifyTeam("Reminder — mark the job complete to bill the balance",
              "<h2 style='color:#1b3d26'>Time to mark a job complete</h2><p><strong>" + (p.title || "A job") +
              "</strong> is set to bill the balance when you mark it complete — and it looks done" +
              (endPassed ? " (project end date has passed)" : "") + ".</p>" +
              "<p>Open the proposal in the CRM → <strong>Timeline → Mark job complete</strong> to send the balance invoice.</p>");
            await markNoticed(p); reminders++;
          }
        }
      }
    }
    res.status(200).json({ ok: true, candidates: rows.length, noticed, sent, reminders, errors });
  } catch (e) { res.status(500).json({ error: (e && e.message) || "cron failed" }); }
};
