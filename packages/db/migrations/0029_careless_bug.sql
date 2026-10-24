CREATE TABLE "sunday_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"amount_xaf" integer NOT NULL,
	"group_id" uuid,
	"campaign_id" uuid,
	"progress_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sunday_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sunday_date" text NOT NULL,
	"men" integer,
	"women" integer,
	"children" integer,
	"service_kind" text DEFAULT 'ordinary' NOT NULL,
	"service_label" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"attendance_by" uuid,
	"attendance_at" timestamp with time zone,
	"closed" boolean DEFAULT false NOT NULL,
	"closed_by" uuid,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sunday_offerings" ADD CONSTRAINT "sunday_offerings_report_id_sunday_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."sunday_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sunday_offerings" ADD CONSTRAINT "sunday_offerings_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sunday_offerings" ADD CONSTRAINT "sunday_offerings_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sunday_reports" ADD CONSTRAINT "sunday_reports_attendance_by_user_id_fk" FOREIGN KEY ("attendance_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sunday_reports" ADD CONSTRAINT "sunday_reports_closed_by_user_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sunday_offerings_report_idx" ON "sunday_offerings" USING btree ("report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sunday_reports_date_idx" ON "sunday_reports" USING btree ("sunday_date");