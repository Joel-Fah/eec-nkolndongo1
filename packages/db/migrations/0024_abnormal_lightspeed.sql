CREATE TABLE "registration_counts" (
	"form_id" uuid PRIMARY KEY NOT NULL,
	"title_fr" text DEFAULT '' NOT NULL,
	"event_date" text NOT NULL,
	"registered" integer DEFAULT 0 NOT NULL,
	"waitlisted" integer DEFAULT 0 NOT NULL,
	"cancelled" integer DEFAULT 0 NOT NULL,
	"present" integer DEFAULT 0 NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid,
	"slug" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"title_fr" text DEFAULT '' NOT NULL,
	"title_en" text DEFAULT '' NOT NULL,
	"intro_fr" text DEFAULT '' NOT NULL,
	"intro_en" text DEFAULT '' NOT NULL,
	"event_slug" text,
	"event_date" text NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"capacity" integer,
	"waitlist" boolean DEFAULT true NOT NULL,
	"audience" text DEFAULT 'open' NOT NULL,
	"for_minors" boolean DEFAULT false NOT NULL,
	"ask_whatsapp" boolean DEFAULT true NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"age_band" text NOT NULL,
	"checked_in_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"whatsapp" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"party_size" integer DEFAULT 1 NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"guardian_confirmed" boolean DEFAULT false NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"policy_version" text NOT NULL,
	"user_id" uuid,
	"added_by" uuid,
	"checked_in_at" timestamp with time zone,
	"promoted_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registration_forms" ADD CONSTRAINT "registration_forms_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_forms" ADD CONSTRAINT "registration_forms_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_forms" ADD CONSTRAINT "registration_forms_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_people" ADD CONSTRAINT "registration_people_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_form_id_registration_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."registration_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "registration_forms_slug_idx" ON "registration_forms" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "registration_forms_state_idx" ON "registration_forms" USING btree ("state","event_date");--> statement-breakpoint
CREATE INDEX "registration_forms_event_idx" ON "registration_forms" USING btree ("event_slug");--> statement-breakpoint
CREATE INDEX "registration_people_reg_idx" ON "registration_people" USING btree ("registration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_code_idx" ON "registrations" USING btree ("form_id","code");--> statement-breakpoint
CREATE INDEX "registrations_form_idx" ON "registrations" USING btree ("form_id","status","created_at");