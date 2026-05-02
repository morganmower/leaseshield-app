import type { Express } from "express";
import { storage } from "../storage";

export async function registerResendWebhookRoute(app: Express) {
  // Resend webhook handler for email engagement tracking
  app.post('/api/resend-webhook', async (req: any, res) => {
    try {
      const event = req.body;
      
      if (!event || !event.type) {
        return res.status(400).json({ message: 'Invalid webhook payload' });
      }

      console.log(`📧 Resend webhook: ${event.type}`);

      const data = event.data;
      
      switch (event.type) {
        case 'email.delivered': {
          if (data?.email_id) {
            await storage.updateEmailEventStatus(data.email_id, 'delivered', new Date());
            console.log(`  ✓ Email ${data.email_id} marked as delivered`);
          }
          break;
        }

        case 'email.opened': {
          if (data?.email_id) {
            await storage.updateEmailEventStatus(data.email_id, 'opened', new Date());
            console.log(`  ✓ Email ${data.email_id} marked as opened`);
          }
          break;
        }

        case 'email.clicked': {
          if (data?.email_id) {
            await storage.updateEmailEventStatus(data.email_id, 'clicked', new Date());
            console.log(`  ✓ Email ${data.email_id} marked as clicked`);
          }
          break;
        }

        case 'email.bounced': {
          if (data?.email_id) {
            await storage.updateEmailEventStatus(data.email_id, 'bounced', new Date());
            console.log(`  ⚠ Email ${data.email_id} bounced`);
          }
          break;
        }

        case 'email.complained': {
          if (data?.email_id) {
            await storage.updateEmailEventStatus(data.email_id, 'complained', new Date());
            console.log(`  ⚠ Email ${data.email_id} received complaint`);
          }
          break;
        }

        default:
          console.log(`  Unhandled Resend event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('❌ Error processing Resend webhook:', error);
      res.status(500).json({ message: 'Webhook processing failed' });
    }
  });
}
