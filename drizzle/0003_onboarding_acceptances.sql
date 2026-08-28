CREATE TABLE "ev_onboarding_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"age_14_confirmed_at" timestamp with time zone NOT NULL,
	"terms_version" varchar(64) NOT NULL,
	"terms_accepted_at" timestamp with time zone NOT NULL,
	"privacy_version" varchar(64) NOT NULL,
	"privacy_accepted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ev_onboarding_acceptances_user_id_ev_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ev_users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ev_onboarding_acceptances_owner_versions_unique" ON "ev_onboarding_acceptances" USING btree ("user_id","terms_version","privacy_version");
