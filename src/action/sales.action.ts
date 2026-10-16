"use server";

import { Failed } from "@/lib/action-result";
import { UserError, safe } from "@/lib/safe-action";
import prisma, { currentGymName, requireGymId, requireOwnTrainer , requireOwner } from "@/lib/tenant";
import publicPrisma from "@/lib/prisma";
import { EmailResult, sendInvoiceEmail } from "@/lib/email";
import { runSaleWorkflows } from "@/lib/whatsapp/workflows";
import { enqueue } from "@/lib/whatsapp/queue";
import { invoiceShare } from "@/lib/whatsapp/messages";
import { invoicePdfUrl } from "@/lib/invoice-pdf";
import { appUrl } from "@/lib/app-url";
import { restoreToMachines } from "@/lib/biometric-commands";
import {
  format,
  parse,
  isValid,
  isWithinInterval,
  addMonths,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { MemberResponse } from "./member.action";
import { PaymentMode, membershipStatus, saleDue, todayString } from "@/lib/membership";
import { notifyTrainerOfMember } from "@/lib/whatsapp/staff";

// Type definitions
export interface SalesInput {
  member_id: string;
  service_id: string;
  description?: string;
  discount: number;
  amount: number;
  paid: number;
  startDate: string; // Format: dd-MM-yyyy
  // How the amount in `paid` was received.
  paymentMode?: PaymentMode;
  trainer_id?: string;
  // An old sale entered later (moving records in): no invoice is sent and the
  // payment carries `paymentDate` instead of today.
  backdated?: boolean;
  paymentDate?: string; // dd-MM-yyyy
}

export interface SalesResponse {
  id: string;
  member_id: string;
  service_id: string;
  description?: string | null;
  discount: number;
  amount: number;
  paid: number;
  startDate: string;
  endDate: string;
  createdAt: Date;
  updatedAt: Date;
  // Set when the sale was just created: how its invoice went out.
  invoice?: InvoiceDelivery;
  machineRestored?: boolean;
}

export interface ExpandedSalesResponse {
  id: string;
  member_id: string;
  service_id: string;
  description?: string | null;
  discount: number;
  amount: number;
  paid: number;
  startDate: string;
  endDate: string;
  createdAt: Date;
  updatedAt: Date;
  member: {
    id: string;
    name: string;
    memberCode: string;
    email?: string | null;
    phone: bigint;
    address?: string | null;
  };
  service: {
    id: string;
    name: string;
    price: number;
    duration: number;
  };
}

// Helper function to validate date format
const validateDateFormat = (dateStr: string): boolean => {
  const parsed = parse(dateStr, "dd-MM-yyyy", new Date());
  return isValid(parsed);
};

// Where a new plan for this member should start by default: the day after
// their current membership ends (an early renewal), or null when they have
// nothing running today or later.
export async function GetRenewalStartDate(member_id: string): Promise<string | null> {
  if (!member_id) return null;
  const sales = await prisma.sales.findMany({ where: { member_id }, select: { endDate: true } });
  const { endDate, daysLeft } = membershipStatus(sales);
  if (!endDate || daysLeft === null || daysLeft < 0) return null;
  return format(addDays(parse(endDate, "dd-MM-yyyy", new Date()), 1), "dd-MM-yyyy");
}

// 1. AddSales
export async function AddSales(data: SalesInput): Promise<SalesResponse | Failed> {
  return safe(async () => {
    try {
      // Validate inputs
      if (
        !data.member_id ||
        !data.service_id ||
        !data.amount ||
        !data.startDate
      ) {
        throw new UserError("Missing required fields");
      }

      // Money is stored in whole rupees; paise are rounded off.
      const amounts = [data.amount, data.discount ?? 0, data.paid ?? 0];
      if (amounts.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
        throw new UserError("Amount, discount and paid must be numbers");
      }
      const [amount, discount, paidRounded] = amounts.map(Math.round);
      if (discount < 0 || amount < 0 || paidRounded < 0) {
        throw new UserError("Discount, amount, and paid cannot be negative");
      }
      if (amount === 0) throw new UserError("Amount must be greater than zero");
      if (discount > amount) {
        throw new UserError(`Discount ₹${discount} is more than the price ₹${amount}`);
      }

      if (!validateDateFormat(data.startDate)) {
        throw new UserError("Invalid start date format. Use dd-MM-yyyy");
      }

      // Fetch service to get duration
      const service = await prisma.services.findUnique({
        where: { id: data.service_id },
      });
      if (!service) {
        throw new UserError("Service not found");
      }

      // Check if member exists
      const member = await prisma.member.findUnique({
        where: { id: data.member_id },
      });
      if (!member) {
        throw new UserError("Member not found");
      }

      // Calculate endDate based on service duration (in months)
      const startDate = parse(data.startDate, "dd-MM-yyyy", new Date());
      const endDate = addMonths(startDate, service.duration);
      const formattedEndDate = format(endDate, "dd-MM-yyyy");

      await requireOwnTrainer(data.trainer_id);
      const paid = paidRounded;
      if (paid > amount - discount) {
        throw new UserError("Amount paid is more than the amount to be paid");
      }

      const sale = await prisma.sales.create({
        data: {
          member_id: data.member_id,
          service_id: data.service_id,
          description: data.description,
          discount,
          amount,
          paid,
          startDate: data.startDate,
          endDate: formattedEndDate,
          trainer_id: data.trainer_id || null,
          // Whatever is paid up front is the first entry in the payment history.
          payments:
            paid > 0
              ? {
                  create: {
                    // Nested rows are not tagged automatically.
                    gym_id: await requireGymId(),
                    member_id: data.member_id,
                    amount: paid,
                    mode: data.paymentMode ?? "cash",
                    date: data.backdated && data.paymentDate ? data.paymentDate : todayString(),
                  },
                }
              : undefined,
        },
      });

      // Buying a package with a trainer makes that trainer the member's trainer.
      if (data.trainer_id && member.trainer_id !== data.trainer_id) {
        const updated = await prisma.member.update({
          where: { id: member.id },
          data: { trainer_id: data.trainer_id },
        });
        await notifyTrainerOfMember(updated).catch((error) =>
          console.error("Failed to notify trainer:", error)
        );
      }

      return {
        ...sale,
        description: sale.description ?? undefined,
        invoice: data.backdated
          ? { whatsapp: 0, email: { status: "skipped" as const, reason: "backdated" as const } }
          : await deliverInvoice(sale.id, paid, sale.id),
        // A renewal puts someone the machines had dropped back on them.
        machineRestored: data.backdated ? false : await restoreToMachines(member.id),
      };
    } catch (error: any) {
      throw error;
    }
  });
}

export interface InvoiceDelivery {
  // Messages put in the WhatsApp queue (0 when the invoice workflow is off).
  whatsapp: number;
  email: EmailResult;
}

// Sends the invoice on WhatsApp (through the "Plan sold" workflow) and by
// email. A delivery problem never fails the sale itself.
async function deliverInvoice(saleId: string, paidNow: number, key?: string): Promise<InvoiceDelivery> {
  const whatsapp = await runSaleWorkflows("sale_created", saleId, { paidNow, key }).catch((error) => {
    console.error("Failed to queue invoice on WhatsApp:", error);
    return 0;
  });
  const email = await sendInvoiceEmail(saleId).catch(
    (error): EmailResult => ({ status: "failed", error: error.message })
  );
  return { whatsapp, email };
}

// Staff pressing "Send invoice" again for a sale.
export async function ResendInvoice(sale_id: string): Promise<InvoiceDelivery | Failed> {
  return safe(async () => {
    const sale = await prisma.sales.findUnique({ where: { id: sale_id } });
    if (!sale) throw new UserError("Sale not found");
    return deliverInvoice(sale.id, sale.paid);
  });
}

// Staff pressing Send on View Subscriptions: the invoice PDF on WhatsApp,
// with a short caption, whether or not the invoice workflow is on.
export async function SendInvoiceOnWhatsapp(sale_id: string): Promise<void | Failed> {
  return safe(async () => {
    const sale = await prisma.sales.findUnique({
      where: { id: sale_id },
      include: { member: true, service: { select: { name: true } } },
    });
    if (!sale) throw new UserError("Sale not found");
    await enqueue([{
      name: sale.member.name,
      phone: sale.member.phone,
      body: invoiceShare(sale.member.name, sale.service.name, await currentGymName()),
      document: invoicePdfUrl(sale.id, await appUrl()),
    }]);
  });
}

// 10. GetAllSalesWithExpand
export async function GetAllSalesWithExpand(): Promise<
  ExpandedSalesResponse[]
> {
  try {
    const sales = await prisma.sales.findMany({
      include: {
        member: {
          select: {
            id: true,
            name: true,
            memberCode: true,
            email: true,
            phone: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            duration: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return sales.map((sale) => ({
      ...sale,
      description: sale.description ?? null,
      member: {
        ...sale.member,
        email: sale.member.email ?? null,
      },
      member_name: sale.member.name,
      service_name: sale.service.name,
      service: {
        ...sale.service,
      },
      dueAmount: sale.amount - sale.paid - (sale.discount ?? 0),
    }));
  } catch (error: any) {
    throw error;
  }
}

// DeleteSaleById
export async function DeleteSaleById(id: string): Promise<void | Failed> {
  return safe(async () => {
    await requireOwner();
    try {
      // Deleting would also wipe the money already recorded against it.
      const payments = await prisma.payment.count({ where: { sale_id: id } });
      if (payments > 0) {
        throw new UserError(
          "payments were collected on this sale. Delete them from the member's Payments tab first"
        );
      }
      await prisma.sales.delete({
        where: { id },
      });
    } catch (error: any) {
      throw error;
    }
  });
}

export async function GetSalesEndingInXdays(
  days: number
): Promise<SalesResponse[]> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    // console.log(days)
    if (days >= 0) {
      const xDaysLater = addDays(today, days);
      const xDaysLaterStr = format(xDaysLater, "dd-MM-yyyy");

      const sales = await prisma.sales.findMany({
        where: {
          endDate: xDaysLaterStr,
        },
        orderBy: { createdAt: "desc" },
        include: {
          service: {
            select: {
              id: true,
              name: true,
            },
          },
          member: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      });
      return sales.map((sale) => ({
        ...sale,
        description: sale.description ?? undefined,
        service_name: sale.service.name,
        member_name: sale.member.name,
        member_phone: sale.member.phone,
      }));
    } else if (days === -1) {
      // Get all sales and then filter in JavaScript
      const allSales = await prisma.sales.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          service: {
            select: {
              id: true,
              name: true,
            },
          },
          member: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      // Filter sales where endDate is before today
      const expiredSales = allSales.filter((sale) => {
        try {
          const endDate = parse(sale.endDate, "dd-MM-yyyy", new Date());
          return endDate < today;
        } catch {
          return false; // Skip if date parsing fails
        }
      });

      return expiredSales.map((sale) => ({
        ...sale,
        description: sale.description ?? undefined,
        service_name: sale.service.name,
        member_name: sale.member.name,
        member_phone: sale.member.phone,
      }));
    }

    return [];
  } catch (error: any) {
    throw error;
  }
}

// Used by the public invoice link sent to members, so it runs without a
// signed-in gym; the sale id is an unguessable uuid.
export async function GetSaleWithExpand(sale_id: string): Promise<any> {
  try {
    // Only the gym's own staff can open its invoices.
    const sale = await prisma.sales.findUnique({
      where: { id: sale_id },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            memberCode: true,
            email: true,
            phone: true,
            address: true,
          },
        },
        payments: { orderBy: { createdAt: "asc" } },
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            duration: true,
          },
        },
      },
    });

    if (!sale) return null;
    const gym = await publicPrisma.gym.findUnique({
      where: { id: sale.gym_id },
      select: { name: true, address: true, phone: true, email: true, gstin: true, invoiceTerms: true, logo: true, brandColor: true },
    });
    return {
      ...sale,
      gym: {
        name: gym?.name ?? "",
        address: gym?.address ?? "",
        phone: gym?.phone?.toString() ?? "",
        email: gym?.email ?? "",
        gstin: gym?.gstin ?? "",
        invoiceTerms: gym?.invoiceTerms ?? "",
        logo: gym?.logo ?? "",
        brandColor: gym?.brandColor ?? "",
      },
      payments: sale.payments.map((p) => ({ date: p.date, mode: p.mode, amount: p.amount })),
    };
  } catch (error: any) {
    throw error;
  }
}

