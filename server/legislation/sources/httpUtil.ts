/**
 * Shared HTTP helpers for legislation source adapters.
 *
 * Adds:
 *  - A descriptive User-Agent (federal APIs frequently 403 requests with no UA)
 *  - One automatic retry on 403/429/5xx with a 30s backoff
 *
 * Use `fetchWithRetry` in adapters that hit federal APIs (Federal Register, eCFR,
 * Congress.gov, etc.) where transient rate limiting / WAF blocks are common.
 */

const LEASESHIELD_USER_AGENT =
  'LeaseShieldApp/1.0 (Legislative Monitoring; +https://leaseshield.app; contact: support@leaseshield.app)';

const RETRY_STATUSES = new Set([403, 429, 500, 502, 503, 504]);
const RETRY_DELAY_MS = 30_000;

export interface FetchWithRetryOptions extends RequestInit {
  /** Override the default 1 retry. */
  maxRetries?: number;
  /** Override the default 30s backoff. */
  retryDelayMs?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wrapper around fetch that:
 *  - Always sends a descriptive User-Agent (additional headers from caller win)
 *  - Retries once on 403/429/5xx after a configurable backoff
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const { maxRetries = 1, retryDelayMs = RETRY_DELAY_MS, headers, ...rest } = options;

  const mergedHeaders: Record<string, string> = {
    'User-Agent': LEASESHIELD_USER_AGENT,
    'Accept': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };

  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { ...rest, headers: mergedHeaders });
      if (response.ok || !RETRY_STATUSES.has(response.status)) {
        return response;
      }
      lastResponse = response;
      if (attempt < maxRetries) {
        console.warn(
          `[fetchWithRetry] ${response.status} from ${new URL(url).host} — retrying in ${retryDelayMs / 1000}s (attempt ${attempt + 1}/${maxRetries})`
        );
        await delay(retryDelayMs);
      }
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        console.warn(
          `[fetchWithRetry] Network error from ${new URL(url).host} — retrying in ${retryDelayMs / 1000}s (attempt ${attempt + 1}/${maxRetries}): ${(err as Error).message}`
        );
        await delay(retryDelayMs);
      }
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError ?? new Error(`fetchWithRetry exhausted retries for ${url}`);
}

export { LEASESHIELD_USER_AGENT };
