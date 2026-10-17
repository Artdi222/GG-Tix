DROP INDEX "vouchers_code_idx";--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_code_upper_chk" CHECK ("vouchers"."code" = upper("vouchers"."code"));