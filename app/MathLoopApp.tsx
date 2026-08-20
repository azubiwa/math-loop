"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import katex from "katex";
import { gradeAnswer, problems, type Difficulty, type Problem } from "@/lib/problems";
import { supabase } from "@/lib/supabase";

type Status = "AC" | "REVIEW" | "WA";
type Progress = {
  problemId: string;
  status: Status;
  bestScore: number;
  attempts: number;
  lastAnswer: string;
  durationSeconds: number;
  firstStatus?: Status;
  firstScore?: number;
  acAttempt?: number;
  solvedAt: string | null;
  updatedAt: string;
};
type GradingMethod = "sakura" | "rule" | "exact" | "photo";
type Result = { status: Status; score: number; feedback: string; method?: GradingMethod };
type Attempt = {
  id: string;
  problemId: string;
  status: Status;
  score: number;
  answer: string;
  answerType: "text" | "text_photo";
  imagePath: string | null;
  durationSeconds: number;
  createdAt: string;
};

const symbols = ["ε", "δ", "∀", "∃", "→", "⇒", "∈", "⊂", "∪", "∩", "∫", "√", "∞", "⁻¹"];
const difficultyLabel: Record<Difficulty, string> = { A: "定義・基本", B: "典型", C: "標準", D: "証明・発展", E: "総合・最難関" };
const difficulties: Difficulty[] = ["A", "B", "C", "D", "E"];
const contestSeries = ["すべて", ...Array.from(new Set(problems.map((problem) => problem.contest.replace(/\s+#\d+$/, ""))))];

const localProgressKey = "mathabc-progress-v2";
const localAttemptsKey = "mathabc-attempt-history-v1";

function readLocalProgress() {
  try {
    return JSON.parse(localStorage.getItem(localProgressKey) || "{}") as Record<string, Progress>;
  } catch {
    return {};
  }
}

function readLocalAttempts() {
  try {
    return JSON.parse(localStorage.getItem(localAttemptsKey) || "{}") as Record<string, Attempt[]>;
  } catch {
    return {};
  }
}

function fromProgressRow(row: Record<string, unknown>): Progress {
  return {
    problemId: String(row.problem_id),
    status: row.status as Status,
    bestScore: Number(row.best_score),
    attempts: Number(row.attempts),
    lastAnswer: String(row.last_answer || ""),
    durationSeconds: Number(row.duration_seconds),
    firstStatus: row.first_status as Status | undefined,
    firstScore: row.first_score == null ? undefined : Number(row.first_score),
    acAttempt: row.ac_attempt == null ? undefined : Number(row.ac_attempt),
    solvedAt: row.solved_at ? String(row.solved_at) : null,
    updatedAt: String(row.updated_at),
  };
}

function fromAttemptRow(row: Record<string, unknown>): Attempt {
  return {
    id: String(row.id),
    problemId: String(row.problem_id),
    status: row.status as Status,
    score: Number(row.score),
    answer: String(row.answer || ""),
    answerType: row.answer_type as Attempt["answerType"],
    imagePath: row.image_path ? String(row.image_path) : null,
    durationSeconds: Number(row.duration_seconds),
    createdAt: String(row.created_at),
  };
}

function groupAttempts(rows: Attempt[]) {
  return rows.reduce<Record<string, Attempt[]>>((grouped, attempt) => {
    (grouped[attempt.problemId] ||= []).push(attempt);
    return grouped;
  }, {});
}

function statusRank(status: Status) {
  return status === "AC" ? 3 : status === "REVIEW" ? 2 : 1;
}

async function gradeWithSakura(problem: Problem, answer: string): Promise<Result | null> {
  const { data, error } = await supabase.functions.invoke("grade-answer", {
    body: {
      problemId: problem.id,
      title: problem.title,
      prompt: problem.prompt,
      answer,
      answerType: problem.answerType,
      grade: problem.grade,
      explanation: {
        summary: problem.explanation.summary,
        steps: problem.explanation.steps,
      },
    },
  });
  if (error || !data || !["AC", "REVIEW", "WA"].includes(data.status)) return null;
  const score = Number(data.score);
  if (!Number.isFinite(score)) return null;
  return { status: data.status as Status, score, feedback: String(data.feedback), method: "sakura" };
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

function attemptDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isFormula(line: string) {
  return /\$|[=∫Σlim]|T:|ker|Im |Var|E\[|det |A°|Ā|∂A/.test(line);
}

function StatusBadge({ status }: { status?: Status }) {
  if (!status) return <span className="resultBadge resultNone">未挑戦</span>;
  const label = status === "AC" ? "AC" : status === "REVIEW" ? "要確認" : "WA";
  return <span className={`resultBadge result${status}`}>{label}</span>;
}

export default function MathLoopApp() {
  const [view, setView] = useState<"problems" | "stats">("problems");
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [attemptsByProblem, setAttemptsByProblem] = useState<Record<string, Attempt[]>>({});
  const [query, setQuery] = useState("");
  const [field, setField] = useState("すべて");
  const [contestFilter, setContestFilter] = useState("すべて");
  const [statusFilter, setStatusFilter] = useState("すべて");
  const [sort, setSort] = useState("難易度順");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [answerPhoto, setAnswerPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncState, setSyncState] = useState<"loading" | "saved" | "local" | "error">("loading");
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authSending, setAuthSending] = useState(false);
  const [openedAt, setOpenedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [virtualUntil, setVirtualUntil] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;

    async function applySession(nextUser: User | null) {
      if (!active) return;
      setUser(nextUser);
      if (!nextUser) {
        setProgress(readLocalProgress());
        setAttemptsByProblem(readLocalAttempts());
        setSyncState("local");
        return;
      }
      setSyncState("loading");
      const [progressResponse, attemptsResponse] = await Promise.all([
        supabase
          .from("math_abc_progress")
          .select("*")
          .eq("user_id", nextUser.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("math_abc_attempts")
          .select("id,problem_id,status,score,answer,answer_type,image_path,duration_seconds,created_at")
          .eq("user_id", nextUser.id)
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);
      if (!active) return;
      if (progressResponse.error || attemptsResponse.error) {
        setSyncState("error");
        return;
      }
      const rows = (progressResponse.data || []).map((row) => fromProgressRow(row));
      const attemptRows = (attemptsResponse.data || []).map((row) => fromAttemptRow(row));
      setProgress(Object.fromEntries(rows.map((row) => [row.problemId, row])));
      setAttemptsByProblem(groupAttempts(attemptRows));
      setSyncState("saved");
      setAuthOpen(false);
    }

    supabase.auth.getSession().then(({ data }) => applySession(data.session?.user || null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session?.user || null);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
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
      const matchesContest = contestFilter === "すべて" || problem.contest.startsWith(contestFilter);
      const currentStatus = progress[problem.id]?.status;
      const matchesStatus = statusFilter === "すべて" ||
        (statusFilter === "未挑戦" ? !currentStatus : currentStatus === statusFilter);
      return matchesText && matchesField && matchesContest && matchesStatus;
    });
    return [...rows].sort((a, b) => {
      if (sort === "新着順") return b.id.localeCompare(a.id);
      if (sort === "分野順") return a.field.localeCompare(b.field, "ja");
      return a.score - b.score;
    });
  }, [query, field, contestFilter, statusFilter, sort, progress]);

  const contestRows = useMemo(() => {
    const grouped = new Map<string, Problem[]>();
    for (const problem of filtered) {
      const current = grouped.get(problem.contest) || [];
      current.push(problem);
      grouped.set(problem.contest, current);
    }
    return Array.from(grouped, ([contest, setProblems]) => ({ contest, problems: setProblems }))
      .sort((a, b) => a.contest.localeCompare(b.contest, "en", { numeric: true }));
  }, [filtered]);

  function navigate(next: "problems" | "stats") {
    setView(next);
    setActiveProblem(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openProblem(problem: Problem) {
    const previous = progress[problem.id];
    const draft = localStorage.getItem(`mathabc-draft-${problem.id}`) || "";
    setActiveProblem(problem);
    setView("problems");
    setAnswer(draft || (previous?.status === "AC" ? "" : previous?.lastAnswer || ""));
    setResult(null);
    setAnswerPhoto(null);
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

  function updatePhoto(file: File | null) {
    setAnswerPhoto(file);
    if (!file) {
      setPhotoPreview(null);
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => setPhotoPreview(typeof reader.result === "string" ? reader.result : null));
    reader.readAsDataURL(file);
  }

  async function sendMagicLink() {
    if (!email.trim() || authSending) return;
    setAuthSending(true);
    setAuthMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
    });
    setAuthMessage(error ? `送信できませんでした：${error.message}` : "ログイン用リンクを送りました。メールを確認してください。");
    setAuthSending(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProgress(readLocalProgress());
    setAttemptsByProblem(readLocalAttempts());
    setSyncState("local");
  }

  async function submit() {
    if (!activeProblem || (!answer.trim() && !answerPhoto) || submitting) return;
    if (answerPhoto && !user) {
      setResult({ status: "REVIEW", score: 0, feedback: "写真の保存にはログインが必要です。ログイン後にもう一度提出してください。" });
      setAuthOpen(true);
      return;
    }
    setSubmitting(true);
    setSyncState("loading");
    try {
      const submittedAnswer = answer;
      const ruleResult = submittedAnswer.trim() ? gradeAnswer(activeProblem, submittedAnswer) : null;
      let graded: Result = ruleResult
        ? { ...ruleResult, method: activeProblem.answerType === "short" ? "exact" : "rule" }
        : { status: "REVIEW", score: 0, feedback: "写真を保存しました。現在は写真だけの自動採点には未対応です。要点をテキストでも入力すると採点できます。", method: "photo" };
      if (user && submittedAnswer.trim() && activeProblem.answerType === "proof") {
        const aiResult = await gradeWithSakura(activeProblem, submittedAnswer);
        graded = aiResult || {
          ...graded,
          feedback: `${graded.feedback} さくらAIに接続できなかったため、今回は必須論点による簡易採点です。`,
          method: "rule",
        };
      }
      const durationSeconds = Math.round((Date.now() - openedAt) / 1000);
      const previous = progress[activeProblem.id];
      const attemptNumber = (previous?.attempts || 0) + 1;
      const timestamp = new Date().toISOString();
      const recordedStatus = previous && statusRank(previous.status) > statusRank(graded.status) ? previous.status : graded.status;
      let imagePath: string | null = null;

      if (user && answerPhoto) {
        const extension = answerPhoto.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        imagePath = `${user.id}/${activeProblem.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("math-abc-answers")
          .upload(imagePath, answerPhoto, { contentType: answerPhoto.type, upsert: false });
        if (uploadError) throw uploadError;
      }

      const nextProgress: Progress = {
        problemId: activeProblem.id,
        status: recordedStatus,
        bestScore: Math.max(previous?.bestScore || 0, graded.score),
        attempts: attemptNumber,
        lastAnswer: submittedAnswer,
        durationSeconds: (previous?.durationSeconds || 0) + durationSeconds,
        firstStatus: previous?.firstStatus || graded.status,
        firstScore: previous?.firstScore ?? graded.score,
        acAttempt: previous?.acAttempt || (graded.status === "AC" ? attemptNumber : undefined),
        solvedAt: previous?.solvedAt || (graded.status === "AC" ? timestamp : null),
        updatedAt: timestamp,
      };
      let savedAttempt: Attempt = {
        id: crypto.randomUUID(),
        problemId: activeProblem.id,
        status: graded.status,
        score: graded.score,
        answer: submittedAnswer,
        answerType: imagePath ? "text_photo" : "text",
        imagePath,
        durationSeconds,
        createdAt: timestamp,
      };

      if (user) {
        const { data: attemptRow, error: attemptError } = await supabase
          .from("math_abc_attempts")
          .insert({
            user_id: user.id,
            problem_id: activeProblem.id,
            status: graded.status,
            score: graded.score,
            answer: submittedAnswer,
            answer_type: imagePath ? "text_photo" : "text",
            image_path: imagePath,
            duration_seconds: durationSeconds,
          })
          .select("id,problem_id,status,score,answer,answer_type,image_path,duration_seconds,created_at")
          .single();
        if (attemptError) throw attemptError;
        savedAttempt = fromAttemptRow(attemptRow);

        const { error: progressError } = await supabase.from("math_abc_progress").upsert({
          user_id: user.id,
          problem_id: nextProgress.problemId,
          status: nextProgress.status,
          best_score: nextProgress.bestScore,
          attempts: nextProgress.attempts,
          last_answer: nextProgress.lastAnswer,
          duration_seconds: nextProgress.durationSeconds,
          first_status: nextProgress.firstStatus,
          first_score: nextProgress.firstScore,
          ac_attempt: nextProgress.acAttempt,
          solved_at: nextProgress.solvedAt,
          updated_at: nextProgress.updatedAt,
        }, { onConflict: "user_id,problem_id" });
        if (progressError) throw progressError;
      } else {
        const nextLocal = { ...progress, [nextProgress.problemId]: nextProgress };
        const currentAttempts = readLocalAttempts();
        const nextLocalAttempts = {
          ...currentAttempts,
          [activeProblem.id]: [savedAttempt, ...(currentAttempts[activeProblem.id] || [])],
        };
        localStorage.setItem(localProgressKey, JSON.stringify(nextLocal));
        localStorage.setItem(localAttemptsKey, JSON.stringify(nextLocalAttempts));
      }

      setResult(graded);
      setProgress((current) => ({ ...current, [nextProgress.problemId]: nextProgress }));
      setAttemptsByProblem((current) => ({
        ...current,
        [activeProblem.id]: [savedAttempt, ...(current[activeProblem.id] || [])],
      }));
      setSyncState(user ? "saved" : "local");
      setAnswerPhoto(null);
      setPhotoPreview(null);
      if (graded.status === "AC") {
        setAnswer("");
        localStorage.removeItem(`mathabc-draft-${activeProblem.id}`);
      }
    } catch (error) {
      setSyncState("error");
      setResult({ status: "REVIEW", score: 0, feedback: `採点記録を保存できませんでした。${error instanceof Error ? error.message : "少し待ってからもう一度提出してください。"}` });
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
        <button className="brand" onClick={() => navigate("problems")} aria-label="MathLoop ホーム">
          <span className="brandMark">∞</span><span>MATHLOOP</span>
        </button>
        <nav aria-label="メインナビゲーション">
          <button className={`navItem ${view === "problems" ? "active" : ""}`} onClick={() => navigate("problems")}><span>▦</span>問題一覧</button>
          <button className={`navItem ${view === "stats" ? "active" : ""}`} onClick={() => navigate("stats")}><span>⌁</span>統計</button>
        </nav>
        <div className="sideProgress">
          <div><span>全体の進捗</span><b>{solved}/{problems.length}</b></div>
          <div className="progressTrack"><span style={{ width: `${(solved / problems.length) * 100}%` }} /></div>
          <small>{syncState === "loading" ? "記録を同期中…" : syncState === "error" ? "再接続待ち" : syncState === "local" ? "この端末だけに保存中" : "Supabaseに自動保存"}</small>
        </div>
        <button className="sideFooter" onClick={() => user ? void signOut() : setAuthOpen(true)}><span className="avatar">{user ? "同" : "学"}</span><span><b>{user?.email || "匿名の学習者"}</b><small>{user ? "クリックでログアウト" : "ログインして端末間同期"}</small></span></button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">MATHEMATICS PRACTICE LOG</span>
            <h1>{activeProblem ? activeProblem.contest : view === "stats" ? "学習統計" : "問題一覧"}</h1>
          </div>
          <div className="topActions">
            {virtualSeconds !== null && virtualSeconds > 0 && <span className="contestClock"><i>●</i> 集中モード {formatTime(virtualSeconds)}</span>}
            <button className={`syncButton ${user ? "connected" : ""}`} onClick={() => user ? void signOut() : setAuthOpen(true)}>{user ? "● 同期中" : "端末間で同期"}</button>
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
            attempts={attemptsByProblem[activeProblem.id] || []}
            elapsedSeconds={elapsedSeconds}
            explanationOpen={explanationOpen}
            setExplanationOpen={setExplanationOpen}
            submitting={submitting}
            answerPhoto={answerPhoto}
            photoPreview={photoPreview}
            onPhotoChange={updatePhoto}
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
                <span className="heroLabel">MATHLOOP — PRACTICE SET</span>
                <h2>解く。</h2>
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
              <div className="levelTabs" aria-label="コンテストシリーズで絞り込み">
                {contestSeries.map((item) => <button key={item} className={contestFilter === item ? "active" : ""} onClick={() => setContestFilter(item)}>{item === "すべて" ? "すべてのシリーズ" : item}</button>)}
              </div>
              <div className="tableWrap setTableWrap">
                <table className="setTable">
                  <thead><tr><th>セット</th>{difficulties.map((difficulty) => <th key={difficulty}><span className={`level level${difficulty}`}>{difficulty}</span><small>{difficultyLabel[difficulty]}</small></th>)}</tr></thead>
                  <tbody>{contestRows.map(({ contest, problems: setProblems }, setIndex) => {
                    const setSolved = setProblems.filter((problem) => progress[problem.id]?.status === "AC").length;
                    const setFields = Array.from(new Set(setProblems.map((problem) => problem.field)));
                    return <tr key={contest}>
                      <th scope="row" className="setIdentity">
                        <span>SET {String(setIndex + 1).padStart(2, "0")}</span>
                        <b>{contest}</b>
                        <small>{setFields.join("・")} · {setSolved}/{setProblems.length} AC</small>
                      </th>
                      {difficulties.map((difficulty) => {
                        const cells = setProblems.filter((problem) => problem.difficulty === difficulty);
                        return <td key={difficulty} className={!cells.length ? "emptyCell" : ""}>
                          {cells.length ? <div className="setCellStack">{cells.map((problem) => {
                            const row = progress[problem.id];
                            return <button key={problem.id} className={`setProblemCell ${row ? `cell${row.status}` : ""}`} onClick={() => openProblem(problem)}>
                              <span className="setProblemTop"><b>{problem.title}</b><StatusBadge status={row?.status} /></span>
                              <span className="setProblemMeta">{problem.minutes} min · {problem.score} pts</span>
                            </button>;
                          })}</div> : <span className="cellDash">—</span>}
                        </td>;
                      })}
                    </tr>;
                  })}</tbody>
                </table>
                {!filtered.length && <div className="emptyState"><b>該当する問題がありません</b><span>検索語や絞り込みを変えてみてください。</span></div>}
              </div>
            </section>
          </div>
        )}
      </section>
      {authOpen && <AuthDialog
        email={email}
        setEmail={setEmail}
        message={authMessage}
        sending={authSending}
        onSend={() => void sendMagicLink()}
        onClose={() => setAuthOpen(false)}
      />}
    </main>
  );
}

function ProblemView({
  problem, answer, setAnswer, result, progress, attempts, elapsedSeconds, explanationOpen, setExplanationOpen,
  submitting, answerPhoto, photoPreview, onPhotoChange, onBack, onSubmit, onNext, onInsert, textareaRef,
}: {
  problem: Problem; answer: string; setAnswer: (value: string) => void; result: Result | null; progress?: Progress; attempts: Attempt[];
  elapsedSeconds: number; explanationOpen: boolean; setExplanationOpen: (value: boolean) => void;
  submitting: boolean; onBack: () => void; onSubmit: () => void; onNext: () => void; onInsert: (symbol: string) => void;
  answerPhoto: File | null; photoPreview: string | null; onPhotoChange: (file: File | null) => void;
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
            {problem.prompt.map((line, index) => <p key={index} className={isFormula(line) ? "formula" : ""}><MathText text={line} /></p>)}
          </div>
          {problem.note && <p className="problemNote">注：<MathText text={problem.note} /></p>}
        </section>

        <section className="answerCard">
          <div className="answerHeading">
            <div><span className="stepNumber">01</span><div><h3>回答を書く</h3><p><MathText text={problem.grade.hint} /></p></div></div>
            <span className="answerMode">{problem.answerType === "short" ? "短答" : "記述・証明"}</span>
          </div>
          <div className="symbolBar" aria-label="数式記号パレット">{symbols.map((symbol) => <button key={symbol} onClick={() => onInsert(symbol)} title={`${symbol} を挿入`}>{symbol}</button>)}</div>
          <textarea ref={textareaRef} value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); onSubmit(); } }} placeholder={problem.answerType === "short" ? "答えを入力（例：1, y=3e^(2x)）" : "証明や考え方を日本語または TeX で入力してください。\n\n例：任意の ε>0 に対して…"} />
          {answer.trim() && <AnswerPreview answer={answer} />}
          <div className="photoAnswer">
            <label className="photoButton">⌑ 解答用紙の写真を添付<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={(event) => onPhotoChange(event.target.files?.[0] || null)} /></label>
            <span>スマホではそのまま撮影できます。写真だけの提出は要確認になります。</span>
            {photoPreview && <div className="photoPreview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="添付する解答写真のプレビュー" />
              <button onClick={() => onPhotoChange(null)}>写真を外す</button>
            </div>}
          </div>
          <div className="answerFooter">
            <span>数式は $...$ でプレビュー <i>⌘ + Enter でも提出</i></span>
            <button className="submitButton" disabled={(!answer.trim() && !answerPhoto) || submitting} onClick={onSubmit}>{submitting ? "採点中…" : "回答を提出する"} <span>→</span></button>
          </div>
        </section>

        {result && <section className={`resultCard resultCard${result.status}`}>
          <span className="resultMark">{result.status === "AC" ? "✓" : result.status === "REVIEW" ? "△" : "×"}</span>
          <div><small>{result.status === "AC" ? "ACCEPTED" : result.status === "REVIEW" ? "NEEDS REVIEW" : "TRY AGAIN"}{result.method && <span className="judgeLabel">{result.method === "sakura" ? "さくらAI採点" : result.method === "exact" ? "完全一致採点" : result.method === "photo" ? "写真を保存" : "簡易採点"}</span>}</small><h3>{result.status === "AC" ? "正解です！" : result.status === "REVIEW" ? "もう一歩です" : "見直してみましょう"}</h3><p>{result.feedback}</p></div>
          <b>{result.score}<small>/100</small></b>
        </section>}

        <section className="attemptHistorySection">
          <div className="attemptHistoryHeading">
            <div><span className="stepNumber">02</span><div><h3>回答履歴</h3><p>送信した回答と採点結果を振り返れます</p></div></div>
            <span className="attemptCount">{attempts.length} 件</span>
          </div>
          {attempts.length ? <div className="attemptList">
            {attempts.map((attempt, index) => <details className={`attemptItem attempt${attempt.status}`} key={attempt.id} open={index === 0}>
              <summary>
                <span className="attemptNumber">#{attempts.length - index}</span>
                <StatusBadge status={attempt.status} />
                <span className="attemptDate">{attemptDate(attempt.createdAt)}</span>
                <b>{attempt.score}<small>/100</small></b>
                <i aria-hidden="true">⌄</i>
              </summary>
              <div className="attemptBody">
                <span>送信した回答</span>
                {attempt.answer.trim() ? <AnswerPreview answer={attempt.answer} /> : <p className="photoOnlyAnswer">写真のみで提出しました</p>}
                <div className="attemptMeta"><span>解答時間 {formatTime(attempt.durationSeconds)}</span>{attempt.imagePath && <span>⌑ 写真付き</span>}</div>
              </div>
            </details>)}
          </div> : <div className="attemptEmpty"><span>↻</span><p><b>まだ回答履歴はありません</b><small>回答を提出すると、ここに内容と採点結果が残ります。</small></p></div>}
        </section>

        <section className={`explanationCard ${explanationOpen ? "open" : ""}`}>
          <button className="explanationToggle" onClick={() => setExplanationOpen(!explanationOpen)} aria-expanded={explanationOpen}>
            <span className="bookIcon">▤</span><span><b>解説と周辺知識</b><small>方針・詳しい解法・使った定理</small></span><i>{explanationOpen ? "−" : "+"}</i>
          </button>
          {explanationOpen && <div className="explanationBody">
            <p className="explanationSummary"><MathText text={problem.explanation.summary} /></p>
            <h4>解答の流れ</h4>
            <ol>{problem.explanation.steps.map((step, index) => <li key={index}><span>{index + 1}</span><p><MathText text={step} /></p></li>)}</ol>
            <h4>周辺知識</h4>
            <div className="knowledgeGrid">{problem.explanation.knowledge.map((item) => <div key={item.title}><b><MathText text={item.title} /></b><p><MathText text={item.body} /></p></div>)}</div>
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

function AnswerPreview({ answer }: { answer: string }) {
  return <div className="answerPreview">
    <span className="previewLabel">TeX PREVIEW</span>
    <div><MathText text={answer} /></div>
  </div>;
}

function MathText({ text }: { text: string }) {
  const normalized = text.replace(/lim_\{([^}]+)\}\s*\(([^)]+)\)\/\(([^)]+)\)/g, (_match, limit, numerator, denominator) => {
    const tex = (value: string) => value
      .replace(/→/g, "\\to ")
      .replace(/∞/g, "\\infty")
      .replace(/²/g, "^2")
      .replace(/³/g, "^3")
      .replace(/⁴/g, "^4")
      .replace(/−/g, "-");
    return `$\\displaystyle\\lim_{${tex(limit)}}\\frac{${tex(numerator)}}{${tex(denominator)}}$`;
  });
  const parts = normalized.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g).filter(Boolean);
  return <>{parts.map((part, index) => {
    const display = part.startsWith("$$") && part.endsWith("$$");
    const inline = !display && part.startsWith("$") && part.endsWith("$");
    if (!display && !inline) return <span key={index} className="previewText">{part}</span>;
    const source = part.slice(display ? 2 : 1, display ? -2 : -1);
    const html = katex.renderToString(source, { throwOnError: false, displayMode: display, strict: false });
    return <span key={index} className={display ? "previewFormula display" : "previewFormula"} dangerouslySetInnerHTML={{ __html: html }} />;
  })}</>;
}

function AuthDialog({ email, setEmail, message, sending, onSend, onClose }: {
  email: string; setEmail: (value: string) => void; message: string; sending: boolean; onSend: () => void; onClose: () => void;
}) {
  return <div className="dialogBackdrop">
    <section className="authDialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button className="dialogClose" onClick={onClose} aria-label="閉じる">×</button>
      <span className="authMark">∞</span>
      <span className="eyebrow">SUPABASE SYNC</span>
      <h2 id="auth-title">学習記録を端末間で同期</h2>
      <p>メールに届くログインリンクを開くだけです。同じメールアドレスなら、スマホとPCで同じ成績を使えます。</p>
      <label>メールアドレス<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSend(); }} placeholder="you@example.com" /></label>
      <button className="authSubmit" disabled={!email.trim() || sending} onClick={onSend}>{sending ? "送信中…" : "ログインリンクを送る"}</button>
      {message && <div className="authMessage" aria-live="polite">{message}</div>}
      <small>ログインしない場合も、この端末内だけで回答記録を保存できます。</small>
    </section>
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

  const difficultyStats = difficulties.map((difficulty) => {
    const scoped = problems.filter((problem) => problem.difficulty === difficulty);
    return { difficulty, solved: scoped.filter((problem) => progress[problem.id]?.status === "AC").length, total: scoped.length };
  });

  const recent = Object.values(progress).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const firstAc = Object.values(progress).filter((row) => row.firstStatus === "AC").length;
  const retryTargets = Object.values(progress).filter((row) => row.firstStatus && row.firstStatus !== "AC");
  const retryAc = retryTargets.filter((row) => row.status === "AC").length;
  const tagStats = Array.from(new Set(problems.flatMap((problem) => problem.tags))).map((tag) => {
    const scoped = problems.filter((problem) => problem.tags.includes(tag));
    const challenged = scoped.filter((problem) => progress[problem.id]);
    const count = scoped.filter((problem) => progress[problem.id]?.status === "AC").length;
    return { tag, count, challenged: challenged.length, total: scoped.length, rate: challenged.length ? Math.round((count / challenged.length) * 100) : 0 };
  }).filter((item) => item.challenged > 0).sort((a, b) => b.challenged - a.challenged || b.rate - a.rate).slice(0, 12);
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
      <div><small>初回AC率</small><b>{attempted ? Math.round((firstAc / attempted) * 100) : 0}<span> %</span></b><em>1</em></div>
      <div><small>復習後AC率</small><b>{retryTargets.length ? Math.round((retryAc / retryTargets.length) * 100) : 0}<span> %</span></b><em>↺</em></div>
    </section>
    <div className="statsGrid">
      <section className="statsPanel heatmapPanel"><div className="statsPanelTitle"><div><h3>学習カレンダー</h3><p>過去10週間の提出記録</p></div><span>{Object.keys(progress).length} activities</span></div><div className="heatmap">{heatDays.map((day) => <span key={day.key} className={`heat heat${Math.min(day.count, 3)}`} title={`${day.key}: ${day.count}件`} />)}</div><div className="heatLegend"><span>Less</span><i className="heat heat0"/><i className="heat heat1"/><i className="heat heat2"/><i className="heat heat3"/><span>More</span></div></section>
      <section className="statsPanel"><div className="statsPanelTitle"><div><h3>分野別の成績</h3><p>AC率で得意分野を比較</p></div></div><div className="fieldBars">{fieldStats.map((item) => <div key={item.field}><p><span>{item.field}</span><b>{item.count}/{item.total}<small>{item.rate}%</small></b></p><div><span style={{ width: `${item.rate}%` }} /></div></div>)}</div></section>
      <section className="statsPanel"><div className="statsPanelTitle"><div><h3>難易度別</h3><p>AからEまでの到達度</p></div></div><div className="difficultyGrid">{difficultyStats.map((item) => <div key={item.difficulty}><span className={`level level${item.difficulty}`}>{item.difficulty}</span><b>{item.solved}<small>/{item.total}</small></b><p>{difficultyLabel[item.difficulty]}</p></div>)}</div></section>
      <section className="statsPanel tagStatsPanel"><div className="statsPanelTitle"><div><h3>タグ別の成績</h3><p>挑戦済みの知識タグごとのAC率</p></div></div>{tagStats.length ? <div className="tagStatsList">{tagStats.map((item) => <div key={item.tag}><p><span>#{item.tag}</span><b>{item.count}/{item.challenged}<small>{item.rate}%</small></b></p><div><span style={{ width: `${item.rate}%` }} /></div></div>)}</div> : <div className="emptyStats">問題を解くと、タグ別の成績が表示されます。</div>}</section>
      <section className="statsPanel recentPanel"><div className="statsPanelTitle"><div><h3>最近の提出</h3><p>直近5件の記録</p></div></div>{recent.length ? <div className="recentList">{recent.map((row) => { const problem = problems.find((item) => item.id === row.problemId)!; return <div key={row.problemId}><span className={`level level${problem.difficulty}`}>{problem.difficulty}</span><p><b>{problem.title}</b><small>{problem.field} · {shortDate(row.updatedAt)}</small></p><StatusBadge status={row.status}/></div>; })}</div> : <div className="emptyStats">問題を解くと、ここに記録が表示されます。</div>}</section>
    </div>
  </div>;
}
