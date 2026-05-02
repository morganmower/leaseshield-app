// Rent payment fee configuration
// LeaseShield's per-transaction platform fee, deducted from every rent payment
// via Stripe Connect's `application_fee_amount`. Held as a server-side constant
// for now — no per-landlord override.
export const PLATFORM_FEE_CENTS = 150; // $1.50

// Cap on the tenant convenience fee a landlord can configure (sanity check).
export const MAX_SERVICE_FEE_CENTS = 5000; // $50.00

export type ServiceFeePayer = "tenant" | "landlord" | "none";

export function isServiceFeePayer(v: unknown): v is ServiceFeePayer {
  return v === "tenant" || v === "landlord" || v === "none";
}

export interface RentFeeBreakdown {
  rent: number;            // cents
  serviceFee: number;      // cents (0 if payer === 'none')
  serviceFeePayer: ServiceFeePayer;
  platformFee: number;     // cents (always PLATFORM_FEE_CENTS for now)
  tenantTotal: number;     // cents — what the tenant is charged at checkout
  applicationFee: number;  // cents — routed to LeaseShield via Stripe Connect
  landlordNet: number;     // cents — what lands in the landlord's account
}

export function computeRentFees(input: {
  rent: number;
  serviceFee: number;
  serviceFeePayer: ServiceFeePayer;
  platformFee?: number;
}): RentFeeBreakdown {
  const platformFee = input.platformFee ?? PLATFORM_FEE_CENTS;
  const sFee = input.serviceFeePayer === "none" ? 0 : Math.max(0, input.serviceFee);
  const tenantTotal = input.rent + (input.serviceFeePayer === "tenant" ? sFee : 0);
  const applicationFee = sFee + platformFee;
  return {
    rent: input.rent,
    serviceFee: sFee,
    serviceFeePayer: input.serviceFeePayer,
    platformFee,
    tenantTotal,
    applicationFee,
    landlordNet: tenantTotal - applicationFee,
  };
}
