import { storage } from "./storage";
import { emailService } from "./emailService";
import { syncScreeningStatus, type ScreeningCredentials } from "./digitalDelveService";
import { decryptCredentials } from "./crypto";

let pollerInterval: NodeJS.Timeout | null = null;
const POLLING_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const INITIAL_DELAY_MS = 60 * 1000; // 1 minute after startup

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
      await storage.updateRentalSubmission(submissionId, { status: newStatus as 'screening_requested' | 'in_progress' | 'complete' });
      console.log(`[Poller] Updated submission ${submissionId} status to ${newStatus}`);
    }
  } catch (error) {
    console.error(`[Poller] Error updating submission status for ${submissionId}:`, error);
  }
}

export async function pollScreeningStatus(): Promise<void> {
  console.log("[Poller] Starting screening status check...");

  try {
    const pendingOrders = await storage.getAllPendingScreeningOrdersWithOwner();

    if (pendingOrders.length === 0) {
      console.log("[Poller] No pending screening orders to check");
      return;
    }

    console.log(`[Poller] Checking ${pendingOrders.length} pending screening orders`);

    const credentialCache = new Map<string, ScreeningCredentials | null>();

    for (const orderInfo of pendingOrders) {
      const { order, ownerUserId, ownerEmail, ownerFirstName, personName, propertyName, unitName } = orderInfo;

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

        const result = await syncScreeningStatus(order.id, credentials);

        if (result.newlyCompleted) {
          console.log(`[Poller] Order ${order.id} (${personName}) marked COMPLETE`);

          await updateSubmissionStatusFromScreening(order.submissionId);

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
              console.log(`[Poller] Sent completion notification to ${ownerEmail}`);
              await storage.updateRentalScreeningOrder(order.id, {
                completionNotifiedAt: new Date(),
              });
            }
          }
        }
      } catch (error) {
        console.error(`[Poller] Error checking order ${order.id}:`, error);
      }
    }

    const completedNeedingNotification = await storage.getInProgressScreeningOrdersWithOwnerInfo();
    const unnotified = completedNeedingNotification.filter(
      o => o.order.status === 'complete' && !o.order.completionNotifiedAt
    );

    if (unnotified.length > 0) {
      console.log(`[Poller] Retrying ${unnotified.length} failed notifications`);
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
          }
        }
      }
    }

    console.log("[Poller] Screening status check complete");
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
