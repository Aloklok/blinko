import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';

const prismaGlobal = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const connectionString = `${process.env.DATABASE_URL}`;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma: PrismaClient =
  prismaGlobal.prisma ??
  new PrismaClient({
    // @ts-ignore - adapter is valid in Prisma 7
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  prismaGlobal.prisma = prisma;
}