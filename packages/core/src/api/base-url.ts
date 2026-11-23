/**
 * Lunch Money API base URL handling. Dependency-free so the web UI can import it
 * (`@lunchmonitor/core/base-url`) without pulling Node-only code into the bundle.
 */

export const DEFAULT_BASE_URL = "https://api.lunchmoney.dev/v2";

/**
 * Resolve the configured base URL to a v2 API root.
 *
 * Configs written for the v1 API pointed at `https://dev.lunchmoney.app`
 * (optionally with `/v1`). That host serves no v2 endpoints and answers them
 * with a misleading 401, so such values fall back to the v2 default.
 */
export function resolveBaseUrl(baseUrl?: string): string {
  if (!baseUrl) return DEFAULT_BASE_URL;
  const url = baseUrl.trim().replace(/\/+$/, "");
  if (/^https?:\/\/dev\.lunchmoney\.app(\/v1)?$/i.test(url)) return DEFAULT_BASE_URL;
  return url;
}
