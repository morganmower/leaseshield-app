// Hourly screening status poller
// Checks in-progress screening orders via Western Verify SSO to detect completion
// and sends email notifications to property owners when screenings complete.

import { storage } from "./storage";
import { emailService } from "./emailService";
import { decryptCredentials } from "./crypto";
import { performSsoViewReport, type ScreeningCredentials } from "./digitalDelveService";
import { db } from "./db";
import { rentalScreeningOrders, rentalProperties, rentalUnits, rentalApplicationLinks, rentalSubmissions, landlordScreeningCredentials } from "@shared/schema";
import { eq } from "drizzle-orm";

let pollerInterval: NodeJS.Timeout | null = null;
const POLLING_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const INITIAL_DELAY_MS = 5 * 60 * 1000; // 5 minutes after startup

interface ScreeningOrderWithOwner {
  order: typeof rentalScreeningOrders.$inferSelect;
  ownerEmail: string;
  ownerFirstName: string | null;
  personName: string;
  propertyName: string;
  unitName: string;
  ownerId: string;
}

/**
 * Check a single screening order's status via Western Verify SSO
 * Returns true if the report is now complete
 */
async function checkOrderStatus(
  order: typeof rentalScreeningOrders.$inferSelect,
  credentials: ScreeningCredentials
): Promise<{ complete: boolean; reportUrl?: string }> {
  try {
    const result = await performSsoViewReport(order.referenceNumber, credentials);
    
    if (result.success && result.redirectUrl) {
      // If we get a successful redirect URL, the report is complete
      return { complete: true, reportUrl: result.redirectUrl };
    }
    
    return { complete: false };
  } catch (error) {
    console.error(`[Poller] Error checking order ${order.id}:`, error);
    return { complete: false };
  }
}

/**
 * Get screening credentials for a landlord (property owner)
 */
async function getLandlordCredentials(ownerId: string): Promise<ScreeningCredentials | null> {
  try {
    const [cred] = await db
      .select()
      .from(landlordScreeningCredentials)
      .where(eq(landlordScreeningCredentials.userId, ownerId));
    
    if (!cred || !cred.encryptedUsername || !cred.encryptedPassword || !cred.encryptionIv) {
      return null;
    }
    
    return decryptCredentials({
      encryptedUsername: cred.encryptedUsername,
      encryptedPassword: cred.encryptedPassword,
      encryptionIv: cred.encryptionIv,
    });
  } catch (error) {
    console.error(`[Poller] Error getting credentials for user ${ownerId}:`, error);
    return null;
  }
}

/**
 * Main polling function - checks all in-progress orders
 */
export async function pollScreeningStatus(): Promise<void> {
  console.log("[Poller] Starting hourly screening status check...");
  
  try {
    // Get in-progress orders with owner info
    const orders = await storage.getInProgressScreeningOrdersWithOwnerInfo();
    
    if (orders.length === 0) {
      console.log("[Poller] No in-progress screening orders to check");
      return;
    }
    
    console.log(`[Poller] Found ${orders.length} in-progress orders to check`);
    
    // Group orders by owner to minimize credential decryption
    const ordersByOwner = new Map<string, Array<typeof orders[0] & { ownerId: string }>>();
    
    // Get owner IDs for all orders
    for (const orderInfo of orders) {
      // Fetch the owner ID through the submission chain
      const ownerInfo = await getOrderOwnerId(orderInfo.order.id);
      if (!ownerInfo) continue;
      
      const existing = ordersByOwner.get(ownerInfo.ownerId) || [];
      existing.push({ ...orderInfo, ownerId: ownerInfo.ownerId });
      ordersByOwner.set(ownerInfo.ownerId, existing);
    }
    
    // Process each landlord's orders
    for (const [ownerId, landlordOrders] of ordersByOwner) {
      console.log(`[Poller] Checking ${landlordOrders.length} orders for landlord ${ownerId}`);
      
      const credentials = await getLandlordCredentials(ownerId);
      if (!credentials) {
        console.log(`[Poller] No credentials for landlord ${ownerId}, skipping`);
        continue;
      }
      
      // Check each order for this landlord
      for (const orderInfo of landlordOrders) {
        const { order, ownerEmail, ownerFirstName, personName, propertyName, unitName } = orderInfo;
        
        // Check if this is an already-complete order needing notification retry
        const alreadyComplete = order.status === 'complete';
        
        let isComplete = alreadyComplete;
        let reportUrl = order.reportUrl;
        
        if (!alreadyComplete) {
          // Rate limit: small delay between API calls
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const result = await checkOrderStatus(order, credentials);
          isComplete = result.complete;
          reportUrl = result.reportUrl;
        }
        
        if (isComplete) {
          console.log(`[Poller] Order ${order.id} is ${alreadyComplete ? 'already' : 'now'} complete!`);
          
          // Update order status to complete if not already (skip redundant updates)
          if (!alreadyComplete) {
            await storage.updateRentalScreeningOrder(order.id, {
              status: 'complete',
              reportUrl: reportUrl,
              lastStatusCheckAt: new Date(),
            });
          }
          
          // Try to send notification email
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
          
          // Only mark as notified if email was sent successfully (or no email address)
          if (emailSent || !ownerEmail) {
            await storage.updateRentalScreeningOrder(order.id, {
              completionNotifiedAt: new Date(),
            });
          }
        } else {
          // Update last check time
          await storage.updateRentalScreeningOrder(order.id, {
            lastStatusCheckAt: new Date(),
          });
        }
      }
    }
    
    console.log("[Poller] Hourly screening status check complete");
  } catch (error) {
    console.error("[Poller] Error during polling:", error);
  }
}

/**
 * Get the owner ID for a screening order
 */
async function getOrderOwnerId(orderId: string): Promise<{ ownerId: string } | null> {
  try {
    const [result] = await db
      .select({
        ownerId: rentalProperties.userId,
      })
      .from(rentalScreeningOrders)
      .innerJoin(rentalSubmissions, eq(rentalScreeningOrders.submissionId, rentalSubmissions.id))
      .innerJoin(rentalApplicationLinks, eq(rentalSubmissions.applicationLinkId, rentalApplicationLinks.id))
      .innerJoin(rentalUnits, eq(rentalApplicationLinks.unitId, rentalUnits.id))
      .innerJoin(rentalProperties, eq(rentalUnits.propertyId, rentalProperties.id))
      .where(eq(rentalScreeningOrders.id, orderId));
    
    return result || null;
  } catch (error) {
    console.error(`[Poller] Error getting owner for order ${orderId}:`, error);
    return null;
  }
}

/**
 * Start the hourly polling job
 */
export function startScreeningPoller(): void {
  console.log("[Poller] Starting screening status poller (hourly checks)");
  
  // Initial check after 5 minute delay
  setTimeout(() => {
    pollScreeningStatus().catch(e => console.error("[Poller] Initial poll error:", e));
  }, INITIAL_DELAY_MS);
  
  // Schedule hourly checks
  pollerInterval = setInterval(() => {
    pollScreeningStatus().catch(e => console.error("[Poller] Interval poll error:", e));
  }, POLLING_INTERVAL_MS);
  
  console.log("[Poller] Screening poller scheduled (hourly)");
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
