// The invoice as a PDF: downloaded from the invoice page, sent on WhatsApp
// as a document and attached to the invoice email. Same content as the
// printable page (src/app/(open)/invoices/[sale_id]/page.tsx).
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import base from "@/lib/prisma";
import { paymentModeLabel, rupees, saleDue } from "@/lib/membership";

// A font with the ₹ sign, fetched once per server and cached. Without it
// (no internet) the PDF falls back to a built-in font and "Rs.".
const FONT_URL = "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/";
let fonts: Promise<[ArrayBuffer, ArrayBuffer] | null> | null = null;
function loadFonts() {
  fonts ??= Promise.all(
    ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf"].map(async (file) => {
      const res = await fetch(FONT_URL + file, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`font ${res.status}`);
      return res.arrayBuffer();
    })
  ).then((f) => f as [ArrayBuffer, ArrayBuffer]).catch(() => {
    fonts = null; // try again next time
    return null;
  });
  return fonts;
}

export const invoiceNumber = (saleId: string) => `INV-${saleId.slice(0, 8).toUpperCase()}`;

const DEFAULT_TERMS =
  "Membership is non-transferable and non-refundable. The gym reserves the right to modify the terms of membership. Members must comply with all gym rules and regulations.";

const INK = rgb(0.07, 0.07, 0.07);
const MUTED = rgb(0.4, 0.4, 0.4);
const LINE = rgb(0.85, 0.85, 0.85);
const GREEN = rgb(0.09, 0.5, 0.24);

