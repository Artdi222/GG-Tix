ALTER TABLE "admins" ADD COLUMN "credentials_changed_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "credentials_changed_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "payment_proofs_order_id_idx" ON "payment_proofs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ticket_categories_event_id_idx" ON "ticket_categories" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "tickets_order_id_idx" ON "tickets" USING btree ("order_id");--> statement-breakpoint
-- Strip expiring B2 download tokens (?Authorization=...) from stored public image URLs.
UPDATE "artists" SET "photo_url" = split_part("photo_url", '?Authorization=', 1) WHERE "photo_url" LIKE '%?Authorization=%';--> statement-breakpoint
UPDATE "venues" SET "image_url" = split_part("image_url", '?Authorization=', 1) WHERE "image_url" LIKE '%?Authorization=%';--> statement-breakpoint
UPDATE "events" SET "image_url" = split_part("image_url", '?Authorization=', 1) WHERE "image_url" LIKE '%?Authorization=%';--> statement-breakpoint
UPDATE "events" SET "seatmap_url" = split_part("seatmap_url", '?Authorization=', 1) WHERE "seatmap_url" LIKE '%?Authorization=%';--> statement-breakpoint
UPDATE "payment_proofs" SET "image_url" = split_part("image_url", '?Authorization=', 1) WHERE "image_url" LIKE '%?Authorization=%';
