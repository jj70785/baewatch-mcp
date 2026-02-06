import eBayApi from "ebay-api";
import { loadConfig } from "./client.js";

let apiInstance: eBayApi | null = null;

/**
 * Get or create an authenticated eBay API instance.
 * The ebay-api package handles OAuth token refresh automatically
 * when configured with a refresh token.
 */
export function getEbayApi(): eBayApi {
  if (apiInstance) {
    return apiInstance;
  }

  const config = loadConfig();

  apiInstance = new eBayApi({
    appId: config.ebay.appId,
    certId: config.ebay.certId,
    devId: config.ebay.devId,
    sandbox: config.ebay.environment === "sandbox",
    siteId: eBayApi.SiteId.EBAY_US,
    marketplaceId: eBayApi.MarketplaceId.EBAY_US,
    ruName: "-",
    // Application-level scope only (for client credentials grant)
    scope: [
      "https://api.ebay.com/oauth/api_scope",
    ],
  });

  // Set the OAuth2 refresh token so the SDK can auto-refresh access tokens.
  // User-level API calls (Browse API etc.) will use this token.
  if (config.ebay.refreshToken) {
    apiInstance.OAuth2.setCredentials({
      access_token: "",
      refresh_token: config.ebay.refreshToken,
      expires_in: 0,
    });
  }

  return apiInstance;
}

/**
 * Reset the API instance (useful if credentials change).
 */
export function resetEbayApi(): void {
  apiInstance = null;
}
