import problemData from "./problem-data.json" with { type: "json" };
import guidedSetData from "./guided-set-data.json" with { type: "json" };

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
  /** Level問題とテーマ演習の小問を、互換性を保ったまま区別する。 */
  category?: "level" | "guided_set";
  /** テーマ演習だけが持つ親セットIDと小問間の依存関係。 */
  setId?: string;
  position?: Difficulty;
  dependsOn?: Difficulty[];
  purpose?: string;
  connection?: string;
  setTitle?: string;
  learningGoal?: string;
  commonStatement?: string[];
};

export type GuidedSetQuestion = Omit<Problem,
  "contest" | "field" | "tags" | "category" | "setId" | "position" | "setTitle" | "learningGoal" | "commonStatement"
> & {
  position: Difficulty;
  dependsOn: Difficulty[];
  purpose: string;
  connection: string;
};

export type GuidedSet = {
  id: string;
  category: "guided_set";
  displayName: string;
  title: string;
  field: string;
  tags: string[];
  learningGoal: string;
  commonStatement: string[];
  questions: GuidedSetQuestion[];
};

export type ProblemStatus = "AC" | "REVIEW" | "WA";
export type ProblemFilters = {
  query: string;
  field: string;
  category: string;
  status: string;
};

export const guidedSets = guidedSetData as GuidedSet[];

const guidedProblems: Problem[] = guidedSets.flatMap((set) => set.questions.map((question) => ({
  ...question,
  contest: set.displayName,
  field: set.field,
  tags: set.tags,
  category: "guided_set" as const,
  setId: set.id,
  position: question.position,
  setTitle: set.title,
  learningGoal: set.learningGoal,
  commonStatement: set.commonStatement,
})));

export const problems = [...(problemData as Problem[]), ...guidedProblems];

const difficulties: Difficulty[] = ["A", "B", "C", "D", "E"];
const problemsBySet = new Map<string, Problem[]>();
for (const problem of guidedProblems) {
  const current = problemsBySet.get(problem.setId!) || [];
  current.push(problem);
  problemsBySet.set(problem.setId!, current);
}
for (const setProblems of problemsBySet.values()) {
  setProblems.sort((a, b) => difficulties.indexOf(a.position!) - difficulties.indexOf(b.position!));
}

export function isGuidedSetProblem(problem: Problem) {
  return problem.category === "guided_set" && Boolean(problem.setId);
}

export function getGuidedSet(setId: string | undefined) {
  return guidedSets.find((set) => set.id === setId);
}

export function getGuidedSetProblems(setId: string | undefined) {
  return setId ? problemsBySet.get(setId) || [] : [];
}

/**
 * 検索・分野・状態のどれかが1小問に一致した場合も、テーマ演習は必ず5小問全部を返す。
 * これにより一覧と演習キューへ小問の一部だけが混入しない。
 */
export function filterProblemsAtomic(
  source: Problem[],
  filters: ProblemFilters,
  statusByProblem: Record<string, { status: ProblemStatus } | undefined>,
) {
  const needle = filters.query.trim().toLowerCase();
  const matches = (problem: Problem) => {
    const searchable = [
      problem.title,
      problem.contest,
      problem.field,
      problem.setTitle || "",
      problem.learningGoal || "",
      ...(problem.commonStatement || []),
      ...problem.tags,
    ].join(" ").toLowerCase();
    const matchesText = !needle || searchable.includes(needle);
    const matchesField = filters.field === "すべて" || problem.field === filters.field;
    const matchesCategory = filters.category === "すべて"
      || (filters.category === "guided_set" ? isGuidedSetProblem(problem) : problem.contest.startsWith(filters.category));
    const currentStatus = statusByProblem[problem.id]?.status;
    const matchesStatus = filters.status === "すべて"
      || (filters.status === "未挑戦" ? !currentStatus : currentStatus === filters.status);
    return matchesText && matchesField && matchesCategory && matchesStatus;
  };

  const matchedSetIds = new Set(
    source.filter((problem) => isGuidedSetProblem(problem) && matches(problem)).map((problem) => problem.setId!),
  );

  return source.filter((problem) => isGuidedSetProblem(problem)
    ? matchedSetIds.has(problem.setId!)
    : matches(problem));
}

/** 60分演習を構成する。テーマ演習は所要時間にかかわらず必ずセット全体を入れる。 */
export function buildPracticeQueue(
  source: Problem[],
  statusByProblem: Record<string, { status: ProblemStatus } | undefined>,
  targetMinutes = 60,
) {
  const units: Problem[][] = [];
  const seenSets = new Set<string>();
  for (const problem of source) {
    if (isGuidedSetProblem(problem)) {
      if (seenSets.has(problem.setId!)) continue;
      seenSets.add(problem.setId!);
      const fullSet = getGuidedSetProblems(problem.setId);
      if (fullSet.some((part) => statusByProblem[part.id]?.status !== "AC")) units.push(fullSet);
    } else if (statusByProblem[problem.id]?.status !== "AC") {
      units.push([problem]);
    }
  }

  if (!units.length) {
    if (!source.length) return [];
    return (isGuidedSetProblem(source[0]) ? getGuidedSetProblems(source[0].setId) : [source[0]])
      .map((problem) => problem.id);
  }

  const queue: Problem[] = [];
  let minutes = 0;
  for (const unit of units) {
    const unitMinutes = unit.reduce((sum, problem) => sum + problem.minutes, 0);
    if (queue.length && minutes + unitMinutes > targetMinutes) continue;
    queue.push(...unit);
    minutes += unitMinutes;
    if (minutes >= targetMinutes) break;
  }
  return (queue.length ? queue : units[0]).map((problem) => problem.id);
}

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
