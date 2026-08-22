ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'expired';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar(128),
	"user_id" uuid,
	"user_email" varchar(150),
	"user_role" varchar(50),
	"method" varchar(10) NOT NULL,
	"path" text NOT NULL,
	"status_code" integer NOT NULL,
	"ip" varchar(50) NOT NULL,
	"user_agent" text,
	"duration_ms" integer,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_settings" (
	"id" varchar(50) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"default_max_tickets_per_order" integer DEFAULT 4 NOT NULL,
	"pending_order_expiry_minutes" integer DEFAULT 15 NOT NULL,
	"support_email" varchar(150) DEFAULT 'support@ggtix.id' NOT NULL,
	"support_whatsapp" varchar(50) DEFAULT '+6281234567890' NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX IF EXISTS "events_city_idx";--> statement-breakpoint
ALTER TABLE "payment_proofs" ALTER COLUMN "image_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "venue_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "end_date_time" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "max_tickets_per_order" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "seatmap_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD COLUMN IF NOT EXISTS "midtrans_transaction_id" varchar(100);--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD COLUMN IF NOT EXISTS "payment_type" varchar(50);--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD COLUMN IF NOT EXISTS "transaction_status" varchar(30);--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD COLUMN IF NOT EXISTS "midtrans_response" jsonb;--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD COLUMN IF NOT EXISTS "paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "ticket_categories" ADD COLUMN IF NOT EXISTS "benefits" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_categories" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "checked_in_at" timestamp;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "city" varchar(100) DEFAULT 'Jakarta' NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_admins_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_path_idx" ON "audit_logs" USING btree ("path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_status_idx" ON "audit_logs" USING btree ("status_code");--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_venue_id_idx" ON "events" USING btree ("venue_id");--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN IF EXISTS "venue";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN IF EXISTS "city";--> statement-breakpoint
ALTER TABLE "venues" DROP COLUMN IF EXISTS "latitude";--> statement-breakpoint
ALTER TABLE "venues" DROP COLUMN IF EXISTS "longitude";--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."admins" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
UPDATE "public"."admins" SET "role" = 'gate_staff' WHERE "role" = 'staff';--> statement-breakpoint
DROP TYPE IF EXISTS "public"."admin_role";--> statement-breakpoint
CREATE TYPE "public"."admin_role" AS ENUM('super_admin', 'admin', 'gate_staff');--> statement-breakpoint
ALTER TABLE "public"."admins" ALTER COLUMN "role" SET DATA TYPE "public"."admin_role" USING "role"::"public"."admin_role";--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "role" SET DEFAULT 'admin';