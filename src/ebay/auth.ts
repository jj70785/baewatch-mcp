import { loadConfig } from "./config.js";

/**
 * Application access token (OAuth client-credentials grant).
 *
 * The Browse API only needs an app token, so no user login or refresh token is
 * involved: App ID + Cert ID are enough, and the token is re-minted every ~2h.
 */
let cached: { token: string; expiresAt: number } | null = null;

export function apiBase(): string {
  return loadConfig().ebay.environment === "sandbox"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
}

export async function getAppToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const { appId, certId } = loadConfig().ebay;
  const res = await fetch(`${apiBase()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${appId}:${certId}`).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });

  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    if (body.error === "invalid_client") {
      throw new Error("Invalid credentials: check appId (Client ID) and certId (Client Secret).");
    }
    throw new Error(`Token request failed (${res.status}): ${JSON.stringify(body)}`);
  }

  // Refresh a minute early so a token never expires mid-request.
  cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return cached.token;
}

export function resetToken(): void {
  cached = null;
}
