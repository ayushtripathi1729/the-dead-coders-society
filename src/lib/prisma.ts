import "server-only";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const retryablePrismaCodes = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (!retryablePrismaCodes.has(code) || attempt === attempts - 1) break;
      await sleep(150 * 2 ** attempt);
    }
  }
  throw lastError;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    transactionOptions: {
      maxWait: 10_000,
      timeout: 30_000,
    },
  }).$extends({
    query: {
      $allModels: {
        async $allOperations({ query, args }) {
          return withRetry(() => query(args));
        },
      },
    },
  }) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
