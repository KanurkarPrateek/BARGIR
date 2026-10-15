// The invoice as a PDF. Public like the invoice page: the sale id is the key.
import { buildInvoicePdf } from "@/lib/invoice-pdf";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ sale_id: string }> }) {
  const { sale_id } = await params;
  const pdf = /^[0-9a-f-]{36}$/i.test(sale_id) ? await buildInvoicePdf(sale_id) : null;
  if (!pdf) return new Response("Invoice not found", { status: 404 });
  const download = new URL(request.url).searchParams.has("download");
  return new Response(Buffer.from(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${pdf.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
