// Instant roof estimate from a property address, powered by Google's Solar API
// (Building Insights) + Geocoding. Returns per-segment roof area/pitch/direction,
// a pitch-banded price range, and a satellite image URL (proxied server-side).
// Secret from env only: GOOGLE_MAPS_API_KEY.
const M2_TO_FT2 = 10.7639;
const WASTE = 1.10;

// $ per roofing "square" (100 sq ft) by pitch band — base = asphalt. Adjustable.
function band(pitchDeg) {
  const x = Math.round(12 * Math.tan(pitchDeg * Math.PI / 180));
  if (x <= 2) return { band: "Low slope / flat", rate: 650, x: x };
  if (x <= 4) return { band: "3–4/12", rate: 475, x: x };
  if (x <= 6) return { band: "5–6/12", rate: 600, x: x };
  if (x <= 8) return { band: "7–8/12", rate: 775, x: x };
  return { band: "9+/12 (custom quote)", rate: null, x: x, custom: true };
}
const MATERIAL = { asphalt: 1.0, metal: 1.9, tile: 2.2, flat: 1.1 };

module.exports = async (req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) { res.status(503).json({ ok: false, reason: "not_configured" }); return; }

  let b = req.body;
  try { if (typeof b === "string") b = JSON.parse(b || "{}"); } catch (e) { b = {}; }
  b = b || {};
  const address = String(b.address || "").trim();
  const material = (MATERIAL[b.roofType] != null) ? b.roofType : "asphalt";
  if (!address) { res.status(400).json({ ok: false, reason: "no_address" }); return; }

  try {
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

    // 3) build sections
    const sections = segs.map((s) => {
      const m2 = (s.stats && s.stats.areaMeters2) || 0;
      const measured = m2 * M2_TO_FT2;
      return { measuredSqFt: Math.round(measured), quotedSqFt: Math.round(measured * WASTE),
        pitchDeg: Math.round((s.pitchDegrees || 0) * 10) / 10, directionDeg: Math.round(s.azimuthDegrees || 0) };
    }).sort((a, b2) => b2.measuredSqFt - a.measuredSqFt);

    const measuredSqFt = sections.reduce((a, s) => a + s.measuredSqFt, 0);
    const quotedSqFt = Math.round(measuredSqFt * WASTE);
    const squares = Math.round(quotedSqFt / 100 * 10) / 10;
    // area-weighted average pitch
    const wPitch = segs.reduce((a, s) => a + ((s.stats && s.stats.areaMeters2) || 0) * (s.pitchDegrees || 0), 0) /
      Math.max(1e-6, segs.reduce((a, s) => a + ((s.stats && s.stats.areaMeters2) || 0), 0));
    const avgPitchDeg = Math.round(wPitch * 10) / 10;
    const bnd = band(avgPitchDeg);
    const mult = MATERIAL[material];

    let costLow = null, costHigh = null, ratePerSquare = null, custom = !!bnd.custom;
    if (!custom) {
      ratePerSquare = Math.round(bnd.rate * mult);
      const base = squares * ratePerSquare;
      costLow = Math.round(base * 0.90);
      costHigh = Math.round(base * 1.12);
    }

    res.status(200).json({
      ok: true, address: formatted, lat, lng, imageUrl,
      material, measuredSqFt, quotedSqFt, squares, wasteFactor: WASTE,
      avgPitchDeg, pitchBand: bnd.band, ratePerSquare, custom,
      costLow, costHigh, sections,
      imageryQuality: solar.imageryQuality || null,
      imageryDate: solar.imageryDate ? (solar.imageryDate.year + "-" + solar.imageryDate.month) : null
    });
  } catch (e) {
    res.status(500).json({ ok: false, reason: "error", detail: (e && e.message) || "" });
  }
};
