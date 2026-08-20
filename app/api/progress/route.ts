import { listProgress, saveProgress } from "@/db/progress";
import { getProblem, gradeAnswer } from "@/lib/problems";

export const runtime = "edge";

function validProfile(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{16,80}$/.test(value);
}

export async function GET(request: Request) {
  const profileId = new URL(request.url).searchParams.get("profile");
  if (!validProfile(profileId)) return Response.json({ error: "invalid profile" }, { status: 400 });
  return Response.json({ progress: await listProgress(profileId) });
}

export async function POST(request: Request) {
  const body = await request.json() as {
    profileId?: unknown;
    problemId?: unknown;
    answer?: unknown;
    durationSeconds?: unknown;
  };
  if (!validProfile(body.profileId) || typeof body.problemId !== "string" || typeof body.answer !== "string") {
    return Response.json({ error: "invalid submission" }, { status: 400 });
  }
  const problem = getProblem(body.problemId);
  if (!problem) return Response.json({ error: "problem not found" }, { status: 404 });
  const answer = body.answer.slice(0, 12000);
  const result = gradeAnswer(problem, answer);
  const durationSeconds = Math.max(0, Math.min(21600, Number(body.durationSeconds) || 0));
  const progress = await saveProgress({
    profileId: body.profileId,
    problemId: problem.id,
    status: result.status,
    score: result.score,
    answer,
    durationSeconds,
  });
  return Response.json({ result, progress });
}
