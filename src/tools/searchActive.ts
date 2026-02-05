import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchActiveListings } from "../ebay/client.js";
import { formatActiveListings } from "../utils/formatters.js";

export function registerSearchActive(server: McpServer): void {
  server.tool(
    "search_active",
    "Search eBay for current active listings. Focuses on Buy It Now listings and includes shipping costs. Great for finding deals to flip.",
    {
      query: z.string().describe("Search term, e.g. 'iPhone 13 128GB'"),
      condition: z
        .enum(["New", "Used", "For Parts", "All"])
        .default("All")
        .describe("Filter by item condition"),
      max_price: z
        .number()
        .optional()
        .describe("Maximum price filter in USD"),
      limit: z
        .number()
        .min(1)
        .max(50)
        .default(10)
        .describe("Number of results to return (max 50)"),
    },
    async ({ query, condition, max_price, limit }) => {
      try {
        const listings = await searchActiveListings(query, condition, max_price, limit);
        const formatted = formatActiveListings(listings);

        return {
          content: [{ type: "text" as const, text: formatted }],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching active listings: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
