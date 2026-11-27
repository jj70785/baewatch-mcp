import { getItemDetails, searchActiveListings } from "../ebay/client.js";
import { ItemWatch, SearchWatch, Watch, readStore, saveChecked } from "./store.js";

export interface WatchEvent {
  /** alert = worth a notification; info = only shown when you ask. */
  level: "alert" | "info";
  watchId: string;
  text: string;
  link?: string;
}

/** Titles with these words are almost always broken, partial or locked. */
export const JUNK =
  /\b(for parts|parts only|parts|repair|needs? repair|battery issue|service battery|not working|non[- ]?working|broken|cracked|as[- ]is|read desc\w*|see desc\w*|issues?|damaged?|lcd only|screen only|logic ?board|motherboard|housing|top ?case|bottom case|locked|icloud|mdm|bios lock\w*|box only|empty box|charger only|no ssd|no hdd|no storage|untested|defective|mboard|read|assembly|replacement|lcd)\b/i;

const MAX_HISTORY = 200;
const MAX_SEEN = 1000;
const money = (n: number) => `$${n.toFixed(2)}`;

export interface ItemSnapshot {
  title: string;
  price: number;
  shipping: number | null;
  total: number;
  ended: boolean;
}

/** Current price/availability for one listing. A 404 means it sold or ended. */
export async function snapshotItem(itemId: string): Promise<ItemSnapshot | null> {
  let d: any;
  try {
    d = await getItemDetails(itemId);
  } catch (e: any) {
    if (/error 404|11001|no longer available|not found/i.test(e.message)) return null;
    throw e;
  }
  const price = parseFloat(d.price?.value ?? "0");
  const ship = d.shippingOptions?.[0]?.shippingCost?.value;
  const shipping = ship !== undefined ? parseFloat(ship) : null;
  const avail = d.estimatedAvailabilities?.[0];
  const ended =
    avail?.estimatedAvailabilityStatus === "OUT_OF_STOCK" ||
    (d.itemEndDate && new Date(d.itemEndDate).getTime() < Date.now());
  return { title: d.title || "Unknown", price, shipping, total: +(price + (shipping ?? 0)).toFixed(2), ended: !!ended };
}

async function checkItem(w: ItemWatch, now: string): Promise<WatchEvent[]> {
  const ev: WatchEvent[] = [];
  const name = w.title.slice(0, 70);
  const snap = await snapshotItem(w.itemId);
  w.lastCheck = now;

  if (!snap || snap.ended) {
    if (w.status !== "ended") ev.push({ level: "alert", watchId: w.id, text: `SOLD or ended: ${name}`, link: w.link });
    w.status = "ended";
    return ev;
  }
  if (w.status === "ended") ev.push({ level: "alert", watchId: w.id, text: `Back for sale at ${money(snap.total)}: ${name}`, link: w.link });
  w.status = "active";

  const prev = w.lastTotal;
  if (prev !== undefined && Math.abs(snap.total - prev) >= 0.01) {
    const diff = snap.total - prev;
    const verb = diff < 0 ? "Price DROP" : "Price up";
    ev.push({
      level: diff < 0 ? "alert" : "info",
      watchId: w.id,
      text: `${verb}: ${money(prev)} → ${money(snap.total)} (${diff < 0 ? "-" : "+"}${money(Math.abs(diff))}) ${name}`,
      link: w.link,
    });
  }
  if (w.target !== undefined && snap.total <= w.target && (prev === undefined || prev > w.target)) {
    ev.push({ level: "alert", watchId: w.id, text: `Hit your target of ${money(w.target)}: now ${money(snap.total)} ${name}`, link: w.link });
  }
  if (prev === undefined || Math.abs(snap.total - prev) >= 0.01) {
    w.history.push({ t: now, total: snap.total });
    if (w.history.length > MAX_HISTORY) w.history.splice(0, w.history.length - MAX_HISTORY);
  }
  Object.assign(w, { lastPrice: snap.price, lastShipping: snap.shipping, lastTotal: snap.total, title: snap.title });
  return ev;
}

/** Current Buy It Now matches for a saved search: shipping quoted, within range, no junk. */
export async function searchMatches(w: Pick<SearchWatch, "query" | "maxTotal" | "minTotal" | "condition" | "exclude" | "mustInclude" | "categoryId">) {
  const { listings } = await searchActiveListings(w.query, {
    sort: "newly_listed",
    limit: 200,
    maxPrice: w.maxTotal,
    minPrice: w.minTotal,
    condition: w.condition,
    buyingOption: "buy_it_now",
    categoryId: w.categoryId,
  });
  const extra = w.exclude.map((x) => x.toLowerCase()).filter(Boolean);
  // eBay's keyword match is loose (a "16 inch" search returns 13" models), so allow required title words.
  const must = (w.mustInclude ?? []).map((x) => x.toLowerCase()).filter(Boolean);
  return listings
    .filter((l) => l.shippingCost !== null && l.conditionId !== "7000")
    .map((l) => ({ ...l, total: +(l.price + (l.shippingCost ?? 0)).toFixed(2) }))
    .filter((l) => l.total <= w.maxTotal && (w.minTotal === undefined || l.total >= w.minTotal))
    .filter((l) => !JUNK.test(l.title) && !extra.some((x) => l.title.toLowerCase().includes(x)))
    .filter((l) => must.every((x) => l.title.toLowerCase().includes(x)));
}

async function checkSearch(w: SearchWatch, now: string): Promise<WatchEvent[]> {
  const matches = await searchMatches(w);
  w.lastCheck = now;
  const seen = new Set(w.seen);
  const fresh = matches.filter((l) => !seen.has(l.itemId));
  const ev: WatchEvent[] = fresh
    .sort((a, b) => a.total - b.total)
    .map((l) => ({
      level: "alert" as const,
      watchId: w.id,
      text: `New listing for "${w.query}" at ${money(l.total)} shipped${l.sellerFeedback ? `, seller ${l.sellerFeedback}` : ""}: ${l.title.slice(0, 80)}`,
      link: l.link,
    }));
  w.seen.push(...fresh.map((l) => l.itemId));
  if (w.seen.length > MAX_SEEN) w.seen.splice(0, w.seen.length - MAX_SEEN);
  return ev;
}

/** Check every watch (or one), save the results, and return what changed. */
export async function runChecks(onlyId?: string): Promise<{ events: WatchEvent[]; checked: number; errors: string[] }> {
  const now = new Date().toISOString();
  const watches = readStore().watches.filter((w) => !onlyId || w.id === onlyId);
  const events: WatchEvent[] = [];
  const errors: string[] = [];
  const done: Watch[] = [];
  for (const w of watches) {
    // Ended listings get one look per run in case they're relisted under the same number; cheap enough.
    try {
      events.push(...(w.kind === "item" ? await checkItem(w, now) : await checkSearch(w, now)));
      done.push(w);
    } catch (e: any) {
      errors.push(`${w.id}: ${e.message}`);
    }
  }
  saveChecked(done);
  return { events, checked: done.length, errors };
}
