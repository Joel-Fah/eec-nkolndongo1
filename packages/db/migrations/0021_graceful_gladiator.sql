CREATE TABLE "sermon_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title_fr" text DEFAULT '' NOT NULL,
	"title_en" text DEFAULT '' NOT NULL,
	"description_fr" text DEFAULT '' NOT NULL,
	"description_en" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sermons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid,
	"slug" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"publish_at" timestamp with time zone,
	"unpublish_at" timestamp with time zone,
	"first_published_at" timestamp with time zone,
	"title_fr" text DEFAULT '' NOT NULL,
	"title_en" text DEFAULT '' NOT NULL,
	"summary_fr" text DEFAULT '' NOT NULL,
	"summary_en" text DEFAULT '' NOT NULL,
	"body_fr" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"body_en" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"transcript" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"preached_on" text,
	"series_id" uuid,
	"preacher_name" text DEFAULT '' NOT NULL,
	"preacher_consent" boolean DEFAULT false NOT NULL,
	"preacher_confirmed_by" uuid,
	"preacher_confirmed_at" timestamp with time zone,
	"refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"youtube_id" text DEFAULT '' NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cover_media_id" uuid,
	"sunday_date" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sermon_series" ADD CONSTRAINT "sermon_series_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sermons" ADD CONSTRAINT "sermons_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sermons" ADD CONSTRAINT "sermons_series_id_sermon_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."sermon_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sermons" ADD CONSTRAINT "sermons_preacher_confirmed_by_user_id_fk" FOREIGN KEY ("preacher_confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sermons" ADD CONSTRAINT "sermons_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sermons" ADD CONSTRAINT "sermons_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sermon_series_slug_idx" ON "sermon_series" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "sermons_slug_idx" ON "sermons" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sermons_list_idx" ON "sermons" USING btree ("state","preached_on");--> statement-breakpoint
CREATE INDEX "sermons_series_idx" ON "sermons" USING btree ("series_id");