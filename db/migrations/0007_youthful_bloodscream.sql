ALTER TABLE "space" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "space" ADD CONSTRAINT "space_parent_id_space_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."space"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "space_parent_idx" ON "space" USING btree ("parent_id");