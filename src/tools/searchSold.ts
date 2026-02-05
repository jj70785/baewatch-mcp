import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchSoldListings } from "../ebay/client.js";
import { calculateStats } from "../utils/stats.js";
import { formatSoldListings } from "../utils/formatters.js";

export function registerSearchSold(server: McpServer): void {
  server.tool(
    "search_sold",
    "Search eBay for recently sold/completed listings to research fair market prices. Returns sold items with prices, conditions, dates, and summary statistics.",
    {
      query: z.string().describe("Search term, e.g. 'Dell Latitude 7420'"),
      condition: z
        .enum(["New", "Used", "For Parts", "All"])
        .default("All")
        .describe("Filter by item condition"),
      limit: z
        .number()
        .min(1)
        .max(50)
        .default(10)
        .describe("Number of results to return (max 50)"),
    },
    async ({ query, condition, limit }) => {
      try {
        const listings = await searchSoldListings(query, condition, limit);
        const prices = listings.map((l) => l.price);
        const stats = calculateStats(prices);
        const formatted = formatSoldListings(listings, stats);

        return {
          content: [{ type: "text" as const, text: formatted }],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching sold listings: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
