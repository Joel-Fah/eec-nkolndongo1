CREATE TABLE "events_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid,
	"slug" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"publish_at" timestamp with time zone,
	"unpublish_at" timestamp with time zone,
	"first_published_at" timestamp with time zone,
	"featured" boolean DEFAULT false NOT NULL,
	"title_fr" text DEFAULT '' NOT NULL,
	"title_en" text DEFAULT '' NOT NULL,
	"description_fr" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"description_en" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"timezone" text DEFAULT 'Africa/Douala' NOT NULL,
	"recurrence" jsonb,
	"exceptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"location_kind" text DEFAULT 'temple' NOT NULL,
	"location_fr" text DEFAULT '' NOT NULL,
	"location_en" text DEFAULT '' NOT NULL,
	"registration_url" text,
	"cover_media_id" uuid,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events_items" ADD CONSTRAINT "events_items_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events_items" ADD CONSTRAINT "events_items_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events_items" ADD CONSTRAINT "events_items_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "events_items_slug_idx" ON "events_items" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "events_items_list_idx" ON "events_items" USING btree ("state","starts_at");--> statement-breakpoint
CREATE INDEX "events_items_group_idx" ON "events_items" USING btree ("group_id");