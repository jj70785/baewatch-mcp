import { PriceStats } from "../ebay/types.js";

/**
 * Calculate price statistics from an array of prices.
 */
export function calculateStats(prices: number[]): PriceStats {
  if (prices.length === 0) {
    return {
      average: 0,
      lowest: 0,
      highest: 0,
      median: 0,
      totalSales: 0,
    };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const average = sum / sorted.length;

  let median: number;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    median = (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    median = sorted[mid];
  }

  return {
    average: Math.round(average * 100) / 100,
    lowest: sorted[0],
    highest: sorted[sorted.length - 1],
    median: Math.round(median * 100) / 100,
    totalSales: sorted.length,
  };
}
