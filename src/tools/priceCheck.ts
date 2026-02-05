import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchSoldListings, searchActiveListings } from "../ebay/client.js";
import { calculateStats } from "../utils/stats.js";
import { formatPriceCheck } from "../utils/formatters.js";

export function registerPriceCheck(server: McpServer): void {
  server.tool(
    "price_check",
    "All-in-one price check tool. Searches both sold and active eBay listings, provides market price summary, and optionally compares against a seller's asking price to determine if it's a good deal.",
    {
      query: z.string().describe("The item to research, e.g. 'Nintendo Switch OLED'"),
      asking_price: z
        .number()
        .optional()
        .describe("What the seller is asking, for comparison against market value"),
    },
    async ({ query, asking_price }) => {
      try {
        // Run both searches in parallel
        const [soldListings, activeListings] = await Promise.all([
          searchSoldListings(query, "All", 20),
          searchActiveListings(query, "All", undefined, 10),
        ]);

        const prices = soldListings.map((l) => l.price);
        const stats = calculateStats(prices);

        // Find the cheapest active listing (by price + shipping)
        const cheapestActive =
          activeListings.length > 0
            ? activeListings.reduce((cheapest, current) => {
                const cheapestTotal =
                  cheapest.price + (cheapest.shippingCost ?? 0);
                const currentTotal =
                  current.price + (current.shippingCost ?? 0);
                return currentTotal < cheapestTotal ? current : cheapest;
              })
            : null;

        const formatted = formatPriceCheck(stats, cheapestActive, asking_price);

        return {
          content: [{ type: "text" as const, text: formatted }],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error during price check: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
