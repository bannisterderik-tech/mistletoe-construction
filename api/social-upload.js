// Admin-only: upload a file for a post. Gets a presigned URL from Zernio,
// PUTs the bytes to it, and returns the public URL to attach to a post.
// Body: { filename, contentType, dataBase64 }  (base64 payload, no data: prefix)
// Note: Vercel caps request bodies ~4.5MB, so this is for images. For large
// video, paste a hosted URL instead.
const { zernio, requireAdmin } = require("./_zernio.js");

const OK_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/mpeg", "video/quicktime", "video/webm", "video/x-m4v"];

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).end(); return; }
  if (!(await requireAdmin(req))) { res.status(403).json({ error: "Admins only" }); return; }

  let b = req.body;
  try { if (typeof b === "string") b = JSON.parse(b || "{}"); } catch (e) { b = {}; }
  b = b || {};
  const filename = String(b.filename || "upload").replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const contentType = String(b.contentType || "").toLowerCase();
  const dataBase64 = String(b.dataBase64 || "");
  if (OK_TYPES.indexOf(contentType) < 0) { res.status(400).json({ error: "Unsupported file type: " + contentType }); return; }
  if (!dataBase64) { res.status(400).json({ error: "No file data" }); return; }

  let buf;
  try { buf = Buffer.from(dataBase64, "base64"); } catch (e) { buf = null; }
  if (!buf || !buf.length) { res.status(400).json({ error: "Could not read file" }); return; }

  // 1) presign
  const pre = await zernio("/v1/media/presign", { method: "POST",
    body: { filename: filename, contentType: contentType, size: buf.length } });
  if (!pre.ok) { res.status(pre.status).json(pre.data || { error: "Could not get upload URL" }); return; }
  const uploadUrl = pre.data && pre.data.uploadUrl;
  const publicUrl = pre.data && pre.data.publicUrl;
  if (!uploadUrl || !publicUrl) { res.status(502).json({ error: "Zernio did not return an upload URL" }); return; }

  // 2) PUT the bytes to cloud storage
  try {
    const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: buf });
    if (!put.ok) { res.status(502).json({ error: "Upload failed (" + put.status + ")" }); return; }
  } catch (e) {
    res.status(502).json({ error: "Upload failed: " + ((e && e.message) || "") }); return;
  }

  res.status(200).json({ ok: true, publicUrl: publicUrl });
};

// Allow larger request bodies (base64 image payloads). Platform hard cap ~4.5MB.
module.exports.config = { api: { bodyParser: { sizeLimit: "4.5mb" } } };
