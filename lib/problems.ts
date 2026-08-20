import problemData from "./problem-data.json";

export type Difficulty = "A" | "B" | "C" | "D" | "E";
export type GradeRule =
  | { type: "exact"; accepted: string[]; hint: string }
  | { type: "keywords"; groups: string[][]; hint: string };

export type Problem = {
  id: string;
  contest: string;
  difficulty: Difficulty;
  score: number;
  /** 内部の出所管理用。学習画面には表示しない。 */
  sourceModel?: string;
  title: string;
  field: string;
  tags: string[];
  minutes: number;
  answerType: "short" | "proof";
  prompt: string[];
  note?: string;
  explanation: {
    summary: string;
    steps: string[];
    knowledge: { title: string; body: string }[];
  };
  grade: GradeRule;
};

export const problems = problemData as Problem[];

export function getProblem(id: string) {
  return problems.find((problem) => problem.id === id);
}
function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/\\left|\\right/g, "")
    .replace(/\s/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/\\mathbb\{r\}/g, "r")
    .replace(/\\/g, "");
}

export function gradeAnswer(problem: Problem, answer: string) {
  const value = normalize(answer);
  if (!value) return { status: "WA" as const, score: 0, feedback: "回答を入力してください。" };

  if (problem.grade.type === "exact") {
    const accepted = problem.grade.accepted.some((item) => normalize(item) === value);
    return accepted
      ? { status: "AC" as const, score: 100, feedback: "正解です。要点をきれいに捉えています。" }
      : { status: "WA" as const, score: 0, feedback: "まだ一致しません。式の形や計算を見直してみましょう。" };
  }

  const matched = problem.grade.groups.filter((group) =>
    group.some((keyword) => value.includes(normalize(keyword)))
  ).length;
  const score = Math.round((matched / problem.grade.groups.length) * 100);
  if (matched === problem.grade.groups.length) {
    return { status: "AC" as const, score, feedback: "必要な論点がそろっています。正解です。" };
  }
  if (matched >= Math.ceil(problem.grade.groups.length / 2)) {
    return { status: "REVIEW" as const, score, feedback: `主要な論点は書けています。あと ${problem.grade.groups.length - matched} 個の観点を補ってみましょう。` };
  }
  return { status: "WA" as const, score, feedback: "重要な論点がまだ不足しています。定義や使う定理から組み立て直してみましょう。" };
}
