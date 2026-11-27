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
| `ebay_status` | Check whether credentials are configured (no API call) |
| `test_ebay_connection` | Live check: gets a token and runs a 1-result search |
| `search_active` | Search current listings: condition, price range, sort, Buy It Now / auction, shipping, seller feedback |
| `price_check` | Market price from up to 100 comps, with parts/broken listings and outliers dropped; compares an asking price |
| `item_details` | Vet one listing: item specifics, condition notes, seller, ship-from, returns, quantity sold |
| `watch_item` | Track a listing: alerts on any price drop, an optional target price, or when it sells/ends |
| `watch_search` | Save a search: alerts on new Buy It Now listings in a price range (junk titles skipped; optional required words and category) |
| `watch_list` / `watch_remove` | Show or delete watches |
| `watch_check` | Run the checks now and report what changed |

> **No sold-price data.** eBay shut down the Finding API (`findCompletedItems`) in Feb 2025, and its
> replacement (Marketplace Insights API) is restricted to approved partners. `price_check` uses current
> asking prices; real sale prices usually land somewhat below the median.

## Setup

Requires Node.js 18+ and an [eBay Developer](https://developer.ebay.com/) production keyset. Only the
**App ID (Client ID)** and **Cert ID (Client Secret)** are needed. BAEWATCH uses an application token
(client-credentials grant), so there is no user login and no refresh token to expire.

```bash
git clone https://github.com/jj70785/baewatch-mcp.git
cd baewatch-mcp
npm install
npm run build
cp config/config.example.json config/config.json   # then fill in appId / certId (and zip)
```

Credentials can also come from environment variables, which take priority over the file:

| Variable | Meaning |
|----------|---------|
| `EBAY_APP_ID` | App ID (Client ID) |
| `EBAY_CERT_ID` | Cert ID (Client Secret) |
| `EBAY_ZIP` | Your US ZIP, so eBay quotes calculated shipping (optional, recommended) |
| `EBAY_ENV` | `production` (default) or `sandbox` |
| `BAEWATCH_CONFIG` | Path to a config.json somewhere else |

### Claude Code

```bash
claude mcp add --scope user baewatch -- node /absolute/path/to/baewatch-mcp/dist/index.js
```

### Hermes Agent

```bash
hermes mcp add baewatch --command node --args /absolute/path/to/baewatch-mcp/dist/index.js
hermes mcp test baewatch
```

Restart the gateway (or `/reload-mcp` in an open session) to pick it up.

## Price tracking

Watches live in `data/watchlist.json` (gitignored; set `BAEWATCH_DATA` to move it). The MCP tools add and
list watches; a scheduled job does the checking:

```bash
node dist/cli.js check --notify   # check everything; send alerts to Telegram
node dist/cli.js list             # print the watchlist
```

`--notify` sends alerts with `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (otherwise they're only printed).
`BAEWATCH_QUIET_HOURS=23-7` makes alerts silent overnight. Example crontab line (every 20 minutes, about
72 runs a day; each watch costs one Browse API call, well under eBay's 5,000/day limit):

```cron
*/20 * * * * cd /path/to/baewatch-mcp && TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... node dist/cli.js check --notify >> check.log 2>&1
```

Each copy of BAEWATCH has its own watchlist, so add watches on the machine that runs the cron job.

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
│   │   ├── searchActive.ts   # search_active tool
│   │   ├── priceCheck.ts     # price_check tool
│   │   └── itemDetails.ts    # item_details tool
│   ├── ebay/
│   │   ├── client.ts         # Browse API calls
│   │   ├── auth.ts           # App token (client credentials)
│   │   ├── config.ts         # Env vars + config.json
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
| "Missing: appId" | Copy `config/config.example.json` to `config/config.json`, or set `EBAY_APP_ID` / `EBAY_CERT_ID` |
| Shipping says "not quoted" | Set `zip` / `EBAY_ZIP`. Listings that stay unquoted are usually local pickup only |
| "Invalid credentials" | Double-check appId and certId in config.json (no extra spaces) |
| "Cannot reach eBay servers" | Check internet connection, try again in a few minutes |
| "No results found" | Try simpler/broader search terms |
| TypeScript build errors | Run `npm run build` and check the error output |

## License

MIT
