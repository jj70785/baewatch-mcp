/** A current eBay listing from the Browse API */
export interface ActiveListing {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  condition: string;
  conditionId: string;
  link: string;
  /** null = eBay didn't give a cost (calculated shipping with no buyer ZIP, or pickup only) */
  shippingCost: number | null;
  listingType: string; // "Buy It Now", "Auction", "Buy It Now / Best Offer", ...
  sellerFeedback: string | null; // e.g. "99.2% (1,234)"
  location: string | null;
}

export interface SearchResult {
  listings: ActiveListing[];
  /** Total matching listings on eBay (not just the ones returned) */
  total: number;
}

export interface PriceStats {
  average: number;
  lowest: number;
  highest: number;
  median: number;
  count: number;
}

export type ItemCondition = "New" | "Used" | "For Parts" | "All";

/** Map condition names to eBay condition IDs */
export const CONDITION_MAP: Record<string, string[]> = {
  New: ["1000", "1500"],
  Used: ["2010", "2020", "2030", "3000", "4000", "5000", "6000"],
  "For Parts": ["7000"],
  All: [],
};

export type SortOrder = "best_match" | "price_low" | "price_high" | "newly_listed" | "ending_soon";

export const SORT_MAP: Record<SortOrder, string | undefined> = {
  best_match: undefined,
  price_low: "price",
  price_high: "-price",
  newly_listed: "newlyListed",
  ending_soon: "endingSoonest",
};

export type BuyingOption = "buy_it_now" | "auction" | "all";

export interface EbayConfig {
  appId: string;
  certId: string;
  zip: string;
  environment: "production" | "sandbox";
}

export interface AppConfig {
  ebay: EbayConfig;
  defaults: {
    resultsLimit: number;
    marketplace: string;
  };
}

export interface ConfigStatus {
  configured: boolean;
  message: string;
  details: {
    configFile: string | null;
    hasAppId: boolean;
    hasCertId: boolean;
    zip: string | null;
    environment: string;
  };
}
