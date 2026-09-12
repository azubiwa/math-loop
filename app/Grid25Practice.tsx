"use client";

import { useEffect, useState } from "react";
import { createGrid, formatGridValue, gridAnswer, gridModes, isGridAnswerCorrect, type GridMode } from "@/lib/grid25";

type Session = { answers: string[]; startedAt: number | null; finishedAt: number | null };
type Saved = { sessions: Record<string, Session> };
const storageKey = "mathloop-grid25-v1";
const emptySession = (): Session => ({ answers: Array(25).fill(""), startedAt: null, finishedAt: null });

function readSaved(): Saved {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || "{}");
    const sessions: Record<string, Session> = {};
    for (const [key, value] of Object.entries(data.sessions || {})) {
      const session = value as Session;
      if (session && Array.isArray(session.answers) && session.answers.length === 25
        && session.answers.every((answer) => typeof answer === "string")
        && (session.startedAt === null || Number.isFinite(session.startedAt))
        && (session.finishedAt === null || Number.isFinite(session.finishedAt))) sessions[key] = session;
    }
    return { sessions };
  } catch { return { sessions: {} }; }
}

function timeLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function Grid25Practice() {
  const [mode, setMode] = useState<GridMode>("addition");
  const [sheet, setSheet] = useState(1);
  const [saved, setSaved] = useState<Saved>({ sessions: {} });
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [now, setNow] = useState(0);
  const [showAnswers, setShowAnswers] = useState(false);
  useEffect(() => {
    // Read browser storage only after hydration; never overwrite it with the server's empty state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(readSaved());
    setReady(true);
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const key = `${mode}-${sheet}`;
  const session = saved.sessions[key] || emptySession();
  const selectedMode = gridModes.find((item) => item.id === mode)!;
  const grid = createGrid(mode, sheet);
  const expected = grid.rows.flatMap((row) => grid.columns.map((column) => gridAnswer(mode, row, column)));
  const correct = expected.map((value, index) => isGridAnswerCorrect(session.answers[index], value));
  const score = correct.filter(Boolean).length;
  const filled = session.answers.filter((value) => value.trim()).length;
  const finished = session.finishedAt !== null;
  const elapsed = session.startedAt === null ? 0 : (session.finishedAt ?? now) - session.startedAt;
  const completedSheets = Array.from({ length: 10 }, (_, index) => saved.sessions[`${mode}-${index + 1}`]).filter((item) => item?.finishedAt != null).length;

  function updateSession(next: Session) {
    const data = { sessions: { ...saved.sessions, [key]: next } };
    setSaved(data);
    try { localStorage.setItem(storageKey, JSON.stringify(data)); setSaveError(false); }
    catch { setSaveError(true); }
  }

  return <div className="content grid25Content">
    <section className="grid25Intro">
      <div><span className="heroLabel">MATHLOOP · 5 × 5</span><h2>25マス計算</h2><p>左の値と上の値を計算して、交点に答えを書く。<br />25回の小さな反復を、数学の基礎体力に。</p></div>
      <div className="grid25Emblem" aria-hidden="true">25<span>MASU</span></div>
    </section>
    <div className="grid25Modes" aria-label="計算の種類">
      {gridModes.map((item) => <button key={item.id} aria-pressed={mode === item.id} onClick={() => { setMode(item.id); setShowAnswers(false); }}><b>{item.title}</b><small>{item.description}</small></button>)}
    </div>
    <section className="panel grid25Panel" aria-label="25マス計算の問題">
      <div className="grid25Toolbar">
        <div><h3>{selectedMode.title}</h3><label>問題集 <select aria-label="問題集のセット" value={sheet} onChange={(event) => { setSheet(Number(event.target.value)); setShowAnswers(false); }}>{Array.from({ length: 10 }, (_, index) => <option key={index} value={index + 1}>#{String(index + 1).padStart(3, "0")}{saved.sessions[`${mode}-${index + 1}`]?.finishedAt != null ? " · 済" : ""}</option>)}</select></label></div>
        <div className="grid25Metrics"><span><small>入力済み</small><b>{filled}<em> / 25</em></b></span><span><small>経過時間</small><b>{timeLabel(elapsed)}</b></span></div>
      </div>
      <p className="grid25Hint">{selectedMode.hint}<span>最初の入力から計測します。Enterで次のマスへ。</span></p>
      <form onSubmit={(event) => { event.preventDefault(); if (!finished && filled) { const timestamp = Date.now(); setNow(timestamp); updateSession({ ...session, finishedAt: timestamp }); } }}>
        <div className="grid25Scroll">
          <table className={`grid25Table ${mode === "complex" ? "grid25Complex" : ""}`}>
            <caption className="sr-only">{selectedMode.title} 第{sheet}セット。各マスに、左の行見出しと上の列見出しの{selectedMode.operation === "+" ? "和" : "積"}を入力してください。</caption>
            <thead><tr><th scope="col" className="grid25Operator">{selectedMode.operation}</th>{grid.columns.map((value, index) => <th scope="col" key={index}>{formatGridValue(value)}</th>)}</tr></thead>
            <tbody>{grid.rows.map((row, rowIndex) => <tr key={rowIndex}><th scope="row">{formatGridValue(row)}</th>{grid.columns.map((column, columnIndex) => {
              const index = rowIndex * 5 + columnIndex;
              const status = !finished ? "" : correct[index] ? "correct" : "incorrect";
              return <td key={columnIndex} className={status}>
                <span className="grid25CellNumber" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <input name={`cell-${index}`} aria-label={`${rowIndex + 1}行${columnIndex + 1}列：(${formatGridValue(row)}) ${selectedMode.operation} (${formatGridValue(column)})${finished ? correct[index] ? "、正解" : "、不正解" : ""}`} aria-invalid={finished && !correct[index]} value={session.answers[index]} disabled={!ready} readOnly={finished} autoComplete="off" spellCheck={false} maxLength={40} onChange={(event) => {
                  const answers = [...session.answers]; answers[index] = event.target.value;
                  const timestamp = Date.now(); setNow(timestamp);
                  updateSession({ ...session, answers, startedAt: session.startedAt ?? timestamp });
                }} onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    const form = event.currentTarget.form;
                    const target = form?.elements.namedItem(`cell-${index + 1}`) as HTMLInputElement | null;
                    if (target) target.focus(); else form?.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus();
                  }
                }} />
                {finished && <span className="grid25CellResult">{correct[index] ? "○" : session.answers[index].trim() ? "×" : "未回答"}</span>}
                {finished && showAnswers && <small className="grid25Answer">{formatGridValue(expected[index])}</small>}
              </td>;
            })}</tr>)}</tbody>
          </table>
        </div>
        <div className="grid25Footer">
          <span>{completedSheets} / 10 セット採点済み</span>
          {!finished ? <button type="submit" className="submitButton" disabled={!ready || !filled}>25マスを答え合わせ</button> : <div className="grid25ResultActions"><button type="button" onClick={() => setShowAnswers(!showAnswers)}>{showAnswers ? "答えを隠す" : "答えを見る"}</button><button type="button" onClick={() => { updateSession(emptySession()); setShowAnswers(false); }}>同じ問題をもう一度</button>{sheet < 10 && <button type="button" className="submitButton" onClick={() => { setSheet(sheet + 1); setShowAnswers(false); }}>次のセット →</button>}</div>}
        </div>
      </form>
      {finished && <div className="grid25Result" role="status"><b>{score === 25 ? "25マス、全問正解！" : `${score} / 25 問正解`}</b><span>{timeLabel(elapsed)} · {score === 25 ? "次のセットにも挑戦してみましょう。" : "答えを確認して、もう一度挑戦してみましょう。"}</span></div>}
    </section>
    <p className="grid25SaveNote" role="status">{saveError ? "このブラウザに保存できませんでした。画面を閉じると今回の入力が失われます。" : "入力と直近の結果はこのブラウザに自動保存されます。25マス計算は端末間同期・保存データの書き出し・学習統計の対象外です。"}</p>
  </div>;
}
