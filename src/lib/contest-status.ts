import type { ContestStatus, ContestStatusOverride } from "@/lib/types";

export function automaticContestStatusAt(startTime: Date | string, durationMinutes: number, now = new Date()): ContestStatus {
  const startsAt = new Date(startTime).getTime();
  const endsAt = startsAt + durationMinutes * 60_000;
  const currentTime = now.getTime();

  if (currentTime < startsAt) return "UPCOMING";
  if (currentTime < endsAt) return "LIVE";
  return "COMPLETED";
}

export function contestStatusAt(startTime: Date | string, durationMinutes: number, statusOverride: ContestStatusOverride = "AUTO", now = new Date()): ContestStatus {
  if (statusOverride === "FORCE_UPCOMING") return "UPCOMING";
  if (statusOverride === "FORCE_LIVE") return "LIVE";
  if (statusOverride === "FORCE_COMPLETED") return "COMPLETED";
  return automaticContestStatusAt(startTime, durationMinutes, now);
}

export function contestEndTime(startTime: Date | string, durationMinutes: number) {
  return new Date(new Date(startTime).getTime() + durationMinutes * 60_000);
}
