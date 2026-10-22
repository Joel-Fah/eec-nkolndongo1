CREATE TABLE "liturgy_seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season" text NOT NULL,
	"meaning_fr" text DEFAULT '' NOT NULL,
	"meaning_en" text DEFAULT '' NOT NULL,
	"parish_fr" text DEFAULT '' NOT NULL,
	"parish_en" text DEFAULT '' NOT NULL,
	"validated" boolean DEFAULT false NOT NULL,
	"validated_by" uuid,
	"validated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liturgy_sundays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"name_fr" text DEFAULT '' NOT NULL,
	"name_en" text DEFAULT '' NOT NULL,
	"theme_fr" text DEFAULT '' NOT NULL,
	"theme_en" text DEFAULT '' NOT NULL,
	"readings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preacher_name" text DEFAULT '' NOT NULL,
	"liturgist_name" text DEFAULT '' NOT NULL,
	"names_consent" boolean DEFAULT false NOT NULL,
	"names_confirmed_by" uuid,
	"names_confirmed_at" timestamp with time zone,
	"hymns" text DEFAULT '' NOT NULL,
	"notes_fr" text DEFAULT '' NOT NULL,
	"notes_en" text DEFAULT '' NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liturgy_verses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" jsonb NOT NULL,
	"text_fr" text DEFAULT '' NOT NULL,
	"text_en" text DEFAULT '' NOT NULL,
	"translation_fr" text DEFAULT 'LSG' NOT NULL,
	"translation_en" text DEFAULT 'WEB' NOT NULL,
	"on_date" text,
	"season" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "liturgy_seasons" ADD CONSTRAINT "liturgy_seasons_validated_by_user_id_fk" FOREIGN KEY ("validated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liturgy_sundays" ADD CONSTRAINT "liturgy_sundays_names_confirmed_by_user_id_fk" FOREIGN KEY ("names_confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liturgy_sundays" ADD CONSTRAINT "liturgy_sundays_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "liturgy_seasons_season_idx" ON "liturgy_seasons" USING btree ("season");--> statement-breakpoint
CREATE UNIQUE INDEX "liturgy_sundays_date_idx" ON "liturgy_sundays" USING btree ("date");--> statement-breakpoint
CREATE INDEX "liturgy_verses_date_idx" ON "liturgy_verses" USING btree ("on_date");