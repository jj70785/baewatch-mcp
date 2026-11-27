import * as fs from "fs";
import * as path from "path";
import { AppConfig, ConfigStatus } from "./types.js";

/**
 * Credentials can come from environment variables (handy for Hermes / other
 * MCP hosts) or from config/config.json. Env vars win when both are set.
 *
 *   EBAY_APP_ID   App ID (Client ID)
 *   EBAY_CERT_ID  Cert ID (Client Secret)
 *   EBAY_ZIP      Buyer ZIP code, so eBay returns real shipping costs (optional)
 *   EBAY_ENV      "production" (default) or "sandbox"
 *   BAEWATCH_CONFIG  Alternate path to a config.json
 */
export const CONFIG_PATH =
  process.env.BAEWATCH_CONFIG || path.join(__dirname, "../../config/config.json");

const isPlaceholder = (val: string | undefined) =>
  !val || val.startsWith("YOUR_") || val.trim() === "";

function readConfigFile(): { exists: boolean; config: Partial<AppConfig> | null; error?: string } {
  if (!fs.existsSync(CONFIG_PATH)) return { exists: false, config: null };
  try {
    return { exists: true, config: JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) };
  } catch {
    return { exists: true, config: null, error: `${CONFIG_PATH} contains invalid JSON.` };
  }
}

function resolve(): { config: AppConfig; fileExists: boolean; fileError?: string } {
  const file = readConfigFile();
  const ebay = file.config?.ebay ?? ({} as Partial<AppConfig["ebay"]>);
  const pick = (env: string | undefined, fromFile: string | undefined) =>
    !isPlaceholder(env) ? env!.trim() : !isPlaceholder(fromFile) ? fromFile!.trim() : "";

  return {
    fileExists: file.exists,
    fileError: file.error,
    config: {
      ebay: {
        appId: pick(process.env.EBAY_APP_ID, ebay.appId),
        certId: pick(process.env.EBAY_CERT_ID, ebay.certId),
        zip: pick(process.env.EBAY_ZIP, ebay.zip),
        environment:
          (process.env.EBAY_ENV || ebay.environment) === "sandbox" ? "sandbox" : "production",
      },
      defaults: {
        resultsLimit: file.config?.defaults?.resultsLimit ?? 10,
        marketplace: file.config?.defaults?.marketplace ?? "EBAY_US",
      },
    },
  };
}

export function checkConfigStatus(): ConfigStatus {
  const { config, fileExists, fileError } = resolve();
  const details = {
    configFile: fileExists ? CONFIG_PATH : null,
    hasAppId: !!config.ebay.appId,
    hasCertId: !!config.ebay.certId,
    zip: config.ebay.zip || null,
    environment: config.ebay.environment,
  };

  const missing: string[] = [];
  if (!details.hasAppId) missing.push("appId (EBAY_APP_ID)");
  if (!details.hasCertId) missing.push("certId (EBAY_CERT_ID)");

  if (missing.length > 0) {
    return {
      configured: false,
      message:
        (fileError ? fileError + " " : "") +
        `Missing: ${missing.join(", ")}. Set the env vars or copy config/config.example.json to config/config.json.`,
      details,
    };
  }
  return { configured: true, message: "eBay credentials are configured.", details };
}

export function loadConfig(): AppConfig {
  const status = checkConfigStatus();
  if (!status.configured) throw new Error(status.message);
  return resolve().config;
}
