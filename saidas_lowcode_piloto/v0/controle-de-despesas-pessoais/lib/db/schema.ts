import { boolean, date, integer, numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const categories = pgTable('categories', { id: serial('id').primaryKey(), name: text('name').notNull().unique(), active: boolean('active').notNull().default(true), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow() })
export const expenses = pgTable('expenses', { id: serial('id').primaryKey(), userId: text('user_id').notNull(), description: text('description').notNull(), amount: numeric('amount', { precision: 12, scale: 2 }).notNull(), categoryId: integer('category_id').notNull(), spentAt: date('spent_at').notNull().defaultNow(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow() })
