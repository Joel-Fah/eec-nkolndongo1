ALTER TABLE "events_items" ADD COLUMN "kind" text DEFAULT 'autre' NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD COLUMN "to_date" text;--> statement-breakpoint
ALTER TABLE "schedule_slots" ADD COLUMN "recurrence" jsonb;--> statement-breakpoint
ALTER TABLE "schedule_slots" ADD COLUMN "anchor_slot_id" uuid;--> statement-breakpoint
ALTER TABLE "schedule_slots" ADD COLUMN "offset_days" integer DEFAULT 0 NOT NULL;