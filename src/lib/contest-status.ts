import type { ContestStatus } from "@/lib/types";

export function contestStatusAt(startTime: Date | string, durationMinutes: number, now = new Date()): ContestStatus {
  const startsAt = new Date(startTime).getTime();
  const endsAt = startsAt + durationMinutes * 60_000;
  const currentTime = now.getTime();

  if (currentTime < startsAt) return "UPCOMING";
  if (currentTime < endsAt) return "LIVE";
  return "COMPLETED";
}
