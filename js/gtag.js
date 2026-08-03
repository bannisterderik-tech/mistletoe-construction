// Google Ads tag (gtag.js) + conversion helper for Mistletoe Construction.
// Tag: AW-18196694742. Lead conversion: "Submit lead form".
// mcTrackLead() fires the conversion on a real lead (contact form submit,
// instant-quote lead capture). Loaded site-wide for measurement + remarketing.
(function () {
  var ID = "AW-18196694742";
  var LEAD = "AW-18196694742/CqGrCMDGrdscENaN7uRD";

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag("js", new Date());
  gtag("config", ID);

  // Fire the lead conversion. Safe to call anytime; no-ops if gtag isn't ready.
  window.mcTrackLead = function () {
    try { window.gtag("event", "conversion", { send_to: LEAD }); } catch (e) { /* ignore */ }
  };
})();
