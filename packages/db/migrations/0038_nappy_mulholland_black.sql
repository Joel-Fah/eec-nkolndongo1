CREATE TABLE "group_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"share_phone" boolean DEFAULT false NOT NULL,
	"decision_message" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "announcements_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"title_fr" text NOT NULL,
	"title_en" text,
	"body_fr" text NOT NULL,
	"body_en" text,
	"link_url" text,
	"state" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_members" ADD COLUMN "share_phone" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "group_requests" ADD CONSTRAINT "group_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_requests" ADD CONSTRAINT "group_requests_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_requests" ADD CONSTRAINT "group_requests_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements_items" ADD CONSTRAINT "announcements_items_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements_items" ADD CONSTRAINT "announcements_items_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_requests_group_idx" ON "group_requests" USING btree ("group_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "group_requests_pending_idx" ON "group_requests" USING btree ("user_id","group_id") WHERE "group_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "announcements_group_idx" ON "announcements_items" USING btree ("group_id","state");