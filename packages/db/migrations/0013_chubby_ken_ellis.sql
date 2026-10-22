CREATE TABLE "guide_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guide_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"title_fr" text DEFAULT '' NOT NULL,
	"title_en" text DEFAULT '' NOT NULL,
	"body_fr" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"body_en" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"documents_fr" text DEFAULT '' NOT NULL,
	"documents_en" text DEFAULT '' NOT NULL,
	"duration_fr" text DEFAULT '' NOT NULL,
	"duration_en" text DEFAULT '' NOT NULL,
	"contact_fr" text DEFAULT '' NOT NULL,
	"contact_en" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"icon" text DEFAULT 'checklist' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"title_fr" text DEFAULT '' NOT NULL,
	"title_en" text DEFAULT '' NOT NULL,
	"intro_fr" text DEFAULT '' NOT NULL,
	"intro_en" text DEFAULT '' NOT NULL,
	"audience_fr" text DEFAULT '' NOT NULL,
	"audience_en" text DEFAULT '' NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guide_steps" ADD CONSTRAINT "guide_steps_guide_id_guides_id_fk" FOREIGN KEY ("guide_id") REFERENCES "public"."guides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guides" ADD CONSTRAINT "guides_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guide_steps_guide_idx" ON "guide_steps" USING btree ("guide_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "guides_slug_idx" ON "guides" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "guides_state_idx" ON "guides" USING btree ("state","sort_order");