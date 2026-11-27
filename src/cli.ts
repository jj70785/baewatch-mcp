/**
 * BAEWATCH command line, for cron:
 *   node dist/cli.js check [--notify]   check every watch; with --notify, send alerts to Telegram
 *   node dist/cli.js list               print the watchlist
 */
import { readStore, WATCHLIST_PATH } from "./watch/store.js";
import { runChecks } from "./watch/check.js";
import { notifyTelegram } from "./watch/notify.js";

async function main() {
  const [cmd = "check", ...flags] = process.argv.slice(2);
  const stamp = new Date().toISOString().slice(0, 19).replace("T", " ");

  if (cmd === "list") {
    const ws = readStore().watches;
    console.log(`${ws.length} watch(es) in ${WATCHLIST_PATH}`);
    for (const w of ws)
      console.log(w.kind === "item" ? `${w.id} item ${w.status} $${w.lastTotal} ${w.title}` : `${w.id} search "${w.query}" <= $${w.maxTotal} (${w.seen.length} seen)`);
    return;
  }
  if (cmd !== "check") throw new Error(`Unknown command "${cmd}". Use check or list.`);

  const r = await runChecks();
  const alerts = r.events.filter((e) => e.level === "alert");
  console.log(`[${stamp}] checked ${r.checked}, ${r.events.length} event(s), ${alerts.length} alert(s), ${r.errors.length} error(s)`);
  for (const e of r.events) console.log(`  ${e.level}: ${e.text} ${e.link ?? ""}`);
  for (const e of r.errors) console.log(`  error: ${e}`);

  if (flags.includes("--notify") && alerts.length) {
    const sent = await notifyTelegram(alerts);
    console.log(sent ? "  sent to Telegram" : "  TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set; alerts only printed");
  }
  // Every watch failing (e.g. eBay or network down) is worth a non-zero exit for the log.
  if (r.errors.length && !r.checked) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`BAEWATCH check failed: ${e.message}`);
  process.exit(1);
});
