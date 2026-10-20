CREATE TABLE "media_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"mime" text NOT NULL,
	"original_name" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"duration_s" integer,
	"variants" jsonb NOT NULL,
	"placeholder" text,
	"alt_fr" text,
	"alt_en" text,
	"caption_fr" text,
	"caption_en" text,
	"credit" text,
	"credit_url" text,
	"source" text DEFAULT 'upload' NOT NULL,
	"source_id" text,
	"status" text DEFAULT 'ready' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"field" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_usages" ADD CONSTRAINT "media_usages_media_id_media_files_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_files_created_idx" ON "media_files" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "media_files_kind_idx" ON "media_files" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "media_usages_media_idx" ON "media_usages" USING btree ("media_id");