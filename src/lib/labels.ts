import type { ContestStatus } from "@/lib/types";

export function yearLabel(year: number) {
  return `${year}${year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th"} Year`;
}

export function getContestLabel(status: ContestStatus) {
  if (status === "UPCOMING") return "TO BE CONDUCTED";
  if (status === "LIVE") return "LIVE NOW";
  return "COMPLETED";
}
