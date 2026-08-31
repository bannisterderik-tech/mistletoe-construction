// Branded PDF receipt for Mistletoe Construction — pure JS (pdf-lib + qrcode),
// no headless browser, serverless-safe. Returns a Uint8Array (the PDF bytes).
//
// buildReceiptPdf(payment, customer, opts) where:
//   payment  = { receipt_number, amount, method, reference, paid_on, note, invoice_id }
//   customer = { name, email, address, city }
//   opts     = { invoiceLabel?, invoiceAmount?, balanceRemaining?, reviewUrl? }
const { PDFDocument, StandardFonts, rgb, degrees } = require("pdf-lib");
const QRCode = require("qrcode");

// Brand palette
const PINE = rgb(0.106, 0.239, 0.149);   // #1b3d26
const PINE_DK = rgb(0.055, 0.145, 0.086); // deep footer
const OCHRE = rgb(0.788, 0.627, 0.259);  // #c9a042
const CREAM = rgb(0.965, 0.969, 0.953);  // #f5f6f3
const SAGE = rgb(0.639, 0.706, 0.655);   // muted green text on dark
const INK = rgb(0.12, 0.15, 0.16);
const GREY = rgb(0.42, 0.46, 0.44);
const HAIR = rgb(0.86, 0.88, 0.85);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(d) {
  const s = String(d || "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s || "";
  return MONTHS[Number(m[2]) - 1] + " " + Number(m[3]) + ", " + m[1];
}
function money(n) {
  return "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function methodLabel(p) {
  const m = String(p.method || "").toLowerCase();
  if (m === "cash") return "Cash";
  if (m === "check") return "Check" + (p.reference ? " #" + p.reference : "");
  if (m === "card") return "Card" + (p.reference ? " · " + p.reference : "");
  return (p.reference || "Other");
}

async function fetchLogo() {
  try {
    const r = await fetch("https://mistletoeconstruction.com/images/logo-lockup-white.png");
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch (e) { return null; }
}

async function buildReceiptPdf(payment, customer, opts) {
  opts = opts || {};
  const doc = await PDFDocument.create();
  doc.setTitle("Receipt " + (payment.receipt_number || ""));
  doc.setAuthor("Mistletoe Construction LLC");
  doc.setSubject("Payment receipt");
  const page = doc.addPage([612, 792]);
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const M = 48;

  const text = (s, x, y, size, f, color, extra) =>
    page.drawText(String(s == null ? "" : s), Object.assign({ x, y, size, font: f || font, color: color || INK }, extra || {}));
  // top-origin helper (y measured from the top of the page)
  const T = (yFromTop) => height - yFromTop;

  // ---- Header band ----
  const HB = 132;
  page.drawRectangle({ x: 0, y: height - HB, width, height: HB, color: PINE });
  page.drawRectangle({ x: 0, y: height - HB - 5, width, height: 5, color: OCHRE });

  const logo = await fetchLogo();
  if (logo) {
    try {
      const img = await doc.embedPng(logo);
      const h = 34, w = (img.width / img.height) * h;
      page.drawImage(img, { x: M, y: height - 56, width: Math.min(w, 300), height: h });
    } catch (e) { text("MISTLETOE CONSTRUCTION", M, T(52), 18, bold, CREAM); }
  } else {
    text("MISTLETOE CONSTRUCTION", M, T(52), 18, bold, CREAM);
  }
  text("ROOFING & HOME CARE · DOUGLAS COUNTY, OREGON", M, T(72), 8.5, font, SAGE, { characterSpacing: 1.5 });

  // right side of header — RECEIPT + meta
  const rx = width - M;
  const rt = (s, y, size, f, color, sp) => {
    const w = (f || font).widthOfTextAtSize(String(s), size);
    text(s, rx - w, T(y), size, f, color, sp ? { characterSpacing: sp } : null);
  };
  rt("RECEIPT", 46, 30, bold, CREAM, 2);
  rt("No. " + (payment.receipt_number || "—"), 66, 11, font, SAGE);
  rt(fmtDate(payment.paid_on), 82, 11, font, SAGE);

  // ---- PAID watermark ----
  text("PAID", 150, 300, 150, bold, rgb(0.106, 0.239, 0.149), { rotate: degrees(-20), opacity: 0.06 });

  // ---- Billed to ----
  let y = 180;
  text("RECEIPT FOR", M, T(y), 9, bold, OCHRE, { characterSpacing: 1.5 });
  y += 20;
  text(customer && customer.name ? customer.name : "Valued customer", M, T(y), 15, bold, INK);
  y += 18;
  const addrLines = [];
  if (customer && customer.address) addrLines.push(customer.address);
  if (customer && customer.city) addrLines.push(customer.city + ", Oregon");
  if (customer && customer.email) addrLines.push(customer.email);
  addrLines.forEach((l) => { text(l, M, T(y), 11, font, GREY); y += 15; });

  // ---- Payment-for line ----
  y = 180;
  const forLabel = opts.invoiceLabel || (payment.note ? payment.note : "Roofing & home services");
  const boxW = 250, boxX = width - M - boxW;
  text("PAYMENT RECEIVED FOR", boxX, T(y), 9, bold, OCHRE, { characterSpacing: 1.2 });
  y += 18;
  // wrap the "for" label within the box
  wrapText(page, forLabel, boxX, T(y), boxW, 11.5, font, INK, 15);

  // ---- Amount block ----
  const ay = 300;
  page.drawRectangle({ x: M, y: T(ay) - 74, width: width - M * 2, height: 92, color: rgb(0.965, 0.969, 0.953), borderColor: HAIR, borderWidth: 1 });
  text("AMOUNT PAID", M + 20, T(ay) - 14, 9, bold, GREY, { characterSpacing: 1.2 });
  text(money(payment.amount), M + 18, T(ay) - 52, 34, bold, PINE);

  // method + date, right side of the amount card
  const paidBy = "Paid by " + methodLabel(payment) + " on " + fmtDate(payment.paid_on);
  const pbw = font.widthOfTextAtSize(paidBy, 11);
  text(paidBy, width - M - 20 - pbw, T(ay) - 20, 11, font, INK);

  // balance / paid-in-full badge (right side, lower)
  const bal = opts.balanceRemaining;
  if (bal != null && Number(bal) > 0.005) {
    const s = "Balance remaining: " + money(bal);
    const w = bold.widthOfTextAtSize(s, 12);
    text(s, width - M - 20 - w, T(ay) - 50, 12, bold, OCHRE);
  } else {
    const s = "PAID IN FULL";
    const w = bold.widthOfTextAtSize(s, 12);
    const bx = width - M - 20 - w - 24;
    page.drawRectangle({ x: bx, y: T(ay) - 56, width: w + 24, height: 22, color: rgb(0.847, 0.906, 0.855), borderColor: PINE, borderWidth: 1 });
    text(s, bx + 12, T(ay) - 50, 12, bold, PINE, { characterSpacing: 1 });
  }

  // ---- Divider ----
  const dy = 408;
  page.drawLine({ start: { x: M, y: T(dy) }, end: { x: width - M, y: T(dy) }, thickness: 1, color: HAIR });

  // ---- Thank-you note ----
  let ty = 436;
  text("THANK YOU", M, T(ty), 9, bold, OCHRE, { characterSpacing: 1.5 });
  ty += 20;
  const note =
    "Thank you for your business — it genuinely means a lot to a small, family-owned crew here in Riddle. " +
    "This receipt confirms your payment has been received and your account is in good standing. Keep it for your " +
    "records; if you ever need anything down the road, we're one call or text away.";
  ty = wrapText(page, note, M, T(ty), 330, 11.5, font, rgb(0.28, 0.32, 0.30), 16);
  ty -= 10;
  text("— Alex Smith, Mistletoe Construction", M, ty, 11.5, bold, INK);

  // ---- Review QR ----
  const reviewUrl = opts.reviewUrl || "https://g.page/r/CYxQiWWU9vkMEBM/review";
  try {
    const qrBuf = await QRCode.toBuffer(reviewUrl, { type: "png", margin: 1, width: 240, color: { dark: "#1b3d26ff", light: "#ffffffff" } });
    const qrImg = await doc.embedPng(new Uint8Array(qrBuf));
    const qs = 96, qx = width - M - qs, qy = T(560);
    page.drawRectangle({ x: qx - 8, y: qy - 8, width: qs + 16, height: qs + 16, color: rgb(1, 1, 1), borderColor: HAIR, borderWidth: 1 });
    page.drawImage(qrImg, { x: qx, y: qy, width: qs, height: qs });
    const cap1 = "Loved the work?";
    const cap2 = "Scan to leave a review.";
    text(cap1, qx + (qs - font.widthOfTextAtSize(cap1, 9)) / 2, qy - 22, 9, bold, INK);
    text(cap2, qx + (qs - font.widthOfTextAtSize(cap2, 8.5)) / 2, qy - 34, 8.5, font, GREY);
  } catch (e) { /* QR is a nicety — never fail the receipt over it */ }

  // ---- Footer band ----
  const FB = 74;
  page.drawRectangle({ x: 0, y: 0, width, height: FB, color: PINE });
  page.drawRectangle({ x: 0, y: FB, width, height: 4, color: OCHRE });
  text("Mistletoe Construction LLC", M, 44, 11, bold, CREAM);
  text("595 E Third St, Riddle, Oregon 97469  ·  (541) 670-5005  ·  Mistletoeconstructionllc@gmail.com", M, 28, 9, font, SAGE);
  text("Oregon CCB #255729  ·  Owens Corning Contractor  ·  Licensed & Insured  ·  mistletoeconstruction.com", M, 15, 9, font, SAGE);

  return doc.save();
}

// Simple word-wrap; returns the y (bottom-origin) after the last line.
function wrapText(page, str, x, yTop, maxW, size, font, color, lh) {
  const words = String(str || "").split(/\s+/);
  let line = "", yy = yTop;
  const flush = () => { if (line) { page.drawText(line, { x, y: yy, size, font, color }); yy -= lh; line = ""; } };
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(test, size) > maxW && line) { page.drawText(line, { x, y: yy, size, font, color }); yy -= lh; line = w; }
    else line = test;
  }
  flush();
  return yy;
}

module.exports = buildReceiptPdf;
module.exports.buildReceiptPdf = buildReceiptPdf;
module.exports.fmtDate = fmtDate;
module.exports.money = money;
module.exports.methodLabel = methodLabel;
