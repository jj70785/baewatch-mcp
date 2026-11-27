import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchActiveListings } from "../ebay/client.js";
import { calculateStats, removeOutliers, percentileRank } from "../utils/stats.js";
import { formatPriceCheck } from "../utils/formatters.js";
import { ActiveListing } from "../ebay/types.js";

// Listings that aren't a working version of the item and wreck the comps.
const JUNK = /\b(for parts|parts only|not working|non[- ]?working|broken|cracked screen|box only|empty box|read description|as[- ]is)\b/i;

export function registerPriceCheck(server: McpServer): void {
  server.tool(
    "price_check",
    "Market price lookup for flipping/buying decisions. Pulls up to 100 current Buy It Now listings, drops parts/broken listings and price outliers, and reports median/average/range plus the cheapest comps. Pass asking_price to see where a seller's price falls. Based on asking prices (eBay's public API has no sold-price data).",
    {
      query: z.string().describe("The item to research — be specific, e.g. 'Dell Latitude 7420 i7 16GB'"),
      asking_price: z.number().optional().describe("Price someone is asking (e.g. on Facebook Marketplace), in USD"),
      condition: z
        .enum(["New", "Used", "For Parts", "All"])
        .default("All")
        .describe("Restrict comps to a condition. 'All' still excludes for-parts listings."),
      zip: z.string().optional().describe("US ZIP for shipping quotes; defaults to the configured EBAY_ZIP"),
    },
    async ({ query, asking_price, condition, zip }) => {
      try {
        const { listings, total } = await searchActiveListings(query, { condition, limit: 100, zip });
        if (listings.length === 0) {
          return { content: [{ type: "text" as const, text: `No active listings found for "${query}". Try broader terms.` }] };
        }

        const wantParts = condition === "For Parts";
        const clean = wantParts ? listings : listings.filter((l) => l.conditionId !== "7000" && !JUNK.test(l.title));
        const excludedJunk = listings.length - clean.length;

        // Only fold shipping in when eBay quoted it for nearly everything; otherwise
        // free-shipping listings would look artificially expensive next to unquoted ones.
        const quoted = clean.filter((l) => l.shippingCost !== null).length;
        const includesShipping = clean.length > 0 && quoted / clean.length >= 0.8;
        const value = (l: ActiveListing) => l.price + (includesShipping ? l.shippingCost ?? 0 : 0);
        // Unquoted listings (usually local pickup only) can't be compared on total cost.
        const comps = includesShipping ? clean.filter((l) => l.shippingCost !== null) : clean;

        const { kept, removed } = removeOutliers(comps, value);
        if (kept.length === 0) {
          return { content: [{ type: "text" as const, text: `All ${listings.length} results for "${query}" looked like parts/broken listings.` }] };
        }
        const values = kept.map(value);

        const text = formatPriceCheck({
          query,
          stats: calculateStats(values),
          totalOnEbay: total,
          includesShipping,
          excludedJunk,
          excludedNoShipping: clean.length - comps.length,
          excludedOutliers: removed.length,
          cheapest: [...kept].sort((a, b) => value(a) - value(b)).slice(0, 3),
          askingPrice: asking_price,
          askingRank: asking_price !== undefined ? percentileRank(values, asking_price) : undefined,
        });
        return { content: [{ type: "text" as const, text }] };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: `Error during price check: ${error.message}` }], isError: true };
      }
    }
  );
}
