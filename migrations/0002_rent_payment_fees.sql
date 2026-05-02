-- Per-landlord rent payment fee defaults
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "default_service_fee_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "default_service_fee_amount" integer DEFAULT 495 NOT NULL;--> statement-breakpoint

-- Per-request fee fields: tenant convenience fee (with payer toggle) + LeaseShield platform fee
ALTER TABLE "rent_payment_requests" ADD COLUMN IF NOT EXISTS "service_fee_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "rent_payment_requests" ADD COLUMN IF NOT EXISTS "service_fee_payer" varchar(16) DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "rent_payment_requests" ADD COLUMN IF NOT EXISTS "platform_fee_amount" integer DEFAULT 0 NOT NULL;
