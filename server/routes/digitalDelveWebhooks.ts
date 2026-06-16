import type { Express } from "express";
import { updateSubmissionStatusFromScreening } from "./_shared";

export async function registerDigitalDelveWebhooksRoutes(app: Express) {
  // ============================================================
  // WEBHOOK ROUTES (No Auth - called by DigitalDelve)
  // ============================================================

  function verifyWebhookToken(token: string | undefined): boolean {
    const webhookSecret = process.env.DIGITAL_DELVE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // Fail CLOSED in production: an unprotected screening webhook would let
      // anyone write screening statuses/results. Only allow the open path in
      // development so local testing without the secret still works.
      if (process.env.NODE_ENV === "production") {
        console.error("DIGITAL_DELVE_WEBHOOK_SECRET not set in production - rejecting webhook");
        return false;
      }
      console.warn("DIGITAL_DELVE_WEBHOOK_SECRET not set - webhooks are unprotected (dev only)");
      return true;
    }
    return token === webhookSecret;
  }

  // Helper to extract XML from a webhook body. Western Verify's transport has
  // varied (raw XML posted directly vs. form-urlencoded with the XML in a
  // 'request' param), and these routes use a catch-all text body parser, so the
  // body can arrive as either a parsed object or a raw string. Result webhooks
  // are the ONLY authority for marking a screening complete, so this MUST never
  // silently drop a valid payload. Handle every shape defensively.
  function extractXmlFromWebhookBody(req: any): string {
    // Case 1: a body parser already produced an object with a 'request' field.
    if (req.body && typeof req.body === 'object' && req.body.request) {
      console.log("[Webhook] Extracted XML from parsed 'request' parameter");
      return String(req.body.request);
    }

    // Case 2: raw string body (the catch-all text parser handles all content types).
    if (typeof req.body === 'string') {
      const raw = req.body.trim();

      // 2a. Raw XML posted directly (the observed Western Verify format).
      if (raw.startsWith('<')) {
        return raw;
      }

      // 2b. Form-urlencoded posted as text, e.g. "request=%3C%3Fxml...%3E".
      if (raw.includes('request=')) {
        try {
          const reqVal = new URLSearchParams(raw).get('request');
          if (reqVal && reqVal.includes('<')) {
            console.log("[Webhook] Extracted XML from URL-encoded 'request' field");
            return reqVal;
          }
        } catch {
          /* fall through */
        }
      }

      // 2c. Whole body is URL-encoded XML without a key (decode best-effort).
      if (raw.includes('%3C')) {
        try {
          const decoded = decodeURIComponent(raw);
          if (decoded.includes('<')) {
            console.log("[Webhook] Extracted XML by decoding URL-encoded body");
            return decoded;
          }
        } catch {
          /* fall through */
        }
      }

      return raw;
    }

    return '';
  }

  // Status update webhook from DigitalDelve
  app.post('/api/webhooks/digitaldelve/status', async (req, res) => {
    try {
      const token = req.query.token as string | undefined;
      if (!verifyWebhookToken(token)) {
        console.warn("Invalid webhook token received for status webhook");
        return res.status(401).send("Unauthorized");
      }

      console.log("Received DigitalDelve status webhook");
      console.log("[Webhook] Content-Type:", req.headers['content-type']);
      console.log("[Webhook] Body type:", typeof req.body);
      console.log("[Webhook] Body keys:", req.body && typeof req.body === 'object' ? Object.keys(req.body) : 'N/A');
      
      const xml = extractXmlFromWebhookBody(req);
      
      if (!xml || xml.length < 20 || !xml.includes('<')) {
        console.warn("Invalid XML body received:", xml?.substring(0, 100));
        return res.status(400).send("Invalid XML body");
      }

      console.log("[Webhook] Parsed XML (first 500 chars):", xml.substring(0, 500));

      const { handleStatusWebhook } = await import("../digitalDelveService");
      const result = await handleStatusWebhook(xml);
      
      if (result.success) {
        // Auto-update submission status based on screening progress
        if (result.submissionId) {
          await updateSubmissionStatusFromScreening(result.submissionId);
        }
        res.status(200).send("OK");
      } else {
        res.status(400).send("Failed to process webhook");
      }
    } catch (error) {
      console.error("Error processing status webhook:", error);
      res.status(500).send("Internal error");
    }
  });

  // Result webhook from DigitalDelve
  app.post('/api/webhooks/digitaldelve/result', async (req, res) => {
    try {
      const token = req.query.token as string | undefined;
      if (!verifyWebhookToken(token)) {
        console.warn("Invalid webhook token received for result webhook");
        return res.status(401).send("Unauthorized");
      }

      console.log("Received DigitalDelve result webhook");
      console.log("[Webhook] Content-Type:", req.headers['content-type']);
      console.log("[Webhook] Body type:", typeof req.body);
      console.log("[Webhook] Body keys:", req.body && typeof req.body === 'object' ? Object.keys(req.body) : 'N/A');
      
      const xml = extractXmlFromWebhookBody(req);
      
      if (!xml || xml.length < 20 || !xml.includes('<')) {
        console.warn("Invalid XML body received:", xml?.substring(0, 100));
        return res.status(400).send("Invalid XML body");
      }

      console.log("[Webhook] Parsed XML (first 500 chars):", xml.substring(0, 500));

      const { handleResultWebhook } = await import("../digitalDelveService");
      const result = await handleResultWebhook(xml);
      
      if (result.success) {
        // Auto-update submission status based on screening progress
        if (result.submissionId) {
          await updateSubmissionStatusFromScreening(result.submissionId);
        }
        res.status(200).send("OK");
      } else {
        res.status(400).send("Failed to process webhook");
      }
    } catch (error) {
      console.error("Error processing result webhook:", error);
      res.status(500).send("Internal error");
    }
  });
}
