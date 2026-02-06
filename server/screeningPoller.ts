// Screening status poller
// Monitors screening orders that are already marked complete (by webhook) but haven't
// had email notifications sent yet, and retries sending those notifications.
// IMPORTANT: Western Verify has NO status-check API. Order completion is determined
// ONLY by webhook callbacks, never by SSO calls.

import { storage } from "./storage";
import { emailService } from "./emailService";

let pollerInterval: NodeJS.Timeout | null = null;
const POLLING_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const INITIAL_DELAY_MS = 30 * 1000; // 30 seconds after startup

/**
 * Main polling function - retries email notifications for completed orders.
 * Western Verify has NO status-check API, so this poller does NOT attempt to
 * determine completion. It only picks up orders that webhooks have already
 * marked complete but whose email notifications failed or weren't sent yet.
 */
export async function pollScreeningStatus(): Promise<void> {
  console.log("[Poller] Starting notification retry check...");
  
  try {
    const orders = await storage.getInProgressScreeningOrdersWithOwnerInfo();
    
    if (orders.length === 0) {
      console.log("[Poller] No orders needing notification retry");
      return;
    }
    
    const completedNeedingNotification = orders.filter(
      o => o.order.status === 'complete' && !o.order.completionNotifiedAt
    );
    
    if (completedNeedingNotification.length === 0) {
      console.log("[Poller] No completed orders needing notification");
      return;
    }
    
    console.log(`[Poller] Found ${completedNeedingNotification.length} completed orders needing notification`);
    
    for (const orderInfo of completedNeedingNotification) {
      const { order, ownerEmail, ownerFirstName, personName, propertyName, unitName } = orderInfo;
      
      let emailSent = false;
      if (ownerEmail) {
        const submissionUrl = `/rental-submissions/${order.submissionId}`;
        emailSent = await emailService.sendScreeningCompleteNotification(
          { email: ownerEmail, firstName: ownerFirstName || undefined },
          personName,
          propertyName,
          unitName,
          submissionUrl
        );
        
        if (emailSent) {
          console.log(`[Poller] Sent completion notification to ${ownerEmail}`);
        } else {
          console.log(`[Poller] Failed to send notification to ${ownerEmail}, will retry next cycle`);
        }
      }
      
      if (emailSent || !ownerEmail) {
        await storage.updateRentalScreeningOrder(order.id, {
          completionNotifiedAt: new Date(),
        });
      }
    }
    
    console.log("[Poller] Notification retry check complete");
  } catch (error) {
    console.error("[Poller] Error during polling:", error);
  }
}

/**
 * Start the notification retry poller
 */
export function startScreeningPoller(): void {
  console.log("[Poller] Starting screening status poller (every 15 minutes)");
  
  // Initial check after 5 minute delay
  setTimeout(() => {
    pollScreeningStatus().catch(e => console.error("[Poller] Initial poll error:", e));
  }, INITIAL_DELAY_MS);
  
  // Schedule hourly checks
  pollerInterval = setInterval(() => {
    pollScreeningStatus().catch(e => console.error("[Poller] Interval poll error:", e));
  }, POLLING_INTERVAL_MS);
  
  console.log("[Poller] Screening poller scheduled (every 15 minutes)");
}

/**
 * Stop the polling job
 */
export function stopScreeningPoller(): void {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log("[Poller] Screening poller stopped");
  }
}
