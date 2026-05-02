import type { Request } from "express";

/**
 * Canonical resolver for the public-facing app origin (scheme + host, no
 * trailing slash). Used for building Stripe redirect URLs, payment links,
 * email links, and any other user-clickable URL the server emits.
 *
 * Resolution order:
 *   1. APP_ORIGIN env var (preferred, immune to host-header poisoning)
 *   2. REPLIT_DOMAINS env var (first comma-separated entry, https)
 *   3. Request headers (X-Forwarded-Proto/Host, then req.headers.host)
 *      — only available when a Request is passed in (i.e. inside a route
 *      handler). For background jobs/webhooks pass nothing and rely on
 *      one of the env vars above.
 */
export function getAppBaseUrl(req?: Request): string {
  if (process.env.APP_ORIGIN) {
    return process.env.APP_ORIGIN.replace(/\/$/, "");
  }
  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  }
  if (req) {
    const proto =
      (req.headers["x-forwarded-proto"] as string | undefined) ||
      req.protocol ||
      "https";
    const host =
      (req.headers["x-forwarded-host"] as string | undefined) ||
      req.headers.host;
    if (host) return `${proto}://${host}`;
  }
  // Final fallback — production hostname so emails/links sent from cron jobs
  // still go somewhere valid if neither env var is configured.
  return "https://leaseshieldapp.com";
}
