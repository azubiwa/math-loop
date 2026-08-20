"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { problems, type Problem } from "@/lib/problems";

type Status = "AC" | "REVIEW" | "WA";
type Progress = {
  problemId: string;
  status: Status;
  bestScore: number;
  attempts: number;
  lastAnswer: string;
  durationSeconds: number;
  solvedAt: string | null;
  updatedAt: string;
};
type Result = { status: Status; score: number; feedback: string };

const symbols = ["ε", "δ", "∀", "∃", "→", "⇒", "∈", "⊂", "∪", "∩", "∫", "√", "∞", "⁻¹"];
const difficultyLabel = { A: "定義・基本", B: "典型", C: "標準", D: "証明・発展" };

function profileId() {
  const saved = localStorage.getItem("mathabc-profile-v1");
  if (saved) return saved;
  const created = crypto.randomUUID();
  localStorage.setItem("mathabc-profile-v1", created);
  return created;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const rest = Math.floor(safe % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function shortDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", { month: "short", day: "numeric" }).format(new Date(value));
}

function isFormula(line: string) {
  return /[=∫Σlim]|T:|ker|Im |Var|E\[|det |A°|Ā|∂A/.test(line);
}

function StatusBadge({ status }: { status?: Status }) {
  if (!status) return <span className="resultBadge resultNone">未挑戦</span>;
  const label = status === "AC" ? "AC" : status === "REVIEW" ? "要確認" : "WA";
  return <span className={`resultBadge result${status}`}>{label}</span>;
}

export default function MathABCApp() {
  const [view, setView] = useState<"problems" | "stats">("problems");
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [query, setQuery] = useState("");
  const [field, setField] = useState("すべて");
  const [statusFilter, setStatusFilter] = useState("すべて");
  const [sort, setSort] = useState("難易度順");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncState, setSyncState] = useState<"loading" | "saved" | "error">("loading");
  const [openedAt, setOpenedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [virtualUntil, setVirtualUntil] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentProfile = useRef("");

  useEffect(() => {
    currentProfile.current = profileId();
    fetch(`/api/progress?profile=${currentProfile.current}`)
      .then((response) => {
        if (!response.ok) throw new Error("sync failed");
        return response.json() as Promise<{ progress: Progress[] }>;
      })
      .then(({ progress: rows }) => {
        setProgress(Object.fromEntries(rows.map((row) => [row.problemId, row])));
        setSyncState("saved");
      })
      .catch(() => setSyncState("error"));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const solved = Object.values(progress).filter((row) => row.status === "AC").length;
  const attempted = Object.keys(progress).length;
  const attempts = Object.values(progress).reduce((sum, row) => sum + row.attempts, 0);
  const totalSeconds = Object.values(progress).reduce((sum, row) => sum + row.durationSeconds, 0);

  const uniqueStudyDays = useMemo(() => {
    return new Set(Object.values(progress).map((row) => row.updatedAt.slice(0, 10))).size;
  }, [progress]);

  const fields = useMemo(() => ["すべて", ...Array.from(new Set(problems.map((p) => p.field)))], []);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = problems.filter((problem) => {
      const matchesText = !needle || [problem.title, problem.contest, problem.field, ...problem.tags].join(" ").toLowerCase().includes(needle);
      const matchesField = field === "すべて" || problem.field === field;
      const currentStatus = progress[problem.id]?.status;
      const matchesStatus = statusFilter === "すべて" ||
        (statusFilter === "未挑戦" ? !currentStatus : currentStatus === statusFilter);
      return matchesText && matchesField && matchesStatus;
    });
    return [...rows].sort((a, b) => {
      if (sort === "新着順") return b.id.localeCompare(a.id);
      if (sort === "分野順") return a.field.localeCompare(b.field, "ja");
      return a.score - b.score;
    });
  }, [query, field, statusFilter, sort, progress]);

  function navigate(next: "problems" | "stats") {
    setView(next);
    setActiveProblem(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openProblem(problem: Problem) {
    setActiveProblem(problem);
    setView("problems");
    setAnswer(progress[problem.id]?.lastAnswer || localStorage.getItem(`mathabc-draft-${problem.id}`) || "");
    setResult(null);
    setExplanationOpen(false);
    setOpenedAt(Date.now());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startPractice() {
    setVirtualUntil(Date.now() + 60 * 60 * 1000);
    const next = problems.find((problem) => progress[problem.id]?.status !== "AC") || problems[0];
    openProblem(next);
  }

  function updateAnswer(value: string) {
    setAnswer(value);
    if (activeProblem) localStorage.setItem(`mathabc-draft-${activeProblem.id}`, value);
  }

  function insertSymbol(symbol: string) {
    const element = textareaRef.current;
    const start = element?.selectionStart ?? answer.length;
    const end = element?.selectionEnd ?? answer.length;
    updateAnswer(answer.slice(0, start) + symbol + answer.slice(end));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + symbol.length, start + symbol.length);
    });
  }

  async function submit() {
    if (!activeProblem || !answer.trim() || submitting) return;
    setSubmitting(true);
    setSyncState("loading");
    try {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profileId: currentProfile.current,
          problemId: activeProblem.id,
          answer,
          durationSeconds: Math.round((Date.now() - openedAt) / 1000),
        }),
      });
      if (!response.ok) throw new Error("submit failed");
      const data = await response.json() as { result: Result; progress: Progress };
      setResult(data.result);
      setProgress((current) => ({ ...current, [data.progress.problemId]: data.progress }));
      setSyncState("saved");
      localStorage.removeItem(`mathabc-draft-${activeProblem.id}`);
    } catch {
      setSyncState("error");
      setResult({ status: "REVIEW", score: 0, feedback: "保存先に接続できませんでした。少し待ってからもう一度提出してください。" });
    } finally {
      setSubmitting(false);
    }
  }

  function nextProblem() {
    if (!activeProblem) return;
    const index = problems.findIndex((problem) => problem.id === activeProblem.id);
    openProblem(problems[(index + 1) % problems.length]);
  }

  const virtualSeconds = virtualUntil ? Math.max(0, Math.round((virtualUntil - now) / 1000)) : null;
  const elapsedSeconds = Math.round((now - openedAt) / 1000);

  return (
    <main className="appShell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("problems")} aria-label="Math ABC ホーム">
          <span className="brandMark">Σ</span><span>MATH ABC</span>
        </button>
        <nav aria-label="メインナビゲーション">
          <button className={`navItem ${view === "problems" ? "active" : ""}`} onClick={() => navigate("problems")}><span>▦</span>問題一覧</button>
          <button className={`navItem ${view === "stats" ? "active" : ""}`} onClick={() => navigate("stats")}><span>⌁</span>統計</button>
        </nav>
        <div className="sideProgress">
          <div><span>全体の進捗</span><b>{solved}/{problems.length}</b></div>
          <div className="progressTrack"><span style={{ width: `${(solved / problems.length) * 100}%` }} /></div>
          <small>{syncState === "loading" ? "記録を同期中…" : syncState === "error" ? "再接続待ち" : "記録は自動保存されます"}</small>
        </div>
        <div className="sideFooter"><span className="avatar">学</span><span><b>匿名の学習者</b><small>この端末の進捗</small></span></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">UNDERGRADUATE MATHEMATICS</span>
            <h1>{activeProblem ? activeProblem.contest : view === "stats" ? "学習統計" : "問題一覧"}</h1>
          </div>
          <div className="topActions">
            {virtualSeconds !== null && virtualSeconds > 0 && <span className="contestClock"><i>●</i> 集中モード {formatTime(virtualSeconds)}</span>}
            <div className="streak"><span>学習日</span><b>{uniqueStudyDays}</b><small>days</small></div>
          </div>
        </header>

        {activeProblem ? (
          <ProblemView
            problem={activeProblem}
            answer={answer}
            setAnswer={updateAnswer}
            result={result}
            progress={progress[activeProblem.id]}
            elapsedSeconds={elapsedSeconds}
            explanationOpen={explanationOpen}
            setExplanationOpen={setExplanationOpen}
            submitting={submitting}
            onBack={() => setActiveProblem(null)}
            onSubmit={submit}
            onNext={nextProblem}
            onInsert={insertSymbol}
            textareaRef={textareaRef}
          />
        ) : view === "stats" ? (
          <StatsView progress={progress} solved={solved} attempted={attempted} attempts={attempts} totalSeconds={totalSeconds} />
        ) : (
          <div className="content" id="problems">
            <section className="heroCard">
              <div>
                <span className="heroLabel">MATH ABC — PRACTICE SET</span>
                <h2>定義から、証明できる力へ。</h2>
                <p>解析・代数・幾何を横断して、学部数学を毎日の習慣に。</p>
              </div>
              <div className="heroAction">
                <span><b>{problems.length - solved}</b> 問が未完了</span>
                <button onClick={startPractice}>60分セットを始める <span>→</span></button>
              </div>
            </section>

            <section className="quickStats" aria-label="学習概要">
              <div><span className="metricIcon green">✓</span><p><small>AC</small><b>{solved}<em>問</em></b></p></div>
              <div><span className="metricIcon orange">↻</span><p><small>提出回数</small><b>{attempts}<em>回</em></b></p></div>
              <div><span className="metricIcon blue">◷</span><p><small>学習時間</small><b>{Math.round(totalSeconds / 60)}<em>分</em></b></p></div>
              <div><span className="metricIcon violet">◇</span><p><small>完答率</small><b>{attempted ? Math.round((solved / attempted) * 100) : 0}<em>%</em></b></p></div>
            </section>

            <section className="panel problemPanel">
              <div className="panelHeading">
                <div><h3>すべての問題</h3><span>{filtered.length} / {problems.length} problems</span></div>
                <label className="sortSelect">並び順
                  <select value={sort} onChange={(event) => setSort(event.target.value)}><option>難易度順</option><option>新着順</option><option>分野順</option></select>
                </label>
              </div>
              <div className="filters">
                <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="問題を検索" placeholder="タイトル・タグで検索" /></label>
                <select value={field} onChange={(event) => setField(event.target.value)} aria-label="分野で絞り込み">{fields.map((item) => <option key={item}>{item === "すべて" ? "すべての分野" : item}</option>)}</select>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="状態で絞り込み"><option>すべて</option><option>AC</option><option>REVIEW</option><option>WA</option><option>未挑戦</option></select>
              </div>
              <div className="tableWrap">
                <table>
                  <thead><tr><th>難易度</th><th>問題</th><th>分野</th><th>タグ</th><th>目安</th><th>結果</th></tr></thead>
                  <tbody>{filtered.map((problem) => {
                    const row = progress[problem.id];
                    return <tr key={problem.id} className={row ? `row${row.status}` : ""}>
                      <td><span className={`level level${problem.difficulty}`}>{problem.difficulty}</span><small className="score">{problem.score}</small></td>
                      <td><button className="problemLink" onClick={() => openProblem(problem)}><span>{problem.title}</span><small>{problem.contest}</small></button></td>
                      <td>{problem.field}</td>
                      <td><div className="tagList">{problem.tags.slice(0, 2).map((tag) => <button key={tag} className="tag" onClick={() => setQuery(tag)}>{tag}</button>)}</div></td>
                      <td>{problem.minutes} min</td>
                      <td><StatusBadge status={row?.status} /></td>
                    </tr>;
                  })}</tbody>
                </table>
                {!filtered.length && <div className="emptyState"><b>該当する問題がありません</b><span>検索語や絞り込みを変えてみてください。</span></div>}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function ProblemView({
  problem, answer, setAnswer, result, progress, elapsedSeconds, explanationOpen, setExplanationOpen,
  submitting, onBack, onSubmit, onNext, onInsert, textareaRef,
}: {
  problem: Problem; answer: string; setAnswer: (value: string) => void; result: Result | null; progress?: Progress;
  elapsedSeconds: number; explanationOpen: boolean; setExplanationOpen: (value: boolean) => void;
  submitting: boolean; onBack: () => void; onSubmit: () => void; onNext: () => void; onInsert: (symbol: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return <div className="problemContent">
    <button className="backButton" onClick={onBack}>← 問題一覧に戻る</button>
    <div className="problemLayout">
      <article className="problemMain">
        <section className="problemStatement">
          <div className="problemTitleRow">
            <span className={`level large level${problem.difficulty}`}>{problem.difficulty}</span>
            <div><span className="problemKicker">{difficultyLabel[problem.difficulty]} · {problem.score} pts</span><h2>{problem.title}</h2></div>
          </div>
          <div className="statementBody">
            {problem.prompt.map((line, index) => <p key={index} className={isFormula(line) ? "formula" : ""}>{line}</p>)}
          </div>
          {problem.note && <p className="problemNote">注：{problem.note}</p>}
        </section>

        <section className="answerCard">
          <div className="answerHeading">
            <div><span className="stepNumber">01</span><div><h3>回答を書く</h3><p>{problem.grade.hint}</p></div></div>
            <span className="answerMode">{problem.answerType === "short" ? "短答" : "記述・証明"}</span>
          </div>
          <div className="symbolBar" aria-label="数式記号パレット">{symbols.map((symbol) => <button key={symbol} onClick={() => onInsert(symbol)} title={`${symbol} を挿入`}>{symbol}</button>)}</div>
          <textarea ref={textareaRef} value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); onSubmit(); } }} placeholder={problem.answerType === "short" ? "答えを入力（例：1, y=3e^(2x)）" : "証明や考え方を日本語または TeX で入力してください。\n\n例：任意の ε>0 に対して…"} />
          <div className="answerFooter">
            <span>日本語・TeX・配列記法に対応 <i>⌘ + Enter でも提出</i></span>
            <button className="submitButton" disabled={!answer.trim() || submitting} onClick={onSubmit}>{submitting ? "採点中…" : "回答を提出する"} <span>→</span></button>
          </div>
        </section>

        {result && <section className={`resultCard resultCard${result.status}`}>
          <span className="resultMark">{result.status === "AC" ? "✓" : result.status === "REVIEW" ? "△" : "×"}</span>
          <div><small>{result.status === "AC" ? "ACCEPTED" : result.status === "REVIEW" ? "NEEDS REVIEW" : "TRY AGAIN"}</small><h3>{result.status === "AC" ? "正解です！" : result.status === "REVIEW" ? "もう一歩です" : "見直してみましょう"}</h3><p>{result.feedback}</p></div>
          <b>{result.score}<small>/100</small></b>
        </section>}

        <section className={`explanationCard ${explanationOpen ? "open" : ""}`}>
          <button className="explanationToggle" onClick={() => setExplanationOpen(!explanationOpen)} aria-expanded={explanationOpen}>
            <span className="bookIcon">▤</span><span><b>解説と周辺知識</b><small>方針・詳しい解法・使った定理</small></span><i>{explanationOpen ? "−" : "+"}</i>
          </button>
          {explanationOpen && <div className="explanationBody">
            <p className="explanationSummary">{problem.explanation.summary}</p>
            <h4>解答の流れ</h4>
            <ol>{problem.explanation.steps.map((step, index) => <li key={index}><span>{index + 1}</span><p>{step}</p></li>)}</ol>
            <h4>周辺知識</h4>
            <div className="knowledgeGrid">{problem.explanation.knowledge.map((item) => <div key={item.title}><b>{item.title}</b><p>{item.body}</p></div>)}</div>
          </div>}
        </section>

        {result?.status === "AC" && <button className="nextButton" onClick={onNext}>次の問題へ進む <span>→</span></button>}
      </article>

      <aside className="problemMeta">
        <div className="timerCard"><small>経過時間</small><b>{formatTime(elapsedSeconds)}</b><span>目安 {problem.minutes}:00</span></div>
        <div className="metaCard"><h3>問題情報</h3><dl><div><dt>分野</dt><dd>{problem.field}</dd></div><div><dt>難易度</dt><dd>{problem.difficulty} — {difficultyLabel[problem.difficulty]}</dd></div><div><dt>得点</dt><dd>{problem.score} pts</dd></div><div><dt>提出</dt><dd>{progress?.attempts || 0} 回</dd></div></dl></div>
        <div className="metaCard"><h3>知識タグ</h3><div className="tagCloud">{problem.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></div>
        {progress && <div className={`historyCard history${progress.status}`}><small>現在の記録</small><StatusBadge status={progress.status} /><span>最高 {progress.bestScore} 点 · {shortDate(progress.updatedAt)}</span></div>}
      </aside>
    </div>
  </div>;
}

function StatsView({ progress, solved, attempted, attempts, totalSeconds }: {
  progress: Record<string, Progress>; solved: number; attempted: number; attempts: number; totalSeconds: number;
}) {
  const fieldStats = Array.from(new Set(problems.map((problem) => problem.field))).map((field) => {
    const scoped = problems.filter((problem) => problem.field === field);
    const count = scoped.filter((problem) => progress[problem.id]?.status === "AC").length;
    return { field, count, total: scoped.length, rate: Math.round((count / scoped.length) * 100) };
  }).sort((a, b) => b.rate - a.rate);

  const difficultyStats = (["A", "B", "C", "D"] as const).map((difficulty) => {
    const scoped = problems.filter((problem) => problem.difficulty === difficulty);
    return { difficulty, solved: scoped.filter((problem) => progress[problem.id]?.status === "AC").length, total: scoped.length };
  });

  const recent = Object.values(progress).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const heatDays = Array.from({ length: 70 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (69 - index));
    const key = date.toISOString().slice(0, 10);
    const count = Object.values(progress).filter((row) => row.updatedAt.slice(0, 10) === key).length;
    return { key, count };
  });

  return <div className="content statsContent">
    <section className="statsHero"><div><span className="heroLabel">LEARNING REPORT</span><h2>積み重ねが、見える。</h2><p>正解数だけでなく、分野ごとの得意・苦手も確認できます。</p></div><div className="overallRing" style={{ "--rate": `${Math.round((solved / problems.length) * 100)}%` } as React.CSSProperties}><span><b>{Math.round((solved / problems.length) * 100)}</b>%<small>全体進捗</small></span></div></section>
    <section className="statCards">
      <div><small>ACした問題</small><b>{solved}<span> / {problems.length}</span></b><em>✓</em></div>
      <div><small>挑戦した問題</small><b>{attempted}<span> 問</span></b><em>↗</em></div>
      <div><small>累計提出</small><b>{attempts}<span> 回</span></b><em>↻</em></div>
      <div><small>学習時間</small><b>{Math.round(totalSeconds / 60)}<span> 分</span></b><em>◷</em></div>
    </section>
    <div className="statsGrid">
      <section className="statsPanel heatmapPanel"><div className="statsPanelTitle"><div><h3>学習カレンダー</h3><p>過去10週間の提出記録</p></div><span>{Object.keys(progress).length} activities</span></div><div className="heatmap">{heatDays.map((day) => <span key={day.key} className={`heat heat${Math.min(day.count, 3)}`} title={`${day.key}: ${day.count}件`} />)}</div><div className="heatLegend"><span>Less</span><i className="heat heat0"/><i className="heat heat1"/><i className="heat heat2"/><i className="heat heat3"/><span>More</span></div></section>
      <section className="statsPanel"><div className="statsPanelTitle"><div><h3>分野別の成績</h3><p>AC率で得意分野を比較</p></div></div><div className="fieldBars">{fieldStats.map((item) => <div key={item.field}><p><span>{item.field}</span><b>{item.count}/{item.total}<small>{item.rate}%</small></b></p><div><span style={{ width: `${item.rate}%` }} /></div></div>)}</div></section>
      <section className="statsPanel"><div className="statsPanelTitle"><div><h3>難易度別</h3><p>AからDまでの到達度</p></div></div><div className="difficultyGrid">{difficultyStats.map((item) => <div key={item.difficulty}><span className={`level level${item.difficulty}`}>{item.difficulty}</span><b>{item.solved}<small>/{item.total}</small></b><p>{difficultyLabel[item.difficulty]}</p></div>)}</div></section>
      <section className="statsPanel recentPanel"><div className="statsPanelTitle"><div><h3>最近の提出</h3><p>直近5件の記録</p></div></div>{recent.length ? <div className="recentList">{recent.map((row) => { const problem = problems.find((item) => item.id === row.problemId)!; return <div key={row.problemId}><span className={`level level${problem.difficulty}`}>{problem.difficulty}</span><p><b>{problem.title}</b><small>{problem.field} · {shortDate(row.updatedAt)}</small></p><StatusBadge status={row.status}/></div>; })}</div> : <div className="emptyStats">問題を解くと、ここに記録が表示されます。</div>}</section>
    </div>
  </div>;
}
