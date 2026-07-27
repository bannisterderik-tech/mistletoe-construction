// Admin-only: save roof pricing config. Verifies the caller is an admin via
// their Supabase session (my_role RPC), then upserts app_settings.roof_pricing
// with the service role. Secret from env: SUPABASE_SERVICE_ROLE_KEY.
const { merge, SUPABASE_URL } = require("./_pricing.js");
const SUPABASE_PUBLISHABLE = "sb_publishable_a2Y-G20spk5ql2fP0nGnAw_WukuyKnF";

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).end(); return; }
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svc) { res.status(503).json({ error: "Not configured" }); return; }

  const authz = req.headers.authorization || "";
  if (!/^Bearer\s+.+/i.test(authz)) { res.status(401).json({ error: "Sign in required" }); return; }
  let role = null;
  try {
    const rr = await fetch(SUPABASE_URL + "/rest/v1/rpc/my_role", {
      method: "POST",
      headers: { apikey: SUPABASE_PUBLISHABLE, Authorization: authz, "Content-Type": "application/json" },
      body: "{}"
    });
    role = await rr.json();
  } catch (e) { role = null; }
  if (role !== "admin") { res.status(403).json({ error: "Admins only" }); return; }

  let b = req.body;
  try { if (typeof b === "string") b = JSON.parse(b || "{}"); } catch (e) { b = {}; }
  const value = merge(b || {});

  try {
    await fetch(SUPABASE_URL + "/rest/v1/app_settings", {
      method: "POST",
      headers: { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ key: "roof_pricing", value: value, updated_at: new Date().toISOString() })
    });
    res.status(200).json({ ok: true, value: value });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "Could not save" });
  }
};