export async function buildInvoicePdf(saleId: string): Promise<{ bytes: Uint8Array; fileName: string } | null> {
  const sale = await base.sales.findUnique({
    where: { id: saleId },
    include: { member: true, service: { select: { name: true } }, payments: { orderBy: { createdAt: "asc" } } },
  });
  if (!sale) return null;
  const gym = await base.gym.findUnique({ where: { id: sale.gym_id } });

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${invoiceNumber(sale.id)}`);
  pdf.setAuthor(gym?.name ?? "");
  const fontBytes = await loadFonts();
  let regular: PDFFont, bold: PDFFont;
  if (fontBytes) {
    pdf.registerFontkit(fontkit);
    regular = await pdf.embedFont(fontBytes[0], { subset: true });
    bold = await pdf.embedFont(fontBytes[1], { subset: true });
  } else {
    regular = await pdf.embedFont(StandardFonts.Helvetica);
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  }
  // The built-in font has no ₹ and only Latin letters.
  const clean = (text: string) => (fontBytes ? text : text.replace(/₹/g, "Rs. ").replace(/[^\x20-\x7E]/g, "?"));
  const money = (n: number) => clean(rupees(n));

  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width } = page.getSize();
  const M = 48;
  let y = 841.89 - M;

  const write = (text: string, x: number, at: number, size = 10, font = regular, color = INK) =>
    page.drawText(clean(text), { x, y: at, size, font, color });
  const writeRight = (text: string, right: number, at: number, size = 10, font = regular, color = INK) =>
    write(text, right - font.widthOfTextAtSize(clean(text), size), at, size, font, color);
  const wrap = (text: string, size: number, maxWidth: number, font = regular) => {
    const lines: string[] = [];
    for (const para of clean(text).split(/\n/)) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
    }
    return lines;
  };
  const rule = (at: number) => page.drawLine({ start: { x: M, y: at }, end: { x: width - M, y: at }, thickness: 0.8, color: LINE });

  // ---- header: gym on the left, invoice number on the right
  let left = y;
  const logo = await embedLogo(pdf, gym?.logo);
  if (logo) {
    const h = 48, w = Math.min(160, (logo.width / logo.height) * h);
    page.drawImage(logo, { x: M, y: left - h, width: w, height: h });
    left -= h + 12;
  }
  write(gym?.name ?? "", M, left - 14, 15, bold);
  left -= 32;
  const gymLines = [
    ...(gym?.address ? wrap(gym.address, 9.5, 280) : []),
    gym?.phone ? `Contact: +91 ${gym.phone}` : null,
    gym?.email || null,
    gym?.gstin ? `GSTIN: ${gym.gstin}` : null,
  ].filter(Boolean) as string[];
  for (const line of gymLines) {
    write(line, M, left, 9.5, regular, MUTED);
    left -= 13;
  }
  writeRight("INVOICE", width - M, y - 20, 22, bold);
  writeRight(`#${invoiceNumber(sale.id)}`, width - M, y - 38, 10, regular, MUTED);
  writeRight(`Date: ${sale.startDate}`, width - M, y - 52, 10, regular, MUTED);
  const due = saleDue(sale);
  if (due <= 0) {
    const label = "PAID", size = 12, w = bold.widthOfTextAtSize(label, size) + 16;
    page.drawRectangle({ x: width - M - w, y: y - 82, width: w, height: 20, borderColor: GREEN, borderWidth: 1.2 });
    write(label, width - M - w + 8, y - 76, size, bold, GREEN);
  }
  y = Math.min(left, y - 90) - 14;

  // ---- member
  write("To,", M, y, 10, regular, MUTED);
  y -= 15;
  write(sale.member.name, M, y, 11.5, bold);
  y -= 14;
  for (const line of sale.member.address ? wrap(sale.member.address, 10, 300) : []) {
    write(line, M, y);
    y -= 13;
  }
  write(`Phone: ${sale.member.phone}`, M, y);
  y -= 30;

  const section = (title: string) => {
    write(title, M, y, 12.5, bold);
    y -= 8;
    rule(y);
    y -= 18;
  };
  const row = (label: string, value: string, strong = false, size = 10.5) => {
    write(label, M, y, size, strong ? bold : regular);
    writeRight(value, width - M, y, size, strong ? bold : regular);
    y -= size + 9;
  };

  section("Membership Details");
  row("Service", `${sale.service.name} membership`, true);
  row("Period", `${sale.startDate} to ${sale.endDate}`);
  y -= 12;

  section("Payment Summary");
  row("Total Amount", money(sale.amount));
  if (sale.discount) row("Discount", `-${money(sale.discount)}`);
  row("Amount After Discount", money(sale.amount - sale.discount), true);
  row("Paid", money(sale.paid));
  y += 4;
  rule(y + 8);
  y -= 6;
  row("Balance Due", money(Math.max(0, due)), true, 12.5);
  y -= 8;

  if (sale.payments.length > 0) {
    section("Payments Received");
    for (const p of sale.payments) {
      write(p.date, M, y);
      write(paymentModeLabel(p.mode), M + 110, y);
      writeRight(money(p.amount), width - M, y);
      y -= 18;
    }
    y -= 6;
  }

  // ---- closing
  rule(y);
  y -= 18;
  for (const line of wrap(`Thank you for choosing ${gym?.name ?? "us"}! We appreciate your business and commitment to your fitness journey.`, 9.5, width - 2 * M)) {
    write(line, M, y, 9.5, regular, MUTED);
    y -= 13;
  }
  y -= 10;
  write("Terms and Conditions", M, y, 9.5, bold);
  y -= 13;
  for (const line of wrap(gym?.invoiceTerms || DEFAULT_TERMS, 8.5, width - 2 * M)) {
    if (y < M + 40) break;
    write(line, M, y, 8.5, regular, MUTED);
    y -= 11.5;
  }
  const footer = [gym?.phone ? `+91 ${gym.phone}` : null, gym?.email].filter(Boolean).join("  |  ");
  const foot1 = "If you have any questions regarding this invoice, please contact us.";
  write(foot1, (width - regular.widthOfTextAtSize(clean(foot1), 8.5)) / 2, M + 12, 8.5, regular, MUTED);
  if (footer) write(footer, (width - regular.widthOfTextAtSize(clean(footer), 8.5)) / 2, M, 8.5, regular, MUTED);

  return { bytes: await pdf.save(), fileName: `Invoice-${invoiceNumber(sale.id)}.pdf` };
}

// Gym logos are stored as data URLs; PNG and JPEG can go into a PDF.
async function embedLogo(pdf: PDFDocument, logo: string | null | undefined) {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(logo ?? "");
  if (!m) return null;
  try {
    const bytes = Buffer.from(m[2], "base64");
    return m[1] === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}


