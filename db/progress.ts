import { env } from "cloudflare:workers";

export type ProgressRow = {
  problemId: string;
  status: "AC" | "REVIEW" | "WA";
  bestScore: number;
  attempts: number;
  lastAnswer: string;
  durationSeconds: number;
  solvedAt: string | null;
  updatedAt: string;
};

let initialized = false;

function database() {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

export async function ensureProgressSchema() {
  if (initialized) return;
  const db = database();
  await db.prepare(`CREATE TABLE IF NOT EXISTS progress (
    profile_id TEXT NOT NULL,
    problem_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('AC','REVIEW','WA')),
    best_score INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_answer TEXT NOT NULL DEFAULT '',
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    solved_at TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (profile_id, problem_id)
  )`).run();
  await db.prepare("PRAGMA optimize").run();
  initialized = true;
}

export async function listProgress(profileId: string): Promise<ProgressRow[]> {
  await ensureProgressSchema();
  const result = await database().prepare(`SELECT
    problem_id AS problemId,
    status,
    best_score AS bestScore,
    attempts,
    last_answer AS lastAnswer,
    duration_seconds AS durationSeconds,
    solved_at AS solvedAt,
    updated_at AS updatedAt
    FROM progress WHERE profile_id = ? ORDER BY updated_at DESC`)
    .bind(profileId).all<ProgressRow>();
  return result.results;
}

export async function saveProgress(input: {
  profileId: string;
  problemId: string;
  status: "AC" | "REVIEW" | "WA";
  score: number;
  answer: string;
  durationSeconds: number;
}) {
  await ensureProgressSchema();
  const now = new Date().toISOString();
  const solvedAt = input.status === "AC" ? now : null;
  await database().prepare(`INSERT INTO progress (
    profile_id, problem_id, status, best_score, attempts, last_answer, duration_seconds, solved_at, updated_at
  ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
  ON CONFLICT(profile_id, problem_id) DO UPDATE SET
    status = CASE
      WHEN progress.status = 'AC' THEN 'AC'
      WHEN excluded.status = 'AC' THEN 'AC'
      WHEN excluded.status = 'REVIEW' THEN 'REVIEW'
      ELSE excluded.status
    END,
    best_score = MAX(progress.best_score, excluded.best_score),
    attempts = progress.attempts + 1,
    last_answer = excluded.last_answer,
    duration_seconds = progress.duration_seconds + excluded.duration_seconds,
    solved_at = COALESCE(progress.solved_at, excluded.solved_at),
    updated_at = excluded.updated_at`)
    .bind(input.profileId, input.problemId, input.status, input.score, input.answer, input.durationSeconds, solvedAt, now)
    .run();

  return (await database().prepare(`SELECT
    problem_id AS problemId,
    status,
    best_score AS bestScore,
    attempts,
    last_answer AS lastAnswer,
    duration_seconds AS durationSeconds,
    solved_at AS solvedAt,
    updated_at AS updatedAt
    FROM progress WHERE profile_id = ? AND problem_id = ?`)
    .bind(input.profileId, input.problemId).first<ProgressRow>())!;
}
