import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkConfigStatus, testConnection } from "./ebay/client.js";
import { resetEbayApi } from "./ebay/auth.js";

// Finding API is deprecated — search_sold disabled for now
// import { registerSearchSold } from "./tools/searchSold.js";
import { registerSearchActive } from "./tools/searchActive.js";
import { registerPriceCheck } from "./tools/priceCheck.js";

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

// Check if eBay credentials are configured (no API call, just checks the config file)
server.tool(
  "ebay_status",
  "Check if eBay API credentials are configured in config/config.json. Does NOT call the eBay API — just checks if the config file exists and has real values filled in.",
  {},
  async () => {
    const status = checkConfigStatus();

    let text = status.configured
      ? "## eBay Config: READY\n\n"
      : "## eBay Config: NOT READY\n\n";

    text += `${status.message}\n\n`;
    text += `**Details:**\n`;
    text += `- Config file exists: ${status.details.configFileExists ? "Yes" : "No"}\n`;
    text += `- App ID (Client ID): ${status.details.hasAppId ? "Set" : "Missing"}\n`;
    text += `- Cert ID (Client Secret): ${status.details.hasCertId ? "Set" : "Missing"}\n`;
    text += `- Dev ID: ${status.details.hasDevId ? "Set" : "Missing"}\n`;
    text += `- Refresh Token: ${status.details.hasRefreshToken ? "Set" : "Missing"}\n`;
    text += `- Environment: ${status.details.environment || "Not set"}\n`;

    return {
      content: [{ type: "text" as const, text }],
    };
  }
);

// Test the actual eBay API connection (makes a real API call)
server.tool(
  "test_ebay_connection",
  "Test the live connection to eBay's API by requesting an access token. Requires credentials to be configured in config/config.json first. Use ebay_status to check config before running this.",
  {},
  async () => {
    // Reset cached instance so we pick up any config changes
    resetEbayApi();

    const result = await testConnection();

    const icon = result.success ? "CONNECTED" : "FAILED";
    const text = `## eBay Connection Test: ${icon}\n\n${result.message}`;

    return {
      content: [{ type: "text" as const, text }],
      isError: !result.success,
    };
  }
);

// registerSearchSold(server); // Finding API deprecated
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
