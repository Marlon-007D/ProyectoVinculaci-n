import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const courseCategories = pgTable('course_categories', {
  courseCategoryId: uuid('course_category_id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id').notNull(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull().default('book-open'),
  coverImageUrl: text('cover_image_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, table => [
  uniqueIndex('course_categories_institution_name_key').on(table.institutionId, table.name),
  uniqueIndex('course_categories_institution_slug_key').on(table.institutionId, table.slug),
  uniqueIndex('course_categories_institution_category_key').on(table.institutionId, table.courseCategoryId),
  index('course_categories_institution_published_order_idx').on(table.institutionId, table.isPublished, table.sortOrder),
  check('course_categories_sort_order_nonnegative_check', sql`${table.sortOrder} >= 0`),
]).enableRLS();

export const courseModules = pgTable('course_modules', {
  courseModuleId: uuid('course_module_id').defaultRandom().primaryKey(),
  institutionId: uuid('institution_id').notNull(),
  slug: text('slug').notNull(),
  courseCategoryId: uuid('course_category_id').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  coverImageUrl: text('cover_image_url'),
  topics: jsonb('topics').$type<{ title: string; description: string }[]>().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, table => [
  uniqueIndex('course_modules_category_name_key').on(table.courseCategoryId, table.name),
  uniqueIndex('course_modules_institution_slug_key').on(table.institutionId, table.slug),
  index('course_modules_institution_published_order_idx').on(table.institutionId, table.isPublished, table.sortOrder),
  index('course_modules_category_order_idx').on(table.courseCategoryId, table.sortOrder),
  check('course_modules_sort_order_nonnegative_check', sql`${table.sortOrder} >= 0`),
]).enableRLS();
