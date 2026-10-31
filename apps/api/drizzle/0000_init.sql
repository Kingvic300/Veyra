CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"status" text NOT NULL,
	"wallet_address" text,
	"tx_hash" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" text NOT NULL,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name_enc" text NOT NULL,
	"email_enc" text,
	"country" text,
	"payout_address_enc" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"status" text NOT NULL,
	"tx_hash" text,
	"submitted_by" uuid NOT NULL,
	"error" text,
	"verification" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finalised_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"route" text NOT NULL,
	"request_hash" text NOT NULL,
	"status_code" integer,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"wallet_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"chain" text NOT NULL,
	"network" text NOT NULL,
	"execution_mode" text NOT NULL,
	"treasury_address" text,
	"asset_address" text NOT NULL,
	"asset_symbol" text NOT NULL,
	"asset_decimals" integer NOT NULL,
	"approval_threshold" integer NOT NULL,
	"allow_creator_approval" boolean DEFAULT false NOT NULL,
	"max_batch_total" numeric(78, 0),
	"data_key_enc" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"status" text NOT NULL,
	"tx_hash" text,
	"verified" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_item_id_unique" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE "payroll_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"execution_mode" text NOT NULL,
	"asset_address" text NOT NULL,
	"asset_symbol" text NOT NULL,
	"asset_decimals" integer NOT NULL,
	"total" numeric(78, 0) DEFAULT '0' NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"treasury_address" text,
	"commitment" text,
	"chain_batch_id" text NOT NULL,
	"chain_items_hash" text,
	"proposal_status" text DEFAULT 'NONE' NOT NULL,
	"proposal_tx_hash" text,
	"proposal_error" text,
	"created_by" uuid NOT NULL,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payroll_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"contractor_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"recipient_enc" text,
	"amount_enc" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_batch_id_payroll_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."payroll_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractors" ADD CONSTRAINT "contractors_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_batch_id_payroll_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."payroll_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_submitted_by_members_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_batch_id_payroll_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."payroll_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_item_id_payroll_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."payroll_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_batches" ADD CONSTRAINT "payroll_batches_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_batches" ADD CONSTRAINT "payroll_batches_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_batch_id_payroll_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."payroll_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "approvals_live_idx" ON "approvals" USING btree ("batch_id","member_id") WHERE status <> 'FAILED';--> statement-breakpoint
CREATE UNIQUE INDEX "audit_org_seq_idx" ON "audit_events" USING btree ("organisation_id","seq");--> statement-breakpoint
CREATE INDEX "contractors_org_idx" ON "contractors" USING btree ("organisation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "executions_attempt_idx" ON "executions" USING btree ("batch_id","attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "executions_tx_idx" ON "executions" USING btree ("tx_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "executions_inflight_idx" ON "executions" USING btree ("batch_id") WHERE status = 'SUBMITTED';--> statement-breakpoint
CREATE UNIQUE INDEX "members_org_user_idx" ON "members" USING btree ("organisation_id","user_id");--> statement-breakpoint
CREATE INDEX "batches_org_idx" ON "payroll_batches" USING btree ("organisation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "items_batch_position_idx" ON "payroll_items" USING btree ("batch_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "items_batch_contractor_idx" ON "payroll_items" USING btree ("batch_id","contractor_id");