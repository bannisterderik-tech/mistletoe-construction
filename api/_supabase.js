// Shared Supabase config + service-role REST helpers for the serverless API.
// Single source of truth for the project URL and public key; the service role
// key is read from env only and never leaves the server.
const SUPABASE_URL = "https://touydwcbxgrigmxvwnvx.supabase.co";
const SUPABASE_PUBLISHABLE = "sb_publishable_a2Y-G20spk5ql2fP0nGnAw_WukuyKnF";

function serviceKey() { return process.env.SUPABASE_SERVICE_ROLE_KEY || null; }
function hasService() { return !!serviceKey(); }

function svcHeaders(extra) {
  const svc = serviceKey();
  if (!svc) return null;
  return Object.assign({ apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json" }, extra || {});
}

// GET rows. `pathAndQuery` is e.g. "customers?id=eq.x&select=name". Returns array/obj or null.
async function sbGet(pathAndQuery) {
  const h = svcHeaders();
  if (!h) return null;
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + pathAndQuery, { headers: h });
  try { return await r.json(); } catch (e) { return null; }
}

// Insert a row (or rows). opts.upsert -> merge-duplicates. Returns the fetch Response.
async function sbInsert(table, row, opts) {
  opts = opts || {};
  const prefer = (opts.upsert ? "resolution=merge-duplicates," : "") + (opts.returning === true ? "return=representation" : "return=minimal");
  return fetch(SUPABASE_URL + "/rest/v1/" + table, {
    method: "POST", headers: svcHeaders({ Prefer: prefer }), body: JSON.stringify(row)
  });
}

// Patch rows matching a PostgREST filter (e.g. "id=eq.x"). Returns the fetch Response.
async function sbPatch(table, filter, patch) {
  return fetch(SUPABASE_URL + "/rest/v1/" + table + "?" + filter, {
    method: "PATCH", headers: svcHeaders({ Prefer: "return=minimal" }), body: JSON.stringify(patch)
  });
}

// Collision-resistant short id, e.g. genId("l") -> "lqk3f9x2a1".
function genId(prefix) {
  return (prefix || "") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

module.exports = { SUPABASE_URL, SUPABASE_PUBLISHABLE, serviceKey, hasService, svcHeaders, sbGet, sbInsert, sbPatch, genId };
