ALTER TABLE "sunday_offerings" ADD COLUMN "pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sunday_reports" ADD COLUMN "attendance_pending" boolean DEFAULT false NOT NULL;