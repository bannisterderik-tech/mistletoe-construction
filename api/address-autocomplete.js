// Address autocomplete proxy (Google Places). Keeps GOOGLE_MAPS_API_KEY
// server-side. Tries the new Places API, falls back to the legacy one,
// and degrades to an empty list so typing always still works.
module.exports = async (req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  res.setHeader("Cache-Control", "no-store");
  if (!key) { res.status(200).json({ predictions: [] }); return; }
  const q = (req.query && req.query.q ? String(req.query.q) : "").trim();
  if (q.length < 3) { res.status(200).json({ predictions: [] }); return; }

  // 1) Places API (New)
  try {
    const r = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({ input: q, includedRegionCodes: ["us"] })
    });
    if (r.ok) {
      const d = await r.json();
      const preds = (d.suggestions || [])
        .map((s) => s.placePrediction).filter(Boolean)
        .map((p) => ({ description: (p.text && p.text.text) || "", placeId: p.placeId || "" }))
        .filter((p) => p.description);
      if (preds.length) { res.status(200).json({ predictions: preds }); return; }
    }
  } catch (e) { /* fall through */ }

  // 2) Legacy Places Autocomplete
  try {
    const r = await fetch("https://maps.googleapis.com/maps/api/place/autocomplete/json?input=" +
      encodeURIComponent(q) + "&types=address&components=country:us&key=" + key);
    const d = await r.json();
    const preds = (d.predictions || []).map((p) => ({ description: p.description, placeId: p.place_id }));
    res.status(200).json({ predictions: preds });
    return;
  } catch (e) { /* fall through */ }

  res.status(200).json({ predictions: [] });
};
