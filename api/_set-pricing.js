// Admin-only: save roof pricing config. Verifies the caller is an admin via
// their Supabase session (my_role RPC), then upserts app_settings.roof_pricing
// with the service role. Secret from env: SUPABASE_SERVICE_ROLE_KEY.
const { merge } = require("./_pricing.js");
const { sbInsert, hasService } = require("./_supabase.js");
const { requireRole } = require("./_auth.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).end(); return; }
  if (!hasService()) { res.status(503).json({ error: "Not configured" }); return; }
  if (!(await requireRole(req, ["admin"]))) { res.status(403).json({ error: "Admins only" }); return; }

  let b = req.body;
  try { if (typeof b === "string") b = JSON.parse(b || "{}"); } catch (e) { b = {}; }
  const value = merge(b || {});

  try {
    await sbInsert("app_settings", { key: "roof_pricing", value: value, updated_at: new Date().toISOString() }, { upsert: true });
    res.status(200).json({ ok: true, value: value });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "Could not save" });
  }
};
