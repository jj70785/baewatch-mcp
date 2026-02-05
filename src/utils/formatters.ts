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
 * Format a price check comparison.
 */
export function formatPriceCheck(
  stats: PriceStats,
  cheapestActive: ActiveListing | null,
  askingPrice?: number
): string {
  let output = `## Price Check Summary\n\n`;
  output += `**Sold Price Data (recent):**\n`;
  output += `- Average sold price: ${formatPrice(stats.average)}\n`;
  output += `- Median sold price: ${formatPrice(stats.median)}\n`;
  output += `- Range: ${formatPrice(stats.lowest)} — ${formatPrice(stats.highest)}\n`;
  output += `- Total recent sales: ${stats.totalSales}\n\n`;

  if (cheapestActive) {
    const shipping = cheapestActive.shippingCost ?? 0;
    output += `**Cheapest Active Listing:**\n`;
    output += `- ${formatPrice(cheapestActive.price)} + ${formatPrice(shipping)} shipping = ${formatPrice(cheapestActive.price + shipping)} total\n`;
    output += `- ${cheapestActive.title}\n`;
    output += `- ${cheapestActive.link}\n\n`;
  }

  if (askingPrice !== undefined && stats.average > 0) {
    const diff = ((stats.average - askingPrice) / stats.average) * 100;
    if (diff > 0) {
      output += `**Deal Analysis:** Asking price of ${formatPrice(askingPrice)} is **${Math.round(diff)}% below** the average sold price. Looks like a good deal!\n`;
    } else if (diff < 0) {
      output += `**Deal Analysis:** Asking price of ${formatPrice(askingPrice)} is **${Math.round(Math.abs(diff))}% above** the average sold price. May want to negotiate.\n`;
    } else {
      output += `**Deal Analysis:** Asking price of ${formatPrice(askingPrice)} is right at the average sold price.\n`;
    }
  }

  return output;
}
