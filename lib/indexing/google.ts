/**
 * Google Web Search Indexing API Client
 *
 * Authenticates using WEB_INDEXING_API_KEY:
 * - If WEB_INDEXING_API_KEY is an API Key (e.g. AIzaSy...), calls with ?key= and x-goog-api-key headers.
 * - If WEB_INDEXING_API_KEY is a JSON string or Base64-encoded Service Account, automatically generates signed OAuth2 token.
 *
 * Endpoint: https://indexing.googleapis.com/v3/urlNotifications:publish
 * Daily Quota: Max 200 URLs/day.
 */

import crypto from "node:crypto";

export type IndexingNotificationType = "URL_UPDATED" | "URL_DELETED";

export interface GoogleIndexingResult {
  success: boolean;
  httpStatus: number;
  url: string;
  type: IndexingNotificationType;
  responseBody?: any;
  errorMessage?: string;
  notifiedAt?: string;
}

// In-memory OAuth2 token cache if service account JSON is used in WEB_INDEXING_API_KEY
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function parseCredentialsFromKey(key: string): { clientEmail: string; privateKey: string } | null {
  if (!key) return null;
  let jsonStr = key.trim();

  if (!jsonStr.startsWith("{") && jsonStr.length > 30) {
    try {
      const decoded = Buffer.from(jsonStr, "base64").toString("utf-8");
      if (decoded.trim().startsWith("{")) {
        jsonStr = decoded;
      }
    } catch {}
  }

  if (jsonStr.startsWith("{")) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.client_email && parsed.private_key) {
        return {
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key.replace(/\\n/g, "\n"),
        };
      }
    } catch {}
  }

  return null;
}

async function getOAuth2AccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.accessToken;
  }

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/indexing",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signInput);
  const signature = signer.sign(privateKey, "base64url");
  const assertion = `${signInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = (await res.json()) as any;
  if (!res.ok || !data.access_token) {
    throw new Error(`Failed to exchange OAuth2 token: ${JSON.stringify(data)}`);
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in || 3600),
  };

  return data.access_token;
}

/**
 * Publishes a URL notification to Google Web Search Indexing API using WEB_INDEXING_API_KEY
 */
export async function publishGoogleUrlNotification(
  url: string,
  type: IndexingNotificationType = "URL_UPDATED"
): Promise<GoogleIndexingResult> {
  // Ensure production domain is used
  let cleanUrl = url.trim().replace(/^http:\/\/localhost(:\d+)?/, "https://thelaunchfeed.com");
  const apiKey = process.env.WEB_INDEXING_API_KEY?.trim();

  if (!apiKey) {
    return {
      success: false,
      httpStatus: 400,
      url: cleanUrl,
      type,
      errorMessage: "WEB_INDEXING_API_KEY is not configured in environment variables",
    };
  }

  const saCreds = parseCredentialsFromKey(apiKey);
  let endpoint = "https://indexing.googleapis.com/v3/urlNotifications:publish";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    if (saCreds) {
      const token = await getOAuth2AccessToken(saCreds.clientEmail, saCreds.privateKey);
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      endpoint = `https://indexing.googleapis.com/v3/urlNotifications:publish?key=${encodeURIComponent(apiKey)}`;
      headers["x-goog-api-key"] = apiKey;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        url: cleanUrl,
        type,
      }),
    });

    const bodyText = await res.text();
    let bodyJson: any = null;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      bodyJson = { raw: bodyText };
    }

    if (res.ok) {
      return {
        success: true,
        httpStatus: res.status,
        url: cleanUrl,
        type,
        responseBody: bodyJson,
        notifiedAt: bodyJson?.urlNotificationMetadata?.latestUpdate?.notifyTime || new Date().toISOString(),
      };
    } else {
      let errMsg = `Web Search Indexing API error (${res.status})`;
      if (bodyJson?.error?.message) {
        errMsg = bodyJson.error.message;
      }

      return {
        success: false,
        httpStatus: res.status,
        url: cleanUrl,
        type,
        responseBody: bodyJson,
        errorMessage: errMsg,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      httpStatus: 500,
      url: cleanUrl,
      type,
      errorMessage: err?.message || String(err),
    };
  }
}

/**
 * Queries Google Web Search Indexing API metadata for a specific URL
 */
export async function getGoogleUrlMetadata(url: string): Promise<any> {
  let cleanUrl = url.trim().replace(/^http:\/\/localhost(:\d+)?/, "https://thelaunchfeed.com");
  const apiKey = process.env.WEB_INDEXING_API_KEY?.trim();

  if (!apiKey) {
    return { error: "WEB_INDEXING_API_KEY is not configured in environment variables" };
  }

  const saCreds = parseCredentialsFromKey(apiKey);
  let endpoint = `https://indexing.googleapis.com/v3/urlNotifications/metadata?url=${encodeURIComponent(cleanUrl)}`;
  const headers: Record<string, string> = {};

  if (saCreds) {
    const token = await getOAuth2AccessToken(saCreds.clientEmail, saCreds.privateKey);
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    endpoint += `&key=${encodeURIComponent(apiKey)}`;
    headers["x-goog-api-key"] = apiKey;
  }

  const res = await fetch(endpoint, { headers });
  const bodyText = await res.text();
  try {
    return JSON.parse(bodyText);
  } catch {
    return { raw: bodyText };
  }
}
