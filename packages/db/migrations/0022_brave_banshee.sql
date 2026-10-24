CREATE TABLE "meditation_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"date" text NOT NULL,
	"headline_fr" text DEFAULT '' NOT NULL,
	"headline_en" text DEFAULT '' NOT NULL,
	"readings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"psalm" text DEFAULT '' NOT NULL,
	"reflection_fr" text DEFAULT '' NOT NULL,
	"reflection_en" text DEFAULT '' NOT NULL,
	"verse_ref" text DEFAULT '' NOT NULL,
	"verse_fr" text DEFAULT '' NOT NULL,
	"verse_en" text DEFAULT '' NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meditation_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title_fr" text DEFAULT '' NOT NULL,
	"title_en" text DEFAULT '' NOT NULL,
	"description_fr" text DEFAULT '' NOT NULL,
	"description_en" text DEFAULT '' NOT NULL,
	"starts_on" text NOT NULL,
	"ends_on" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meditation_days" ADD CONSTRAINT "meditation_days_plan_id_meditation_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."meditation_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meditation_days" ADD CONSTRAINT "meditation_days_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meditation_plans" ADD CONSTRAINT "meditation_plans_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "meditation_days_plan_date_idx" ON "meditation_days" USING btree ("plan_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "meditation_plans_slug_idx" ON "meditation_plans" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "meditation_plans_dates_idx" ON "meditation_plans" USING btree ("starts_on","ends_on");