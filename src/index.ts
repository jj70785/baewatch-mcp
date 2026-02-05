import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// eBay tools — uncomment these once your API key is set up
// import { registerSearchSold } from "./tools/searchSold.js";
// import { registerSearchActive } from "./tools/searchActive.js";
// import { registerPriceCheck } from "./tools/priceCheck.js";

const server = new McpServer({
  name: "baewatch",
  version: "1.0.0",
});

// Test tool — verifies Claude Code can talk to the server
server.tool(
  "ping",
  "Test tool to verify the BAEWATCH MCP server is running and connected.",
  {
    message: z.string().optional().describe("Optional message to echo back"),
  },
  async ({ message }) => {
    const reply = message
      ? `pong! You said: "${message}"`
      : "pong! BAEWATCH is alive and connected.";

    return {
      content: [{ type: "text" as const, text: reply }],
    };
  }
);

// eBay tools — uncomment these once your API key is set up
// registerSearchSold(server);
// registerSearchActive(server);
// registerPriceCheck(server);

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
