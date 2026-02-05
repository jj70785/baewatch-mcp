import * as fs from "fs";
import * as path from "path";
import { AppConfig, ConfigStatus, SoldListing, ActiveListing, CONDITION_MAP } from "./types.js";
import { getEbayApi } from "./auth.js";

const CONFIG_PATH = path.join(__dirname, "../../config/config.json");

/**
 * Check if eBay credentials are configured without throwing.
 * Returns a status object with details about what's missing.
 */
export function checkConfigStatus(): ConfigStatus {
  const details = {
    configFileExists: false,
    hasAppId: false,
    hasCertId: false,
    hasDevId: false,
    hasRefreshToken: false,
    environment: null as string | null,
  };

  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      configured: false,
      message:
        "Config file not found. Copy config/config.example.json to config/config.json and fill in your eBay API credentials.",
      details,
    };
  }

  details.configFileExists = true;

  let config: AppConfig;
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    config = JSON.parse(raw) as AppConfig;
  } catch {
    return {
      configured: false,
      message: "config/config.json contains invalid JSON. Please check the format.",
      details,
    };
  }

  const placeholder = (val: string | undefined) =>
    !val || val.startsWith("YOUR_") || val.trim() === "";

  details.hasAppId = !placeholder(config.ebay?.appId);
  details.hasCertId = !placeholder(config.ebay?.certId);
  details.hasDevId = !placeholder(config.ebay?.devId);
  details.hasRefreshToken = !placeholder(config.ebay?.refreshToken);
  details.environment = config.ebay?.environment || null;

  const missing: string[] = [];
  if (!details.hasAppId) missing.push("appId");
  if (!details.hasCertId) missing.push("certId");
  if (!details.hasDevId) missing.push("devId");
  if (!details.hasRefreshToken) missing.push("refreshToken");

  if (missing.length > 0) {
    return {
      configured: false,
      message: `eBay credentials incomplete. Missing: ${missing.join(", ")}. Edit config/config.json with your real API keys.`,
      details,
    };
  }

  return {
    configured: true,
    message: "eBay credentials are configured and ready.",
    details,
  };
}

/**
 * Load the config file from disk.
 * Throws a helpful error if the file doesn't exist or is invalid.
 */
export function loadConfig(): AppConfig {
  const status = checkConfigStatus();

  if (!status.configured) {
    throw new Error(status.message);
  }

  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as AppConfig;
}

/**
 * Test the eBay API connection by requesting a client credentials token.
 * This verifies that appId and certId are valid without needing a user token.
 */
export async function testConnection(): Promise<{ success: boolean; message: string }> {
  const status = checkConfigStatus();

  if (!status.configured) {
    return { success: false, message: status.message };
  }

  try {
    const api = getEbayApi();

    // Try to get an application access token (client credentials grant).
    // This only requires appId + certId, not a user refresh token.
    const token = await api.OAuth2.getAccessToken();

    if (token) {
      return {
        success: true,
        message: "Connected to eBay API successfully! Your credentials are valid.",
      };
    }

    return {
      success: false,
      message: "eBay returned an empty token. Double-check your appId and certId.",
    };
  } catch (error: any) {
    const msg = error.message || String(error);

    if (msg.includes("invalid_client") || msg.includes("Unauthorized")) {
      return {
        success: false,
        message:
          "Invalid credentials. Double-check your appId (Client ID) and certId (Client Secret) in config/config.json.",
      };
    }

    if (msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED")) {
      return {
        success: false,
        message: "Cannot reach eBay servers. Check your internet connection or try again later.",
      };
    }

    return {
      success: false,
      message: `Connection failed: ${msg}`,
    };
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
