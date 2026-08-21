import assert from "node:assert/strict";
import test from "node:test";

import { stripAuthParamsFromUrl } from "../lib/auth-url.ts";

test("removes Supabase auth tokens from URL hash", () => {
  const cleaned = stripAuthParamsFromUrl("https://azubiwa.github.io/math-loop/#access_token=abc&expires_in=3600&refresh_token=xyz&type=bearer");
  assert.equal(cleaned, "https://azubiwa.github.io/math-loop/");
});

test("removes Supabase auth callback query params and preserves app params", () => {
  const cleaned = stripAuthParamsFromUrl(
    "https://azubiwa.github.io/math-loop/?problem=L1-001-A&token_hash=abc&type=email",
  );
  assert.equal(cleaned, "https://azubiwa.github.io/math-loop/?problem=L1-001-A");
});

test("keeps non-auth fragment untouched", () => {
  const cleaned = stripAuthParamsFromUrl("https://azubiwa.github.io/math-loop/#section-2");
  assert.equal(cleaned, "https://azubiwa.github.io/math-loop/#section-2");
});
