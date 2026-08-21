type GradingProblem = {
  grade:
    | { type: "exact"; accepted: string[] }
    | { type: "keywords" };
};

const numericAnswerCharacters = new Set("0123456789+-*/^().,{}[]&=<>|:;!?%");

/** TeXの記法が混ざると、同値な表記を完全一致で扱えない。 */
export function containsTex(value: string) {
  return /\\|\$|[_^]\{|[{}]/.test(value);
}

function isNumericAcceptedAnswer(value: string) {
  if (containsTex(value)) return false;

  const normalized = value
    .toLowerCase()
    .replace(/\b(?:sqrt|pi|inf|infinity|cos|sin|tan|log|ln|exp)\b/g, "")
    .replace(/[π∞¼½¾⅐-⅞↉]/g, "")
    .replace(/[ei]/g, "")
    .replace(/\\/g, "")
    .replace(/\s/g, "");

  return normalized.length > 0
    && [...normalized].every((character) => numericAnswerCharacters.has(character));
}

/** 数値・数値ベクトル等の完全一致で済まない答案はAI採点へ送る。 */
export function usesAiGrading(problem: GradingProblem, answer?: string) {
  return problem.grade.type !== "exact"
    || !problem.grade.accepted.every(isNumericAcceptedAnswer)
    || Boolean(answer && containsTex(answer));
}
