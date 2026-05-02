import type { Express } from "express";
import { updateSubmissionStatusFromScreening } from "./_shared";

export async function registerDigitalDelveWebhooksRoutes(app: Express) {
  // ============================================================
  // WEBHOOK ROUTES (No Auth - called by DigitalDelve)
  // ============================================================

  function verifyWebhookToken(token: string | undefined): boolean {
    const webhookSecret = process.env.DIGITAL_DELVE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn("DIGITAL_DELVE_WEBHOOK_SECRET not set - webhooks are unprotected");
      return true;
    }
    return token === webhookSecret;
  }

  // Helper to extract XML from webhook body (handles both raw XML and form-urlencoded)
  function extractXmlFromWebhookBody(req: any): string {
    // Western Verify sends webhooks as application/x-www-form-urlencoded with XML in 'request' param
    if (req.body && typeof req.body === 'object' && req.body.request) {
      console.log("[Webhook] Extracted XML from form-urlencoded 'request' parameter");
      return req.body.request;
    }
    // Fallback to raw body if sent as plain XML
    if (typeof req.body === 'string') {
      return req.body;
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
