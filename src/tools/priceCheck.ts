import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchActiveListings } from "../ebay/client.js";
import { calculateStats } from "../utils/stats.js";
import { formatPriceCheck } from "../utils/formatters.js";

export function registerPriceCheck(server: McpServer): void {
  server.tool(
    "price_check",
    "Quick price check for flipping decisions. Searches active eBay listings, shows market price summary (avg, low, high), and optionally compares against a seller's asking price to show if it's a good deal.",
    {
      query: z.string().describe("The item to research, e.g. 'Nintendo Switch OLED'"),
      asking_price: z
        .number()
        .optional()
        .describe("What the seller is asking, for comparison against market value"),
    },
    async ({ query, asking_price }) => {
      try {
        const listings = await searchActiveListings(query, "All", undefined, 25);

        if (listings.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No active listings found for "${query}". Try simpler or broader search terms.`,
              },
            ],
          };
        }

        // Calculate total cost (price + shipping) for each listing
        const totalPrices = listings.map(
          (l) => l.price + (l.shippingCost ?? 0)
        );
        const stats = calculateStats(totalPrices);

        // Find cheapest listing by total cost
        const cheapest = listings.reduce((best, current) => {
          const bestTotal = best.price + (best.shippingCost ?? 0);
          const currentTotal = current.price + (current.shippingCost ?? 0);
          return currentTotal < bestTotal ? current : best;
        });

        const formatted = formatPriceCheck(stats, cheapest, asking_price);

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
