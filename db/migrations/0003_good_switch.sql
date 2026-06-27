CREATE TYPE "public"."user_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "space_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" text NOT NULL,
	"last_editor_id" text,
	"space_id" uuid NOT NULL,
	"category_id" uuid,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"content_json" jsonb NOT NULL,
	"excerpt" text,
	"status" "document_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_tag" (
	"document_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_tag_document_id_tag_id_pk" PRIMARY KEY("document_id","tag_id")
);
--> statement-breakpoint
DROP TABLE "post" CASCADE;--> statement-breakpoint
DROP TABLE "post_tag" CASCADE;--> statement-breakpoint
DROP TABLE "comment" CASCADE;--> statement-breakpoint
DROP TABLE "like" CASCADE;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" "user_role" DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_space_id_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."space"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space" ADD CONSTRAINT "space_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_last_editor_id_user_id_fk" FOREIGN KEY ("last_editor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_space_id_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."space"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tag" ADD CONSTRAINT "document_tag_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tag" ADD CONSTRAINT "document_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "category_space_idx" ON "category" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "category_slug_idx" ON "category" USING btree ("space_id","slug");--> statement-breakpoint
CREATE INDEX "space_slug_idx" ON "space" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "document_slug_space_idx" ON "document" USING btree ("space_id","slug");--> statement-breakpoint
CREATE INDEX "document_status_published_idx" ON "document" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "document_author_status_idx" ON "document" USING btree ("author_id","status","published_at");--> statement-breakpoint
CREATE INDEX "document_space_status_idx" ON "document" USING btree ("space_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "document_category_status_idx" ON "document" USING btree ("category_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "document_tag_tag_idx" ON "document_tag" USING btree ("tag_id");--> statement-breakpoint
DROP TYPE "public"."post_status";--> statement-breakpoint
DROP TYPE "public"."like_target_type";