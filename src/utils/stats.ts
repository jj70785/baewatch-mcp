import { PriceStats } from "../ebay/types.js";

const round = (n: number) => Math.round(n * 100) / 100;

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function calculateStats(prices: number[]): PriceStats {
  if (prices.length === 0) return { average: 0, lowest: 0, highest: 0, median: 0, count: 0 };
  const sorted = [...prices].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    average: round(sum / sorted.length),
    lowest: sorted[0],
    highest: sorted[sorted.length - 1],
    median: round(quantile(sorted, 0.5)),
    count: sorted.length,
  };
}

/**
 * Drop outliers with the 1.5×IQR rule (the "whiskers" on a box plot).
 * Catches the $5 "box only" listings and the $2,000 "lot of 10" listings that
 * drag an average around. Needs a handful of points to be meaningful.
 */
export function removeOutliers<T>(items: T[], value: (t: T) => number): { kept: T[]; removed: T[] } {
  if (items.length < 6) return { kept: items, removed: [] };
  const sorted = items.map(value).sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const kept: T[] = [];
  const removed: T[] = [];
  for (const it of items) (value(it) >= lo && value(it) <= hi ? kept : removed).push(it);
  return { kept, removed };
}

/** Fraction of values strictly below x (0..1). */
export function percentileRank(values: number[], x: number): number {
  if (values.length === 0) return 0;
  return values.filter((v) => v < x).length / values.length;
}
