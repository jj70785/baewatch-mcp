import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { addWatch, readStore, removeWatch, Watch, WATCHLIST_PATH } from "../watch/store.js";
import { runChecks, searchMatches, snapshotItem, WatchEvent } from "../watch/check.js";

const text = (t: string, isError = false) => ({ content: [{ type: "text" as const, text: t }], ...(isError ? { isError } : {}) });
const money = (n?: number) => (n === undefined ? "?" : `$${n.toFixed(2)}`);

function describe(w: Watch): string {
  if (w.kind === "item") {
    const hist = w.history.length > 1 ? ` | was ${money(w.history[0].total)} when added` : "";
    return (
      `- **${w.id}** item ${w.status === "ended" ? "**SOLD/ENDED**" : money(w.lastTotal) + " shipped"}` +
      `${w.target !== undefined ? ` (target ${money(w.target)})` : ""}${hist}\n  ${w.title}\n  ${w.link}` +
      `${w.lastCheck ? ` · checked ${w.lastCheck.slice(0, 16).replace("T", " ")} UTC` : ""}`
    );
  }
  return (
    `- **${w.id}** search "${w.query}" ${w.minTotal ? `${money(w.minTotal)}–` : "≤ "}${money(w.maxTotal)} shipped, ${w.condition}` +
    `${w.mustInclude?.length ? `, title must have ${w.mustInclude.join(" + ")}` : ""}` +
    `${w.exclude.length ? `, excluding ${w.exclude.join(", ")}` : ""} · ${w.seen.length} listings seen` +
    `${w.lastCheck ? ` · checked ${w.lastCheck.slice(0, 16).replace("T", " ")} UTC` : ""}`
  );
}

export function formatEvents(events: WatchEvent[]): string {
  return events.map((e) => `- ${e.level === "alert" ? "🔔 " : ""}${e.text}${e.link ? `\n  ${e.link}` : ""}`).join("\n");
}

export function registerWatchTools(server: McpServer): void {
  server.tool(
    "watch_item",
    "Track one eBay listing. The scheduled checker alerts when its total price (with shipping) drops, hits your target, or the listing sells/ends.",
    {
      item: z.string().describe("eBay item number or ebay.com/itm/... URL"),
      target_price: z.number().optional().describe("Optional: alert when the total with shipping is at or below this"),
    },
    async ({ item, target_price }) => {
      try {
        const id = /(\d{9,})/.exec(item)?.[1];
        if (!id) return text(`"${item}" doesn't look like an eBay item number or URL.`, true);
        if (readStore().watches.some((w) => w.kind === "item" && w.itemId === id))
          return text(`Already watching item ${id}. Use watch_list to see it.`);
        const snap = await snapshotItem(id);
        if (!snap || snap.ended) return text(`Item ${id} has already sold or ended.`, true);
        const now = new Date().toISOString();
        const w = addWatch({
          kind: "item", itemId: id, title: snap.title, link: `https://www.ebay.com/itm/${id}`, target: target_price,
          addedAt: now, status: "active", lastPrice: snap.price, lastShipping: snap.shipping, lastTotal: snap.total,
          lastCheck: now, history: [{ t: now, total: snap.total }],
        });
        return text(`Watching (${w.id}): ${snap.title}\nNow ${money(snap.total)} shipped${target_price !== undefined ? `, alert at ${money(target_price)} or less` : ""}. You'll also be alerted on any price drop or if it sells.`);
      } catch (e: any) {
        return text(`Error: ${e.message}`, true);
      }
    }
  );

  server.tool(
    "watch_search",
    "Save an eBay search. The scheduled checker alerts on NEW Buy It Now listings whose total with shipping is in range. Titles that say parts/broken/locked/issue etc. are skipped automatically. Listings that already exist when you add it are not alerted.",
    {
      query: z.string().describe("Search words, e.g. 'MacBook Pro 16 2019 i9'"),
      max_total: z.number().describe("Max total price including shipping"),
      min_total: z.number().optional().describe("Min total; use it to skip accessories like chargers and cases"),
      condition: z.enum(["New", "Used", "All"]).default("All"),
      exclude: z.array(z.string()).default([]).describe("Extra title words to skip, e.g. ['13 inch', '2017']"),
      must_include: z.array(z.string()).default([]).describe("Words that must ALL be in the title, e.g. ['i9']. eBay's search is loose, so this cuts noise a lot."),
      category_id: z.string().optional().describe("Optional eBay category id to skip parts and accessories, e.g. '175672' = Laptops & Netbooks, '9355' = Cell Phones & Smartphones"),
    },
    async ({ query, max_total, min_total, condition, exclude, must_include, category_id }) => {
      try {
        const spec = { query, maxTotal: max_total, minTotal: min_total, condition, exclude, mustInclude: must_include, categoryId: category_id };
        const current = await searchMatches(spec);
        const w = addWatch({ kind: "search", ...spec, addedAt: new Date().toISOString(), lastCheck: new Date().toISOString(), seen: current.map((l) => l.itemId) });
        const cheapest = [...current].sort((a, b) => a.total - b.total).slice(0, 5)
          .map((l) => `- ${money(l.total)} ${l.title.slice(0, 80)}\n  ${l.link}`).join("\n");
        return text(`Saved search (${w.id}). ${current.length} listings match right now (not alerted).${cheapest ? `\nCheapest current matches:\n${cheapest}` : ""}\nFrom now on, new matches will be alerted.`);
      } catch (e: any) {
        return text(`Error: ${e.message}`, true);
      }
    }
  );

  server.tool("watch_list", "List tracked eBay listings and saved searches with their latest prices.", {}, async () => {
    const ws = readStore().watches;
    if (!ws.length) return text(`Nothing is being watched yet. Use watch_item or watch_search.\n(Watchlist file: ${WATCHLIST_PATH})`);
    return text(`## Watchlist (${ws.length})\n\n${ws.map(describe).join("\n")}`);
  });

  server.tool(
    "watch_remove",
    "Stop watching a listing or saved search.",
    { id: z.string().describe("Watch id from watch_list, e.g. 'w3'") },
    async ({ id }) => {
      const w = removeWatch(id);
      return w ? text(`Removed ${id}: ${w.kind === "item" ? w.title : `search "${w.query}"`}`) : text(`No watch with id ${id}.`, true);
    }
  );

  server.tool(
    "watch_check",
    "Check all watches now (or one by id) and report price drops, sold listings and new search matches. Updates the saved state, so the scheduled checker won't alert the same thing again.",
    { id: z.string().optional().describe("Only check this watch id") },
    async ({ id }) => {
      try {
        const r = await runChecks(id);
        const body = r.events.length ? formatEvents(r.events) : "No changes.";
        return text(`Checked ${r.checked} watch(es).\n\n${body}${r.errors.length ? `\n\nErrors:\n${r.errors.join("\n")}` : ""}`);
      } catch (e: any) {
        return text(`Error: ${e.message}`, true);
      }
    }
  );
}
