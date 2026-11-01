CREATE TABLE "communion_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"valid_until" date NOT NULL,
	"proposed_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communion_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"month" text NOT NULL,
	"amount_xaf" integer NOT NULL,
	"noted_by" uuid,
	"noted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communion_excuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"month" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communion_fees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"amount_xaf" integer NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communion_visas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"month" text NOT NULL,
	"signed_by" uuid,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "baptised" boolean;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "confirmed" boolean;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "sacrament_confirmed_by" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "sacrament_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "communion_cards" ADD CONSTRAINT "communion_cards_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communion_cards" ADD CONSTRAINT "communion_cards_proposed_by_user_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communion_cards" ADD CONSTRAINT "communion_cards_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communion_contributions" ADD CONSTRAINT "communion_contributions_card_id_communion_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."communion_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communion_contributions" ADD CONSTRAINT "communion_contributions_noted_by_user_id_fk" FOREIGN KEY ("noted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communion_excuses" ADD CONSTRAINT "communion_excuses_card_id_communion_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."communion_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communion_fees" ADD CONSTRAINT "communion_fees_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communion_visas" ADD CONSTRAINT "communion_visas_card_id_communion_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."communion_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communion_visas" ADD CONSTRAINT "communion_visas_signed_by_user_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "communion_cards_user_idx" ON "communion_cards" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "communion_contributions_unique" ON "communion_contributions" USING btree ("card_id","month");--> statement-breakpoint
CREATE INDEX "communion_contributions_month_idx" ON "communion_contributions" USING btree ("month");--> statement-breakpoint
CREATE UNIQUE INDEX "communion_excuses_unique" ON "communion_excuses" USING btree ("card_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "communion_fees_unique" ON "communion_fees" USING btree ("kind","key");--> statement-breakpoint
CREATE UNIQUE INDEX "communion_visas_unique" ON "communion_visas" USING btree ("card_id","month");