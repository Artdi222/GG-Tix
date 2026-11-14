ALTER TABLE "events" ADD COLUMN "poster_url" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "timezone" varchar(64) DEFAULT 'Asia/Jakarta' NOT NULL;