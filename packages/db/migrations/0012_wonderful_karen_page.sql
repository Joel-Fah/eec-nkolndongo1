CREATE TABLE "department_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"tagline_fr" text DEFAULT '' NOT NULL,
	"tagline_en" text DEFAULT '' NOT NULL,
	"body_fr" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"body_en" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"cover_media_id" uuid,
	"meeting_fr" text DEFAULT '' NOT NULL,
	"meeting_en" text DEFAULT '' NOT NULL,
	"contact_whatsapp" text DEFAULT '' NOT NULL,
	"contact_phone" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "department_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"role_fr" text DEFAULT '' NOT NULL,
	"role_en" text DEFAULT '' NOT NULL,
	"photo_media_id" uuid,
	"public_consent" boolean DEFAULT false NOT NULL,
	"consent_by" uuid,
	"consent_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "department_quiz" (
	"key" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "department_pages" ADD CONSTRAINT "department_pages_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_pages" ADD CONSTRAINT "department_pages_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_people" ADD CONSTRAINT "department_people_page_id_department_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."department_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_people" ADD CONSTRAINT "department_people_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_people" ADD CONSTRAINT "department_people_consent_by_user_id_fk" FOREIGN KEY ("consent_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_quiz" ADD CONSTRAINT "department_quiz_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "department_pages_group_idx" ON "department_pages" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "department_pages_state_idx" ON "department_pages" USING btree ("state","sort_order");--> statement-breakpoint
CREATE INDEX "department_people_page_idx" ON "department_people" USING btree ("page_id","sort_order");