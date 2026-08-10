// Auto-generated dispatcher — routes ?action= to a handler module (keeps us under Vercel's 12-fn Hobby cap).
var H = {
  "get": require("./_get-proposal.js"),
  "send": require("./_send-proposal.js"),
  "accept": require("./_accept-proposal.js"),
  "sign": require("./_sign-contract.js"),
  "track": require("./_track-view.js"),
};
module.exports = async function (req, res) {
  var action = (req.query && req.query.action) || "";
  var h = H[action];
  if (typeof h !== "function") { res.status(404).json({ error: "unknown action: " + action }); return; }
  return h(req, res);
};
module.exports.config = { maxDuration: 60 };
