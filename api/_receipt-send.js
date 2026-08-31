// Shared receipt sender: builds the branded PDF and emails it to the customer
// as an attachment via Resend. Used by _log-payment.js (on create), the
// "Resend receipt" endpoint, and the Stripe webhook (card payments).
// Everything runs with the service role — no user session required.
const buildReceiptPdf = require("./_receipt-pdf.js");
const { sbGet, sbPatch } = require("./_supabase.js");

const FROM = "Mistletoe Construction <alex@hi.mistletoeconstruction.com>";
const REPLY_TO = "Mistletoeconstructionllc@gmail.com";
const REVIEW_URL = process.env.GOOGLE_REVIEW_URL || "https://g.page/r/CYxQiWWU9vkMEBM/review";

function esc(s) { return String(s == null ? "" : s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])); }
function money(n) { return "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// Sum every payment already recorded against an invoice.
async function paidAgainstInvoice(invoiceId) {
  if (!invoiceId) return 0;
  const rows = await sbGet("payments?invoice_id=eq." + encodeURIComponent(invoiceId) + "&select=amount");
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
}

/**
 * sendReceipt(paymentId, opts?)
 *   opts.email     — override recipient (else customer.email)
 *   opts.customer  — pass the customer row to skip a lookup
 *   opts.payment   — pass the payment row to skip a lookup
 * Returns { ok, email?, receipt_number?, error? }.
 */
async function sendReceipt(paymentId, opts) {
  opts = opts || {};
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "email not configured" };

  let pay = opts.payment;
  if (!pay) {
    const rows = await sbGet("payments?id=eq." + encodeURIComponent(paymentId) + "&select=*");
    pay = Array.isArray(rows) ? rows[0] : null;
  }
  if (!pay) return { ok: false, error: "payment not found" };

  let cust = opts.customer;
  if (!cust && pay.customerId) {
    const cs = await sbGet("customers?id=eq." + encodeURIComponent(pay.customerId) + "&select=name,email,address,city");
    cust = Array.isArray(cs) ? cs[0] : null;
  }
  const to = String(opts.email || (cust && cust.email) || pay.receipt_email || "").trim();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: "no valid email for this customer" };

  // Resolve the invoice label + running balance (partial-payment aware).
  let invoiceLabel = pay.note || "Roofing & home services";
  let balanceRemaining = null;
  if (pay.invoice_id) {
    const inv = await sbGet("invoices?id=eq." + encodeURIComponent(pay.invoice_id) + "&select=label,amount,kind");
    const row = Array.isArray(inv) ? inv[0] : null;
    if (row) {
      invoiceLabel = row.label || invoiceLabel;
      const total = Number(row.amount) || 0;
      const paid = await paidAgainstInvoice(pay.invoice_id);
      balanceRemaining = Math.max(0, total - paid);
    }
  }

  const pdf = await buildReceiptPdf(pay, cust || {}, { invoiceLabel, balanceRemaining, reviewUrl: REVIEW_URL });
  const b64 = Buffer.from(pdf).toString("base64");
  const first = (cust && cust.name ? String(cust.name).split(/\s+/)[0] : "there");
  const balLine = (balanceRemaining != null && balanceRemaining > 0.005)
    ? "<p style='margin:0 0 14px'>Remaining balance on this project: <strong>" + money(balanceRemaining) + "</strong>.</p>"
    : "<p style='margin:0 0 14px;color:#1b6b3a'><strong>You're paid in full — thank you!</strong></p>";

  const html =
    "<div style='font-family:Arial,Helvetica,sans-serif;max-width:540px;margin:0 auto;color:#1f2937'>" +
    "<div style='background:#15321f;padding:18px 24px;border-radius:10px 10px 0 0'><span style='color:#fff;font-weight:800;letter-spacing:.5px'>MISTLETOE CONSTRUCTION</span></div>" +
    "<div style='border:1px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px;padding:22px 24px;font-size:15px;line-height:1.6'>" +
    "<p style='margin:0 0 14px'>Hi " + esc(first) + ",</p>" +
    "<p style='margin:0 0 14px'>Thank you — we've received your payment of <strong>" + money(pay.amount) + "</strong>. Your receipt (<strong>" + esc(pay.receipt_number) + "</strong>) is attached as a PDF for your records.</p>" +
    balLine +
    "<p style='margin:0 0 14px'>If you ever need anything — a question about the work, a future project, or a copy of anything for your files — just call or text <strong>(541)&nbsp;670-5005</strong>. We're always here.</p>" +
    "<p style='margin:18px 0 4px'>With gratitude,<br><strong>Alex Smith</strong><br>Mistletoe Construction LLC</p>" +
    "<hr style='border:none;border-top:1px solid #eee;margin:18px 0 12px'>" +
    "<p style='font-size:12px;color:#9ca3af;margin:0'>Mistletoe Construction LLC · 595 E Third St, Riddle, OR 97469 · Oregon CCB #255729<br>" +
    "Loved the work? <a href='" + REVIEW_URL + "' style='color:#3f9128'>Leave us a review</a> — it means the world to a small family crew.</p>" +
    "</div></div>";

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM, to: [to], reply_to: REPLY_TO,
        subject: "Your receipt from Mistletoe Construction — " + pay.receipt_number,
        html,
        attachments: [{ filename: "Receipt-" + pay.receipt_number + ".pdf", content: b64 }]
      })
    });
    if (!r.ok) { const t = await r.text(); return { ok: false, error: "send failed: " + t.slice(0, 160) }; }
  } catch (e) { return { ok: false, error: (e && e.message) || "send failed" }; }

  try { await sbPatch("payments", "id=eq." + encodeURIComponent(pay.id), { receipt_sent_at: new Date().toISOString(), receipt_email: to }); } catch (e) {}
  return { ok: true, email: to, receipt_number: pay.receipt_number, balanceRemaining };
}

module.exports = sendReceipt;
module.exports.sendReceipt = sendReceipt;
module.exports.paidAgainstInvoice = paidAgainstInvoice;
