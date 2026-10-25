DROP INDEX "sunday_reports_date_idx";--> statement-breakpoint
ALTER TABLE "sunday_reports" ADD COLUMN "position" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sunday_reports" ADD COLUMN "service_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sunday_reports_date_idx" ON "sunday_reports" USING btree ("sunday_date","position");