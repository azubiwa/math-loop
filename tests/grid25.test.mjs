import assert from "node:assert/strict";
import test from "node:test";
import { createGrid, formatGridValue, gridAnswer, gridModes, isGridAnswerCorrect } from "../lib/grid25.ts";

test("all 40 sets provide five unique headers on each axis and 25 gradable answers", () => {
  for (const { id } of gridModes) {
    const signatures = new Set();
    for (let sheet = 1; sheet <= 10; sheet++) {
      const grid = createGrid(id, sheet);
      assert.deepEqual(grid, createGrid(id, sheet));
      assert.equal(grid.rows.length, 5);
      assert.equal(grid.columns.length, 5);
      assert.equal(new Set(grid.rows.map(formatGridValue)).size, 5);
      assert.equal(new Set(grid.columns.map(formatGridValue)).size, 5);
      signatures.add(JSON.stringify(grid));
      for (const row of grid.rows) for (const column of grid.columns) {
        const answer = gridAnswer(id, row, column);
        assert.ok(isGridAnswerCorrect(formatGridValue(answer), answer));
        assert.ok(!isGridAnswerCorrect("", answer));
        assert.ok(!isGridAnswerCorrect(formatGridValue({ ...answer, real: answer.real + 1 }), answer));
      }
    }
    assert.equal(signatures.size, 10);
  }
});

test("arithmetic handles signs, common denominators, and i squared", () => {
  const value = (real, denominator = 1, imaginary = 0) => ({ real, denominator, imaginary });
  assert.deepEqual(gridAnswer("addition", value(-7), value(3)), value(-4));
  assert.deepEqual(gridAnswer("multiplication", value(-7), value(-3)), value(21));
  assert.deepEqual(gridAnswer("fractions", value(1, 6), value(1, 3)), value(1, 2));
  assert.deepEqual(gridAnswer("complex", value(2, 1, 3), value(1, 1, -4)), value(14, 1, -5));
  assert.deepEqual(gridAnswer("complex", value(1, 1, 1), value(1, 1, -1)), value(2));
  assert.deepEqual(gridAnswer("complex", value(1, 1, 1), value(1, 1, 1)), value(0, 1, 2));
});

test("grading accepts equivalent fractions and full-width input without evaluating expressions", () => {
  const half = { real: 1, denominator: 2, imaginary: 0 };
  for (const answer of ["1/2", "2/4", "-2/-4", "0.5", ".5", "０．５", " １ / ２ "]) assert.ok(isGridAnswerCorrect(answer, half), answer);
  for (const answer of ["", "0/0", "1/0", "0.50001", "1/3", "1+1", "NaN", "Infinity", "0.5abc", "9007199254740993/18014398509481986"]) assert.ok(!isGridAnswerCorrect(answer, half), answer);
  assert.ok(!isGridAnswerCorrect("0.333333", { real: 1, denominator: 3, imaginary: 0 }));
  assert.ok(isGridAnswerCorrect("2 - 3i", { real: 2, denominator: 1, imaginary: -3 }));
  assert.ok(isGridAnswerCorrect("−i", { real: 0, denominator: 1, imaginary: -1 }));
  assert.ok(isGridAnswerCorrect("i", { real: 0, denominator: 1, imaginary: 1 }));
  assert.ok(isGridAnswerCorrect("2+0i", { real: 2, denominator: 1, imaginary: 0 }));
});
