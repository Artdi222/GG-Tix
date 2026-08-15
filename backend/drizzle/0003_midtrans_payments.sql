ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'expired';
--> statement-breakpoint
ALTER TABLE "payment_proofs" ALTER COLUMN "image_url" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD COLUMN IF NOT EXISTS "midtrans_transaction_id" varchar(100);
--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD COLUMN IF NOT EXISTS "payment_type" varchar(50);
--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD COLUMN IF NOT EXISTS "transaction_status" varchar(30);
--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD COLUMN IF NOT EXISTS "midtrans_response" jsonb;
--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD COLUMN IF NOT EXISTS "paid_at" timestamp;
