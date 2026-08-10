// Auto-generated dispatcher — routes ?action= to a handler module (keeps us under Vercel's 12-fn Hobby cap).
var H = {
  "estimate": require("./_roof-estimate.js"),
  "image": require("./_roof-image.js"),
  "address": require("./_address-autocomplete.js"),
};
module.exports = async function (req, res) {
  var action = (req.query && req.query.action) || "";
  var h = H[action];
  if (typeof h !== "function") { res.status(404).json({ error: "unknown action: " + action }); return; }
  return h(req, res);
};
module.exports.config = { maxDuration: 60 };
