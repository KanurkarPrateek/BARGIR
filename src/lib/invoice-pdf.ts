// The invoice as a PDF: downloaded from the invoice page, sent on WhatsApp
// as a document and attached to the invoice email. Same content as the
// printable page (src/app/(open)/invoices/[sale_id]/page.tsx).
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import base from "@/lib/prisma";
import { paymentModeLabel, rupees, saleDue } from "@/lib/membership";
import { brandColors } from "@/lib/brand";

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

const GREY = rgb(0.42, 0.42, 0.45);
const LINE = rgb(0.9, 0.9, 0.9);
const INK = rgb(0.07, 0.07, 0.07);
const GREEN = rgb(0.08, 0.5, 0.24);
const AMBER = rgb(0.75, 0.42, 0.02);
const color = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);

// Same layout as the invoice page: a band in the gym's brand colour with its
// logo and details, then who it is for, the plan, totals, payments, terms.
export async function buildInvoicePdf(saleId: string): Promise<{ bytes: Uint8Array; fileName: string } | null> {
  const sale = await base.sales.findUnique({
    where: { id: saleId },
    include: { member: true, service: { select: { name: true } }, payments: { orderBy: { createdAt: "asc" } } },
  });
  if (!sale) return null;
  const gym = await base.gym.findUnique({ where: { id: sale.gym_id } });
  const c = brandColors(gym?.brandColor);
  const BRAND = color(c.brand), ON_BRAND = color(c.onBrand), SOFT = color(c.soft), ACCENT = color(c.ink);

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
  const { width, height } = page.getSize();
  const M = 44;

  const write = (text: string, x: number, at: number, size = 10, font = regular, fill = INK) =>
    page.drawText(clean(text), { x, y: at, size, font, color: fill });
  const writeRight = (text: string, right: number, at: number, size = 10, font = regular, fill = INK) =>
    write(text, right - font.widthOfTextAtSize(clean(text), size), at, size, font, fill);
  const spaced = (text: string) => text.split("").join(" ");
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
  const rule = (at: number, from = M, to = width - M) => page.drawLine({ start: { x: from, y: at }, end: { x: to, y: at }, thickness: 0.7, color: LINE });

  // ---- brand band
  const logo = await embedLogo(pdf, gym?.logo);
  const logoBox = 62;
  const textX = logo ? M + logoBox + 16 : M;
  const info = [
    ...(gym?.address ? wrap(gym.address, 9, 270) : []),
    gym?.phone ? `Contact: +91 ${gym.phone}` : null,
    gym?.email || null,
    gym?.gstin ? `GSTIN: ${gym.gstin}` : null,
  ].filter(Boolean) as string[];
  const leftHeight = Math.max(logo ? logoBox : 0, 22 + info.length * 12);
  const bandHeight = Math.max(leftHeight, 64) + 52;
  page.drawRectangle({ x: 0, y: height - bandHeight, width, height: bandHeight, color: BRAND });
  const top = height - 26;
  if (logo) {
    page.drawRectangle({ x: M, y: top - logoBox, width: logoBox, height: logoBox, color: rgb(1, 1, 1) });
    const inner = logoBox - 10;
    const scale = Math.min(inner / logo.width, inner / logo.height);
    const w = logo.width * scale, h = logo.height * scale;
    page.drawImage(logo, { x: M + (logoBox - w) / 2, y: top - logoBox + (logoBox - h) / 2, width: w, height: h });
  }
  write(gym?.name ?? "", textX, top - 15, 16, bold, ON_BRAND);
  info.forEach((line, i) => write(line, textX, top - 32 - i * 12, 9, regular, ON_BRAND));
  writeRight(spaced("INVOICE"), width - M, top - 18, 20, bold, ON_BRAND);
  writeRight(`#${invoiceNumber(sale.id)}`, width - M, top - 36, 9.5, regular, ON_BRAND);
  writeRight(`Date: ${sale.startDate}`, width - M, top - 49, 9.5, regular, ON_BRAND);
  let y = height - bandHeight - 34;

  // ---- billed to + status
  write("BILLED TO", M, y, 8, bold, ACCENT);
  const total = sale.amount - sale.discount;
  const due = Math.max(0, saleDue(sale));
  const status = due === 0 ? "PAID" : `BALANCE DUE ${money(due)}`;
  const statusColor = due === 0 ? GREEN : AMBER;
  const sw = bold.widthOfTextAtSize(clean(status), 9) + 20;
  page.drawRectangle({ x: width - M - sw, y: y - 8, width: sw, height: 20, borderColor: statusColor, borderWidth: 1.4 });
  writeRight(status, width - M - 10, y - 1.5, 9, bold, statusColor);
  y -= 17;
  write(sale.member.name, M, y, 12.5, bold);
  y -= 14;
  for (const line of [
    sale.member.memberCode ? `Member ID: ${sale.member.memberCode}` : null,
    `Phone: ${sale.member.phone}`,
    ...(sale.member.address ? wrap(sale.member.address, 9.5, 300) : []),
  ].filter(Boolean) as string[]) {
    write(line, M, y, 9.5, regular, GREY);
    y -= 12.5;
  }
  y -= 18;

  // ---- items
  const periodX = M + 250;
  page.drawRectangle({ x: M, y: y - 7, width: width - 2 * M, height: 22, color: SOFT });
  write("DESCRIPTION", M + 10, y, 8, bold, ACCENT);
  write("PERIOD", periodX, y, 8, bold, ACCENT);
  writeRight("AMOUNT", width - M - 10, y, 8, bold, ACCENT);
  y -= 26;
  // A long plan name wraps within its column instead of running into the dates.
  const description = wrap(`${sale.service.name} membership`, 10.5, periodX - M - 26, bold);
  write(`${sale.startDate} to ${sale.endDate}`, periodX, y, 10, regular, GREY);
  writeRight(money(sale.amount), width - M - 10, y, 10.5);
  description.forEach((line, i) => write(line, M + 10, y - i * 13, 10.5, bold));
  y -= 12 + (description.length - 1) * 13;
  rule(y);
  y -= 24;

  // ---- totals
  const tx = width - M - 200;
  const totalRow = (label: string, value: string, strong = false) => {
    write(label, tx, y, 10, strong ? bold : regular, strong ? INK : GREY);
    writeRight(value, width - M, y, 10, strong ? bold : regular);
    y -= 17;
  };
  totalRow("Subtotal", money(sale.amount));
  if (sale.discount) totalRow("Discount", `-${money(sale.discount)}`);
  rule(y + 11, tx, width - M);
  totalRow("Total", money(total), true);
  totalRow("Paid", money(sale.paid));
  // The bar sits below the last row, with the text centred in it.
  y -= 10;
  page.drawRectangle({ x: tx - 10, y: y - 9, width: width - M - tx + 10, height: 28, color: BRAND });
  write("Balance Due", tx, y, 12, bold, ON_BRAND);
  writeRight(money(due), width - M - 8, y, 12, bold, ON_BRAND);
  y -= 42;

  // ---- payments received
  if (sale.payments.length > 0) {
    write("PAYMENTS RECEIVED", M, y, 8, bold, ACCENT);
    y -= 16;
    for (const p of sale.payments) {
      write(p.date, M, y, 9.5);
      write(paymentModeLabel(p.mode), M + 110, y, 9.5, regular, GREY);
      writeRight(money(p.amount), width - M, y, 9.5);
      y -= 8;
      rule(y);
      y -= 12;
    }
    y -= 8;
  }

  // ---- closing
  rule(y);
  y -= 20;
  const thanks = `Thank you for choosing ${gym?.name ?? "us"}! We appreciate your commitment to your fitness journey.`;
  for (const line of wrap(thanks, 9.5, width - 2 * M)) {
    write(line, (width - regular.widthOfTextAtSize(line, 9.5)) / 2, y, 9.5, regular, GREY);
    y -= 13;
  }
  y -= 12;
  write("Terms and Conditions", M, y, 9, bold);
  y -= 12;
  for (const line of wrap(gym?.invoiceTerms || DEFAULT_TERMS, 8.5, width - 2 * M)) {
    if (y < M + 40) break;
    write(line, M, y, 8.5, regular, GREY);
    y -= 11;
  }

  // ---- footer
  const foot1 = "If you have any questions regarding this invoice, please contact us.";
  const foot2 = [gym?.phone ? `+91 ${gym.phone}` : null, gym?.email].filter(Boolean).join("  |  ");
  write(foot1, (width - regular.widthOfTextAtSize(clean(foot1), 8.5)) / 2, 34, 8.5, regular, GREY);
  if (foot2) write(foot2, (width - regular.widthOfTextAtSize(clean(foot2), 8.5)) / 2, 22, 8.5, regular, GREY);
  page.drawRectangle({ x: 0, y: 0, width, height: 8, color: BRAND });

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


