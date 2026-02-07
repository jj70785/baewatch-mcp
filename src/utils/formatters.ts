import { SoldListing, ActiveListing, PriceStats } from "../ebay/types.js";

/**
 * Format a price with currency symbol.
 */
export function formatPrice(amount: number, currency: string = "USD"): string {
  if (currency === "USD") {
    return `$${amount.toFixed(2)}`;
  }
  return `${amount.toFixed(2)} ${currency}`;
}

/**
 * Format sold listings into a readable string.
 */
export function formatSoldListings(listings: SoldListing[], stats: PriceStats): string {
  if (listings.length === 0) {
    return "No sold listings found for this search.";
  }

  let output = `## Sold Listings (${stats.totalSales} results)\n\n`;
  output += `**Price Summary:**\n`;
  output += `- Average: ${formatPrice(stats.average)}\n`;
  output += `- Median: ${formatPrice(stats.median)}\n`;
  output += `- Lowest: ${formatPrice(stats.lowest)}\n`;
  output += `- Highest: ${formatPrice(stats.highest)}\n\n`;
  output += `**Recent Sales:**\n`;

  for (const item of listings) {
    const date = item.dateSold !== "Unknown"
      ? new Date(item.dateSold).toLocaleDateString()
      : "Unknown date";
    output += `- **${formatPrice(item.price)}** — ${item.title} (${item.condition}) — Sold ${date}\n`;
    output += `  ${item.link}\n`;
  }

  return output;
}

/**
 * Format active listings into a readable string.
 */
export function formatActiveListings(listings: ActiveListing[]): string {
  if (listings.length === 0) {
    return "No active listings found for this search.";
  }

  let output = `## Active Listings (${listings.length} results)\n\n`;

  for (const item of listings) {
    const shipping =
      item.shippingCost === null
        ? "shipping TBD"
        : item.shippingCost === 0
        ? "free shipping"
        : `+ ${formatPrice(item.shippingCost)} shipping`;

    const total =
      item.shippingCost !== null
        ? ` (${formatPrice(item.price + item.shippingCost)} total)`
        : "";

    output += `- **${formatPrice(item.price)}** ${shipping}${total} — ${item.title} (${item.condition}) [${item.listingType}]\n`;
    output += `  ${item.link}\n`;
  }

  return output;
}

/**
 * Format a price check summary based on active listings.
 */
export function formatPriceCheck(
  stats: PriceStats,
  cheapest: ActiveListing,
  askingPrice?: number
): string {
  let output = `## Price Check Summary\n\n`;
  output += `**Market Data (${stats.totalSales} active listings, price + shipping):**\n`;
  output += `- Average: ${formatPrice(stats.average)}\n`;
  output += `- Median: ${formatPrice(stats.median)}\n`;
  output += `- Lowest: ${formatPrice(stats.lowest)}\n`;
  output += `- Highest: ${formatPrice(stats.highest)}\n\n`;

  const shipping = cheapest.shippingCost ?? 0;
  const total = cheapest.price + shipping;
  output += `**Cheapest Listing:**\n`;
  output += `- ${formatPrice(cheapest.price)} + ${formatPrice(shipping)} shipping = ${formatPrice(total)} total\n`;
  output += `- ${cheapest.title}\n`;
  output += `- ${cheapest.link}\n\n`;

  if (askingPrice !== undefined && stats.average > 0) {
    const diff = ((stats.average - askingPrice) / stats.average) * 100;
    if (diff > 0) {
      output += `**Deal Analysis:** Asking price of ${formatPrice(askingPrice)} is **${Math.round(diff)}% below** market average. Looks like a good deal!\n`;
    } else if (diff < 0) {
      output += `**Deal Analysis:** Asking price of ${formatPrice(askingPrice)} is **${Math.round(Math.abs(diff))}% above** market average. May want to negotiate.\n`;
    } else {
      output += `**Deal Analysis:** Asking price of ${formatPrice(askingPrice)} is right at market average.\n`;
    }
  }

  return output;
}
