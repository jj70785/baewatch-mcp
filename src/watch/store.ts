import fs from "fs";
import path from "path";

/** A single listing being tracked for price drops / selling out. */
export interface ItemWatch {
  id: string;
  kind: "item";
  itemId: string;
  title: string;
  link: string;
  /** Alert when the total (price + shipping) drops to this or lower. */
  target?: number;
  addedAt: string;
  status: "active" | "ended";
  lastPrice?: number;
  lastShipping?: number | null;
  lastTotal?: number;
  lastCheck?: string;
  /** Total-price history, newest last; only stored when the price changes. */
  history: { t: string; total: number }[];
}

/** A saved search that alerts on new Buy It Now listings under a price. */
export interface SearchWatch {
  id: string;
  kind: "search";
  query: string;
  maxTotal: number;
  minTotal?: number;
  condition: string;
  /** Extra words that disqualify a title (case-insensitive), on top of the built-in junk filter. */
  exclude: string[];
  /** Words that must all appear in the title (case-insensitive). */
  mustInclude?: string[];
  /** Optional eBay category id (175672 = Laptops & Netbooks). */
  categoryId?: string;
  addedAt: string;
  lastCheck?: string;
  /** Item ids already reported (or present when the watch started). */
  seen: string[];
}

export type Watch = ItemWatch | SearchWatch;

interface StoreFile {
  nextId: number;
  watches: Watch[];
}

/** data/watchlist.json next to the repo, or $BAEWATCH_DATA/watchlist.json. */
export const WATCHLIST_PATH = path.join(
  process.env.BAEWATCH_DATA || path.join(__dirname, "..", "..", "data"),
  "watchlist.json"
);

export function readStore(): StoreFile {
  try {
    const s = JSON.parse(fs.readFileSync(WATCHLIST_PATH, "utf-8"));
    return { nextId: s.nextId || 1, watches: Array.isArray(s.watches) ? s.watches : [] };
  } catch (e: any) {
    if (e.code === "ENOENT") return { nextId: 1, watches: [] };
    throw new Error(`Can't read ${WATCHLIST_PATH}: ${e.message}`);
  }
}

function writeStore(s: StoreFile): void {
  fs.mkdirSync(path.dirname(WATCHLIST_PATH), { recursive: true });
  // Write-then-rename so a reader (MCP server vs. the cron checker) never sees half a file.
  const tmp = `${WATCHLIST_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2));
  fs.renameSync(tmp, WATCHLIST_PATH);
}

/** Re-read, modify, write. Keeps the window for lost updates to milliseconds. */
export function updateStore<T>(fn: (s: StoreFile) => T): T {
  const s = readStore();
  const out = fn(s);
  writeStore(s);
  return out;
}

export function addWatch(w: Omit<ItemWatch, "id"> | Omit<SearchWatch, "id">): Watch {
  return updateStore((s) => {
    const watch = { ...w, id: `w${s.nextId++}` } as Watch;
    s.watches.push(watch);
    return watch;
  });
}

export function removeWatch(id: string): Watch | null {
  return updateStore((s) => {
    const i = s.watches.findIndex((w) => w.id === id);
    return i === -1 ? null : s.watches.splice(i, 1)[0];
  });
}

/** Merge checked copies back by id, so watches added/removed during a check aren't clobbered. */
export function saveChecked(checked: Watch[]): void {
  const byId = new Map(checked.map((w) => [w.id, w]));
  updateStore((s) => {
    s.watches = s.watches.map((w) => byId.get(w.id) ?? w);
  });
}
