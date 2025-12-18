CREATE TYPE "public"."bill_status" AS ENUM('introduced', 'in_committee', 'passed_chamber', 'passed_both', 'signed', 'vetoed', 'dead');--> statement-breakpoint
CREATE TYPE "public"."broadcast_audience" AS ENUM('trial', 'active', 'all', 'individual');--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('leasing', 'screening', 'compliance', 'tenant_issues', 'notices', 'move_in_out');--> statement-breakpoint
CREATE TYPE "public"."communication_template_type" AS ENUM('rent_reminder', 'welcome_letter', 'lease_renewal_notice', 'late_payment_notice', 'move_in_welcome');--> statement-breakpoint
CREATE TYPE "public"."generation_mode" AS ENUM('wizard', 'static');--> statement-breakpoint
CREATE TYPE "public"."relevance_level" AS ENUM('high', 'medium', 'low', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."rental_decision_type" AS ENUM('approved', 'denied');--> statement-breakpoint
CREATE TYPE "public"."rental_letter_type" AS ENUM('approval', 'adverse_action');--> statement-breakpoint
CREATE TYPE "public"."rental_person_role" AS ENUM('applicant', 'coapplicant', 'guarantor');--> statement-breakpoint
CREATE TYPE "public"."rental_screening_status" AS ENUM('not_sent', 'sent', 'in_progress', 'complete', 'error');--> statement-breakpoint
CREATE TYPE "public"."rental_submission_status" AS ENUM('started', 'submitted', 'screening_requested', 'in_progress', 'complete');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'in_review', 'approved', 'rejected', 'published');--> statement-breakpoint
CREATE TYPE "public"."template_type" AS ENUM('lease', 'application', 'adverse_action', 'late_rent_notice', 'lease_violation_notice', 'non_renewal_notice', 'rent_increase_notice', 'move_in_checklist', 'move_out_checklist', 'esa_documentation', 'property_damage_form', 'partial_payment_form', 'tenant_complaint_form', 'eviction_notice', 'security_deposit_return');--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"event_type" varchar(50) NOT NULL,
	"event_data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" varchar(200) NOT NULL,
	"excerpt" text NOT NULL,
	"content" text NOT NULL,
	"author" varchar(100) DEFAULT 'LeaseShield Team' NOT NULL,
	"featured_image_url" text,
	"meta_title" text,
	"meta_description" text,
	"state_ids" text[],
	"tags" text[],
	"is_published" boolean DEFAULT false,
	"published_at" timestamp,
	"view_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "broadcast_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"audience" "broadcast_audience" NOT NULL,
	"sent_by_user_id" varchar NOT NULL,
	"recipient_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcast_recipients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broadcast_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"email_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcast_replies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broadcast_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"is_read_by_admin" boolean DEFAULT false,
	"read_by_admin_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_law_monitoring" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" text NOT NULL,
	"state_id" varchar(2) NOT NULL,
	"case_name" text NOT NULL,
	"case_name_full" text,
	"citation" text NOT NULL,
	"court" text NOT NULL,
	"date_filed" timestamp,
	"case_number" text,
	"url" text,
	"relevance_level" "relevance_level",
	"ai_analysis" text,
	"affected_template_ids" text[],
	"is_monitored" boolean DEFAULT true,
	"is_reviewed" boolean DEFAULT false,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "case_law_monitoring_case_id_unique" UNIQUE("case_id")
);
--> statement-breakpoint
CREATE TABLE "communication_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_id" varchar(2) NOT NULL,
	"template_type" "communication_template_type" NOT NULL,
	"title" text NOT NULL,
	"body_text" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_cards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_id" varchar(2) NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"category" text NOT NULL,
	"content" jsonb NOT NULL,
	"related_template_id" varchar,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"email" varchar(255) NOT NULL,
	"resend_id" varchar(100),
	"sequence_id" varchar,
	"step_id" varchar,
	"email_type" varchar(50) NOT NULL,
	"subject" text NOT NULL,
	"status" varchar(20) DEFAULT 'sent' NOT NULL,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"ai_content_cached" text,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"bounced_at" timestamp,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "email_sequence_enrollments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"sequence_id" varchar NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"next_send_at" timestamp,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"last_sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "email_sequence_steps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" varchar NOT NULL,
	"step_number" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"subject" text NOT NULL,
	"ai_prompt" text,
	"fallback_body" text NOT NULL,
	"delay_hours" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_sequences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"trigger" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_updates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_id" varchar(2) NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"why_it_matters" text NOT NULL,
	"before_text" text,
	"after_text" text,
	"effective_date" timestamp,
	"impact_level" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "legislative_monitoring" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" text NOT NULL,
	"state_id" varchar(2) NOT NULL,
	"bill_number" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "bill_status" NOT NULL,
	"url" text,
	"last_action" text,
	"last_action_date" timestamp,
	"relevance_level" "relevance_level",
	"ai_analysis" text,
	"affected_template_ids" text[],
	"is_monitored" boolean DEFAULT true,
	"is_reviewed" boolean DEFAULT false,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "legislative_monitoring_bill_id_unique" UNIQUE("bill_id")
);
--> statement-breakpoint
CREATE TABLE "monitoring_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_date" timestamp DEFAULT now(),
	"states_checked" text[],
	"bills_found" integer DEFAULT 0,
	"relevant_bills" integer DEFAULT 0,
	"templates_queued" integer DEFAULT 0,
	"status" varchar,
	"error_message" text,
	"summary_report" text,
	"email_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text,
	"state" varchar(2),
	"zip_code" varchar(10),
	"property_type" varchar(50),
	"units" integer DEFAULT 1,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "rent_ledger_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"property_id" varchar,
	"tenant_name" text NOT NULL,
	"month" varchar(7) NOT NULL,
	"amount_expected" integer NOT NULL,
	"amount_received" integer DEFAULT 0,
	"payment_date" timestamp,
	"notes" text,
	"effective_date" timestamp,
	"category" varchar(50) DEFAULT 'Rent',
	"description" text,
	"payment_method" varchar(50),
	"reference_number" varchar(100),
	"type" varchar(20) DEFAULT 'charge',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_application_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" varchar,
	"event_type" varchar(50) NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_application_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" varchar NOT NULL,
	"public_token" varchar(64) NOT NULL,
	"merged_schema_json" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rental_application_links_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE "rental_decision_letters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" varchar NOT NULL,
	"decision_id" varchar,
	"letter_type" "rental_letter_type" NOT NULL,
	"template_body" text NOT NULL,
	"final_body" text NOT NULL,
	"sent_to_email" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_decisions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" varchar NOT NULL,
	"decision" "rental_decision_type" NOT NULL,
	"decided_at" timestamp NOT NULL,
	"decided_by_user_id" varchar NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rental_decisions_submission_id_unique" UNIQUE("submission_id")
);
--> statement-breakpoint
CREATE TABLE "rental_properties" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"state" varchar(2),
	"zip_code" varchar(10),
	"default_cover_page_json" jsonb NOT NULL,
	"default_field_schema_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_screening_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" varchar NOT NULL,
	"invitation_id" text,
	"reference_number" varchar(100) NOT NULL,
	"status" "rental_screening_status" DEFAULT 'not_sent' NOT NULL,
	"report_id" text,
	"report_url" text,
	"raw_status_xml" text,
	"raw_result_xml" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rental_screening_orders_submission_id_unique" UNIQUE("submission_id"),
	CONSTRAINT "rental_screening_orders_reference_number_unique" UNIQUE("reference_number")
);
--> statement-breakpoint
CREATE TABLE "rental_submission_acknowledgements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" varchar NOT NULL,
	"person_id" varchar,
	"type" varchar(50) NOT NULL,
	"ack_name" text,
	"ack_checked" boolean DEFAULT false NOT NULL,
	"ack_at" timestamp,
	"ack_ip" varchar(50),
	"ack_user_agent" text,
	"content_snapshot_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_submission_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" varchar NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"original_name" text NOT NULL,
	"stored_path" text NOT NULL,
	"file_size" integer,
	"mime_type" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_submission_people" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" varchar NOT NULL,
	"role" "rental_person_role" NOT NULL,
	"invite_token" varchar(64) NOT NULL,
	"first_name" text,
	"last_name" text,
	"email" text,
	"phone" text,
	"form_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rental_submission_people_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE "rental_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_link_id" varchar NOT NULL,
	"status" "rental_submission_status" DEFAULT 'started' NOT NULL,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_units" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" varchar NOT NULL,
	"unit_label" text NOT NULL,
	"cover_page_override_enabled" boolean DEFAULT false NOT NULL,
	"cover_page_override_json" jsonb,
	"field_schema_override_enabled" boolean DEFAULT false NOT NULL,
	"field_schema_override_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"property_id" varchar,
	"template_id" varchar NOT NULL,
	"template_name" text NOT NULL,
	"template_version" integer,
	"document_name" text NOT NULL,
	"form_data" jsonb NOT NULL,
	"state_code" varchar(2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screening_content" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"category" varchar(50) NOT NULL,
	"content" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "screening_content_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "states" (
	"id" varchar(2) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "template_review_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"bill_id" varchar,
	"status" "review_status" DEFAULT 'pending',
	"priority" integer DEFAULT 5,
	"reason" text NOT NULL,
	"recommended_changes" text,
	"current_version" integer,
	"assigned_to" varchar,
	"review_started_at" timestamp,
	"review_completed_at" timestamp,
	"attorney_notes" text,
	"approved_changes" text,
	"approval_notes" text,
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"updated_template_snapshot" jsonb,
	"published_at" timestamp,
	"published_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "template_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"version_number" integer NOT NULL,
	"pdf_url" text,
	"fillable_form_data" jsonb,
	"version_notes" text,
	"last_update_reason" text,
	"source_review_id" varchar,
	"metadata" jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" "category" NOT NULL,
	"template_type" "template_type" NOT NULL,
	"state_id" varchar(2) NOT NULL,
	"pdf_url" text,
	"fillable_form_data" jsonb,
	"generation_mode" "generation_mode" DEFAULT 'wizard',
	"version" integer DEFAULT 1,
	"version_notes" text,
	"last_update_reason" text,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_issue_workflows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" varchar(50) NOT NULL,
	"steps" jsonb NOT NULL,
	"related_template_ids" jsonb,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenant_issue_workflows_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "training_interest" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"email" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploaded_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"property_id" varchar,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_type" varchar(100),
	"file_size" integer,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"legal_update_id" varchar,
	"template_id" varchar,
	"message" text,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"password_hash" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"is_admin" boolean DEFAULT false,
	"stripe_customer_id" varchar,
	"stripe_subscription_id" varchar,
	"subscription_status" varchar,
	"billing_interval" varchar,
	"trial_ends_at" timestamp,
	"subscription_ends_at" timestamp,
	"subscription_expires_at" timestamp,
	"renewal_reminder_sent_at" timestamp,
	"payment_failed_at" timestamp,
	"preferred_state" varchar(2),
	"has_completed_onboarding" boolean DEFAULT false,
	"notify_legal_updates" boolean DEFAULT true,
	"notify_template_revisions" boolean DEFAULT true,
	"notify_billing_alerts" boolean DEFAULT true,
	"notify_tips" boolean DEFAULT false,
	"business_name" varchar,
	"phone_number" varchar,
	"password_reset_token" varchar,
	"password_reset_expires" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "broadcast_messages" ADD CONSTRAINT "broadcast_messages_sent_by_user_id_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_broadcast_id_broadcast_messages_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcast_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_replies" ADD CONSTRAINT "broadcast_replies_broadcast_id_broadcast_messages_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcast_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_replies" ADD CONSTRAINT "broadcast_replies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_cards" ADD CONSTRAINT "compliance_cards_related_template_id_templates_id_fk" FOREIGN KEY ("related_template_id") REFERENCES "public"."templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_sequence_id_email_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."email_sequences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_step_id_email_sequence_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."email_sequence_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sequence_enrollments" ADD CONSTRAINT "email_sequence_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sequence_enrollments" ADD CONSTRAINT "email_sequence_enrollments_sequence_id_email_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."email_sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sequence_steps" ADD CONSTRAINT "email_sequence_steps_sequence_id_email_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."email_sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_ledger_entries" ADD CONSTRAINT "rent_ledger_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_ledger_entries" ADD CONSTRAINT "rent_ledger_entries_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_application_events" ADD CONSTRAINT "rental_application_events_submission_id_rental_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."rental_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_application_links" ADD CONSTRAINT "rental_application_links_unit_id_rental_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."rental_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_decision_letters" ADD CONSTRAINT "rental_decision_letters_submission_id_rental_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."rental_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_decision_letters" ADD CONSTRAINT "rental_decision_letters_decision_id_rental_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."rental_decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_decisions" ADD CONSTRAINT "rental_decisions_submission_id_rental_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."rental_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_decisions" ADD CONSTRAINT "rental_decisions_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_properties" ADD CONSTRAINT "rental_properties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_screening_orders" ADD CONSTRAINT "rental_screening_orders_submission_id_rental_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."rental_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_submission_acknowledgements" ADD CONSTRAINT "rental_submission_acknowledgements_submission_id_rental_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."rental_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_submission_acknowledgements" ADD CONSTRAINT "rental_submission_acknowledgements_person_id_rental_submission_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."rental_submission_people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_submission_files" ADD CONSTRAINT "rental_submission_files_person_id_rental_submission_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."rental_submission_people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_submission_people" ADD CONSTRAINT "rental_submission_people_submission_id_rental_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."rental_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_submissions" ADD CONSTRAINT "rental_submissions_application_link_id_rental_application_links_id_fk" FOREIGN KEY ("application_link_id") REFERENCES "public"."rental_application_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_units" ADD CONSTRAINT "rental_units_property_id_rental_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."rental_properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_documents" ADD CONSTRAINT "saved_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_documents" ADD CONSTRAINT "saved_documents_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_documents" ADD CONSTRAINT "saved_documents_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_interest" ADD CONSTRAINT "training_interest_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_documents" ADD CONSTRAINT "uploaded_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_documents" ADD CONSTRAINT "uploaded_documents_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_refresh_tokens_user" ON "refresh_tokens" USING btree ("user_id");