'use server';

import { Failed } from '@/lib/action-result';
import { UserError, safe } from '@/lib/safe-action';
import prisma, { requireOwnTrainer, requireOwner } from '@/lib/tenant';
// import { EnquiryType }from '@prisma/client';
import { format, parse, isValid } from 'date-fns';
import { runEnquiryCreatedWorkflows } from '@/lib/whatsapp/workflows';
import { notifyTrainerOfEnquiry } from '@/lib/whatsapp/staff';
import { ENQUIRY_STATUSES, EnquiryStatus } from '@/lib/membership';
import { requireIndianMobile } from '@/lib/phone';

type EnquiryType = 'call' | 'walkin' | 'instagram' | 'whatsapp';

export interface EnquiryInput {
  name: string;
  phone: bigint;
  followupDate?: string; // Format: dd-MM-yyyy
  message?: string;
  type: EnquiryType;
  trainer_id?: string;
  // An old enquiry entered later: dated `enquiryDate`, and nobody is messaged.
  backdated?: boolean;
  enquiryDate?: string; // dd-MM-yyyy
}

export interface EnquiryResponse {
  id: string;
  name: string;
  phone: bigint;
  followupDate?: string | null;
  message?: string | null;
  type: EnquiryType;
  status: EnquiryStatus;
  trainer_id: string | null;
  trainer_name?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to validate date format
const validateDateFormat = (dateStr: string): boolean => {
  const parsed = parse(dateStr, 'dd-MM-yyyy', new Date());
  return isValid(parsed);
};


// 1. AddEnquiry
export async function AddEnquiry(data: EnquiryInput): Promise<EnquiryResponse | Failed> {
  return safe(async () => {
    try {
      // Validate inputs
      if (!data.name || !data.phone || !data.type) {
        throw new UserError('Missing required fields');
      }

      const phone = requireIndianMobile(data.phone);
      await requireOwnTrainer(data.trainer_id);

      if (data.followupDate && !validateDateFormat(data.followupDate)) {
        throw new UserError('Invalid followup date format. Use dd-MM-yyyy');
      }

      const enquiry = await prisma.enquiry.create({
        data: {
          name: data.name,
          phone,
          followupDate: data.followupDate,
          message: data.message,
          type: data.type,
          trainer_id: data.trainer_id || null,
          ...(data.backdated && data.enquiryDate
            ? { createdAt: parse(data.enquiryDate, 'dd-MM-yyyy', new Date()) }
            : {}),
        },
      });
      // An old enquiry: nobody is welcomed or told about it.
      if (data.backdated) {
        return {
          ...enquiry,
          followupDate: enquiry.followupDate ?? undefined,
          message: enquiry.message ?? undefined,
        };
      }

      // The enquiry is saved either way; a WhatsApp problem must not lose it.
      await runEnquiryCreatedWorkflows(enquiry).catch((error) =>
        console.error('Failed to queue WhatsApp message for enquiry:', error)
      );
      await notifyTrainerOfEnquiry(enquiry).catch((error) =>
        console.error('Failed to notify trainer of enquiry:', error)
      );

      return {
        ...enquiry,
        followupDate: enquiry.followupDate ?? undefined,
        message: enquiry.message ?? undefined,
      };
    } catch (error:any) {
      throw error;
    }
  });
}

// 2. GetEnquiryById
export async function GetEnquiryById(id: string): Promise<EnquiryResponse | null> {
  try {
    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
    });

    if (!enquiry) {
      return null;
    }

    return {
      ...enquiry,
      followupDate: enquiry.followupDate ?? undefined,
      message: enquiry.message ?? undefined,
    };
  } catch (error:any) {
    throw error;
  }
}

// 3. GetAllEnquiry
export async function GetAllEnquiry(): Promise<EnquiryResponse[]> {
  try {
    const enquiries = await prisma.enquiry.findMany({
      orderBy: { createdAt: 'desc' },
      include: { trainer: { select: { name: true } } },
    });

    return enquiries.map(({ trainer, ...enquiry }) => ({
      ...enquiry,
      followupDate: enquiry.followupDate ?? undefined,
      message: enquiry.message ?? undefined,
      trainer_name: trainer?.name ?? null,
    }));
  } catch (error:any) {
    throw error;
  }
}

// 4. GetEnquiryByFollowupDate
export async function GetEnquiryByFollowupDate(date: string): Promise<EnquiryResponse[]> {
  try {
    if (!validateDateFormat(date)) {
      throw new UserError('Invalid date format. Use dd-MM-yyyy');
    }

    const enquiries = await prisma.enquiry.findMany({
      where: {
        followupDate: date,
      },
      orderBy: { createdAt: 'desc' },
    });

    return enquiries.map((enquiry) => ({
      ...enquiry,
      followupDate: enquiry.followupDate ?? undefined,
      message: enquiry.message ?? undefined,
    }));
  } catch (error:any) {
    throw error;
  }
}

// 5. DeleteEnquiry (owner only; the front desk marks enquiries as lost).
export async function DeleteEnquiry(id: string): Promise<void | Failed> {
  return safe(async () => {
    await requireOwner();
    await prisma.enquiry.delete({
      where: { id },
    });
  });
}

// 6. UpdateEnquiry: move it along the pipeline, hand it to a trainer, or
// push the follow-up date.
export async function UpdateEnquiry(
  id: string,
  data: { status?: EnquiryStatus; trainer_id?: string | null; followupDate?: string }
): Promise<void | Failed> {
  return safe(async () => {
    try {
      // Only these three fields are taken from the browser; anything else in
      // `data` (gym, nested trainer writes, dates) is ignored.
      const values: { status?: EnquiryStatus; trainer_id?: string | null; followupDate?: string } = {};
      if (data.status !== undefined) {
        if (!ENQUIRY_STATUSES.some((s) => s.value === data.status)) throw new UserError('Unknown enquiry status');
        values.status = data.status;
      }
      if (data.trainer_id !== undefined) {
        if (data.trainer_id !== null && typeof data.trainer_id !== 'string') throw new UserError('Trainer not found');
        await requireOwnTrainer(data.trainer_id);
        values.trainer_id = data.trainer_id || null;
      }
      if (data.followupDate !== undefined) {
        if (typeof data.followupDate !== 'string' || !validateDateFormat(data.followupDate)) {
          throw new UserError('Invalid followup date format. Use dd-MM-yyyy');
        }
        values.followupDate = data.followupDate;
      }
      const enquiry = await prisma.enquiry.update({ where: { id }, data: values });
      if (values.trainer_id) {
        await notifyTrainerOfEnquiry(enquiry).catch((error) =>
          console.error('Failed to notify trainer of enquiry:', error)
        );
      }
    } catch (error:any) {
      throw error;
    }
  });
}
