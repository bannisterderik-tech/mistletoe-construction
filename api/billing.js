// Auto-generated dispatcher — routes ?action= to a handler module (keeps us under Vercel's 12-fn Hobby cap).
var H = {
  "checkout": require("./_create-checkout.js"),
  "invoice": require("./_create-invoice.js"),
  "final": require("./_create-final-invoice.js"),
  "lead-proposal": require("./_create-lead-proposal.js"),
  "payment": require("./_log-payment.js"),
  "receipt": require("./_send-receipt.js"),
};
module.exports = async function (req, res) {
  var action = (req.query && req.query.action) || "";
  var h = H[action];
  if (typeof h !== "function") { res.status(404).json({ error: "unknown action: " + action }); return; }
  return h(req, res);
};
module.exports.config = { maxDuration: 60 };
