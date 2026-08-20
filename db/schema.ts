import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const progress = sqliteTable(
  "progress",
  {
    profileId: text("profile_id").notNull(),
    problemId: text("problem_id").notNull(),
    status: text("status", { enum: ["AC", "REVIEW", "WA"] }).notNull(),
    bestScore: integer("best_score").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    lastAnswer: text("last_answer").notNull().default(""),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    solvedAt: text("solved_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.profileId, table.problemId] })]
);
