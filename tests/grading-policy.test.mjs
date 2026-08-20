import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { usesAiGrading } from "../lib/grading-policy.ts";

const problems = JSON.parse(
  await readFile(new URL("../lib/problem-data.json", import.meta.url), "utf8"),
);

function problem(id) {
  const value = problems.find((item) => item.id === id);
  assert.ok(value, `${id} is present in problem data`);
  return value;
}

test("sends descriptive short answers such as Level 1 #015 A to AI grading", () => {
  assert.equal(usesAiGrading(problem("L1-015-A")), true);
});

test("keeps scalar and fixed numeric matrix answers on local grading", () => {
  assert.equal(usesAiGrading(problem("L1-016-A")), false);
  assert.equal(usesAiGrading(problem("L1-012-A")), false);
});

test("sends symbolic formulas and proof rubrics to AI grading", () => {
  assert.equal(usesAiGrading(problem("L1-017-A")), true);
  assert.equal(usesAiGrading(problem("L1-015-D")), true);
});
