'use server';
import { Failed } from '@/lib/action-result';
import { UserError, safe } from '@/lib/safe-action';
import prisma, { requireOwner } from '@/lib/tenant';

// Type definitions
export interface ServiceInput {
    name: string;
    description?: string;
    price: number;
    duration: number; // Duration in months
    isPersonalTraining?: boolean;
    discountType?: string | null; // "percent" | "flat" | null
    discountValue?: number;
    offerTill?: string | null; // dd-MM-yyyy
}

export interface ServiceResponse {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    duration: number;
    isPersonalTraining: boolean;
    discountType: string | null;
    discountValue: number;
    offerTill: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// 1. AddService
export async function AddService(data: ServiceInput): Promise<ServiceResponse | Failed> {
  return safe(async () => {
      await requireOwner();
      try {
          // Validate inputs
          if (!data.name || !data.price || !data.duration) {
              throw new UserError('Missing required fields');
          }

          if (data.price < 0) {
              throw new UserError('Price cannot be negative');
          }

          if (data.duration <= 0) {
              throw new UserError('Duration must be a positive number');
          }

          const service = await prisma.services.create({
              data: {
                  name: data.name,
                  description: data.description,
                  price: Number(data.price),
                  duration: Number(data.duration),
                  isPersonalTraining: data.isPersonalTraining ?? false,
                  ...discountFields(data),
              },
          });

          return {
              ...service,
              description: service.description ?? undefined,
          };
      } catch (error:any) {
          throw error;
      }
  });
}

// 2. GetAllServices
export async function GetAllServices(): Promise<ServiceResponse[]> {
    try {
        const services = await prisma.services.findMany({
            orderBy: { createdAt: 'desc' },
        });

        return services.map((service) => ({
            ...service,
            description: service.description ?? undefined,
        }));
    } catch (error:any) {
        throw error;
    }
}

// 5. DeleteServiceById
// Owner only. A package that has been sold stays, so past sales keep it.
export async function DeleteServiceById(id: string): Promise<void | Failed> {
    return safe(async () => {
        await requireOwner();
        if (await prisma.sales.count({ where: { service_id: id } })) {
            throw new UserError('This package has been sold, so it cannot be deleted');
        }
        await prisma.services.delete({
            where: { id },
        });
    });
}

// Marks an existing plan as a personal training package (or not).
export async function SetServicePersonalTraining(id: string, isPersonalTraining: boolean): Promise<void> {
    await requireOwner();
    await prisma.services.update({ where: { id }, data: { isPersonalTraining } });
}

// Checks and normalises the offer part of a package.
function discountFields(data: ServiceInput) {
    const type = data.discountType === "percent" || data.discountType === "flat" ? data.discountType : null;
    const value = type ? Math.trunc(Number(data.discountValue) || 0) : 0;
    if (type && value <= 0) throw new UserError("Enter the discount amount, or choose No offer");
    if (type === "percent" && value >= 100) throw new UserError("A percentage discount must be below 100");
    if (type === "flat" && value >= Number(data.price)) throw new UserError("The discount must be less than the price");
    return { discountType: type, discountValue: value, offerTill: type ? data.offerTill || null : null };
}

// Edit Package: name, price, duration, personal training and offer.
export async function UpdateService(id: string, data: ServiceInput): Promise<void | Failed> {
    return safe(async () => {
        await requireOwner();
        if (!data.name?.trim()) throw new UserError('Enter the package name');
        if (!(Number(data.price) > 0) || !(Number(data.duration) > 0)) throw new UserError('Price and duration must be more than zero');
        await prisma.services.update({
            where: { id },
            data: {
                name: data.name.trim(),
                description: data.description,
                price: Number(data.price),
                duration: Number(data.duration),
                isPersonalTraining: data.isPersonalTraining ?? false,
                ...discountFields(data),
            },
        });
    });
}
