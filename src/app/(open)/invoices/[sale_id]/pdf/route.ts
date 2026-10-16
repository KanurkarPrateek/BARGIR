// The invoice as a PDF, for the gym's own staff and for the WhatsApp sender
// (which sends it to the member as a document). Members get the file itself;
// there is no public link.
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import base from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ sale_id: string }> }) {
  const { sale_id } = await params;
  const notFound = new Response("Invoice not found", { status: 404 });
  if (!/^[0-9a-f-]{36}$/i.test(sale_id)) return notFound;
  const sale = await base.sales.findUnique({ where: { id: sale_id }, select: { gym_id: true } });
  if (!sale) return notFound;

  const workerKey = process.env.WHATSAPP_WORKER_KEY;
  const fromSender = !!workerKey && request.headers.get("x-api-key") === workerKey;
  if (!fromSender && (await getSession())?.gymId !== sale.gym_id) return notFound;

  const pdf = await buildInvoicePdf(sale_id);
  if (!pdf) return notFound;
  const download = new URL(request.url).searchParams.has("download");
  return new Response(Buffer.from(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${pdf.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
