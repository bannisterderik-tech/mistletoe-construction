// Single source of truth for roof-estimate pricing. Stored in Supabase
// app_settings (key='roof_pricing'); falls back to these defaults.
const { sbGet, SUPABASE_URL } = require("./_supabase.js");

const DEFAULTS = {
  waste: 1.10,          // quoted area = measured * waste
  rangeLow: 0.90,       // cost range lower multiplier
  rangeHigh: 1.12,      // cost range upper multiplier
  bands: { flat: 650, b34: 475, b56: 600, b78: 775 }, // $ per square (100 sq ft), asphalt base
  materials: { asphalt: 1.0, metal: 1.9, tile: 2.2, flat: 1.1 } // rate multipliers
};

// merge stored config over defaults (shallow per section)
function merge(cfg) {
  cfg = cfg || {};
  return {
    waste: Number(cfg.waste) || DEFAULTS.waste,
    rangeLow: Number(cfg.rangeLow) || DEFAULTS.rangeLow,
    rangeHigh: Number(cfg.rangeHigh) || DEFAULTS.rangeHigh,
    bands: Object.assign({}, DEFAULTS.bands, cfg.bands || {}),
    materials: Object.assign({}, DEFAULTS.materials, cfg.materials || {})
  };
}

// read current pricing (service role); returns defaults on any problem
async function getPricing() {
  try {
    const rows = await sbGet("app_settings?key=eq.roof_pricing&select=value");
    return merge(rows && rows[0] && rows[0].value);
  } catch (e) { return merge(null); }
}

// pitch (degrees) -> band key + $/square (before material multiplier); custom for 9+/12
function bandFor(pitchDeg, cfg) {
  const x = Math.round(12 * Math.tan(pitchDeg * Math.PI / 180));
  if (x <= 2) return { key: "flat", band: "Low slope / flat", rate: cfg.bands.flat, x: x };
  if (x <= 4) return { key: "b34", band: "3–4/12", rate: cfg.bands.b34, x: x };
  if (x <= 6) return { key: "b56", band: "5–6/12", rate: cfg.bands.b56, x: x };
  if (x <= 8) return { key: "b78", band: "7–8/12", rate: cfg.bands.b78, x: x };
  return { key: "custom", band: "9+/12 (custom quote)", rate: null, x: x, custom: true };
}

module.exports = { DEFAULTS, merge, getPricing, bandFor, SUPABASE_URL };
