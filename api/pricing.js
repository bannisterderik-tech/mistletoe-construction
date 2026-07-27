// Public: current roof pricing config (used by the instant-quote manual calc).
// Not sensitive — these are the same rates shown in every quote.
const { getPricing } = require("./_pricing.js");

module.exports = async (req, res) => {
  const cfg = await getPricing();
  res.setHeader("Cache-Control", "public, max-age=60");
  res.status(200).json(cfg);
};
