CREATE TABLE "schedule_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"slot_id" uuid,
	"kind" text NOT NULL,
	"note_fr" text DEFAULT '' NOT NULL,
	"note_en" text DEFAULT '' NOT NULL,
	"start_time" text,
	"end_time" text,
	"label_fr" text DEFAULT '' NOT NULL,
	"label_en" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text DEFAULT 'culte' NOT NULL,
	"label_fr" text NOT NULL,
	"label_en" text DEFAULT '' NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text,
	"place_fr" text DEFAULT '' NOT NULL,
	"place_en" text DEFAULT '' NOT NULL,
	"group_id" uuid,
	"notes_fr" text DEFAULT '' NOT NULL,
	"notes_en" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"validated" boolean DEFAULT false NOT NULL,
	"validated_by" uuid,
	"validated_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_slot_id_schedule_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."schedule_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_validated_by_user_id_fk" FOREIGN KEY ("validated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "schedule_exceptions_date_idx" ON "schedule_exceptions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "schedule_slots_week_idx" ON "schedule_slots" USING btree ("weekday","start_time");