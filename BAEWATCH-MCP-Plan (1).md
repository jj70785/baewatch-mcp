# BAEWATCH MCP Server - Complete Build Plan

> **What is this document?** This is a comprehensive plan for Claude Code to build "BAEWATCH" — a local MCP server that connects Claude to eBay's API for price research and deal hunting.

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Prerequisites & Setup](#2-prerequisites--setup)
3. [eBay Developer Account Setup](#3-ebay-developer-account-setup)
4. [How MCP Servers Work (Simple Explanation)](#4-how-mcp-servers-work-simple-explanation)
5. [Feature Specifications](#5-feature-specifications)
6. [Project Architecture](#6-project-architecture)
7. [Implementation Phases](#7-implementation-phases) *(Now starts with Phase 0: GitHub Setup)*
8. [Claude Code MCP Configuration](#8-claude-code-mcp-configuration)
9. [Example Usage](#9-example-usage)
10. [Troubleshooting Guide](#10-troubleshooting-guide)
11. [Future Expansion: Adding More Platforms](#11-future-expansion-adding-more-platforms)

---

## 1. Project Overview

### What We're Building
**BAEWATCH** is a local MCP (Model Context Protocol) server that runs on the user's Windows 11 PC. It allows Claude Code to:
- Search eBay for sold listings (to research fair market prices)
- Search eBay for active listings (to find deals)
- Filter by item condition (New, Used, For Parts)
- Help the user decide if a deal is worth flipping

### Why This Exists
The user finds items on Facebook Marketplace and other places, then needs to quickly research:
1. What did this item actually sell for recently? (sold listings)
2. Are there cheaper ones available right now? (active listings)
3. Is this a good deal to flip?

### User Profile
- **Coding experience:** Beginner (doesn't need to understand the code, just run it)
- **Tech level:** Tech-savvy, comfortable with command line and troubleshooting
- **OS:** Windows 11
- **Tools installed:** Node.js (probably), Python (probably), Claude Code
- **eBay API status:** Developer account created, waiting for approval

### Tool Name
**BAEWATCH** (yes, like the TV show 🏖️)

---

## 2. Prerequisites & Setup

### Required Software
Before building, ensure these are installed:

#### 1. Node.js (Required)
- **What it is:** JavaScript runtime that lets you run JS code outside a browser
- **Check if installed:** Open PowerShell and run: `node --version`
- **Expected output:** Something like `v18.17.0` or `v20.x.x`
- **If not installed:** Download from https://nodejs.org (use LTS version)

#### 2. npm (Comes with Node.js)
- **What it is:** Package manager for installing code libraries
- **Check if installed:** Run: `npm --version`
- **Expected output:** Something like `9.x.x` or `10.x.x`

#### 3. Claude Code
- **Already installed:** User confirmed they use Claude Code regularly

#### 4. Git (Required)
- **What it is:** Version control to track changes and push to GitHub
- **Check if installed:** Run: `git --version`
- **Expected output:** Something like `git version 2.x.x`
- **If not installed:** Download from https://git-scm.com/download/win

#### 5. GitHub Account
- **What it is:** Online hosting for your code repository
- **If you don't have one:** Create a free account at https://github.com
- **Auth setup:** Make sure you can push to GitHub (either via SSH key or GitHub CLI)

### Project Location
Create the project in a dedicated folder:
```
C:\Users\[Username]\Projects\baewatch-mcp\
```

---

## 3. eBay Developer Account Setup

> **Current Status:** User has created an account but is waiting for approval (takes 1-2 business days)

### Step-by-Step Instructions

#### Step 1: Go to eBay Developer Program
- URL: https://developer.ebay.com/
- Click "Join" or "Sign In" if you already have an account

#### Step 2: Create an Application
Once approved:
1. Go to "Hi [Name]" → "Application access keys"
2. Click "Create a keyset" 
3. Choose **"Production"** environment (not Sandbox)
4. Give it a name like "BAEWATCH"

#### Step 3: Get Your Credentials
After creating the application, you'll see:
- **App ID (Client ID):** Something like `YourName-BAEWATCH-PRD-abc123-def456`
- **Cert ID (Client Secret):** A long string of random characters
- **Dev ID:** Another ID (not always needed)

**IMPORTANT:** Save these somewhere safe! You'll need them to configure BAEWATCH.

#### Step 4: Generate an OAuth Token
eBay uses OAuth 2.0 for authentication. You need to:
1. In the developer portal, go to "User Tokens"
2. Select your application
3. Click "Get a Token from eBay via Your Application"
4. Follow the flow to authorize
5. Save the **refresh token** — this is what BAEWATCH will use

### What API We're Using
- **Browse API** — For searching active listings
- **Finding API** — For searching sold/completed listings

---

## 4. How MCP Servers Work (Simple Explanation)

### The Basic Idea
Think of an MCP server like a translator that sits between Claude and another service:

```
┌─────────────────────────────────────────────────────────────┐
│                      YOUR COMPUTER                          │
│                                                             │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐│
│   │             │      │             │      │             ││
│   │ Claude Code │ ←──→ │  BAEWATCH   │ ←──→ │  eBay API   ││
│   │             │      │ MCP Server  │      │ (Internet)  ││
│   └─────────────┘      └─────────────┘      └─────────────┘│
│                              ↑                              │
│                    Runs locally on your PC                  │
└─────────────────────────────────────────────────────────────┘
```

### What the MCP Server Does
1. **Listens** for requests from Claude Code
2. **Translates** natural requests into proper eBay API calls
3. **Sends** the request to eBay over the internet
4. **Receives** raw data from eBay (big ugly JSON)
5. **Formats** it nicely and sends it back to Claude
6. **Claude** presents it to you in a readable way

### Why Not Just Use Web Search?
- Web search: Claude Googles "Dell Latitude 7420 eBay sold" → finds random articles → guesses at prices
- MCP Server: Claude asks eBay directly "give me sold listings for Dell Latitude 7420" → gets exact data

---

## 5. Feature Specifications

### Core Features (Version 1.0)

#### Feature 1: Search Sold Listings
- **Command:** `search_sold`
- **Purpose:** Find what an item actually sold for recently
- **Inputs:**
  - `query` (required): Search term, e.g., "Dell Latitude 7420"
  - `condition` (optional): "New", "Used", "For Parts", or "All"
  - `limit` (optional): Number of results (default: 10, max: 50)
- **Outputs:**
  - List of sold items with: title, price, condition, date sold, link
  - Summary stats: average price, lowest, highest, number of sales

#### Feature 2: Search Active Listings
- **Command:** `search_active`
- **Purpose:** Find current listings for sale
- **Inputs:**
  - `query` (required): Search term
  - `condition` (optional): "New", "Used", "For Parts", or "All"
  - `max_price` (optional): Filter out expensive ones
  - `limit` (optional): Number of results (default: 10)
- **Outputs:**
  - List of active items with: title, price, condition, shipping cost, link
  - Shows "Buy It Now" prices primarily (auctions are less useful for flipping)

#### Feature 3: Quick Price Check
- **Command:** `price_check`
- **Purpose:** All-in-one lookup for flipping decisions
- **Inputs:**
  - `query` (required): The item to research
  - `asking_price` (optional): What the seller is asking (for comparison)
- **Outputs:**
  - Average sold price (last 30 days)
  - Lowest/highest sold prices
  - Current cheapest active listing
  - If `asking_price` provided: "This is X% below/above market"

### Future Features (Version 2.0+)
These are NOT for initial build, but design the code to allow adding:
- Profit calculator (factor in eBay fees, shipping, etc.)
- Save searches to a file
- Price history graphs
- Additional platforms (Amazon, etc.)

---

## 6. Project Architecture

### Technology Choices
- **Language:** TypeScript (compiles to JavaScript, better error checking)
- **Runtime:** Node.js
- **MCP SDK:** `@modelcontextprotocol/sdk` (official Anthropic library)
- **eBay Library:** `ebay-api` (npm package for eBay API)

### File Structure
```
baewatch-mcp/
├── src/
│   ├── index.ts            # Main entry point, MCP server setup
│   ├── tools/
│   │   ├── searchSold.ts      # search_sold command
│   │   ├── searchActive.ts    # search_active command
│   │   └── priceCheck.ts      # price_check command
│   ├── ebay/
│   │   ├── client.ts          # eBay API connection handler
│   │   ├── auth.ts            # OAuth token management
│   │   └── types.ts           # TypeScript types for eBay data
│   └── utils/
│       ├── formatters.ts      # Format results nicely
│       └── stats.ts           # Calculate averages, etc.
├── config/
│   └── config.example.json    # Example config (user copies and fills in)
├── package.json               # Project dependencies
├── tsconfig.json              # TypeScript configuration
├── README.md                  # Instructions
└── .gitignore                 # Ignore node_modules, config.json, etc.
```

### Configuration File Structure
`config/config.json` (user creates from example):
```json
{
  "ebay": {
    "appId": "YOUR_APP_ID_HERE",
    "certId": "YOUR_CERT_ID_HERE",
    "devId": "YOUR_DEV_ID_HERE",
    "refreshToken": "YOUR_REFRESH_TOKEN_HERE",
    "environment": "production"
  },
  "defaults": {
    "resultsLimit": 10,
    "marketplace": "EBAY_US"
  }
}
```

---

## 7. Implementation Phases

### Phase 0: GitHub Repository Setup
**Goal:** Create the GitHub repo first so everything is tracked from the start

1. Create a new repository on GitHub:
   - Go to https://github.com/new
   - Repository name: `baewatch-mcp`
   - Description: "MCP server for eBay price research and deal hunting"
   - Make it **Public** or **Private** (user's choice)
   - Check "Add a README file"
   - Add `.gitignore` template: **Node**
   - License: MIT (optional)
2. Clone the repository to local machine:
   ```bash
   cd C:\Users\[Username]\Projects
   git clone https://github.com/[YourUsername]/baewatch-mcp.git
   cd baewatch-mcp
   ```
3. Verify git is working:
   ```bash
   git status
   ```

**✅ CHECKPOINT:** Push is automatic (repo just cloned), but verify you can push:
```bash
git commit --allow-empty -m "Initial setup verified"
git push origin main
```

---

### Phase 1: Project Setup
**Goal:** Get the basic project structure in place

1. Initialize npm project (inside the cloned repo folder):
   ```bash
   npm init -y
   ```
2. Install dependencies:
   ```bash
   npm install @modelcontextprotocol/sdk ebay-api dotenv typescript @types/node
   npm install -D ts-node nodemon
   ```
3. Set up TypeScript config (`tsconfig.json`)
4. Create the folder structure (see Project Architecture section)
5. Create `config/config.example.json`
6. Update `.gitignore` to also ignore:
   - `config/config.json` (contains secrets)
   - `.env`
   - `dist/`
7. Update `README.md` with basic project description

**✅ CHECKPOINT:** Commit and push Phase 1:
```bash
git add .
git commit -m "Phase 1: Project setup complete"
git push origin main
```

### Phase 2: eBay API Connection
**Goal:** Get connected to eBay and test it works

1. Create `src/ebay/auth.ts` — Handle OAuth token refresh
2. Create `src/ebay/client.ts` — Initialize eBay API connection
3. Create a simple test script to verify connection works
4. Test searching for a product manually

**✅ CHECKPOINT:** Commit and push Phase 2:
```bash
git add .
git commit -m "Phase 2: eBay API connection working"
git push origin main
```

### Phase 3: Build the MCP Server Shell
**Goal:** Get a basic MCP server running that Claude Code can connect to

1. Create `src/index.ts` with basic MCP server setup
2. Register a simple test tool (like "ping" that returns "pong")
3. Configure Claude Code to use the local MCP server
4. Verify Claude Code can talk to the server

**✅ CHECKPOINT:** Commit and push Phase 3:
```bash
git add .
git commit -m "Phase 3: MCP server shell working"
git push origin main
```

### Phase 4: Implement search_sold
**Goal:** First real feature working

1. Create `src/tools/searchSold.ts`
2. Build the eBay API query for completed listings
3. Parse and format the results
4. Create summary statistics (avg, low, high)
5. Register the tool with the MCP server
6. Test it end-to-end through Claude Code

**✅ CHECKPOINT:** Commit and push Phase 4:
```bash
git add .
git commit -m "Phase 4: search_sold feature complete"
git push origin main
```

### Phase 5: Implement search_active
**Goal:** Second feature working

1. Create `src/tools/searchActive.ts`
2. Build the eBay API query for active listings
3. Focus on "Buy It Now" listings
4. Include shipping cost in results
5. Test it end-to-end

**✅ CHECKPOINT:** Commit and push Phase 5:
```bash
git add .
git commit -m "Phase 5: search_active feature complete"
git push origin main
```

### Phase 6: Implement price_check
**Goal:** All-in-one convenience feature

1. Create `src/tools/priceCheck.ts`
2. This tool internally calls both `searchSold` and `searchActive`
3. Combines data into a single useful summary
4. Optionally compares against user's asking price
5. Test it end-to-end

**✅ CHECKPOINT:** Commit and push Phase 6:
```bash
git add .
git commit -m "Phase 6: price_check feature complete"
git push origin main
```

### Phase 7: Polish & Error Handling
**Goal:** Make it robust and user-friendly

1. Add proper error messages for common issues:
   - API key invalid
   - Rate limit hit
   - No results found
   - Network error
2. Add input validation
3. Clean up output formatting
4. Test edge cases

**✅ CHECKPOINT:** Commit and push Phase 7:
```bash
git add .
git commit -m "Phase 7: Error handling and polish complete"
git push origin main
```

### Phase 8: Documentation
**Goal:** User can set it up without help

1. Write clear README.md with setup instructions
2. Document all available commands
3. Add examples of common queries

**✅ CHECKPOINT:** Commit and push Phase 8 (Final!):
```bash
git add .
git commit -m "Phase 8: Documentation complete - v1.0 ready!"
git push origin main
```

🎉 **BAEWATCH v1.0 is complete!**

---

## 8. Claude Code MCP Configuration

### How to Add BAEWATCH to Claude Code

Once the server is built, you need to tell Claude Code about it.

#### Option A: Project-Level Config
Create or edit `.mcp.json` in your project folder:
```json
{
  "mcpServers": {
    "baewatch": {
      "command": "node",
      "args": ["C:\\Users\\[Username]\\Projects\\baewatch-mcp\\dist\\index.js"],
      "env": {}
    }
  }
}
```

#### Option B: Global Config
Edit Claude Code's global settings (location depends on installation).

Look for `claude_desktop_config.json` or similar, and add:
```json
{
  "mcpServers": {
    "baewatch": {
      "command": "node",
      "args": ["C:\\Users\\[Username]\\Projects\\baewatch-mcp\\dist\\index.js"]
    }
  }
}
```

### Verifying It Works
1. Start Claude Code
2. It should show "baewatch" as an available MCP server
3. Ask Claude: "Use baewatch to search for Dell Latitude 7420 sold prices"
4. Claude should use the tool and return results

---

## 9. Example Usage

Once everything is set up, here's how you'd use it:

### Example 1: Research Before Buying
**You:** "I found a Dell Latitude 7420 on Facebook Marketplace for $150. Is that a good deal?"

**Claude uses:** `price_check` with query "Dell Latitude 7420" and asking_price 150

**Claude responds:** 
> Based on eBay data, Dell Latitude 7420 laptops sold for an average of $195 in the last 30 days (range: $140-$280, depending on specs and condition). At $150, this is about 23% below market average. Looks like a solid deal if the condition is good!

### Example 2: Find Deals to Flip
**You:** "Show me used iPhone 13 listings under $400"

**Claude uses:** `search_active` with query "iPhone 13", condition "Used", max_price 400

**Claude responds:**
> Here are 10 active listings for used iPhone 13 under $400:
> 1. iPhone 13 128GB Blue - $375 + $8 shipping - [link]
> 2. iPhone 13 128GB Black (cracked back) - $299 + free shipping - [link]
> ...etc

### Example 3: Check Sold Prices
**You:** "What have Nintendo Switch OLEDs sold for recently?"

**Claude uses:** `search_sold` with query "Nintendo Switch OLED"

**Claude responds:**
> Last 30 days of Nintendo Switch OLED sales on eBay:
> - Average: $245
> - Lowest: $180 (for parts unit)
> - Highest: $320 (new in box with games)
> - 47 total sales
>
> Most used units in good condition sold between $220-$260.

---

## 10. Troubleshooting Guide

### Problem: "Cannot find module" error
**Cause:** Dependencies not installed
**Fix:** 
```bash
cd C:\Users\[Username]\Projects\baewatch-mcp
npm install
```

### Problem: "ECONNREFUSED" or network error
**Cause:** Can't reach eBay's servers
**Fix:** 
- Check internet connection
- Make sure you're not on a VPN that blocks eBay
- Try again in a few minutes (might be temporary)

### Problem: "Invalid credentials" or "Unauthorized"
**Cause:** eBay API keys are wrong
**Fix:**
1. Double-check your `config.json` has the right credentials
2. Make sure you copied them correctly (no extra spaces)
3. Verify your eBay developer account is fully approved
4. Check if your OAuth token expired (may need to refresh)

### Problem: "Rate limit exceeded"
**Cause:** Too many requests too fast
**Fix:**
- Wait 1-2 minutes and try again
- eBay's API has limits on how many calls per second/day
- The free tier is generous but not unlimited

### Problem: Claude Code doesn't see the MCP server
**Cause:** Configuration not set up correctly
**Fix:**
1. Make sure the path in your MCP config is exactly right
2. Make sure you built the project (`npm run build`)
3. Restart Claude Code after changing config
4. Check that `dist/index.js` exists

### Problem: "No results found" for items that definitely exist
**Cause:** Search query might be too specific or formatted wrong
**Fix:**
- Try simpler search terms
- Remove special characters
- Use model numbers without spaces
- Try broader terms first, then narrow down

### Problem: TypeScript errors when building
**Cause:** Code issues (shouldn't happen if following the plan)
**Fix:**
- Run `npm run build` and read the error messages
- Most common: missing imports or typos
- Google the specific error message

---

## 11. Future Expansion: Adding More Platforms

The architecture is designed to make adding new platforms straightforward.

### How It's Designed for Expansion

The `src/tools/` folder contains separate files for each command. Each command can internally call different platforms.

### To Add Amazon (Example):

1. **Create new API client:**
   - `src/amazon/client.ts`
   - `src/amazon/auth.ts`

2. **Get Amazon API Access:**
   - Sign up for Amazon Product Advertising API
   - Get credentials

3. **Add Amazon search functions:**
   - `src/amazon/searchProducts.ts`

4. **Update existing tools OR create new ones:**
   - Option A: Modify `price_check` to query both eBay AND Amazon
   - Option B: Create `amazon_search` as a separate tool

5. **Update config:**
   ```json
   {
     "ebay": { ... },
     "amazon": {
       "accessKey": "...",
       "secretKey": "...",
       "partnerTag": "..."
     }
   }
   ```

### Other Platforms That Could Be Added:
- **Mercari** — No official API (would need scraping, not recommended)
- **Craigslist** — Has RSS feeds, could work
- **Swappa** — For phones/tech, has informal API
- **PriceCharting** — Great for video games, has API

### Design Principle for Expansion
Keep each platform in its own folder. Tools can call multiple platforms. This keeps the code organized and makes it easy to add/remove platforms without breaking everything.

---

## Summary for Claude Code

**Project Name:** BAEWATCH  
**Purpose:** MCP server for eBay price research  
**Platform:** Local Windows 11, Node.js/TypeScript  
**User Level:** Beginner coder, tech-savvy, explain things clearly

**Build this in phases, testing each phase before moving on.**

**GitHub Workflow:**
- Phase 0 creates the repo FIRST
- After EVERY phase, commit and push to GitHub
- Use the exact commit messages provided in each checkpoint

**Key Commands to Implement:**
1. `search_sold` — Completed listings with prices
2. `search_active` — Current listings for sale  
3. `price_check` — All-in-one lookup

**Important Notes:**
- User is waiting for eBay API approval (1-2 days)
- Include clear error messages
- Format output nicely for readability
- Design for future expansion (more platforms later)
- ALWAYS push to GitHub after completing each phase

**When in doubt, ask the user for clarification rather than assuming.**

---

*Document created: February 2025*
*For use with Claude Code*
