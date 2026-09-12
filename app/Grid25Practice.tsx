"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import { createDrillBoard, drillCategories, drills, expressionTex, getDrill, gradeDrillCell, type Category, type DrillCell } from "@/lib/grid-drills";
import { accuracy, confirmCell, createRun, duration, eligibleBest, emptyGridSaved, finishRun, gridStorageKey, legacyGridStorageKey, mergeGridSaved, migrateLegacy, parseGridSaved, runIndices, runKey, sameBoard, type GridSaved, type Run } from "@/lib/grid-history";
import Grid25Guide from "./Grid25Guide";
import DrillStatistics from "./Grid25Statistics";

export function Formula({ tex }: { tex: string }) {
  const html = useMemo(() => katex.renderToString(tex, { throwOnError: false, strict: "ignore", trust: false, output: "htmlAndMathml" }), [tex]);
  return <span className="drillFormula" dangerouslySetInnerHTML={{ __html: html }} />;
}
export function timeLabel(milliseconds: number | null) {
  if (milliseconds === null) return "—";
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
function downloadJson(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const basisTex = (basis: string) => basis.startsWith("∂") ? `\\partial_${basis.slice(1)}` : basis === "e₁" ? "e_1" : basis === "e₂" ? "e_2" : basis.split("∧").map((b) => `\\mathrm{d}${b.slice(1)}`).join("\\wedge ");
function answerTex(cell: DrillCell, values: string[]) {
  if (cell.basis[0] === "答え") return expressionTex(values[0] || "0");
  return values.map((v, i) => `\\left(${expressionTex(v || "0")}\\right)${basisTex(cell.basis[i])}`).join("+");
}
type Selection = { id: string; level: "basic" | "standard"; sheet: number; mode: "practice" | "timed" };
const gradeLabel = { correct: "○ 正解", incorrect: "× 不正解", invalid: "入力を確認", empty: "未回答" };

export default function Grid25Practice() {
  const [selection, setSelection] = useState<Selection>({ id: "addition", level: "basic", sheet: 1, mode: "practice" });
  const [category, setCategory] = useState<Category>("calculation");
  const [saved, setSaved] = useState<GridSaved>(emptyGridSaved);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(0);
  const [selectedCell, setSelected] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [inspect, setInspect] = useState<Run | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [device, setDevice] = useState<Run["device"]>("keyboard");
  const dataRef = useRef(saved);
  const activeKeyRef = useRef("");
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLInputElement>(null);
  const definition = getDrill(selection.id)!;
  const board = useMemo(() => createDrillBoard(selection.id, selection.sheet, selection.level), [selection.id, selection.sheet, selection.level]);
  const key = runKey(board, selection.mode);
  const seenBefore = saved.history.some((r) => sameBoard(r.board, board));
  const preview = useMemo(() => createRun(board, selection.mode, device, seenBefore, "preview"), [board, selection.mode, device, seenBefore]);
  const run = inspect || saved.drafts[key] || preview;
  const currentBoard = run.board;
  const indices = runIndices(run);
  const selected = indices.includes(selectedCell) ? selectedCell : indices[0];
  const finished = run.finishedAt !== null;
  const hidden = run.mode === "timed" && run.startedAt === null;
  const cell = currentBoard.cells[selected];
  const direct = currentBoard.cells[0].basis[0] === "答え" && !currentBoard.cells[0].variables.length;
  const visibleGrade = finished || run.mode !== "timed" ? run.checked[selected] : run.checked[selected] === "invalid" || run.checked[selected] === "empty" ? run.checked[selected] : null;
  const filled = indices.filter((i) => run.answers[i].every((a) => a.trim())).length;
  const elapsed = run.startedAt === null ? 0 : (run.finishedAt ?? now) - run.startedAt;

  const commit = useCallback((data: GridSaved) => {
    dataRef.current = data; setSaved(data);
    try { localStorage.setItem(gridStorageKey, JSON.stringify(data)); setSaveError(false); }
    catch { setSaveError(true); }
  }, []);

  useEffect(() => {
    let data: GridSaved;
    try {
      const raw = localStorage.getItem(gridStorageKey);
      data = raw ? parseGridSaved(raw) : emptyGridSaved();
      data = migrateLegacy(data, localStorage.getItem(legacyGridStorageKey));
      for (const [draftKey, draft] of Object.entries(data.drafts)) {
        if (draft.mode === "timed" && draft.startedAt !== null && draft.finishedAt === null) data.drafts[draftKey] = { ...draft, interrupted: true };
      }
    } catch (error) {
      // Preserve unreadable browser data instead of replacing it with an empty save.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadError(error instanceof Error ? error.message : "保存データを読み取れません。");
      return;
    }
    commit(data); setReady(true); setNow(Date.now());
    setDevice(window.matchMedia("(pointer: coarse)").matches ? "touch" : "keyboard");
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    function interrupt() {
      const current = dataRef.current; const draftKey = activeKeyRef.current; const draft = current.drafts[draftKey];
      if (draft?.mode === "timed" && draft.startedAt !== null && draft.finishedAt === null && !draft.interrupted) {
        const next = { ...current, drafts: { ...current.drafts, [draftKey]: { ...draft, interrupted: true } } };
        dataRef.current = next;
        try { localStorage.setItem(gridStorageKey, JSON.stringify(next)); } catch { /* On-screen data remains exportable. */ }
        setSaved(next);
      }
    }
    const visibility = () => { if (document.hidden) interrupt(); };
    document.addEventListener("visibilitychange", visibility); window.addEventListener("pagehide", interrupt);
    return () => { interrupt(); window.clearInterval(timer); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", interrupt); };
  }, [commit]);
  useEffect(() => { activeKeyRef.current = key; }, [key]);

  function saveRun(next: Run) {
    if (!ready) return;
    const data = dataRef.current;
    const mode = next.mode === "timed" ? "timed" : "practice";
    const history = next.finishedAt !== null && !data.history.some((r) => r.id === next.id) ? [...data.history, next] : data.history;
    commit({ ...data, history, drafts: { ...data.drafts, [runKey(next.board, mode)]: next } });
  }
  function editableRun(): Run { return run.id === "preview" ? createRun(board, selection.mode, device, seenBefore, crypto.randomUUID()) : run; }
  function changeSelection(next: Selection) {
    const draft = dataRef.current.drafts[key];
    if (draft?.mode === "timed" && draft.startedAt !== null && draft.finishedAt === null) saveRun({ ...draft, interrupted: true });
    setSelection(next); setInspect(null); setSelected(0); setReveal(false); setNotice("");
  }
  function start(timestamp: number) { const next = editableRun(); setNow(timestamp); saveRun({ ...next, startedAt: timestamp }); }
  function edit(index: number, component: number, value: string, timestamp: number) {
    if (finished || hidden || !ready) return;
    const next = editableRun(); const answers = next.answers.map((a) => [...a]); answers[index][component] = value;
    const checked = [...next.checked]; checked[index] = null;
    setNow(timestamp);
    saveRun({ ...next, answers, checked, startedAt: next.startedAt ?? timestamp }); setNotice("");
  }
  function select(index: number) { setSelected(index); setReveal(false); setNotice(""); }
  function confirm(index: number, advance: boolean, timestamp: number) {
    if (finished || hidden || !ready) return;
    const result = confirmCell(editableRun(), index, timestamp); saveRun(result.run); setNotice(result.message);
    if (!result.message && advance) {
      const next = indices[indices.indexOf(index) + 1];
      if (next !== undefined) { select(next); if (direct) document.getElementById(`drill-cell-${next}`)?.focus(); else window.setTimeout(() => editorRef.current?.focus(), 0); }
      else document.getElementById("drill-submit")?.focus();
    }
  }
  function submit(timestamp: number) {
    if (finished || hidden || !ready) return;
    const next = editableRun();
    const invalid = indices.find((i) => gradeDrillCell(next.board.cells[i], next.answers[i]).status === "invalid");
    if (invalid !== undefined) { select(invalid); setNotice(gradeDrillCell(next.board.cells[invalid], next.answers[invalid]).message); return; }
    setNow(timestamp);
    saveRun(finishRun({ ...next, startedAt: next.startedAt ?? timestamp }, timestamp)); setReveal(false); setNotice("");
  }
  function help() {
    if (run.mode === "timed" && !finished) return;
    if (!finished) { const next = editableRun(); const assisted = [...next.assisted]; assisted[selected] = true; saveRun({ ...next, assisted }); }
    setReveal(!reveal);
  }
  function retry(review = false) {
    const wrong = indices.filter((i) => run.checked[i] !== "correct");
    const mode = review ? "practice" : selection.mode;
    const next = createRun(currentBoard, mode, device, true, crypto.randomUUID());
    if (review) next.reviewIndices = wrong;
    setSelection({ id: currentBoard.drillId, level: currentBoard.level, sheet: currentBoard.sheet, mode });
    saveRun(next); setInspect(null); select(review ? wrong[0] : 0);
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 15_000_000) throw new Error("15MB以内のJSONファイルを選んでください。");
      const incoming = parseGridSaved(await file.text());
      for (const [k, r] of Object.entries(incoming.drafts)) if (r.mode === "timed" && r.startedAt !== null && r.finishedAt === null) incoming.drafts[k] = { ...r, interrupted: true };
      commit(mergeGridSaved(dataRef.current, incoming)); setNotice("履歴を読み込みました。今の下書きと既存の履歴は保持しています。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "読み込めませんでした。"); }
    if (fileRef.current) fileRef.current.value = "";
  }

  if (loadError) return <div className="content"><section className="panel drillError"><h2>保存データを読み取れませんでした</h2><p>{loadError}</p><p>元のデータは変更していません。バックアップを保存してから再読み込みしてください。</p><button onClick={() => downloadJson(localStorage.getItem(gridStorageKey) || localStorage.getItem(legacyGridStorageKey) || "{}", "mathloop-grid25-recovery.json")}>元データを保存</button></section></div>;

  return <div className="content grid25Content">
    <section className="grid25Intro"><div><span className="heroLabel">MATHLOOP · 25 GRID</span><h2>25マス計算</h2><p>数から微分形式まで。<br />25回の反復で、数学の基本操作を身につける。</p></div><div className="grid25Emblem" aria-hidden="true">25<span>MASU</span></div></section>
    <nav className="drillCategories" aria-label="ドリルの分野">{drillCategories.map((c) => <button key={c.id} aria-pressed={category === c.id} onClick={() => { setCategory(c.id); changeSelection({ ...selection, id: drills.find((d) => d.category === c.id)!.id, level: "basic", sheet: 1 }); }}><b>{c.title}</b><small>{c.english}</small></button>)}</nav>
    <div className="grid25Modes" aria-label="演算の種類">{drills.filter((d) => d.category === category).map((d) => <button key={d.id} aria-pressed={selection.id === d.id} onClick={() => changeSelection({ ...selection, id: d.id, level: "basic", sheet: 1 })}><b>{d.title}</b><small>{d.description}</small></button>)}</div>
    <Grid25Guide key={selection.id} drillId={selection.id} locked={run.mode === "timed" && run.startedAt !== null && !finished} />
    <section className="panel grid25Panel" aria-label="25マス計算の問題">
      <div className="grid25Toolbar"><div><h3>{definition.title}</h3><div className="drillSelectors">
        {definition.levels && <label>難度<select aria-label="ドリルの難度" value={selection.level} onChange={(e) => changeSelection({ ...selection, level: e.target.value as Selection["level"] })}><option value="basic">基礎</option><option value="standard">標準</option></select></label>}
        <label>セット<select aria-label="問題集のセット" value={selection.sheet} onChange={(e) => changeSelection({ ...selection, sheet: Number(e.target.value) })}>{Array.from({ length: 10 }, (_, i) => <option key={i} value={i + 1}>#{String(i + 1).padStart(3, "0")}</option>)}</select></label>
      </div></div><div className="grid25Metrics"><span><small>入力済み</small><b>{filled}<em> / {indices.length}</em></b></span><span><small>経過時間</small><b>{timeLabel(elapsed)}</b></span></div></div>
      <div className="drillModeSwitch" aria-label="取り組み方"><button aria-pressed={selection.mode === "practice"} onClick={() => changeSelection({ ...selection, mode: "practice" })}>練習 <small>1マスずつ確認・解説あり</small></button><button aria-pressed={selection.mode === "timed"} onClick={() => changeSelection({ ...selection, mode: "timed" })}>計測 <small>開始してから一括採点</small></button></div>
      <div className="drillInstructions"><b>{currentBoard.rule}</b><p>{currentBoard.context}</p><small>{direct ? "Enterで回答を確定し、次のマスへ。" : "マスを選び、回答パネルに係数を入力します。例：x^2、2(x+y)、1/2。空欄と0は区別します。"}</small></div>
      {run.interrupted && <p className="drillNotice">中断・再開した計測です。続けて解けますが、無中断の自己ベストには含めません。</p>}
      {run.reviewIndices && <p className="drillNotice">誤答復習 · {indices.length}問。薄いマスは今回の復習対象外です。</p>}
      {run.mode === "legacy" && <p className="drillNotice">旧方式の結果。時間は最初の入力から採点までです。初回正答率は未記録です。</p>}
      {/* Date.now is read only when the user clicks Start, never during render. */}
      {/* eslint-disable-next-line react-hooks/purity */}
      {hidden ? <div className="drillStart"><span aria-hidden="true">5 × 5</span><h4>準備ができたら、25マスへ。</h4><p>開始すると問題が表示されます。正誤は提出後に確認できます。</p><button className="submitButton" disabled={!ready} onClick={() => start(Date.now())}>計測を開始</button></div>
        : <div className={`drillWorkArea ${direct ? "directAnswers" : "coefficientAnswers"}`}>
          <div className="grid25Scroll"><table className={`grid25Table drillTable ${direct ? "" : "drillSymbolicTable"}`}>
            <caption className="sr-only">{definition.title} 第{currentBoard.sheet}セット。{currentBoard.rule}</caption>
            <thead><tr><th scope="col" className="grid25Operator">{currentBoard.operator}</th>{currentBoard.columns.map((h, i) => <th scope="col" key={i}><Formula tex={h.tex} /></th>)}</tr></thead>
            <tbody>{currentBoard.rows.map((row, ri) => <tr key={ri}><th scope="row"><Formula tex={row.tex} /></th>{currentBoard.columns.map((column, ci) => {
              const i = ri * 5 + ci; const c = currentBoard.cells[i]; const enabled = indices.includes(i);
              const status = !enabled ? "outsideReview" : finished || run.mode !== "timed" ? run.checked[i] || "" : "";
              const label = `${ri + 1}行${ci + 1}列：${row.text}、${column.text}`;
              return <td key={ci} className={`${status} ${selected === i ? "selectedCell" : ""}`}><span className="grid25CellNumber" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                {direct ? <input id={`drill-cell-${i}`} aria-label={label} aria-invalid={status === "incorrect" || status === "invalid"} value={run.answers[i][0]} disabled={!ready || !enabled} readOnly={finished} autoComplete="off" spellCheck={false} maxLength={300} onFocus={() => select(i)} onChange={(e) => edit(i, 0, e.target.value, Date.now())} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); confirm(i, true, Date.now()); } }} />
                  : <button className="drillCellButton" aria-label={`${label}${run.answers[i].every((a) => a.trim()) ? "、入力済み" : "、未回答"}`} aria-pressed={selected === i} disabled={!ready || !enabled} onClick={() => { select(i); window.setTimeout(() => editorRef.current?.focus(), 0); }}>{run.answers[i].some((a) => a.trim()) ? <span>{run.answers[i].map((a) => a || "□").join(" ; ")}</span> : <span className="drillCellPlaceholder">{c.basis.length > 1 ? `${c.basis.length}係数` : "答え"}</span>}</button>}
                {enabled && (finished || run.mode !== "timed") && run.checked[i] && <span className="grid25CellResult">{gradeLabel[run.checked[i]!]}</span>}
                {enabled && !finished && run.mode === "timed" && run.firstAnswers[i] && <span className="drillConfirmed">確定</span>}
                {run.assisted[i] && <span className="drillAssisted">解説使用</span>}
              </td>;
            })}</tr>)}</tbody>
          </table></div>
          <section className="drillEditor" aria-label="選択したマスの回答パネル">
            <div className="drillEditorTitle"><span>マス {String(selected + 1).padStart(2, "0")}</span><b>{Math.floor(selected / 5) + 1}行 · {selected % 5 + 1}列</b></div>
            <div className="drillSelectedObjects"><div><small>左の対象</small><Formula tex={currentBoard.rows[Math.floor(selected / 5)].tex} /></div><div><small>上の対象</small><Formula tex={currentBoard.columns[selected % 5].tex} /></div></div>
            {!direct && <div className="drillCoefficientFields">{cell.basis.map((basis, i) => <label key={`${selected}-${i}`}><span>{basis === "答え" ? "答え" : <Formula tex={basisTex(basis)} />}{basis !== "答え" && " の係数"}</span><input ref={i === 0 ? editorRef : undefined} aria-label={`マス${selected + 1} ${basis}の入力`} value={run.answers[selected][i]} disabled={!ready} readOnly={finished} maxLength={300} autoComplete="off" spellCheck={false} onChange={(e) => edit(selected, i, e.target.value, Date.now())} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); if (i === cell.basis.length - 1) confirm(selected, true, Date.now()); else { const fields = e.currentTarget.closest(".drillCoefficientFields")?.querySelectorAll("input"); (fields?.[i + 1] as HTMLInputElement | undefined)?.focus(); } } }} /></label>)}</div>}
            {!direct && run.answers[selected].every((a) => a.trim()) && gradeDrillCell(cell, run.answers[selected]).status !== "invalid" && <div className="drillAnswerPreview"><small>入力プレビュー</small><Formula tex={answerTex(cell, run.answers[selected])} /></div>}
            {visibleGrade && <p className={`drillGrade ${visibleGrade}`} role="status">{gradeLabel[visibleGrade]}</p>}
            {!finished && <div className="drillEditorActions"><button className="submitButton" onClick={() => confirm(selected, true, Date.now())} disabled={!ready}>{run.mode === "timed" ? "確定して次へ" : "確認して次へ"}</button>{cell.basis.length > 1 && <button onClick={() => { const next = editableRun(); const answers = next.answers.map((a) => [...a]); answers[selected] = cell.expected.map(() => "0"); const checked = [...next.checked]; checked[selected] = null; saveRun({ ...next, answers, checked, startedAt: next.startedAt ?? Date.now() }); }}>全係数を0</button>}</div>}
            {(finished || run.mode !== "timed") && <button className="drillHelpButton" onClick={help}>{reveal ? "解説を閉じる" : finished ? "答えと解説を見る" : "答えと解説を見る（支援あり）"}</button>}
            {reveal && <div className="drillExplanation"><b>答え</b><Formula tex={answerTex(cell, cell.expected)} /><ol>{cell.explanation.map((line, i) => <li key={i}>{line}</li>)}</ol></div>}
          </section>
        </div>}
      <div className="grid25Footer"><span>{run.mode === "timed" ? "正誤は一括提出後に表示" : "確定した最初の答えを記録します"}</span>
        {!finished ? <button id="drill-submit" className="submitButton" disabled={!ready || hidden || !filled} onClick={() => submit(Date.now())}>{indices.length}マスをまとめて採点</button>
          : <div className="grid25ResultActions"><button onClick={() => retry()}>同じセットをもう一度</button>{accuracy(run) < indices.length && <button onClick={() => retry(true)}>誤答だけ復習</button>}{currentBoard.sheet < 10 && <button className="submitButton" onClick={() => changeSelection({ ...selection, sheet: currentBoard.sheet + 1 })}>次のセット →</button>}</div>}
      </div>
      {finished && <div className="grid25Result" role="status"><b>{accuracy(run)} / {indices.length} 問正解</b><span>{timeLabel(duration(run))} · {run.mode === "legacy" ? "旧方式" : `初回正解 ${accuracy(run, true)} / ${indices.length}`}{eligibleBest(run) ? " · 全問正解タイムの対象" : ""}</span></div>}
    </section>
    <p className="drillFeedback" role="status">{notice}</p>
    <DrillStatistics history={saved.history} run={run} now={now} />
    <section className="panel drillHistory"><div className="drillHistoryHeading"><button onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen}>取り組み履歴 <b>{saved.history.length}</b> {historyOpen ? "−" : "+"}</button><div><button disabled={!ready} onClick={() => downloadJson(JSON.stringify(dataRef.current, null, 2), `mathloop-grid25-${new Date().toISOString().slice(0, 10)}.json`)}>履歴を書き出す</button><button disabled={!ready} onClick={() => fileRef.current?.click()}>読み込む</button><input ref={fileRef} type="file" accept="application/json,.json" hidden aria-label="25マス計算の保存データ" onChange={(e) => void importFile(e.target.files?.[0])} /></div></div>
      {historyOpen && <div className="drillHistoryList">{saved.history.length ? [...saved.history].reverse().slice(0, 30).map((r) => <button key={r.id} onClick={() => { changeSelection({ id: r.board.drillId, level: r.board.level, sheet: r.board.sheet, mode: r.mode === "timed" ? "timed" : "practice" }); setCategory(getDrill(r.board.drillId)!.category); setInspect(r); setSelected(runIndices(r)[0]); }}><span><b>{getDrill(r.board.drillId)!.title} #{String(r.board.sheet).padStart(3, "0")}</b><small>{new Date(r.finishedAt!).toLocaleString("ja-JP")} · {r.board.level === "basic" ? "基礎" : "標準"} · {r.mode === "legacy" ? "旧方式" : r.reviewIndices ? "誤答復習" : r.mode === "timed" ? "計測" : "練習"}</small></span><span>{accuracy(r)}/{runIndices(r).length} · {timeLabel(duration(r))}</span></button>) : <p>採点すると履歴が残ります。同じ問題への再挑戦も別の記録になります。</p>}{saved.history.length > 30 && <p>最新30件を表示しています。すべての履歴は書き出しで保存できます。</p>}</div>}
    </section>
    <p className="grid25SaveNote" role="status">{saveError ? "このブラウザに保存できません。画面を閉じる前に「履歴を書き出す」で入力と記録を保存してください。" : "25マス計算の入力と履歴は、このブラウザに保存しています。端末間同期と通常問題の学習統計には含まれません。"}</p>
  </div>;
}
