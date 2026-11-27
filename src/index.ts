import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { checkConfigStatus, testConnection } from "./ebay/client.js";
import { registerSearchActive } from "./tools/searchActive.js";
import { registerPriceCheck } from "./tools/priceCheck.js";
import { registerItemDetails } from "./tools/itemDetails.js";
import { registerWatchTools } from "./tools/watch.js";

const server = new McpServer({ name: "baewatch", version: "2.1.0" });

server.tool(
  "ebay_status",
  "Check whether BAEWATCH has eBay credentials configured (no API call). Use test_ebay_connection to verify they actually work.",
  {},
  async () => {
    const s = checkConfigStatus();
    const d = s.details;
    const text =
      `## eBay Config: ${s.configured ? "READY" : "NOT READY"}\n\n${s.message}\n\n` +
      `- Config file: ${d.configFile ?? "none (using env vars only)"}\n` +
      `- App ID: ${d.hasAppId ? "set" : "missing"}\n` +
      `- Cert ID: ${d.hasCertId ? "set" : "missing"}\n` +
      `- Buyer ZIP (for shipping quotes): ${d.zip ?? "not set"}\n` +
      `- Environment: ${d.environment}\n`;
    return { content: [{ type: "text" as const, text }] };
  }
);

server.tool(
  "test_ebay_connection",
  "Make a live call to eBay to verify the credentials work (gets a token and runs a 1-result search).",
  {},
  async () => {
    const r = await testConnection();
    return {
      content: [{ type: "text" as const, text: `## eBay Connection: ${r.success ? "OK" : "FAILED"}\n\n${r.message}` }],
      isError: !r.success,
    };
  }
);

registerSearchActive(server);
registerPriceCheck(server);
registerItemDetails(server);
registerWatchTools(server);

async function main() {
  await server.connect(new StdioServerTransport());
  console.error("BAEWATCH MCP server is running");
}

main().catch((error) => {
  console.error("Fatal error starting BAEWATCH:", error);
  process.exit(1);
});
