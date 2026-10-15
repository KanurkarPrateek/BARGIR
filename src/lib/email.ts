// Invoice emails, sent through Resend (https://resend.com). Email is optional:
// without RESEND_API_KEY nothing is sent and the rest of the app is unaffected.
import base from "@/lib/prisma";
import prisma from "@/lib/tenant";
import { appUrl } from "@/lib/app-url";
import { rupees, saleDue } from "@/lib/membership";
import { buildInvoicePdf } from "@/lib/invoice-pdf";

const API_URL = process.env.RESEND_API_URL ?? "https://api.resend.com/emails";

export type EmailResult =
  | { status: "sent"; to: string }
  | { status: "skipped"; reason: "no-email" | "not-configured" | "backdated" }
  | { status: "failed"; error: string };

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const isEmail = (value: string | null | undefined): value is string =>
  !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function sendInvoiceEmail(saleId: string): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  // The address emails are sent from; its domain must be verified in Resend.
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { status: "skipped", reason: "not-configured" };

  const sale = await prisma.sales.findUnique({
    where: { id: saleId },
    include: { member: true, service: { select: { name: true } } },
  });
  if (!sale || !isEmail(sale.member.email)) return { status: "skipped", reason: "no-email" };
  const gym = await base.gym.findUnique({ where: { id: sale.gym_id } });
  const gymName = gym?.name ?? "Your gym";
  const link = `${await appUrl()}/invoices/${sale.id}`;

  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#666">${label}</td><td style="padding:6px 0"><strong>${escapeHtml(value)}</strong></td></tr>`;
  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111;max-width:520px">
  <h2 style="margin:0 0 4px">${escapeHtml(gymName)}</h2>
  <p style="margin:0 0 20px;color:#666">Invoice INV-${sale.id.slice(0, 8).toUpperCase()}</p>
  <p>Hi ${escapeHtml(sale.member.name)},</p>
  <p>Thank you for choosing ${escapeHtml(gymName)}. Your invoice is attached as a PDF; the details are below.</p>
  <table style="border-collapse:collapse;margin:16px 0">
    ${row("Plan", sale.service.name)}
    ${row("Valid", `${sale.startDate} to ${sale.endDate}`)}
    ${row("Amount", rupees(sale.amount - sale.discount))}
    ${row("Paid", rupees(sale.paid))}
    ${row("Balance", rupees(saleDue(sale)))}
  </table>
  <p><a href="${link}" style="background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">View or print your invoice</a></p>
  <p style="color:#666;font-size:13px;margin-top:24px">${[gym?.address, gym?.phone ? `+91 ${gym.phone}` : null].filter(Boolean).map((part) => escapeHtml(String(part))).join(" · ")}</p>
</div>`;

  const pdf = await buildInvoicePdf(sale.id).catch(() => null);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Shown as coming from the gym, sent from the platform's verified address.
        from: `${gymName.replace(/[<>"]/g, "")} <${from}>`,
        to: [sale.member.email],
        reply_to: isEmail(gym?.email) ? gym.email : undefined,
        subject: `Your invoice from ${gymName}`,
        html,
        attachments: pdf ? [{ filename: pdf.fileName, content: Buffer.from(pdf.bytes).toString("base64") }] : undefined,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return { status: "sent", to: sale.member.email };
    const body = await res.json().catch(() => ({}));
    return { status: "failed", error: body.message ?? `Email service replied ${res.status}` };
  } catch (error: any) {
    return { status: "failed", error: error.message };
  }
}
