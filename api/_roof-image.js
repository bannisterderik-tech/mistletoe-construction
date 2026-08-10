// Server-side proxy for the Google Static Maps satellite tile, so the
// GOOGLE_MAPS_API_KEY never reaches the browser.
module.exports = async (req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) { res.status(503).end(); return; }
  const q = req.query || {};
  const lat = parseFloat(q.lat), lng = parseFloat(q.lng);
  const z = Math.min(21, Math.max(17, parseInt(q.z || "20", 10)));
  if (!isFinite(lat) || !isFinite(lng)) { res.status(400).end(); return; }

  const url = "https://maps.googleapis.com/maps/api/staticmap?center=" + lat + "," + lng +
    "&zoom=" + z + "&size=640x420&scale=2&maptype=satellite" +
    "&markers=color:0x3f9128%7C" + lat + "," + lng + "&key=" + key;
  try {
    const r = await fetch(url);
    if (!r.ok) { res.status(502).end(); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", r.headers.get("content-type") || "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.status(200).send(buf);
  } catch (e) { res.status(502).end(); }
};
