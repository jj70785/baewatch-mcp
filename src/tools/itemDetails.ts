import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getItemDetails } from "../ebay/client.js";
import { formatItemDetails } from "../utils/formatters.js";

export function registerItemDetails(server: McpServer): void {
  server.tool(
    "item_details",
    "Full details for one eBay listing: condition notes, item specifics (model, storage, etc.), seller feedback, ship-from location, shipping, return policy, and quantity sold. Use it to vet a specific listing before buying.",
    {
      item: z.string().describe("eBay item number (e.g. '336899110736') or a full ebay.com/itm/... URL"),
      zip: z.string().optional().describe("US ZIP for the shipping quote; defaults to the configured EBAY_ZIP"),
    },
    async ({ item, zip }) => {
      try {
        const data = await getItemDetails(item, zip);
        return { content: [{ type: "text" as const, text: formatItemDetails(data) }] };
      } catch (error: any) {
        return { content: [{ type: "text" as const, text: `Error fetching item: ${error.message}` }], isError: true };
      }
    }
  );
}
