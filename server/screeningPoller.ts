import { storage } from "./storage";
import { checkOrderStatus } from "./digitalDelveService";
import { decryptCredentials } from "./crypto";

const POLL_INTERVAL_MS = 60 * 1000; // Check every minute
const INITIAL_RETRY_DELAY_MS = 2 * 60 * 1000; // 2 minutes
const MAX_RETRY_DELAY_MS = 30 * 60 * 1000; // 30 minutes max backoff
const MAX_CONSECUTIVE_FAILURES = 10; // Mark as error after this many failures

let pollerInterval: NodeJS.Timeout | null = null;

async function updateSubmissionStatusFromScreening(submissionId: string): Promise<void> {
  try {
    const submission = await storage.getRentalSubmission(submissionId);
    if (!submission) return;
    
    const decision = await storage.getRentalDecision(submissionId);
    if (decision) return;
    
    const screeningOrders = await storage.getRentalScreeningOrdersBySubmission(submissionId);
    
    if (screeningOrders.length === 0) return;
    
    const normalizeStatus = (status: string): string => {
      const s = status.toLowerCase().trim();
      if (s === 'completed' || s === 'complete') return 'complete';
      if (s === 'in_progress' || s === 'in progress' || s === 'inprogress' || s === 'processing') return 'in_progress';
      if (s === 'sent' || s === 'pending') return 'sent';
      return s;
    };
    
    const normalizedStatuses = screeningOrders.map(o => normalizeStatus(o.status));
    const completeCount = normalizedStatuses.filter(s => s === 'complete').length;
    const inProgressCount = normalizedStatuses.filter(s => s === 'in_progress').length;
    const errorCount = normalizedStatuses.filter(s => s === 'error').length;
    
    let newStatus: string | null = null;
    
    if (completeCount > 0 && completeCount === screeningOrders.length) {
      newStatus = 'complete';
    } else if (inProgressCount > 0) {
      newStatus = 'in_progress';
    } else if (screeningOrders.length > errorCount) {
      newStatus = 'screening_requested';
    }
    
    const statusOrder = ['started', 'submitted', 'screening_requested', 'in_progress', 'complete'];
    if (newStatus && statusOrder.indexOf(newStatus) > statusOrder.indexOf(submission.status)) {
      await storage.updateRentalSubmission(submissionId, { status: newStatus as any });
      console.log(`[Poller] Updated submission ${submissionId} status to ${newStatus}`);
    }
  } catch (error) {
    console.error("[Poller] Error updating submission status:", error);
  }
}

async function pollSingleOrder(order: any): Promise<void> {
  const orderId = order.id;
  const now = new Date();
  
  try {
    console.log(`[Poller] Checking status for order ${orderId} (ref: ${order.referenceNumber})`);
    
    // Get landlord credentials if available
    const submission = await storage.getRentalSubmission(order.submissionId);
    if (!submission) {
      console.error(`[Poller] Submission not found for order ${orderId}`);
      return;
    }
    
    // Get the property owner's credentials
    const appLink = submission.applicationLinkId ? await storage.getRentalApplicationLink(submission.applicationLinkId) : null;
    const unit = appLink ? await storage.getRentalUnit(appLink.unitId) : null;
    const property = unit ? await storage.getRentalPropertyById(unit.propertyId) : null;
    
    let credentials: { username: string; password: string } | undefined;
    if (property?.userId) {
      const landlordCreds = await storage.getLandlordScreeningCredentials(property.userId);
      if (landlordCreds && landlordCreds.status === 'verified') {
        try {
          credentials = decryptCredentials({
            encryptedUsername: landlordCreds.encryptedUsername,
            encryptedPassword: landlordCreds.encryptedPassword,
            encryptionIv: landlordCreds.encryptionIv,
          });
        } catch (e) {
          console.error(`[Poller] Failed to decrypt credentials for order ${orderId}`);
        }
      }
    }
    
    const result = await checkOrderStatus(order.referenceNumber, credentials);
    
    if (result.success && result.status) {
      // Success - update order and reset failures
      await storage.updateRentalScreeningOrder(orderId, {
        status: result.status as any,
        reportId: result.reportId || order.reportId,
        reportUrl: result.reportUrl || order.reportUrl,
        rawStatusXml: result.rawXml || order.rawStatusXml,
        lastStatusCheckAt: now,
        consecutiveFailures: 0,
        nextStatusCheckAt: new Date(now.getTime() + INITIAL_RETRY_DELAY_MS),
      });
      
      console.log(`[Poller] Order ${orderId} status: ${result.status}`);
      
      // If complete, clear nextStatusCheckAt to stop polling
      if (result.status === 'complete') {
        await storage.updateRentalScreeningOrder(orderId, {
          nextStatusCheckAt: null,
        });
      }
      
      await updateSubmissionStatusFromScreening(order.submissionId);
    } else {
      // Status check failed - increment failures and apply exponential backoff
      // Do NOT use getViewReportByRefSsoUrl as fallback - it incorrectly marked pending as complete
      const failures = (order.consecutiveFailures || 0) + 1;
      const backoffMs = Math.min(
        INITIAL_RETRY_DELAY_MS * Math.pow(2, failures - 1),
        MAX_RETRY_DELAY_MS
      );
      
      if (failures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(`[Poller] Order ${orderId} exceeded max failures, marking as error`);
        await storage.updateRentalScreeningOrder(orderId, {
          status: 'error',
          errorMessage: 'Status check failed after multiple attempts',
          lastStatusCheckAt: now,
          consecutiveFailures: failures,
          nextStatusCheckAt: null, // Stop polling
        });
      } else {
        console.log(`[Poller] Order ${orderId} status check failed (attempt ${failures}), next check in ${backoffMs / 1000}s`);
        await storage.updateRentalScreeningOrder(orderId, {
          lastStatusCheckAt: now,
          consecutiveFailures: failures,
          nextStatusCheckAt: new Date(now.getTime() + backoffMs),
        });
      }
    }
  } catch (error) {
    console.error(`[Poller] Error polling order ${orderId}:`, error);
    
    // Increment failures on exception
    const failures = (order.consecutiveFailures || 0) + 1;
    const backoffMs = Math.min(
      INITIAL_RETRY_DELAY_MS * Math.pow(2, failures - 1),
      MAX_RETRY_DELAY_MS
    );
    
    await storage.updateRentalScreeningOrder(orderId, {
      lastStatusCheckAt: now,
      consecutiveFailures: failures,
      nextStatusCheckAt: new Date(now.getTime() + backoffMs),
    });
  }
}

async function runPollingCycle(): Promise<void> {
  try {
    const ordersToPoll = await storage.getScreeningOrdersNeedingPoll();
    
    if (ordersToPoll.length === 0) {
      return;
    }
    
    console.log(`[Poller] Found ${ordersToPoll.length} orders to poll`);
    
    // Process orders sequentially to avoid overloading the API
    for (const order of ordersToPoll) {
      await pollSingleOrder(order);
      // Small delay between orders to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error("[Poller] Error in polling cycle:", error);
  }
}

export function startScreeningPoller(): void {
  if (pollerInterval) {
    console.log("[Poller] Already running");
    return;
  }
  
  console.log("[Poller] Starting screening status poller");
  
  // Run immediately on start to catch up
  runPollingCycle();
  
  // Then run periodically
  pollerInterval = setInterval(runPollingCycle, POLL_INTERVAL_MS);
}

export function stopScreeningPoller(): void {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log("[Poller] Stopped screening status poller");
  }
}
