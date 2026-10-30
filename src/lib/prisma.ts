import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Tái sử dụng PrismaClient và Connection Pool trên Serverless để không phải kết nối lại từ đầu mỗi request
globalForPrisma.prisma = prisma;

