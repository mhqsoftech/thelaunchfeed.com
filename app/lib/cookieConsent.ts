"use client";

export const TLF_COOKIE_CONSENT_KEY = "tlf_cookie_consent";
export const TLF_OPEN_SETTINGS_EVENT = "tlf-open-cookie-settings";

export type CookieConsentSettings = {
  essential: true;
  analytics: boolean;
  decidedAt: string;
  version: string;
};

/**
 * Reads user cookie consent from localStorage.
 * Returns null if the user hasn't made a choice yet.
 */
export function getStoredConsent(): CookieConsentSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TLF_COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.analytics === "boolean") {
      return parsed as CookieConsentSettings;
    }
  } catch {
    // If invalid JSON, treat as no consent
  }
  return null;
}

/**
 * Updates Google Consent Mode v2 and Microsoft Clarity tracking states.
 */
export function applyConsentToTrackers(settings: CookieConsentSettings) {
  if (typeof window === "undefined") return;

  const state = settings.analytics ? "granted" : "denied";

  // Google Analytics / Google Consent Mode v2
  if (typeof (window as unknown as { gtag?: Function }).gtag === "function") {
    (window as unknown as { gtag: Function }).gtag("consent", "update", {
      analytics_storage: state,
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  }

  // Microsoft Clarity consent API
  if (typeof (window as unknown as { clarity?: Function }).clarity === "function") {
    if (settings.analytics) {
      (window as unknown as { clarity: Function }).clarity("consent");
    }
  }
}

/**
 * Saves user cookie consent choices to localStorage and applies them to trackers immediately.
 */
export function saveConsent(analyticsGranted: boolean): CookieConsentSettings {
  const settings: CookieConsentSettings = {
    essential: true,
    analytics: analyticsGranted,
    decidedAt: new Date().toISOString(),
    version: "1.0",
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(TLF_COOKIE_CONSENT_KEY, JSON.stringify(settings));
    } catch {}
    applyConsentToTrackers(settings);
  }

  return settings;
}

/**
 * Clears stored cookie consent from localStorage (useful for re-testing or explicit reset).
 */
export function resetConsent() {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(TLF_COOKIE_CONSENT_KEY);
    } catch {}
  }
}

/**
 * Triggers the cookie consent modal/banner to reopen so the user can review or change their preferences.
 */
export function openCookieSettings() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TLF_OPEN_SETTINGS_EVENT));
  }
}
