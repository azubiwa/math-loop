type GradingProblem = {
  grade:
    | { type: "exact"; accepted: string[] }
    | { type: "keywords" };
};

const numericAnswerCharacters = new Set("0123456789+-*/^().,{}[]&=<>|:;!?%");

function isNumericAcceptedAnswer(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/\^(?:\{t\}|t)/g, "")
    .replace(/\\begin\{[pbv]?matrix\}|\\end\{[pbv]?matrix\}/g, "")
    .replace(/\\(?:left|right|frac|dfrac|tfrac|sqrt|pi|infty|cdot|times|pm|mp|cos|sin|tan|log|ln|exp)/g, "")
    .replace(/\b(?:sqrt|pi|inf|infinity|cos|sin|tan|log|ln|exp)\b/g, "")
    .replace(/[π∞¼½¾⅐-⅞↉]/g, "")
    .replace(/[ei]/g, "")
    .replace(/\\/g, "")
    .replace(/\s/g, "");

  return normalized.length > 0
    && [...normalized].every((character) => numericAnswerCharacters.has(character));
}

/** 数値・数値ベクトル等の完全一致で済まない答案はAI採点へ送る。 */
export function usesAiGrading(problem: GradingProblem) {
  return problem.grade.type !== "exact"
    || !problem.grade.accepted.every(isNumericAcceptedAnswer);
}
