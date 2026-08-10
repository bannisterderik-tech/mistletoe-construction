// Best-effort "opened" tracking for proposal.html / contract.html.
// Records first/last view + a count. NEVER errors (must not break the customer page).
// Anti-false-view: caller only beacons after real dwell+interaction; we also drop
// any hit within 90s of sent_at (the email-scanner detonation window).
const { sbGet, sbPatch, hasService } = require("./_supabase.js");

module.exports = async (req, res) => {
  if (!hasService()) { res.status(200).json({ ok: false }); return; }
  let body = req.body;
  try { if (typeof body === "string") body = JSON.parse(body || "{}"); } catch (e) { body = {}; }
  body = body || {};
  const token = String(body.token || (req.query && req.query.t) || "").replace(/[^a-f0-9]/gi, "");
  const kind = String(body.kind || (req.query && req.query.kind) || "proposal");
  if (!token) { res.status(200).json({ ok: false }); return; }

  try {
    const rows = await sbGet("proposals?token=eq." + token + "&select=id,sent_at,view_count,agreement_view_count,first_viewed_at,agreement_first_viewed_at");
    const p = rows && rows[0];
    if (!p) { res.status(200).json({ ok: false }); return; }

    const now = Date.now();
    if (p.sent_at && (now - new Date(p.sent_at).getTime()) < 90 * 1000) { res.status(200).json({ ok: true, suppressed: true }); return; }

    const nowIso = new Date().toISOString();
    let patch = {};
    if (kind === "agreement") {
      patch.agreement_first_viewed_at = p.agreement_first_viewed_at || nowIso;
      patch.agreement_view_count = (Number(p.agreement_view_count) || 0) + 1;
    } else {
      patch.first_viewed_at = p.first_viewed_at || nowIso;
      patch.last_viewed_at = nowIso;
      patch.view_count = (Number(p.view_count) || 0) + 1;
    }
    try { await sbPatch("proposals", "id=eq." + encodeURIComponent(p.id), patch); } catch (e) { /* columns arrive with the migration */ }
    res.status(200).json({ ok: true });
  } catch (e) { res.status(200).json({ ok: false }); }
};
