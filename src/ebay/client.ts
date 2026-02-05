import * as fs from "fs";
import * as path from "path";
import { AppConfig, SoldListing, ActiveListing, CONDITION_MAP } from "./types.js";
import { getEbayApi } from "./auth.js";

const CONFIG_PATH = path.join(__dirname, "../../config/config.json");

/**
 * Load the config file from disk.
 * Throws a helpful error if the file doesn't exist or is invalid.
 */
export function loadConfig(): AppConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      "Config file not found! Copy config/config.example.json to config/config.json and fill in your eBay API credentials."
    );
  }

  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");

  try {
    const config = JSON.parse(raw) as AppConfig;

    if (!config.ebay?.appId || config.ebay.appId === "YOUR_APP_ID_HERE") {
      throw new Error(
        "eBay credentials not configured. Edit config/config.json with your real API keys."
      );
    }

    return config;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error("config/config.json contains invalid JSON. Please check the format.");
    }
    throw err;
  }
}

/**
 * Search eBay for completed/sold listings.
 */
export async function searchSoldListings(
  query: string,
  condition: string = "All",
  limit: number = 10
): Promise<SoldListing[]> {
  const api = getEbayApi();

  const conditionIds = CONDITION_MAP[condition] || [];

  try {
    // Use the Finding API for completed listings
    const filters: Array<{ name: string; value: string }> = [
      { name: "SoldItemsOnly", value: "true" },
    ];

    if (conditionIds.length > 0) {
      filters.push({ name: "Condition", value: conditionIds.join(",") });
    }

    const response = await api.finding.findCompletedItems({
      keywords: query,
      itemFilter: filters,
      paginationInput: {
        entriesPerPage: Math.min(limit, 50),
        pageNumber: 1,
      },
      sortOrder: "EndTimeSoonest",
    });

    const items = response?.searchResult?.item || [];

    return items.map((item: any) => ({
      title: item.title?.[0] || "Unknown",
      price: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || "0"),
      currency: item.sellingStatus?.[0]?.currentPrice?.[0]?.["@currencyId"] || "USD",
      condition: item.condition?.[0]?.conditionDisplayName?.[0] || "Unknown",
      link: item.viewItemURL?.[0] || "",
      dateSold: item.listingInfo?.[0]?.endTime?.[0] || "Unknown",
    }));
  } catch (error: any) {
    throw new Error(`eBay sold search failed: ${error.message || error}`);
  }
}

/**
 * Search eBay for active (current) listings.
 */
export async function searchActiveListings(
  query: string,
  condition: string = "All",
  maxPrice?: number,
  limit: number = 10
): Promise<ActiveListing[]> {
  const api = getEbayApi();

  try {
    // Use the Browse API for active listings
    const filterParts: string[] = [];

    const conditionIds = CONDITION_MAP[condition] || [];
    if (conditionIds.length > 0) {
      filterParts.push(`conditionIds:{${conditionIds.join("|")}}`);
    }

    if (maxPrice !== undefined) {
      filterParts.push(`price:[..${maxPrice}]`);
      filterParts.push("priceCurrency:USD");
    }

    // Prefer Buy It Now listings for flipping
    filterParts.push("buyingOptions:{FIXED_PRICE}");

    const params: any = {
      q: query,
      limit: Math.min(limit, 50),
      sort: "price",
    };

    if (filterParts.length > 0) {
      params.filter = filterParts.join(",");
    }

    const response = await api.buy.browse.search(params);

    const items = response?.itemSummaries || [];

    return items.map((item: any) => ({
      title: item.title || "Unknown",
      price: parseFloat(item.price?.value || "0"),
      currency: item.price?.currency || "USD",
      condition: item.condition || "Unknown",
      link: item.itemWebUrl || "",
      shippingCost: item.shippingOptions?.[0]?.shippingCost?.value
        ? parseFloat(item.shippingOptions[0].shippingCost.value)
        : null,
      listingType: item.buyingOptions?.includes("FIXED_PRICE") ? "Buy It Now" : "Auction",
    }));
  } catch (error: any) {
    throw new Error(`eBay active search failed: ${error.message || error}`);
  }
}
