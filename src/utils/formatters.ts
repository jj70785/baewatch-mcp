import { ActiveListing, PriceStats } from "../ebay/types.js";

export function formatPrice(amount: number, currency: string = "USD"): string {
  return currency === "USD" ? `$${amount.toFixed(2)}` : `${amount.toFixed(2)} ${currency}`;
}

function shippingText(item: ActiveListing): string {
  if (item.shippingCost === null) return "shipping not quoted";
  if (item.shippingCost === 0) return "free shipping";
  return `+ ${formatPrice(item.shippingCost)} ship = ${formatPrice(item.price + item.shippingCost)}`;
}

export function listingLine(item: ActiveListing): string {
  const seller = item.sellerFeedback ? ` · seller ${item.sellerFeedback}` : "";
  return (
    `- **${formatPrice(item.price, item.currency)}** ${shippingText(item)} — ${item.title} ` +
    `(${item.condition}) [${item.listingType}]${seller}\n  ${item.link}\n`
  );
}

export function formatActiveListings(listings: ActiveListing[], total: number): string {
  if (listings.length === 0) return "No active listings found for this search. Try broader terms.";
  let out = `## Active Listings (showing ${listings.length} of ${total.toLocaleString("en-US")})\n\n`;
  for (const item of listings) out += listingLine(item);
  return out;
}

export interface PriceCheckReport {
  query: string;
  stats: PriceStats;
  totalOnEbay: number;
  includesShipping: boolean;
  excludedJunk: number;
  excludedNoShipping: number;
  excludedOutliers: number;
  cheapest: ActiveListing[];
  askingPrice?: number;
  askingRank?: number; // fraction of comps cheaper than the asking price
}

export function formatPriceCheck(r: PriceCheckReport): string {
  const basis = r.includesShipping ? "price + shipping" : "item price only (shipping not quoted; set EBAY_ZIP)";
  let out = `## Price Check: ${r.query}\n\n`;
  out += `**Current Buy It Now asking prices** — ${r.stats.count} comps (${basis}), `;
  out += `${r.totalOnEbay.toLocaleString("en-US")} matching listings on eBay\n`;
  out += `- Median: ${formatPrice(r.stats.median)}\n`;
  out += `- Average: ${formatPrice(r.stats.average)}\n`;
  out += `- Range: ${formatPrice(r.stats.lowest)} – ${formatPrice(r.stats.highest)}\n`;
  const dropped: string[] = [];
  if (r.excludedJunk) dropped.push(`${r.excludedJunk} parts/broken/box-only`);
  if (r.excludedNoShipping) dropped.push(`${r.excludedNoShipping} with no shipping quote (pickup only)`);
  if (r.excludedOutliers) dropped.push(`${r.excludedOutliers} price outliers`);
  if (dropped.length) out += `- Excluded: ${dropped.join(", ")}\n`;

  out += `\n**Cheapest comps:**\n`;
  for (const item of r.cheapest) out += listingLine(item);

  if (r.askingPrice !== undefined && r.stats.median > 0) {
    const diff = ((r.stats.median - r.askingPrice) / r.stats.median) * 100;
    const pct = Math.round((r.askingRank ?? 0) * 100);
    const rel =
      Math.abs(diff) < 1
        ? "right at the median"
        : `${Math.round(Math.abs(diff))}% ${diff > 0 ? "below" : "above"} the median`;
    out += `\n**Deal check:** ${formatPrice(r.askingPrice)} is ${rel}; ${pct}% of comps are cheaper.\n`;
  }

  out +=
    `\n_Note: these are asking prices, not sold prices. Overpriced listings sit unsold, so ` +
    `real sale prices usually land below the median. Check the comps match the exact model/specs._\n`;
  return out;
}

/** Compact summary of a Browse API getItem response. */
export function formatItemDetails(item: any): string {
  // get_items_by_item_group returns { items: [...] }: summarize the variations.
  if (Array.isArray(item.items)) {
    let out = `## Multi-variation listing (${item.items.length} variations)\n\n`;
    for (const v of item.items.slice(0, 25)) {
      const aspects = (v.localizedAspects || []).map((a: any) => `${a.name}: ${a.value}`).slice(0, 3).join(", ");
      out += `- ${formatPrice(parseFloat(v.price?.value || "0"))} — ${aspects || v.title}\n`;
    }
    return out;
  }

  const price = item.price ?? item.currentBidPrice;
  const seller = item.seller || {};
  const loc = item.itemLocation || {};
  const ship = item.shippingOptions?.[0];
  const ret = item.returnTerms;

  let out = `## ${item.title}\n\n`;
  out += `- **Price:** ${price ? formatPrice(parseFloat(price.value), price.currency) : "n/a"}`;
  if (item.bidCount !== undefined) out += ` (${item.bidCount} bids)`;
  out += `\n- **Format:** ${listingType(item.buyingOptions)}`;
  if (item.itemEndDate) out += `, ends ${new Date(item.itemEndDate).toLocaleString("en-US")}`;
  out += `\n- **Condition:** ${item.condition || "Unknown"}`;
  if (item.conditionDescription) out += ` — "${item.conditionDescription}"`;
  out += `\n- **Seller:** ${seller.username || "?"}, ${seller.feedbackPercentage ?? "?"}% positive (${seller.feedbackScore ?? "?"})`;
  out += `\n- **Ships from:** ${[loc.city, loc.stateOrProvince, loc.country].filter(Boolean).join(", ") || "?"}`;
  if (ship) {
    const cost = ship.shippingCost?.value;
    out += `\n- **Shipping:** ${cost === undefined ? "not quoted" : cost === "0.00" ? "free" : formatPrice(parseFloat(cost))}`;
    if (ship.shippingServiceCode) out += ` via ${ship.shippingServiceCode}`;
  }
  if (ret) {
    out += `\n- **Returns:** ${ret.returnsAccepted ? `${ret.returnPeriod?.value ?? "?"} ${String(ret.returnPeriod?.unit ?? "").toLowerCase()}` : "not accepted"}`;
  }
  const qty = item.estimatedAvailabilities?.[0];
  if (qty?.estimatedSoldQuantity) out += `\n- **Sold so far:** ${qty.estimatedSoldQuantity}`;

  const aspects = (item.localizedAspects || []).slice(0, 20);
  if (aspects.length) {
    out += `\n\n**Item specifics:**\n`;
    for (const a of aspects) out += `- ${a.name}: ${a.value}\n`;
  }
  if (item.shortDescription) out += `\n**Description:** ${String(item.shortDescription).slice(0, 600)}\n`;
  out += `\n${item.legacyItemId ? `https://www.ebay.com/itm/${item.legacyItemId}` : item.itemWebUrl}\n`;
  return out;
}

function listingType(opts: string[] = []): string {
  return (
    [
      opts.includes("FIXED_PRICE") && "Buy It Now",
      opts.includes("AUCTION") && "Auction",
      opts.includes("BEST_OFFER") && "Best Offer",
    ]
      .filter(Boolean)
      .join(" / ") || "Unknown"
  );
}
