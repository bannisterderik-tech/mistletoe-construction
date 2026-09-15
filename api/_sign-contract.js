// Customer e-signs the Master Construction Agreement for a proposal.
// Records signer + acknowledgements + IP, marks the proposal 'signed'.
// The invoice is then created by accept-proposal (which requires a signature).
const notifyTeam = require("./_notify.js");
const { sbGet, sbPatch, hasService } = require("./_supabase.js");
const AGREEMENT_VERSION = "MCA-2026-01";

module.exports = async (req, res) => {
  if (!hasService()) { res.status(503).json({ error: "Not configured yet" }); return; }
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

  try {
    const rows = await sbGet("proposals?token=eq." + token + "&select=id,title,status,agreement_signed_at,customerId");
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
    // The signature is the thing that matters. Some databases constrain
    // proposals.status and reject "signed", which used to fail the WHOLE patch
    // silently — the customer got a "signed" email while nothing was recorded,
    // and every downstream invoice then refused with "please sign first".
    let wrote = await sbPatch("proposals", "id=eq." + encodeURIComponent(p.id), patch);
    if (wrote && wrote.ok === false) {
      const noStatus = Object.assign({}, patch); delete noStatus.status;
      wrote = await sbPatch("proposals", "id=eq." + encodeURIComponent(p.id), noStatus);
    }
    if (wrote && wrote.ok === false) {
      let detail = ""; try { detail = (await wrote.text() || "").slice(0, 300); } catch (_) {}
      try { await notifyTeam("⚠️ SIGNATURE NOT SAVED — action needed",
        "<h2 style=\"color:#b00020\">" + signer + " signed \"" + (p.title || "a proposal") +
        "\" but the signature could not be saved, so no invoice can be raised.</h2><p>" + detail +
        "</p><p>Token <code>" + token + "</code></p>"); } catch (_) {}
      res.status(500).json({ error: "We could not record your signature. Please call (541) 670-5005." });
      return;
    }

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
