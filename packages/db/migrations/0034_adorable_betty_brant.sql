ALTER TABLE "profiles" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "neighbourhood" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "marital_status" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "profession" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "photo_key" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "photo_level" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "photo_updated_at" timestamp with time zone;