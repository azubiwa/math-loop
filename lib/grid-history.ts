import { createDrillBoard, getDrill, gradeDrillCell, type DrillBoard, type Grade } from "./grid-drills.ts";

export const gridStorageKey = "mathloop-grid25-v2";
export const legacyGridStorageKey = "mathloop-grid25-v1";
export type Run = {
  id: string; board: DrillBoard; mode: "practice" | "timed" | "legacy";
  answers: string[][]; firstAnswers: (string[] | null)[]; firstGrades: (Grade | null)[];
  checked: (Grade | null)[]; confirmedAt: (number | null)[]; assisted: boolean[];
  startedAt: number | null; finishedAt: number | null; interrupted: boolean;
  reviewIndices: number[] | null; device: "touch" | "keyboard";
  timingVersion: "start-button-v1" | "legacy-first-input";
  seenBefore: boolean; order: number[]; revised: boolean;
};
export type GridSaved = { format: "mathloop-grid25"; version: 2; history: Run[]; drafts: Record<string, Run>; legacyImported: boolean };
export const emptyGridSaved = (): GridSaved => ({ format: "mathloop-grid25", version: 2, history: [], drafts: {}, legacyImported: false });
export const runKey = (board: DrillBoard, mode: "practice" | "timed") => `${board.drillId}:${board.level}:${board.sheet}:${mode}`;
export const sameBoard = (a: DrillBoard, b: DrillBoard) => a.drillId === b.drillId && a.level === b.level && a.sheet === b.sheet && a.version === b.version;
export const runIndices = (run: Run) => run.reviewIndices ?? run.board.cells.map((_, i) => i);
export function createRun(board: DrillBoard, mode: "practice" | "timed", device: Run["device"], seenBefore: boolean, id: string): Run {
  return { id, board, mode, device, seenBefore,
    answers: board.cells.map((c) => c.expected.map(() => "")), firstAnswers: Array(25).fill(null), firstGrades: Array(25).fill(null), checked: Array(25).fill(null), confirmedAt: Array(25).fill(null), assisted: Array(25).fill(false),
    startedAt: null, finishedAt: null, interrupted: false, reviewIndices: null, timingVersion: "start-button-v1", order: [], revised: false };
}
export function confirmCell(run: Run, index: number, now: number): { run: Run; message: string } {
  if (run.finishedAt !== null || !runIndices(run).includes(index)) return { run, message: "" };
  const grade = gradeDrillCell(run.board.cells[index], run.answers[index]);
  const checked = [...run.checked];
  if (grade.status === "invalid" || grade.status === "empty") {
    checked[index] = grade.status;
    return { run: { ...run, checked }, message: grade.message };
  }
  const firstAnswers = [...run.firstAnswers]; const firstGrades = [...run.firstGrades]; const confirmedAt = [...run.confirmedAt];
  const order = [...run.order];
  const revised = run.revised || firstAnswers[index] !== null || index !== order.length;
  if (!firstAnswers[index]) { firstAnswers[index] = [...run.answers[index]]; firstGrades[index] = grade.status; confirmedAt[index] = now; order.push(index); }
  checked[index] = run.mode === "timed" ? null : grade.status;
  return { run: { ...run, checked, firstAnswers, firstGrades, confirmedAt, order, revised }, message: "" };
}
export function finishRun(run: Run, now: number): Run {
  if (run.finishedAt !== null) return run;
  const unconfirmed = runIndices(run).some((i) => run.firstAnswers[i] === null);
  let next = run;
  for (const i of runIndices(run)) if (next.firstAnswers[i] === null) next = confirmCell(next, i, now).run;
  const checked = [...next.checked];
  for (const i of runIndices(run)) checked[i] = gradeDrillCell(next.board.cells[i], next.answers[i]).status;
  return { ...next, checked, finishedAt: now, revised: next.revised || unconfirmed };
}
export function eligibleBest(run: Run): boolean {
  return run.mode === "timed" && run.timingVersion === "start-button-v1" && !run.interrupted && !run.reviewIndices
    && run.startedAt !== null && run.finishedAt !== null && !run.assisted.some(Boolean)
    && run.firstGrades.every((g) => g === "correct") && run.checked.every((g) => g === "correct");
}
export const duration = (run: Run) => run.startedAt !== null && run.finishedAt !== null ? Math.max(0, run.finishedAt - run.startedAt) : null;
export const comparisonKey = (run: Run) => `${run.board.drillId}:${run.board.level}:${run.board.version}:${run.device}:${run.seenBefore ? "repeat" : "new"}:${run.timingVersion}`;
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
export function cellMedian(run: Run): number | null {
  if (!eligibleBest(run) || run.revised || run.order.length !== 25 || run.order.some((i, n) => i !== n)) return null;
  let previous = run.startedAt!;
  return median(run.confirmedAt.map((time) => { const interval = Math.max(0, (time ?? previous) - previous); previous = time ?? previous; return interval; }));
}
export function accuracy(run: Run, first = false) {
  return runIndices(run).filter((i) => (first ? run.firstGrades : run.checked)[i] === "correct").length;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const timestamp = (v: unknown) => v === null || typeof v === "number" && Number.isFinite(v) && v >= 0;
const grades = new Set([null, "correct", "incorrect", "invalid", "empty"]);
function validRun(value: unknown): value is Run {
  if (!isObject(value) || !isObject(value.board)) return false;
  const b = value.board;
  if (typeof value.id !== "string" || !value.id || value.id.length > 160 || !getDrill(String(b.drillId)) || b.version !== 1
    || !["basic", "standard"].includes(String(b.level)) || !Number.isInteger(b.sheet) || Number(b.sheet) < 1 || Number(b.sheet) > 10) return false;
  const expected = createDrillBoard(String(b.drillId), Number(b.sheet), b.level as "basic" | "standard");
  // The imported board must match a supported definition. Do not trust imported expected answers.
  if (JSON.stringify(b) !== JSON.stringify(expected)) return false;
  if (!["practice", "timed", "legacy"].includes(String(value.mode)) || !["touch", "keyboard"].includes(String(value.device))
    || !["start-button-v1", "legacy-first-input"].includes(String(value.timingVersion))) return false;
  if (!timestamp(value.startedAt) || !timestamp(value.finishedAt) || value.finishedAt !== null && value.startedAt === null
    || typeof value.startedAt === "number" && typeof value.finishedAt === "number" && value.finishedAt < value.startedAt) return false;
  for (const name of ["interrupted", "seenBefore", "revised"]) if (typeof value[name] !== "boolean") return false;
  for (const name of ["answers", "firstAnswers", "firstGrades", "checked", "confirmedAt", "assisted"]) if (!Array.isArray(value[name]) || value[name].length !== 25) return false;
  const answers = value.answers as unknown[]; const first = value.firstAnswers as unknown[];
  const validAnswers = (a: unknown, i: number) => Array.isArray(a) && a.length === expected.cells[i].expected.length && a.every((s) => typeof s === "string" && s.length <= 300);
  if (!answers.every(validAnswers) || !first.every((a, i) => a === null || validAnswers(a, i))
    || !(value.firstGrades as unknown[]).every((g) => grades.has(g as Grade)) || !(value.checked as unknown[]).every((g) => grades.has(g as Grade))
    || !(value.confirmedAt as unknown[]).every(timestamp) || !(value.assisted as unknown[]).every((a) => typeof a === "boolean")) return false;
  if (!Array.isArray(value.order) || value.order.length > 25 || new Set(value.order).size !== value.order.length || !value.order.every((n) => Number.isInteger(n) && n >= 0 && n < 25)) return false;
  if (value.reviewIndices !== null && (!Array.isArray(value.reviewIndices) || !value.reviewIndices.length || value.reviewIndices.length > 25 || new Set(value.reviewIndices).size !== value.reviewIndices.length || !value.reviewIndices.every((n) => Number.isInteger(n) && n >= 0 && n < 25))) return false;
  return true;
}
export function parseGridSaved(text: string): GridSaved {
  if (text.length > 15_000_000) throw new Error("保存データが大きすぎます（15MB以内）。");
  const data: unknown = JSON.parse(text);
  if (!isObject(data) || data.format !== "mathloop-grid25" || data.version !== 2 || !Array.isArray(data.history) || !isObject(data.drafts)
    || Object.keys(data.drafts).length > 600 || typeof data.legacyImported !== "boolean") throw new Error("25マス計算の保存データではありません。");
  if (!data.history.every((r) => validRun(r) && r.finishedAt !== null)
    || !Object.entries(data.drafts).every(([key, r]) => validRun(r) && r.mode !== "legacy" && key === runKey(r.board, r.mode))) throw new Error("保存データの問題・回答・時刻の形式を確認してください。");
  const ids = data.history.map((r) => r.id);
  if (new Set(ids).size !== ids.length) throw new Error("試行IDが重複しています。");
  return data as GridSaved;
}
export function mergeGridSaved(current: GridSaved, incoming: GridSaved): GridSaved {
  const history = new Map(current.history.map((r) => [r.id, r]));
  for (const run of incoming.history) if (!history.has(run.id)) history.set(run.id, run);
  // Existing drafts win, so importing never destroys work in progress.
  return { ...current, legacyImported: current.legacyImported || incoming.legacyImported, history: [...history.values()].sort((a, b) => a.finishedAt! - b.finishedAt!), drafts: { ...incoming.drafts, ...current.drafts } };
}
export function migrateLegacy(data: GridSaved, text: string | null): GridSaved {
  if (data.legacyImported || !text) return { ...data, legacyImported: true };
  const old: unknown = JSON.parse(text);
  if (!isObject(old) || !isObject(old.sessions)) throw new Error("旧25マス計算の保存データを読み取れません。");
  const next: GridSaved = { ...data, history: [...data.history], drafts: { ...data.drafts }, legacyImported: true };
  for (const [key, value] of Object.entries(old.sessions)) {
    const match = key.match(/^(addition|multiplication|fractions|complex)-(\d+)$/);
    if (!match || !isObject(value) || !Array.isArray(value.answers) || value.answers.length !== 25 || !value.answers.every((s) => typeof s === "string" && s.length <= 300)
      || !timestamp(value.startedAt) || !timestamp(value.finishedAt) || value.startedAt === null && value.finishedAt !== null
      || typeof value.finishedAt === "number" && typeof value.startedAt === "number" && value.finishedAt < value.startedAt) continue;
    const sheet = Number(match[2]); if (sheet < 1 || sheet > 10) continue;
    const board = createDrillBoard(match[1], sheet);
    const run = createRun(board, "practice", "keyboard", true, `legacy-${key}-${value.finishedAt ?? "draft"}`);
    run.answers = value.answers.map((a) => [a]); run.startedAt = value.startedAt as number | null; run.finishedAt = value.finishedAt as number | null;
    run.timingVersion = "legacy-first-input";
    if (run.finishedAt !== null) { run.mode = "legacy"; run.checked = board.cells.map((c, i) => gradeDrillCell(c, run.answers[i]).status); if (!next.history.some((r) => r.id === run.id)) next.history.push(run); }
    else if (!next.drafts[runKey(board, "practice")]) next.drafts[runKey(board, "practice")] = run;
  }
  return next;
}
