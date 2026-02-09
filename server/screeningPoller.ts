import { storage } from "./storage";
import { emailService } from "./emailService";
import { syncScreeningStatus, type ScreeningCredentials } from "./digitalDelveService";
import { decryptCredentials } from "./crypto";

let pollerInterval: NodeJS.Timeout | null = null;
const POLLING_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const INITIAL_DELAY_MS = 60 * 1000; // 1 minute after startup

/**
 * Screening Poller - Refreshes SSO URLs and retries failed notifications.
 * 
 * IMPORTANT: This poller does NOT determine completion status.
 * Completion is ONLY determined by webhooks from Western Verify.
 * SSO redirect URLs are NOT reliable indicators of report readiness -
 * Western Verify returns them even for draft/pending orders.
 * 
 * This poller:
 * 1. Refreshes SSO portal URLs for pending orders (so landlords can check status)
 * 2. Retries email notifications for orders that completed via webhook but 
 *    whose notification emails failed to send
 */
export async function pollScreeningStatus(): Promise<void> {
  console.log("[Poller] Starting SSO URL refresh and notification retry...");

  try {
    const pendingOrders = await storage.getAllPendingScreeningOrdersWithOwner();

    if (pendingOrders.length === 0) {
      console.log("[Poller] No pending screening orders to refresh");
    } else {
      console.log(`[Poller] Refreshing SSO URLs for ${pendingOrders.length} pending orders`);

      const credentialCache = new Map<string, ScreeningCredentials | null>();

      for (const orderInfo of pendingOrders) {
        const { order, ownerUserId } = orderInfo;

        try {
          if (!credentialCache.has(ownerUserId)) {
            const landlordCreds = await storage.getLandlordScreeningCredentials(ownerUserId);
            if (landlordCreds && landlordCreds.status === 'verified') {
              try {
                const decrypted = decryptCredentials({
                  encryptedUsername: landlordCreds.encryptedUsername,
                  encryptedPassword: landlordCreds.encryptedPassword,
                  encryptionIv: landlordCreds.encryptionIv,
                });
                credentialCache.set(ownerUserId, {
                  username: decrypted.username,
                  password: decrypted.password,
                  invitationId: landlordCreds.defaultInvitationId || undefined,
                });
              } catch (e) {
                console.error(`[Poller] Failed to decrypt credentials for user ${ownerUserId}`);
                credentialCache.set(ownerUserId, null);
              }
            } else {
              const systemUsername = process.env.DIGITAL_DELVE_USERNAME;
              const systemPassword = process.env.DIGITAL_DELVE_PASSWORD;
              if (systemUsername && systemPassword) {
                credentialCache.set(ownerUserId, { username: systemUsername, password: systemPassword });
              } else {
                credentialCache.set(ownerUserId, null);
              }
            }
          }

          const credentials = credentialCache.get(ownerUserId);
          if (!credentials) {
            console.log(`[Poller] No credentials available for user ${ownerUserId}, skipping order ${order.id}`);
            continue;
          }

          await new Promise(resolve => setTimeout(resolve, 1000));

          await syncScreeningStatus(order.id, credentials);
        } catch (error) {
          console.error(`[Poller] Error refreshing SSO URL for order ${order.id}:`, error);
        }
      }
    }

    const completedOrders = await storage.getInProgressScreeningOrdersWithOwnerInfo();
    const unnotified = completedOrders.filter(
      o => o.order.status === 'complete' && !o.order.completionNotifiedAt
    );

    if (unnotified.length > 0) {
      console.log(`[Poller] Retrying ${unnotified.length} failed completion notifications`);
      for (const orderInfo of unnotified) {
        const { order, ownerEmail, ownerFirstName, personName, propertyName, unitName } = orderInfo;
        if (ownerEmail) {
          const submissionUrl = `/rental-submissions/${order.submissionId}`;
          const emailSent = await emailService.sendScreeningCompleteNotification(
            { email: ownerEmail, firstName: ownerFirstName || undefined },
            personName,
            propertyName,
            unitName,
            submissionUrl
          );
          if (emailSent) {
            await storage.updateRentalScreeningOrder(order.id, {
              completionNotifiedAt: new Date(),
            });
            console.log(`[Poller] Sent completion notification to ${ownerEmail} for ${personName}`);
          }
        }
      }
    }

    console.log("[Poller] SSO URL refresh and notification retry complete");
  } catch (error) {
    console.error("[Poller] Error during polling:", error);
  }
}

export function startScreeningPoller(): void {
  console.log("[Poller] Starting screening poller (every 30 minutes)");

  setTimeout(() => {
    pollScreeningStatus().catch(e => console.error("[Poller] Initial poll error:", e));
  }, INITIAL_DELAY_MS);

  pollerInterval = setInterval(() => {
    pollScreeningStatus().catch(e => console.error("[Poller] Interval poll error:", e));
  }, POLLING_INTERVAL_MS);
}

export function stopScreeningPoller(): void {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log("[Poller] Screening poller stopped");
  }
}
