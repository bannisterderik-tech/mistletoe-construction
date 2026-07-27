// Instant roof estimate from a property address, powered by Google's Solar API
// (Building Insights) + Geocoding. Pricing comes from the owner-adjustable config
// (api/_pricing.js -> Supabase app_settings). Secret from env: GOOGLE_MAPS_API_KEY.
const { getPricing, bandFor } = require("./_pricing.js");
const M2_TO_FT2 = 10.7639;

module.exports = async (req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) { res.status(503).json({ ok: false, reason: "not_configured" }); return; }

  let b = req.body;
  try { if (typeof b === "string") b = JSON.parse(b || "{}"); } catch (e) { b = {}; }
  b = b || {};
  const address = String(b.address || "").trim();
  if (!address) { res.status(400).json({ ok: false, reason: "no_address" }); return; }

  try {
    const cfg = await getPricing();
    const material = (cfg.materials[b.roofType] != null) ? b.roofType : "asphalt";
    const WASTE = cfg.waste;

    // 1) geocode
    const gc = await fetch("https://maps.googleapis.com/maps/api/geocode/json?address=" +
      encodeURIComponent(address) + "&key=" + key).then((r) => r.json());
    if (!gc.results || !gc.results[0]) { res.status(200).json({ ok: false, reason: "address_not_found" }); return; }
    const loc = gc.results[0].geometry.location;
    const formatted = gc.results[0].formatted_address;
    const lat = loc.lat, lng = loc.lng;
    const imageUrl = "/api/roof-image?lat=" + lat + "&lng=" + lng + "&z=20";

    // 2) solar building insights
    const solar = await fetch("https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=" +
      lat + "&location.longitude=" + lng + "&requiredQuality=LOW&key=" + key).then((r) => r.json());
    const sp = solar && solar.solarPotential;
    const segs = sp && sp.roofSegmentStats;
    if (!segs || !segs.length) {
      res.status(200).json({ ok: false, reason: "no_building_data", lat, lng, address: formatted, imageUrl });
      return;
    }

    // 3) sections
    const sections = segs.map((s) => {
      const measured = ((s.stats && s.stats.areaMeters2) || 0) * M2_TO_FT2;
      return { measuredSqFt: Math.round(measured), quotedSqFt: Math.round(measured * WASTE),
        pitchDeg: Math.round((s.pitchDegrees || 0) * 10) / 10, directionDeg: Math.round(s.azimuthDegrees || 0) };
    }).sort((a, c) => c.measuredSqFt - a.measuredSqFt);

    const measuredSqFt = sections.reduce((a, s) => a + s.measuredSqFt, 0);
    const quotedSqFt = Math.round(measuredSqFt * WASTE);
    const squares = Math.round(quotedSqFt / 100 * 10) / 10;
    const totalArea = segs.reduce((a, s) => a + ((s.stats && s.stats.areaMeters2) || 0), 0);
    const wPitch = segs.reduce((a, s) => a + ((s.stats && s.stats.areaMeters2) || 0) * (s.pitchDegrees || 0), 0) /
      Math.max(1e-6, totalArea);
    const avgPitchDeg = Math.round(wPitch * 10) / 10;
    const bnd = bandFor(avgPitchDeg, cfg);
    const mult = cfg.materials[material];

    let costLow = null, costHigh = null, ratePerSquare = null, custom = !!bnd.custom;
    if (!custom) {
      ratePerSquare = Math.round(bnd.rate * mult);
      const base = squares * ratePerSquare;
      costLow = Math.round(base * cfg.rangeLow);
      costHigh = Math.round(base * cfg.rangeHigh);
    }

    res.status(200).json({
      ok: true, address: formatted, lat, lng, imageUrl,
      material, measuredSqFt, quotedSqFt, squares, wasteFactor: WASTE,
      avgPitchDeg, pitchBand: bnd.band, ratePerSquare, custom, costLow, costHigh, sections,
      imageryQuality: solar.imageryQuality || null,
      imageryDate: solar.imageryDate ? (solar.imageryDate.year + "-" + solar.imageryDate.month) : null
    });
  } catch (e) {
    res.status(500).json({ ok: false, reason: "error", detail: (e && e.message) || "" });
  }
};
