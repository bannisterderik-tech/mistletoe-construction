// Shared caller-role authorization. Verifies the request's Supabase JWT by
// asking the DB for the effective role (my_role RPC), evaluated under RLS with
// the caller's own token — never a service key. Returns the role, or null.
const { SUPABASE_URL, SUPABASE_PUBLISHABLE } = require("./_supabase.js");

async function callerRole(req) {
  const authz = (req.headers && req.headers.authorization) || "";
  if (!/^Bearer\s+.+/i.test(authz)) return null;
  try {
    const rr = await fetch(SUPABASE_URL + "/rest/v1/rpc/my_role", {
      method: "POST",
      headers: { apikey: SUPABASE_PUBLISHABLE, Authorization: authz, "Content-Type": "application/json" },
      body: "{}"
    });
    const role = await rr.json();
    return typeof role === "string" ? role : null;
  } catch (e) { return null; }
}

// Returns the caller's role if it is in `roles`, else null.
async function requireRole(req, roles) {
  const role = await callerRole(req);
  return (role && roles.indexOf(role) >= 0) ? role : null;
}

module.exports = { callerRole, requireRole };
