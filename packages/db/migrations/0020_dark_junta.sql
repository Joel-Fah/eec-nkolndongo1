CREATE TABLE "system_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"checks" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_marks" (
	"key" text PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "system_health_at_idx" ON "system_health" USING btree ("checked_at");