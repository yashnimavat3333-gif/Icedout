const FROM_ADDRESS = "iceyoutleagacy@gmail.com";

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "$0.00";
  return `$${amount.toFixed(2)}`;
}

function parseItems(raw) {
  try {
    const parsed = JSON.parse(raw || "");
    return parsed && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function validEmail(value) {
  const email = String(value || "").trim();
  if (!email || email.length > 200) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

export function confirmationRecipient(order, payerEmail) {
  const stored = parseItems(order?.items);
  return validEmail(stored?.customerEmail) || validEmail(payerEmail);
}

export function buildOrderConfirmation({ order, payerEmail } = {}) {
  const to = confirmationRecipient(order, payerEmail);
  const stored = parseItems(order?.items);
  const orderNumber = String(stored?.orderNumber || "").trim();
  if (!to || !orderNumber) return null;

  const lines = Array.isArray(stored?.lines) ? stored.lines : [];
  const total = Number(order?.totalAmount ?? order?.amount);
  const name = String(order?.shipping_full_name || "").trim();
  const address = String(order?.shippingAddress || "").trim();
  const captureId = String(order?.paypal_capture_id || "").trim();

  const itemLines = lines.map((line) => {
    const label = line.gift || line.promotionalGift
      ? `${line.name || "FREE PROMOTIONAL GIFT"} — included`
      : [line.name || "Item", line.variationName].filter(Boolean).join(" — ");
    const qty = Math.max(1, Number(line.quantity) || 1);
    return `${qty} × ${label} — ${money(line.lineTotal ?? line.unitPrice)}`;
  });

  const text = [
    name ? `Hello ${name},` : "Hello,",
    "",
    `Your ICEYOUT payment is confirmed. Order ${orderNumber}.`,
    "",
    "Items",
    ...(itemLines.length ? itemLines : ["The paid items are on your order."]),
    "",
    `Total paid: ${money(total)}`,
    captureId ? `PayPal reference: ${captureId}` : "",
    address ? `Ship to: ${address}` : "",
    "",
    "We will prepare this order for shipping. Free worldwide shipping is included.",
    "If you need to reach us about this order, reply to this email.",
    "",
    "ICEYOUT",
  ].filter((line) => line !== undefined).join("\n");

  const rows = lines.map((line) => {
    const title = line.gift || line.promotionalGift
      ? "FREE PROMOTIONAL GIFT"
      : String(line.name || "Item");
    const detail = line.variationName ? String(line.variationName) : "";
    const qty = Math.max(1, Number(line.quantity) || 1);
    return `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #e7e1d6;">${qty} × ${escapeHtml(title)}${detail ? `<br><span style="color:#6d675e;">${escapeHtml(detail)}</span>` : ""}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e7e1d6;text-align:right;">${escapeHtml(money(line.lineTotal ?? line.unitPrice))}</td>
    </tr>`;
  }).join("");

  const html = `<div style="background:#f6f3ec;padding:24px;font-family:Georgia,serif;color:#1a1206;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #c6a15b;padding:28px;">
      <p style="letter-spacing:.22em;font-size:11px;text-transform:uppercase;color:#8d6b32;">ICEYOUT</p>
      <h1 style="font-size:28px;font-weight:normal;margin:8px 0 16px;">Payment confirmed</h1>
      <p>${name ? `Hello ${escapeHtml(name)},` : "Hello,"}</p>
      <p>Your payment is confirmed. Order <strong>${escapeHtml(orderNumber)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
      <p style="font-size:18px;">Total paid: <strong>${escapeHtml(money(total))}</strong></p>
      ${captureId ? `<p style="color:#6d675e;">PayPal reference: ${escapeHtml(captureId)}</p>` : ""}
      ${address ? `<p>Ship to:<br>${escapeHtml(address).replace(/\n/g, "<br>")}</p>` : ""}
      <p>We will prepare this order for shipping. Free worldwide shipping is included.</p>
    </div>
  </div>`;

  return {
    to,
    from: `ICEYOUT <${process.env.ORDER_EMAIL_FROM || FROM_ADDRESS}>`,
    replyTo: process.env.ORDER_EMAIL_FROM || FROM_ADDRESS,
    subject: `Your ICEYOUT order ${orderNumber} is confirmed`,
    text,
    html,
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function deliverOrderConfirmation({ order, payerEmail, transport } = {}) {
  if (!order) return { sent: false, reason: "missing-order" };
  const message = buildOrderConfirmation({ order, payerEmail });
  if (!message) return { sent: false, reason: "missing-email" };

  const user = String(process.env.ORDER_EMAIL_USER || process.env.ORDER_EMAIL_FROM || FROM_ADDRESS).trim();
  const pass = String(process.env.ORDER_EMAIL_APP_PASSWORD || "").trim();
  if (!transport && !pass) return { sent: false, reason: "not-configured" };

  try {
    const mailer = transport || await createTransport(user, pass);
    await mailer.sendMail({
      from: message.from,
      to: message.to,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { sent: true, orderNumber: parseItems(order.items)?.orderNumber || "" };
  } catch (err) {
    return { sent: false, reason: "send-failed", message: String(err?.message || "send failed").slice(0, 160) };
  }
}

async function createTransport(user, pass) {
  const nodemailer = await import("nodemailer");
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}
