/**
 * IndexNow Protocol Client
 *
 * IndexNow instantly informs participating search engines (Bing, Yandex, Seznam, Naver)
 * about latest URL changes, additions, and deletions.
 *
 * Documentation: https://www.indexnow.org/documentation
 */

export interface IndexNowResult {
  success: boolean;
  httpStatus: number;
  urls: string[];
  responseBody?: any;
  errorMessage?: string;
}

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com").replace(/\/+$/, "");

/**
 * Gets the configured IndexNow key or generates a stable deterministic key
 */
export function getIndexNowKey(): string {
  if (process.env.INDEXNOW_KEY && process.env.INDEXNOW_KEY.trim().length >= 8) {
    return process.env.INDEXNOW_KEY.trim();
  }
  if (process.env.WEB_INDEXING_API_KEY) {
    const sanitized = process.env.WEB_INDEXING_API_KEY.replace(/[^a-zA-Z0-9]/g, "");
    if (sanitized.length >= 8) return sanitized.slice(0, 32);
  }
  return "thelaunchfeedindexnowkey2026";
}

/**
 * Submits one or more URLs to IndexNow
 */
export async function submitToIndexNow(urls: string | string[]): Promise<IndexNowResult> {
  const prodAppUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com")
    .replace(/^http:\/\/localhost(:\d+)?/, "https://thelaunchfeed.com")
    .replace(/\/+$/, "");

  const urlList = (Array.isArray(urls) ? urls : [urls])
    .map((u) => u.trim().replace(/^http:\/\/localhost(:\d+)?/, "https://thelaunchfeed.com"))
    .filter((u) => u.startsWith("http"));

  if (urlList.length === 0) {
    return {
      success: true,
      httpStatus: 200,
      urls: [],
      responseBody: { message: "No valid URLs provided" },
    };
  }

  const key = getIndexNowKey();
  const host = "thelaunchfeed.com";
  const keyLocation = `${prodAppUrl}/${key}.txt`;

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        host,
        key,
        keyLocation,
        urlList,
      }),
    });

    const bodyText = await res.text();
    let bodyJson: any = null;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      bodyJson = { raw: bodyText };
    }

    // IndexNow returns 200 (OK) or 202 (Accepted) on success
    if (res.status === 200 || res.status === 202) {
      return {
        success: true,
        httpStatus: res.status,
        urls: urlList,
        responseBody: bodyJson,
      };
    }

    return {
      success: false,
      httpStatus: res.status,
      urls: urlList,
      responseBody: bodyJson,
      errorMessage: `IndexNow responded with status ${res.status}: ${bodyText || "Unknown error"}`,
    };
  } catch (err: any) {
    return {
      success: false,
      httpStatus: 500,
      urls: urlList,
      errorMessage: err?.message || String(err),
    };
  }
}
