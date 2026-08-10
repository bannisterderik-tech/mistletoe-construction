// Auto-generated dispatcher — routes ?action= to a handler module (keeps us under Vercel's 12-fn Hobby cap).
var H = {
  "accounts": require("./_social-accounts.js"),
  "connect": require("./_social-connect.js"),
  "post": require("./_social-post.js"),
  "posts": require("./_social-posts.js"),
  "update": require("./_social-update.js"),
  "upload": require("./_social-upload.js"),
};
module.exports = async function (req, res) {
  var action = (req.query && req.query.action) || "";
  var h = H[action];
  if (typeof h !== "function") { res.status(404).json({ error: "unknown action: " + action }); return; }
  return h(req, res);
};
module.exports.config = { maxDuration: 60 };
