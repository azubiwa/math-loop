import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};

type GradeResult = { status: "AC" | "REVIEW" | "WA"; score: number; feedback: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("SAKURA_AI_API_KEY");
  if (!apiKey) return json({ error: "Sakura AI Engine is not configured" }, 503);

  try {
    const { title, prompt, answer, grade } = await request.json();
    if (!title || !answer) return json({ error: "title and answer are required" }, 400);

    const response = await fetch("https://api.ai.sakura.ad.jp/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("SAKURA_AI_MODEL") || "gpt-oss-120b",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: "あなたは学部数学の厳密な採点者です。正しさ・論理の欠落・定義の量化を確認し、JSONだけを返してください。statusはAC, REVIEW, WAのいずれか、scoreは0〜100の整数、feedbackは160字以内の日本語です。",
          },
          {
            role: "user",
            content: JSON.stringify({
              problem: { title, prompt },
              rubric: grade,
              student_answer: answer,
              output_schema: { status: "AC | REVIEW | WA", score: "integer 0..100", feedback: "Japanese string" },
            }),
          },
        ],
      }),
    });

    if (!response.ok) return json({ error: `Sakura AI Engine returned ${response.status}` }, 502);
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const match = typeof content === "string" ? content.match(/\{[\s\S]*\}/) : null;
    if (!match) return json({ error: "Invalid grading response" }, 502);

    const parsed = JSON.parse(match[0]) as GradeResult;
    if (!["AC", "REVIEW", "WA"].includes(parsed.status) || !Number.isFinite(parsed.score) || typeof parsed.feedback !== "string") {
      return json({ error: "Invalid grading schema" }, 502);
    }
    return json({ ...parsed, score: Math.max(0, Math.min(100, Math.round(parsed.score))) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
