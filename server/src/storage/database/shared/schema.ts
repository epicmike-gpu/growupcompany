import { pgTable, serial, timestamp, varchar, integer, text, index, uuid } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: uuid("user_id").notNull().default(sql`auth.uid()`),
    nickname: varchar("nickname", { length: 50 }),
    age: integer("age"),
    subscription_type: varchar("subscription_type", { length: 20 }).notNull().default("free"),
    messages_remaining: integer("messages_remaining").notNull().default(20),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("user_profiles_user_id_idx").on(table.user_id),
  ]
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: uuid("user_id").notNull().default(sql`auth.uid()`),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    command_type: varchar("command_type", { length: 30 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("chat_messages_user_id_idx").on(table.user_id),
    index("chat_messages_created_at_idx").on(table.created_at),
  ]
);
