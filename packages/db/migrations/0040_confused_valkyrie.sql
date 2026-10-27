CREATE TABLE "rights_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"channel" text NOT NULL,
	"received_on" date NOT NULL,
	"due_on" date NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"outcome" text DEFAULT '' NOT NULL,
	"closed_on" date,
	"handled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rights_requests" ADD CONSTRAINT "rights_requests_handled_by_user_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rights_requests_status_idx" ON "rights_requests" USING btree ("status","due_on");