// Customer e-signs the Master Construction Agreement for a proposal.
// Records signer + acknowledgements + IP, marks the proposal 'signed'.
// The invoice is then created by accept-proposal (which requires a signature).
const notifyTeam = require("./_notify.js");
const SUPABASE_URL = "https://touydwcbxgrigmxvwnvx.supabase.co";
const AGREEMENT_VERSION = "MCA-2026-01";

module.exports = async (req, res) => {
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svc) { res.status(503).json({ error: "Not configured yet" }); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }

  let body = req.body;
  try { if (typeof body === "string") body = JSON.parse(body || "{}"); } catch (e) { body = {}; }
  body = body || {};
  const token = String(body.token || "").replace(/[^a-f0-9]/gi, "");
  const signer = String(body.signer || "").trim();
  const cosigner = String(body.cosigner || "").trim();
  const agree = body.agree === true || body.agree === "true";
  const lienAck = body.lienAck === true || body.lienAck === "true";
  if (!token) { res.status(400).json({ error: "Missing token" }); return; }
  if (!signer) { res.status(400).json({ error: "Please type your full legal name to sign." }); return; }
  if (!agree) { res.status(400).json({ error: "You must agree to the Master Construction Agreement." }); return; }
  if (!lienAck) { res.status(400).json({ error: "Please acknowledge the Notice of Right to a Lien." }); return; }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || null;
  const h = { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json" };

  try {
    const rows = await fetch(SUPABASE_URL + "/rest/v1/proposals?token=eq." + token + "&select=id,title,status,agreement_signed_at,customerId", { headers: h }).then((r) => r.json());
    const p = rows && rows[0];
    if (!p) { res.status(404).json({ error: "Proposal not found" }); return; }
    if (p.agreement_signed_at) { res.status(200).json({ ok: true, already: true }); return; }

    const patch = {
      agreement_version: AGREEMENT_VERSION,
      agreement_signer: signer,
      agreement_cosigner: cosigner || null,
      agreement_signed_at: new Date().toISOString(),
      agreement_signer_ip: ip,
      lien_notice_ack: true,
      status: (p.status === "invoiced" || p.status === "paid") ? p.status : "signed"
    };
    await fetch(SUPABASE_URL + "/rest/v1/proposals?id=eq." + encodeURIComponent(p.id), {
      method: "PATCH", headers: Object.assign({ Prefer: "return=minimal" }, h), body: JSON.stringify(patch)
    });

    notifyTeam("🖊️ Agreement signed — " + (p.title || "proposal"),
      "<h2 style='color:#1b3d26'>Master Construction Agreement signed</h2><p><strong>" + signer + "</strong>" +
      (cosigner ? " &amp; " + cosigner : "") + " signed the agreement for <strong>" + (p.title || "a proposal") +
      "</strong> and acknowledged the Notice of Right to a Lien.</p><p>Signed " + patch.agreement_signed_at +
      (ip ? " · IP " + ip : "") + "</p>");

    res.status(200).json({ ok: true, signedAt: patch.agreement_signed_at });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "Could not record signature" });
  }
};
