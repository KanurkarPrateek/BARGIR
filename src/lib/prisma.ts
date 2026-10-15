// Dates ("today", the daytime sending window, attendance) follow the gym's
// local time. Hosts like Vercel run in UTC and reserve the TZ setting, so it
// is set here, before any date is computed.
process.env.TZ = process.env.APP_TIMEZONE ?? 'Asia/Kolkata'

import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { 
    prisma: PrismaClient
}

// The unscoped client: sees every gym's rows. Gym-facing code must use
// src/lib/tenant.ts instead. Do not add the Accelerate extension here: it
// replaces the read methods and skips the per-gym filter that tenant.ts adds.
const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
