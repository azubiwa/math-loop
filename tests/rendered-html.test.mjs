import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../dist/client/", import.meta.url);

test("exports the MathLoop problem-set grid as static HTML", async () => {
  const html = await readFile(new URL("index.html", outputRoot), "utf8");

  assert.match(html, /<title>MathLoop — 学部数学の演習記録<\/title>/);
  assert.match(html, /class="setTable"/);
  assert.match(html, /レベル 1 #001/);
  assert.match(html, /レベル 2/);
  assert.match(html, /レベル 3/);
  assert.ok(html.indexOf("レベル 1") < html.indexOf("レベル 2"));
  assert.ok(html.indexOf("レベル 2") < html.indexOf("レベル 3"));
  assert.ok(html.indexOf("レベル 1 #010") < html.indexOf("レベル 1 #009"));
  assert.ok(html.indexOf("レベル 1 #009") < html.indexOf("レベル 1 #001"));
  assert.match(html, /総合・最難関/);
  assert.match(html, /テーマ演習/);
  assert.match(html, /一般化固有空間から決める Jordan 標準形/);
  assert.match(html, /共通問題文/);
  assert.match(html, /5つの連続小問/);
  assert.match(html, /解く。/);
  assert.match(html, /定義・基本/);
  assert.match(html, /端末間で同期/);
  assert.match(html, /https:\/\/azubiwa\.github\.io\/math-loop\/og\.png/);
  assert.doesNotMatch(html, /\/api\/progress/);
});

test("bundles Supabase sync and Sakura grading integration", async () => {
  const prefixedChunkRoot = new URL("math-loop/_next/static/chunks/", outputRoot);
  const chunkRoot = await access(prefixedChunkRoot).then(() => prefixedChunkRoot).catch(() => new URL("_next/static/chunks/", outputRoot));
  const names = await readdir(chunkRoot);
  const appChunkName = names.find((name) => name.startsWith("MathLoopApp-") && name.endsWith(".js"));
  assert.ok(appChunkName, "MathLoopApp client chunk should exist");

  const source = await readFile(new URL(appChunkName, chunkRoot), "utf8");
  assert.match(source, /hocqvxcobesonakkultw\.supabase\.co/);
  assert.match(source, /grade-answer/);
  assert.match(source, /さくらAI採点/);
  assert.match(source, /explanation/);
  assert.match(source, /math-abc-answers/);
  assert.match(source, /mathabc-attempt-history-v1/);
  assert.match(source, /回答履歴/);
  assert.match(source, /math_abc_attempts/);
});
