/** Represents a single eBay listing (sold or active) */
export interface EbayListing {
  title: string;
  price: number;
  currency: string;
  condition: string;
  link: string;
  imageUrl?: string;
}

/** A sold listing includes the date it sold */
export interface SoldListing extends EbayListing {
  dateSold: string;
}

/** An active listing includes shipping cost and listing type */
export interface ActiveListing extends EbayListing {
  shippingCost: number | null;
  listingType: string; // "Buy It Now", "Auction", etc.
}

/** Summary statistics for a set of sold listings */
export interface PriceStats {
  average: number;
  lowest: number;
  highest: number;
  median: number;
  totalSales: number;
}

/** Item condition filter options */
export type ItemCondition = "New" | "Used" | "For Parts" | "All";

/** Map condition names to eBay condition IDs */
export const CONDITION_MAP: Record<string, string[]> = {
  New: ["1000"],
  Used: ["3000", "4000", "5000", "6000"],
  "For Parts": ["7000"],
  All: [],
};

/** eBay API configuration */
export interface EbayConfig {
  appId: string;
  certId: string;
  devId: string;
  refreshToken: string;
  environment: "production" | "sandbox";
}

/** Full application config */
export interface AppConfig {
  ebay: EbayConfig;
  defaults: {
    resultsLimit: number;
    marketplace: string;
  };
}
