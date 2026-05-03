import type { Express } from "express";
import { getUncachableResendClient } from "../resend";

const ADMIN_EMAIL = "support@leaseshieldapp.com";

export async function registerWaitlistRoutes(app: Express) {
  app.post("/api/waitlist/state", async (req, res) => {
    try {
      const { email, stateId, stateName } = req.body || {};

      if (!email || typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ message: "Valid email required" });
      }
      if (!stateId || typeof stateId !== "string" || stateId.length !== 2) {
        return res.status(400).json({ message: "Valid state required" });
      }

      const safeStateName = (typeof stateName === "string" ? stateName : stateId).slice(0, 60);
      const safeEmail = email.trim().slice(0, 200);
      const safeStateId = stateId.toUpperCase().slice(0, 2);

      const escapeHtml = (s: string) =>
        s
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");

      const htmlStateName = escapeHtml(safeStateName);
      const htmlStateId = escapeHtml(safeStateId);
      const htmlEmail = escapeHtml(safeEmail);

      console.log(
        `[waitlist] state-request stateId=${safeStateId} stateName="${safeStateName}" email="${safeEmail}"`
      );

      try {
        const { client, fromEmail } = await getUncachableResendClient();
        await client.emails.send({
          from: `LeaseShield App <${fromEmail}>`,
          to: ADMIN_EMAIL,
          subject: `State waitlist: ${safeStateName} (${safeStateId})`,
          html: `
            <p>A landing-page visitor asked to be notified when LeaseShield adds support for <strong>${htmlStateName} (${htmlStateId})</strong>.</p>
            <p><strong>Email:</strong> ${htmlEmail}</p>
            <p><em>Source: state-picker chip on landing page hero</em></p>
          `,
          text: `State waitlist request\n\nState: ${safeStateName} (${safeStateId})\nEmail: ${safeEmail}\nSource: state-picker chip on landing page hero`,
        });
      } catch (emailErr: any) {
        // Don't fail the request if email is misconfigured — we already logged it.
        console.error("[waitlist] resend send failed:", emailErr?.message || emailErr);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("[waitlist] error:", error);
      res.status(500).json({ message: "Failed to record waitlist request" });
    }
  });
}
