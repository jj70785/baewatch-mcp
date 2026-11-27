import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchActiveListings } from "../ebay/client.js";
import { formatActiveListings } from "../utils/formatters.js";

export function registerSearchActive(server: McpServer): void {
  server.tool(
    "search_active",
    "Search current eBay listings. Returns price, shipping, condition, format, seller feedback and a short link for each. Defaults to Buy It Now, best match.",
    {
      query: z.string().describe("Search term, e.g. 'iPhone 13 128GB unlocked'"),
      condition: z.enum(["New", "Used", "For Parts", "All"]).default("All").describe("Filter by item condition"),
      min_price: z.number().optional().describe("Minimum item price in USD"),
      max_price: z.number().optional().describe("Maximum item price in USD"),
      sort: z
        .enum(["best_match", "price_low", "price_high", "newly_listed", "ending_soon"])
        .default("best_match")
        .describe("Sort order. price_low sorts by price + shipping."),
      buying_option: z
        .enum(["buy_it_now", "auction", "all"])
        .default("buy_it_now")
        .describe("Listing format"),
      limit: z.number().min(1).max(50).default(10).describe("Number of results (max 50)"),
      zip: z.string().optional().describe("US ZIP for shipping quotes; defaults to the configured EBAY_ZIP"),
    },
    async ({ query, condition, min_price, max_price, sort, buying_option, limit, zip }) => {
      try {
        const { listings, total } = await searchActiveListings(query, {
          condition,
          minPrice: min_price,
          maxPrice: max_price,
          sort,
          buyingOption: buying_option,
          limit,
          zip,
        });
        return { content: [{ type: "text" as const, text: formatActiveListings(listings, total) }] };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: `Error searching listings: ${error.message}` }], isError: true };
      }
    }
  );
}
