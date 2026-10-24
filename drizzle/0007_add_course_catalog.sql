CREATE TABLE "course_categories" (
	"course_category_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT 'book-open' NOT NULL,
	"cover_image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_categories_sort_order_nonnegative_check" CHECK ("course_categories"."sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "course_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "course_modules" (
	"course_module_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"course_category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"cover_image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_modules_sort_order_nonnegative_check" CHECK ("course_modules"."sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "course_modules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "course_categories_institution_name_key" ON "course_categories" USING btree ("institution_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "course_categories_institution_category_key" ON "course_categories" USING btree ("institution_id","course_category_id");--> statement-breakpoint
CREATE INDEX "course_categories_institution_published_order_idx" ON "course_categories" USING btree ("institution_id","is_published","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "course_modules_category_name_key" ON "course_modules" USING btree ("course_category_id","name");--> statement-breakpoint
CREATE INDEX "course_modules_institution_published_order_idx" ON "course_modules" USING btree ("institution_id","is_published","sort_order");--> statement-breakpoint
CREATE INDEX "course_modules_category_order_idx" ON "course_modules" USING btree ("course_category_id","sort_order");--> statement-breakpoint

ALTER TABLE "course_categories"
  ADD CONSTRAINT "course_categories_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES public.institutions("institution_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "course_modules"
  ADD CONSTRAINT "course_modules_category_same_institution_fkey"
  FOREIGN KEY ("institution_id", "course_category_id")
  REFERENCES public.course_categories("institution_id", "course_category_id") ON DELETE CASCADE;--> statement-breakpoint

GRANT SELECT ON public.course_categories, public.course_modules TO anon, authenticated;--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE ON public.course_categories, public.course_modules TO authenticated;--> statement-breakpoint

CREATE POLICY "course_categories_public_read_published" ON public.course_categories
  FOR SELECT TO anon USING (is_published);--> statement-breakpoint
CREATE POLICY "course_modules_public_read_published" ON public.course_modules
  FOR SELECT TO anon USING (is_published);--> statement-breakpoint

CREATE POLICY "course_categories_member_read" ON public.course_categories
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_member_of_institution(institution_id));--> statement-breakpoint
CREATE POLICY "course_modules_member_read" ON public.course_modules
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_member_of_institution(institution_id));--> statement-breakpoint

CREATE POLICY "course_categories_admin_write" ON public.course_categories
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.user_role_type[]))
  WITH CHECK (public.is_super_admin() OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.user_role_type[]));--> statement-breakpoint
CREATE POLICY "course_modules_admin_write" ON public.course_modules
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.user_role_type[]))
  WITH CHECK (public.is_super_admin() OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.user_role_type[]));
