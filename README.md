# BAEWATCH

MCP server for eBay price research and deal hunting. Connects Claude Code directly to eBay's API so you can research fair market prices and find deals to flip.

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ Claude Code │ ←──→ │  BAEWATCH   │ ←──→ │  eBay API   │
│             │      │ MCP Server  │      │ (Internet)  │
└─────────────┘      └─────────────┘      └─────────────┘
```

## Tools

| Tool | Description |
|------|-------------|
| `ping` | Verify the server is running and connected |
| `ebay_status` | Check if your eBay credentials are configured (no API call) |
| `test_ebay_connection` | Test live connection to eBay's API |
| `search_sold` | Search recently sold listings with price stats |
| `search_active` | Search current Buy It Now listings with shipping info |
| `price_check` | All-in-one market price lookup with deal analysis |

## Quick Start

### 1. Prerequisites

- [Node.js](https://nodejs.org) v18+
- [Claude Code](https://claude.ai/download) installed
- [eBay Developer Account](https://developer.ebay.com/) (free, takes 1-2 days for approval)

### 2. Clone and Install

```bash
git clone https://github.com/jj70785/baewatch-mcp.git
cd baewatch-mcp
npm install
npm run build
```

### 3. Connect to Claude Code

```bash
claude mcp add baewatch node C:\path\to\baewatch-mcp\dist\index.js
```

Restart Claude Code, then test with: **"Use the ping tool"**

### 4. Configure eBay Credentials

Once your eBay developer account is approved:

```bash
copy config\config.example.json config\config.json
```

Edit `config/config.json` with your credentials:

```json
{
  "ebay": {
    "appId": "your-app-id",
    "certId": "your-cert-id",
    "devId": "your-dev-id",
    "refreshToken": "your-refresh-token",
    "environment": "production"
  },
  "defaults": {
    "resultsLimit": 10,
    "marketplace": "EBAY_US"
  }
}
```

Then verify with:
- **"Use ebay_status"** — checks that your config file has all fields filled in
- **"Use test_ebay_connection"** — makes a real API call to verify your keys work

### 5. Getting Your eBay Credentials

1. Go to [developer.ebay.com](https://developer.ebay.com/) and sign in
2. Go to **Application access keys** and create a keyset (Production)
3. Copy your **App ID (Client ID)**, **Cert ID (Client Secret)**, and **Dev ID**
4. Go to **User Tokens** > select your app > **Get a Token from eBay via Your Application**
5. Save the **refresh token** — this goes in the config file

## Usage Examples

Once eBay credentials are configured, just talk to Claude naturally:

> "I found a Dell Latitude 7420 on Facebook Marketplace for $150. Is that a good deal?"

> "Show me used iPhone 13 listings under $400"

> "What have Nintendo Switch OLEDs sold for recently?"

Claude will automatically pick the right BAEWATCH tool.

## Project Structure

```
baewatch-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── tools/
│   │   ├── searchSold.ts     # search_sold tool
│   │   ├── searchActive.ts   # search_active tool
│   │   └── priceCheck.ts     # price_check tool
│   ├── ebay/
│   │   ├── client.ts         # eBay API connection & search functions
│   │   ├── auth.ts           # OAuth token management
│   │   └── types.ts          # TypeScript types
│   └── utils/
│       ├── formatters.ts     # Output formatting
│       └── stats.ts          # Price statistics
├── config/
│   └── config.example.json   # Template for credentials
├── package.json
└── tsconfig.json
```

## Development

```bash
npm run build    # Compile TypeScript to dist/
npm run start    # Run the compiled server
npm run dev      # Run directly with ts-node (no build step)
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Claude doesn't see BAEWATCH | Run `claude mcp list` to check. Re-add and restart Claude Code. |
| "Config file not found" | Copy `config/config.example.json` to `config/config.json` |
| "Invalid credentials" | Double-check appId and certId in config.json (no extra spaces) |
| "Cannot reach eBay servers" | Check internet connection, try again in a few minutes |
| "No results found" | Try simpler/broader search terms |
| TypeScript build errors | Run `npm run build` and check the error output |

## License

MIT
