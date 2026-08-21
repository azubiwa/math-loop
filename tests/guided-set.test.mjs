import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildPracticeQueue,
  filterProblemsAtomic,
  getGuidedSetProblems,
  guidedSets,
  problems,
} from "../lib/problems.ts";

const positions = ["A", "B", "C", "D", "E"];

test("stores every guided theme as one parent set with five ordered dependent parts", () => {
  assert.ok(guidedSets.length > 0);
  for (const set of guidedSets) {
    assert.equal(set.category, "guided_set");
    assert.ok(set.commonStatement.length > 0);
    assert.equal(set.questions.length, 5);
    assert.deepEqual(set.questions.map((question) => question.position), positions);
    assert.equal(new Set(set.questions.map((question) => question.id)).size, 5);

    for (const question of set.questions) {
      assert.equal(question.id, `${set.id}-${question.position}`);
      const index = positions.indexOf(question.position);
      assert.ok(question.dependsOn.every((dependency) => positions.indexOf(dependency) < index));
      assert.ok(question.purpose.length > 0);
      assert.ok(question.connection.length > 0);
      assert.ok(question.explanation.steps.length > 0);
    }
  }
});

test("keeps all five parts when a filter matches only one guided-set part", () => {
  const filtered = filterProblemsAtomic(problems, {
    query: "一般化固有空間と最小多項式",
    field: "すべて",
    category: "すべて",
    status: "すべて",
  }, {});
  assert.deepEqual(filtered.filter((problem) => problem.setId === "GSET-001").map((problem) => problem.position), positions);
});

test("treats a guided set as an indivisible 60-minute practice unit", () => {
  const setProblems = getGuidedSetProblems("GSET-001");
  assert.equal(setProblems.reduce((sum, problem) => sum + problem.minutes, 0), 60);
  assert.deepEqual(buildPracticeQueue(setProblems, {}, 60), positions.map((position) => `GSET-001-${position}`));
  const completed = Object.fromEntries(setProblems.map((problem) => [problem.id, { status: "AC" }]));
  assert.deepEqual(buildPracticeQueue(setProblems, completed, 60), positions.map((position) => `GSET-001-${position}`));

  const mixedQueue = buildPracticeQueue([problems[0], ...setProblems], {}, 60);
  const guidedIds = mixedQueue.filter((id) => id.startsWith("GSET-001-"));
  assert.ok(guidedIds.length === 0 || guidedIds.length === 5, "a mixed practice may include zero or all five parts, never a subset");
});

test("has a dedicated generation prompt that requires one atomic A-to-E story", async () => {
  const prompt = await readFile(new URL("../prompts/guided-set.md", import.meta.url), "utf8");
  assert.match(prompt, /独立問題5問ではなく/);
  assert.match(prompt, /A〜Dで必要な計算、事実、補題、構造を段階的に得て、Eで/);
  assert.match(prompt, /"category": "guided_set"/);
  assert.match(prompt, /"commonStatement"/);
  assert.match(prompt, /"dependsOn"/);
});
