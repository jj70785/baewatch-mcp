import { loadConfig, checkConfigStatus } from "./config.js";
import { getAppToken, apiBase, resetToken } from "./auth.js";
import {
  ActiveListing,
  SearchResult,
  CONDITION_MAP,
  SORT_MAP,
  SortOrder,
  BuyingOption,
} from "./types.js";

export { checkConfigStatus };

/** GET a Browse API path with the app token and buyer-context headers. */
async function browseGet(pathAndQuery: string, zipOverride?: string): Promise<any> {
  const config = loadConfig();
  const zip = zipOverride || config.ebay.zip;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await getAppToken()}`,
    "X-EBAY-C-MARKETPLACE-ID": config.defaults.marketplace,
  };
  // With a buyer ZIP, eBay fills in calculated shipping instead of leaving it blank.
  if (zip) {
    headers["X-EBAY-C-ENDUSERCTX"] = `contextualLocation=${encodeURIComponent(
      `country=US,zip=${zip}`
    )}`;
  }

  let res: Response;
  try {
    res = await fetch(`${apiBase()}/buy/browse/v1${pathAndQuery}`, { headers });
  } catch (e: any) {
    throw new Error(`Cannot reach eBay (${e.cause?.code || e.message}). Check the internet connection.`);
  }
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) resetToken();
    const msg = body.errors?.map((e: any) => e.longMessage || e.message).join("; ");
    throw new Error(`eBay API error ${res.status}: ${msg || JSON.stringify(body)}`);
  }
  return body;
}

/** eBay item URLs carry ~500 chars of tracking params; the bare /itm/<id> link works the same. */
function legacyId(item: any): string {
  if (item.legacyItemId) return String(item.legacyItemId);
  const m = /\|(\d+)\|/.exec(item.itemId || "") || /\/itm\/(\d+)/.exec(item.itemWebUrl || "");
  return m ? m[1] : "";
}

function listingType(buyingOptions: string[] = []): string {
  const parts: string[] = [];
  if (buyingOptions.includes("FIXED_PRICE")) parts.push("Buy It Now");
  if (buyingOptions.includes("AUCTION")) parts.push("Auction");
  if (buyingOptions.includes("BEST_OFFER")) parts.push("Best Offer");
  return parts.join(" / ") || "Unknown";
}

function feedback(seller: any): string | null {
  if (!seller?.feedbackPercentage) return null;
  return `${seller.feedbackPercentage}% (${Number(seller.feedbackScore ?? 0).toLocaleString("en-US")})`;
}

function mapSummary(item: any): ActiveListing {
  const id = legacyId(item);
  const price = item.price ?? item.currentBidPrice;
  const ship = item.shippingOptions?.[0]?.shippingCost?.value;
  const loc = item.itemLocation;
  return {
    itemId: id,
    title: item.title || "Unknown",
    price: parseFloat(price?.value || "0"),
    currency: price?.currency || "USD",
    condition: item.condition || "Unknown",
    conditionId: String(item.conditionId || ""),
    link: id ? `https://www.ebay.com/itm/${id}` : item.itemWebUrl || "",
    shippingCost: ship !== undefined ? parseFloat(ship) : null,
    listingType: listingType(item.buyingOptions),
    sellerFeedback: feedback(item.seller),
    location: loc ? [loc.city, loc.stateOrProvince, loc.postalCode, loc.country].filter(Boolean).join(", ") : null,
  };
}

export interface SearchOptions {
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
  sort?: SortOrder;
  buyingOption?: BuyingOption;
  zip?: string;
}

/** Search current eBay listings (Browse API item_summary/search). */
export async function searchActiveListings(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
  const filters: string[] = [];

  const conditionIds = CONDITION_MAP[opts.condition || "All"] || [];
  if (conditionIds.length > 0) filters.push(`conditionIds:{${conditionIds.join("|")}}`);

  if (opts.minPrice !== undefined || opts.maxPrice !== undefined) {
    filters.push(`price:[${opts.minPrice ?? ""}..${opts.maxPrice ?? ""}]`, "priceCurrency:USD");
  }

  const buying = opts.buyingOption || "buy_it_now";
  if (buying === "buy_it_now") filters.push("buyingOptions:{FIXED_PRICE}");
  else if (buying === "auction") filters.push("buyingOptions:{AUCTION}");
  else filters.push("buyingOptions:{FIXED_PRICE|AUCTION}");

  const params = new URLSearchParams({
    q: query,
    limit: String(Math.min(Math.max(opts.limit ?? 10, 1), 200)),
    filter: filters.join(","),
  });
  const sort = SORT_MAP[opts.sort || "best_match"];
  if (sort) params.set("sort", sort);

  const body = await browseGet(`/item_summary/search?${params}`, opts.zip);
  return {
    listings: (body.itemSummaries || []).map(mapSummary),
    total: body.total ?? 0,
  };
}

/** Full details for one listing, by its numeric eBay item number or a listing URL. */
export async function getItemDetails(idOrUrl: string, zip?: string): Promise<any> {
  const m = /(\d{9,})/.exec(idOrUrl);
  if (!m) throw new Error(`"${idOrUrl}" doesn't look like an eBay item number or listing URL.`);
  try {
    return await browseGet(`/item/get_item_by_legacy_id?legacy_item_id=${m[1]}`, zip);
  } catch (e: any) {
    // Multi-variation listings (sizes/colors) need a specific variation; return the group instead.
    if (/item group|11006/i.test(e.message)) {
      return browseGet(`/item/get_items_by_item_group?item_group_id=${m[1]}`, zip);
    }
    throw e;
  }
}

/** Verify the keys by minting a token and running a tiny search. */
export async function testConnection(): Promise<{ success: boolean; message: string }> {
  const status = checkConfigStatus();
  if (!status.configured) return { success: false, message: status.message };
  try {
    resetToken();
    await getAppToken();
    const r = await searchActiveListings("test", { limit: 1 });
    return {
      success: true,
      message: `Connected. Token OK and Browse API search works (${r.total.toLocaleString("en-US")} results for "test").`,
    };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}
