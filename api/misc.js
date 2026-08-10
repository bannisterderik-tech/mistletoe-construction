// Auto-generated dispatcher — routes ?action= to a handler module (keeps us under Vercel's 12-fn Hobby cap).
var H = {
  "get-pricing": require("./_pricing-endpoint.js"),
  "set-pricing": require("./_set-pricing.js"),
  "send-preview": require("./_send-preview.js"),
};
module.exports = async function (req, res) {
  var action = (req.query && req.query.action) || "";
  var h = H[action];
  if (typeof h !== "function") { res.status(404).json({ error: "unknown action: " + action }); return; }
  return h(req, res);
};
module.exports.config = { maxDuration: 60 };
