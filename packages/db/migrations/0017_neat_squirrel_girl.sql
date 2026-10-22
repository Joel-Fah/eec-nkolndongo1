CREATE TABLE "legal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doc_key" text NOT NULL,
	"version" integer NOT NULL,
	"label" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"body_fr" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"body_en" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"summary_fr" text DEFAULT '' NOT NULL,
	"summary_en" text DEFAULT '' NOT NULL,
	"purpose_changed" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legal_documents_key_idx" ON "legal_documents" USING btree ("doc_key","version");--> statement-breakpoint
CREATE INDEX "legal_documents_state_idx" ON "legal_documents" USING btree ("doc_key","state");