export async function getAllExpiringSalesInXDays(
  days: number
): Promise<SalesResponse[]> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    if (days >= 0) {
      const xDaysLater = addDays(today, days);

      // Fetch all sales (we'll filter in JavaScript due to string date storage)
      const allSales = await prisma.sales.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          service: {
            select: {
              id: true,
              name: true,
            },
          },
          member: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      // Filter sales where endDate is between today and xDaysLater (inclusive)
      const expiringSales = allSales.filter((sale) => {
        try {
          const endDate = parse(sale.endDate, "dd-MM-yyyy", new Date());
          return endDate >= today && endDate <= xDaysLater;
        } catch {
          return false; // Skip if date parsing fails
        }
      });

      return expiringSales.map((sale) => ({
        ...sale,
        description: sale.description ?? undefined,
        service_name: sale.service.name,
        member_name: sale.member.name,
        member_phone: sale.member.phone,
      }));
    }

    return [];
  } catch (error: any) {
    throw error;
  }
}

// GetSalesWithPendingAmount
export async function GetSalesWithPendingAmount(): Promise<any> {
  try {
    const sales = await prisma.sales.findMany({
      include: {
        member: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            duration: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const filteredSales = sales.filter(
      (sale) => sale.amount - sale.discount - sale.paid > 0
    );

    return {
      sales: filteredSales.map((sale) => ({
        // ...sale,
        id: sale.id,
        member_id: sale.member.id,
        description: sale.description ?? undefined,
        member_name: sale.member.name,
        member_phone: sale.member.phone,
        service_name: sale.service.name,
        amount: sale.amount,
        discount: sale.discount,
        paid: sale.paid,
        due: sale.amount - sale.discount - sale.paid,
        // service: {
        //   ...sale.service,
        // },
      })),
      total: filteredSales.reduce(
        (acc, sale) => acc + sale.amount - sale.discount - sale.paid,
        0
      ),
    };
  } catch (error: any) {
    throw error;
  }
}
