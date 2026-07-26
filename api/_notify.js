// Shared team-notification helper — emails the owners via Resend.
// Best-effort: never throws (a notification hiccup must not break the caller).
const NOTIFY_TO = ["alex@mistletoeconstruction.com", "bannisterderik@gmail.com"];
const FROM = "Mistletoe <alex@hi.mistletoeconstruction.com>";

module.exports = async function notifyTeam(subject, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM, to: NOTIFY_TO, subject: subject,
        html: "<div style='font-family:Arial,sans-serif;font-size:15px;color:#1f1f1f'>" + html + "</div>"
      })
    });
  } catch (e) { /* swallow */ }
};
