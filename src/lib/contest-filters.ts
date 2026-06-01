import type { Prisma } from "@prisma/client";

export const RANKED_CONTEST_WHERE = {
  visibility: { not: "PRIVATE" as const },
  standingsFinalizedAt: { not: null },
} satisfies Prisma.ContestWhereInput;

export const PUBLIC_CONTEST_WHERE = {
  visibility: { not: "PRIVATE" as const },
} satisfies Prisma.ContestWhereInput;

export const NON_ARCHIVED_CONTEST_WHERE = {
  visibility: { not: "ARCHIVED" as const },
} satisfies Prisma.ContestWhereInput;

export const PRIVATE_CONTEST_WHERE = {
  visibility: "PRIVATE" as const,
} satisfies Prisma.ContestWhereInput;
