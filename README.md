# BAEWATCH

MCP server for eBay price research and deal hunting. Connects Claude Code directly to eBay's API so you can research fair market prices and find deals to flip.

## What It Does

- **search_sold** — Find what items actually sold for recently on eBay
- **search_active** — Browse current listings with price and shipping info
- **price_check** — All-in-one lookup that combines sold data, active listings, and deal analysis

## Setup

### 1. Prerequisites

- [Node.js](https://nodejs.org) v18+ installed
- [Claude Code](https://claude.ai) installed
- eBay Developer Account approved ([sign up here](https://developer.ebay.com/))

### 2. Install Dependencies

```bash
cd baewatch-mcp
npm install
npm run build
```

### 3. Configure eBay Credentials

Copy the example config and fill in your API keys:

```bash
cp config/config.example.json config/config.json
```

Edit `config/config.json` with your eBay Developer credentials:

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

### 4. Add to Claude Code

Add BAEWATCH to your Claude Code MCP config (`.mcp.json` in your project or global config):

```json
{
  "mcpServers": {
    "baewatch": {
      "command": "node",
      "args": ["C:\\path\\to\\baewatch-mcp\\dist\\index.js"]
    }
  }
}
```

## Usage Examples

Once configured, just talk to Claude naturally:

- "I found a Dell Latitude 7420 for $150. Is that a good deal?"
- "Show me used iPhone 13 listings under $400"
- "What have Nintendo Switch OLEDs sold for recently?"

Claude will use the appropriate BAEWATCH tool automatically.

## Development

```bash
npm run build    # Compile TypeScript
npm run start    # Run the server
npm run dev      # Run with ts-node (no build needed)
```

## License

MIT
