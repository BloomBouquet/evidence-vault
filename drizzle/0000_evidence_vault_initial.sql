CREATE TABLE "ev_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identity_subject" varchar(191) NOT NULL,
  "display_name" varchar(120) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "ev_users_identity_subject_unique" UNIQUE("identity_subject")
);
--> statement-breakpoint
CREATE TABLE "ev_app_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" char(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  CONSTRAINT "ev_app_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "ev_vault_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "title" varchar(120) NOT NULL,
  "category" varchar(40) NOT NULL,
  "merchant_name" varchar(120) NOT NULL,
  "purchase_or_start_date" date NOT NULL,
  "amount" bigint,
  "currency" char(3) DEFAULT 'KRW' NOT NULL,
  "description" text,
  "status" varchar(24) DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ev_deadlines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vault_item_id" uuid NOT NULL,
  "type" varchar(40) NOT NULL,
  "due_date" date NOT NULL,
  "source_type" varchar(40) NOT NULL,
  "source_note" varchar(500),
  "reminder_state" varchar(24) DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ev_evidence_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vault_item_id" uuid NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "occurred_on" date NOT NULL,
  "event_type" varchar(40) NOT NULL,
  "title" varchar(120) NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ev_evidence_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "vault_item_id" uuid NOT NULL,
  "evidence_event_id" uuid,
  "storage_key" varchar(500) NOT NULL,
  "original_filename" varchar(255) NOT NULL,
  "mime_type" varchar(100) NOT NULL,
  "byte_size" bigint NOT NULL,
  "sha256" char(64) NOT NULL,
  "redaction_state" varchar(24) DEFAULT 'unreviewed' NOT NULL,
  "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "ev_evidence_files_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "ev_cases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vault_item_id" uuid NOT NULL,
  "case_type" varchar(40) NOT NULL,
  "opened_at" timestamp with time zone DEFAULT now() NOT NULL,
  "closed_at" timestamp with time zone,
  "user_summary" text,
  "status" varchar(24) DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ev_case_evidence_links" (
  "case_id" uuid NOT NULL,
  "evidence_file_id" uuid NOT NULL,
  CONSTRAINT "ev_case_evidence_links_case_id_evidence_file_id_pk" PRIMARY KEY("case_id","evidence_file_id")
);
--> statement-breakpoint
CREATE TABLE "ev_export_packets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "case_id" uuid NOT NULL,
  "requested_by_user_id" uuid NOT NULL,
  "generated_at" timestamp with time zone,
  "storage_key" varchar(500),
  "manifest_hash" char(64),
  "status" varchar(24) DEFAULT 'queued' NOT NULL,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ev_deletion_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "kind" varchar(40) NOT NULL,
  "target_id" uuid NOT NULL,
  "status" varchar(24) DEFAULT 'queued' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error_code" varchar(80),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ev_app_sessions" ADD CONSTRAINT "ev_app_sessions_user_id_ev_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ev_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ev_vault_items" ADD CONSTRAINT "ev_vault_items_user_id_ev_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ev_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ev_deadlines" ADD CONSTRAINT "ev_deadlines_vault_item_id_ev_vault_items_id_fk" FOREIGN KEY ("vault_item_id") REFERENCES "public"."ev_vault_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ev_evidence_events" ADD CONSTRAINT "ev_evidence_events_vault_item_id_ev_vault_items_id_fk" FOREIGN KEY ("vault_item_id") REFERENCES "public"."ev_vault_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ev_evidence_events" ADD CONSTRAINT "ev_evidence_events_created_by_user_id_ev_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."ev_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ev_evidence_files" ADD CONSTRAINT "ev_evidence_files_user_id_ev_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ev_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ev_evidence_files" ADD CONSTRAINT "ev_evidence_files_vault_item_id_ev_vault_items_id_fk" FOREIGN KEY ("vault_item_id") REFERENCES "public"."ev_vault_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ev_evidence_files" ADD CONSTRAINT "ev_evidence_files_evidence_event_id_ev_evidence_events_id_fk" FOREIGN KEY ("evidence_event_id") REFERENCES "public"."ev_evidence_events"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ev_cases" ADD CONSTRAINT "ev_cases_vault_item_id_ev_vault_items_id_fk" FOREIGN KEY ("vault_item_id") REFERENCES "public"."ev_vault_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ev_case_evidence_links" ADD CONSTRAINT "ev_case_evidence_links_case_id_ev_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."ev_cases"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ev_case_evidence_links" ADD CONSTRAINT "ev_case_evidence_links_evidence_file_id_ev_evidence_files_id_fk" FOREIGN KEY ("evidence_file_id") REFERENCES "public"."ev_evidence_files"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ev_export_packets" ADD CONSTRAINT "ev_export_packets_case_id_ev_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."ev_cases"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ev_export_packets" ADD CONSTRAINT "ev_export_packets_requested_by_user_id_ev_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."ev_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ev_deletion_jobs" ADD CONSTRAINT "ev_deletion_jobs_user_id_ev_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ev_users"("id") ON DELETE cascade ON UPDATE no action;
