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
}

export interface ServiceResponse {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    duration: number;
    isPersonalTraining: boolean;
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
export async function DeleteServiceById(id: string): Promise<void> {
    try {
        await prisma.services.delete({
            where: { id },
        });
    } catch (error:any) {
        throw new UserError(`Failed to delete service: ${ error.message }`);
    }
}

// Marks an existing plan as a personal training package (or not).
export async function SetServicePersonalTraining(id: string, isPersonalTraining: boolean): Promise<void> {
    await requireOwner();
    await prisma.services.update({ where: { id }, data: { isPersonalTraining } });
}
