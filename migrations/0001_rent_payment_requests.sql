-- Stripe Connect fields on users (for landlord ACH rent collection)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_connect_account_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_connect_charges_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_connect_payouts_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_connect_details_submitted" boolean DEFAULT false;--> statement-breakpoint

-- Rent payment requests (online rent collection via Stripe Connect ACH)
CREATE TABLE IF NOT EXISTS "rent_payment_requests" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "rental_property_id" varchar,
  "tenant_name" text NOT NULL,
  "tenant_email" varchar,
  "amount" integer NOT NULL,
  "amount_paid" integer DEFAULT 0 NOT NULL,
  "due_date" date NOT NULL,
  "description" text,
  "public_token" varchar(64) NOT NULL,
  "late_fee_amount" integer DEFAULT 0 NOT NULL,
  "grace_period_days" integer DEFAULT 5 NOT NULL,
  "late_fee_applied_at" timestamp,
  "late_fee_ledger_entry_id" varchar,
  "reminder_days_before" integer DEFAULT 5 NOT NULL,
  "reminder_sent_at" timestamp,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "paid_at" timestamp,
  "stripe_checkout_session_id" varchar,
  "stripe_payment_intent_id" varchar,
  "ledger_entry_id" varchar,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "rent_payment_requests_public_token_unique" UNIQUE("public_token")
);--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "rent_payment_requests" ADD CONSTRAINT "rent_payment_requests_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "rent_payment_requests" ADD CONSTRAINT "rent_payment_requests_rental_property_id_rental_properties_id_fk"
    FOREIGN KEY ("rental_property_id") REFERENCES "public"."rental_properties"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_rent_payment_user" ON "rent_payment_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rent_payment_status" ON "rent_payment_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rent_payment_due_date" ON "rent_payment_requests" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rent_payment_token" ON "rent_payment_requests" USING btree ("public_token");
