CREATE TABLE "council_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"role_key" text NOT NULL,
	"title_fr" text DEFAULT '' NOT NULL,
	"title_en" text DEFAULT '' NOT NULL,
	"photo_media_id" uuid,
	"public_consent" boolean DEFAULT false NOT NULL,
	"consent_by" uuid,
	"consent_at" timestamp with time zone,
	"term" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "history_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" text DEFAULT '' NOT NULL,
	"title_fr" text DEFAULT '' NOT NULL,
	"title_en" text DEFAULT '' NOT NULL,
	"text_fr" text DEFAULT '' NOT NULL,
	"text_en" text DEFAULT '' NOT NULL,
	"media_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_key" text NOT NULL,
	"slot_key" text NOT NULL,
	"value_fr" text DEFAULT '' NOT NULL,
	"value_en" text DEFAULT '' NOT NULL,
	"body_fr" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"body_en" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "council_members" ADD CONSTRAINT "council_members_consent_by_user_id_fk" FOREIGN KEY ("consent_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_milestones" ADD CONSTRAINT "history_milestones_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_slots" ADD CONSTRAINT "page_slots_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "council_members_idx" ON "council_members" USING btree ("role_key","sort_order");--> statement-breakpoint
CREATE INDEX "history_milestones_idx" ON "history_milestones" USING btree ("state","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "page_slots_key_idx" ON "page_slots" USING btree ("page_key","slot_key");