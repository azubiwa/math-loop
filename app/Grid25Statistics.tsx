"use client";

import { getDrill } from "@/lib/grid-drills";
import { accuracy, cellMedian, comparisonKey, duration, eligibleBest, median, runIndices, type Run } from "@/lib/grid-history";

function timeLabel(milliseconds: number | null) {
  if (milliseconds === null) return "—";
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export default function DrillStatistics({ history, run, now }: { history: Run[]; run: Run; now: number }) {
  const relevant = history.filter((r) => r.board.drillId === run.board.drillId && r.board.level === run.board.level && r.mode !== "legacy");
  const initialCount = relevant.reduce((s, r) => s + accuracy(r, true), 0);
  const totalCount = relevant.reduce((s, r) => s + runIndices(r).length, 0);
  const comparable = relevant.filter((r) => comparisonKey(r) === comparisonKey(run) && eligibleBest(r));
  const best = comparable.length ? Math.min(...comparable.map((r) => duration(r)!)) : null;
  const latest = [...comparable].sort((a, b) => b.finishedAt! - a.finishedAt!)[0];
  let streak = 0;
  for (const r of [...relevant].sort((a, b) => a.finishedAt! - b.finishedAt!)) {
    for (const i of r.order) streak = r.firstGrades[i] === "correct" && !r.assisted[i] ? streak + 1 : 0;
    if (runIndices(r).some((i) => r.firstAnswers[i] === null)) streak = 0;
  }
  const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const days = Array.from({ length: 30 }, (_, i) => { const date = new Date(now || 0); date.setDate(date.getDate() - 29 + i); const values = comparable.filter((r) => dayKey(new Date(r.finishedAt!)) === dayKey(date)).map((r) => duration(r)!); return { date, value: median(values), count: values.length }; });
  const max = Math.max(1, ...days.map((d) => d.value || 0));
  return <section className="panel drillStatistics" aria-label="25マス計算の学習記録"><div className="drillStatsHeading"><h3>この演算の記録</h3><small>{run.board.level === "basic" ? "基礎" : "標準"} · {getDrill(run.board.drillId)!.title}</small></div><div className="drillStatsMetrics"><div><small>初回正答率</small><b>{totalCount ? `${Math.round(initialCount / totalCount * 100)}%` : "—"}</b></div><div><small>全問正解ベスト</small><b>{timeLabel(best)}</b></div><div><small>直近の1問中央値</small><b>{latest && cellMedian(latest) !== null ? `${(cellMedian(latest)! / 1000).toFixed(1)}秒` : "—"}</b></div><div><small>連続初回正解</small><b>{streak}<em>問</em></b></div></div>
    <p className="drillStatsNote">ベスト・速度推移：{run.device === "touch" ? "タッチ入力" : "キーボード入力"}、{run.seenBefore ? "同じセットへの再提出" : "セットごとの初回提出"}、無中断・支援なしの全問正解を比較。1問中央値は順番に確定した計測だけが対象です。</p>
    <details><summary>過去30日の全問正解タイム</summary>{days.some((d) => d.count) ? <><div className="drillTrend" role="img" aria-label="過去30日の、日ごとの全問正解時間の中央値。棒が低いほど短い時間です。">{days.map((d, i) => <div key={i} title={`${d.date.toLocaleDateString("ja-JP")}：${timeLabel(d.value)}（${d.count}回）`}><span style={{ height: d.value === null ? "0" : `${Math.max(3, d.value / max * 100)}%` }} /></div>)}</div><ul className="drillTrendValues">{days.filter((d) => d.count).map((d) => <li key={dayKey(d.date)}>{d.date.toLocaleDateString("ja-JP")}：{timeLabel(d.value)} · {d.count}回</li>)}</ul></> : <p>同じ条件の全問正解タイムが記録されると、日ごとの中央値を表示します。</p>}</details>
  </section>;
}
