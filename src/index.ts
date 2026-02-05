import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSearchSold } from "./tools/searchSold.js";
import { registerSearchActive } from "./tools/searchActive.js";
import { registerPriceCheck } from "./tools/priceCheck.js";

const server = new McpServer({
  name: "baewatch",
  version: "1.0.0",
});

// Register all tools
registerSearchSold(server);
registerSearchActive(server);
registerPriceCheck(server);

// Start the server using stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BAEWATCH MCP server is running");
}

main().catch((error) => {
  console.error("Fatal error starting BAEWATCH:", error);
  process.exit(1);
});
