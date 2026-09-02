import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMathDelimiters } from "../lib/math-text.ts";

test("keeps negative exponents inside generated math delimiters", () => {
  const prompt = "逆像 f^{-1}(V) が X の開集合になる。逆像 f^{-1}(F) も考える。";
  const normalized = normalizeMathDelimiters(prompt);

  assert.equal(
    normalized,
    "逆像 $\\displaystyle f^{-1}(V)$が X の開集合になる。逆像 $\\displaystyle f^{-1}(F)$も考える。",
  );
  assert.doesNotMatch(normalized, /f\^\{\$/);
});
