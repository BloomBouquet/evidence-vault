import { z } from "zod";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function dateOnlyToUtcDay(value: string): number {
  if (!DATE_ONLY_RE.test(value)) throw new Error("invalid_date_only");
  const [year, month, day] = value.split("-").map(Number);
  const ms = Date.UTC(year, month - 1, day);
  const parsed = new Date(ms);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("invalid_date_only");
  }
  return Math.floor(ms / DAY_MS);
}

export function addDays(value: string, offset: number): string {
  if (!Number.isInteger(offset)) throw new Error("invalid_day_offset");
  const utcDay = dateOnlyToUtcDay(value) + offset;
  return new Date(utcDay * DAY_MS).toISOString().slice(0, 10);
}

export const dateOnlySchema = z.string().refine((value) => {
  try {
    dateOnlyToUtcDay(value);
    return true;
  } catch {
    return false;
  }
}, "날짜 형식이 올바르지 않습니다.");
