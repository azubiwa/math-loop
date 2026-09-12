import { advancedBoard } from "./grid-advanced.ts";
import { createGrid, formatGridValue, gridAnswer, gridModes, isGridAnswerCorrect, type GridMode, type GridValue } from "./grid25.ts";
import { constant, derivative, equalPoly, exteriorDerivative, form, oneForm, parsePolynomial, polynomialText, pullback, substitute, wedge, type DifferentialForm, type Polynomial } from "./grid-math.ts";

export const drillCategories = [
  { id: "calculation", title: "計算", english: "Calculation" },
  { id: "algebra", title: "代数", english: "Algebra" },
  { id: "analysis", title: "解析", english: "Analysis" },
  { id: "structures", title: "構造", english: "Structures" },
  { id: "geometry", title: "幾何", english: "Geometry Drill" },
] as const;
export type Category = typeof drillCategories[number]["id"];
export type Grade = "correct" | "incorrect" | "invalid" | "empty";
export type Header = { text: string; tex: string };
export type DrillCell = {
  expected: string[];
  basis: string[];
  variables: string[];
  explanation: string[];
  legacy?: GridValue;
};
export type DrillBoard = {
  drillId: string; version: number; sheet: number; level: "basic" | "standard";
  rows: Header[]; columns: Header[]; cells: DrillCell[];
  context: string; rule: string; operator: string;
};
export type DrillDefinition = { id: string; category: Category; title: string; description: string; levels: boolean };
export const drills: DrillDefinition[] = [
  { id: "ode", category: "analysis", title: "常微分方程式", description: "積分と初期条件から多項式解を求める。", levels: true },
  { id: "taylor", category: "analysis", title: "テイラー展開", description: "展開中心を変えて低次の項を残す。", levels: true },
  { id: "complex-analysis", category: "analysis", title: "複素解析", description: "正則多項式の導関数の値を求める。", levels: true },
  { id: "lie", category: "geometry", title: "リーブラケット", description: "ベクトル場が作用する順序の差。", levels: true },
  { id: "metric", category: "geometry", title: "計量と内積", description: "指定された計量で内積を計算する。", levels: true },
  { id: "christoffel", category: "geometry", title: "クリストッフェル記号", description: "計量を微分し接続の係数を求める。", levels: true },
  { id: "tangent", category: "geometry", title: "接ベクトルと微分", description: "Jacobianで接ベクトルを写す。", levels: true },
  ...gridModes.map((mode) => ({ id: mode.id, title: mode.title, description: mode.description, category: "calculation" as const, levels: false })),
  { id: "dot", category: "algebra", title: "ベクトルの内積", description: "対応する成分を掛けて足す。", levels: true },
  { id: "matrix", category: "algebra", title: "行列積", description: "25マス全体で AB を完成させる。", levels: true },
  { id: "derivative", category: "analysis", title: "多項式の微分", description: "関数 × 微分回数。", levels: true },
  { id: "gcd", category: "structures", title: "最大公約数", description: "2つの整数に共通する約数を探す。", levels: true },
  { id: "mod", category: "structures", title: "剰余", description: "左の整数を上の整数で割った余り。", levels: true },
  { id: "evaluation", category: "geometry", title: "1形式の評価", description: "双対基底とベクトルの組合せ。", levels: true },
  { id: "wedge", category: "geometry", title: "wedge積", description: "基底の順序と符号に慣れる。", levels: true },
  { id: "differential", category: "geometry", title: "関数の微分 df", description: "偏微分から1形式を組み立てる。", levels: true },
  { id: "exterior", category: "geometry", title: "外微分 dω", description: "係数を微分し、wedge積を整理する。", levels: true },
  { id: "pullback", category: "geometry", title: "pullback", description: "写像で係数と基底を引き戻す。", levels: true },
];
export const getDrill = (id: string) => drills.find((d) => d.id === id);
const p = (text: string) => parsePolynomial(text, ["x", "y", "z", "u", "v", "a"]);
export function expressionTex(text: string): string {
  return text.replace(/(\d+)\/(\d+)/g, "\\frac{$1}{$2}").replace(/\^(\d+)/g, "^{$1}").replace(/\*/g, "\\cdot ");
}
function header(text: string, tex = expressionTex(text)): Header { return { text, tex }; }
function formHeader(value: DifferentialForm): Header {
  const terms = Object.entries(value.terms).map(([key, coefficient]) => {
    const text = polynomialText(coefficient);
    const basis = key.split(",").map((i) => `d${value.coordinates[Number(i)]}`);
    return { text: `(${text})${basis.join("∧")}`, tex: `\\left(${expressionTex(text)}\\right)${basis.map((b) => `\\mathrm{d}${b.slice(1)}`).join("\\wedge ")}` };
  });
  return header(terms.map((t) => t.text).join(" + ") || "0", terms.map((t) => t.tex).join("+") || "0");
}
function vectorHeader(v: number[], tangent = false): Header {
  return tangent ? header(v.map((n, i) => `${n}∂${["x", "y", "z"][i]}`).join(" + "), v.map((n, i) => `(${n})\\partial_{${["x", "y", "z"][i]}}`).join("+"))
    : header(`(${v.join(", ")})`, `\\begin{pmatrix}${v.join("\\\\")}\\end{pmatrix}`);
}
function polynomialCell(values: Polynomial[], variables: string[], basis: string[] = ["答え"], explanation: string[] = []): DrillCell {
  return { expected: values.map(polynomialText), variables, basis, explanation };
}
function formCell(value: DifferentialForm, explanation: string[]): DrillCell {
  const keys: string[] = [];
  if (value.degree === 1) value.coordinates.forEach((_, i) => keys.push(String(i)));
  else for (let i = 0; i < value.coordinates.length; i++) for (let j = i + 1; j < value.coordinates.length; j++) keys.push(`${i},${j}`);
  return polynomialCell(keys.map((key) => value.terms[key] || {}), value.coordinates, keys.map((key) => key.split(",").map((i) => `d${value.coordinates[Number(i)]}`).join("∧")), explanation);
}
function generator(seed: number) {
  let state = seed >>> 0;
  return (min: number, max: number) => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return min + Math.floor(state / 4294967296 * (max - min + 1)); };
}
function uniqueVectors(count: number, dimension: number, seed: number) {
  const random = generator(seed); const vectors: number[][] = [];
  while (vectors.length < count) {
    const v = Array.from({ length: dimension }, () => random(-3, 3));
    if (v.some(Boolean) && !vectors.some((other) => other.join() === v.join())) vectors.push(v);
  }
  return vectors;
}

export function createDrillBoard(id: string, sheet: number, requestedLevel: "basic" | "standard" = "basic"): DrillBoard {
  const definition = getDrill(id);
  if (!definition || !Number.isInteger(sheet) || sheet < 1 || sheet > 10) throw new Error("問題セットが見つかりません。");
  const level = definition.levels ? requestedLevel : "basic";
  const advanced = advancedBoard(id, sheet, level);
  if (advanced) return advanced;
  const standard = level === "standard";
  const board: DrillBoard = { drillId: id, version: 1, sheet, level, rows: [], columns: [], cells: [], context: "", rule: "", operator: "" };
  const legacyMode = gridModes.find((m) => m.id === id);
  if (legacyMode) {
    const grid = createGrid(id as GridMode, sheet);
    board.rows = grid.rows.map((v) => header(formatGridValue(v)));
    board.columns = grid.columns.map((v) => header(formatGridValue(v)));
    board.operator = legacyMode.operation;
    board.context = legacyMode.hint;
    board.rule = `左の値 ${legacyMode.operation} 上の値を計算します。`;
    board.cells = grid.rows.flatMap((r) => grid.columns.map((c) => {
      const expected = gridAnswer(id as GridMode, r, c);
      return { expected: [formatGridValue(expected)], basis: ["答え"], variables: [], legacy: expected,
        explanation: [`(${formatGridValue(r)}) ${legacyMode.operation} (${formatGridValue(c)}) = ${formatGridValue(expected)}`,
          id === "complex" ? "(a+bi)(c+di)=(ac-bd)+(ad+bc)i。i²=-1を使います。" : id === "fractions" ? "分母をそろえて分子を足し、約分します。" : "正負の符号を確認して計算します。"] };
    }));
    return board;
  }
  if (["dot", "matrix", "evaluation", "wedge"].includes(id)) {
    const dimension = id === "wedge" ? 3 : standard ? 3 : 2;
    const coords = ["x", "y", "z"].slice(0, dimension);
    const data = uniqueVectors(10, dimension, sheet * 8317 + id.length * 101 + (standard ? 1 : 0));
    const canonical = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [0, 1, 1]];
    const rows = id === "wedge" && !standard && sheet === 1 ? canonical : data.slice(0, 5);
    const columns = id === "wedge" && !standard && sheet === 1 ? canonical : data.slice(5);
    const asForm = (v: number[]) => oneForm(coords, v.map((n) => constant(n)));
    board.rows = rows.map((v) => id === "evaluation" || id === "wedge" ? formHeader(asForm(v)) : vectorHeader(v));
    board.columns = columns.map((v) => id === "wedge" ? formHeader(asForm(v)) : vectorHeader(v, id === "evaluation"));
    board.operator = id === "wedge" ? "∧" : id === "evaluation" ? "ω(X)" : "·";
    board.rule = id === "wedge" ? "左の1形式 α と上の1形式 β から、α∧β を求めます。" : id === "evaluation" ? "左の1形式 ω を上のベクトル X に作用させ、ω(X) を求めます。" : "左と上のベクトルの対応する成分を掛けて足します。";
    board.context = id === "matrix" ? `Aは5×${dimension}行列、Bは${dimension}×5行列。左はAの各行（成分を縦に表示）、上はBの各列です。25マスが行列ABになります。`
      : id === "wedge" ? "R³、座標は(x,y,z)。答えの基底順序は dx∧dy, dx∧dz, dy∧dz。零の係数も0と入力します。"
      : `R${dimension === 2 ? "²" : "³"}の標準座標 (${coords.join(",")}) を使います。`;
    board.cells = rows.flatMap((r) => columns.map((c) => id === "wedge" ? formCell(wedge(asForm(r), asForm(c)), ["dxᵢ∧dxⱼ=-dxⱼ∧dxᵢ、dxᵢ∧dxᵢ=0。", "各係数は aᵢbⱼ-aⱼbᵢ (i<j) です。"])
      : polynomialCell([constant(r.reduce((s, n, i) => s + n * c[i], 0))], [], ["答え"], [r.map((n, i) => `(${n})×(${c[i]})`).join(" + "), id === "evaluation" ? "dxⁱ(∂ⱼ)=δⁱⱼなので、同じ座標の係数だけを掛けて足します。" : "対応する成分の積を足します。"]))) ;
    return board;
  }
  if (id === "gcd" || id === "mod") {
    const rows = Array.from({ length: 5 }, (_, i) => (standard && id === "mod" ? -1 : 1) * (sheet * 7 + i * 5 + 6));
    const columns = Array.from({ length: 5 }, (_, i) => sheet + i * 2 + (standard ? 7 : 2));
    const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : Math.abs(a);
    board.rows = rows.map((n) => header(String(n))); board.columns = columns.map((n) => header(String(n)));
    board.operator = id; board.context = id === "mod" ? "上の数 b は正。余り r は 0≤r<b にそろえます。" : "最大公約数は正の整数で答えます。";
    board.rule = id === "mod" ? "左の a を上の b で割った余り a mod b。" : "左の a と上の b の最大公約数 gcd(a,b)。";
    board.cells = rows.flatMap((a) => columns.map((b) => {
      const result = id === "mod" ? ((a % b) + b) % b : gcd(a, b);
      const steps: string[] = [];
      if (id === "mod") steps.push(`${a}=(${Math.floor(a / b)})×${b}+${result}`);
      else { let x = a; let y = b; while (y) { steps.push(`${x}=(${Math.floor(x / y)})×${y}+${x % y}`); [x, y] = [y, x % y]; } steps.push(`最後の0でない余り（除数）は${x}です。`); }
      return polynomialCell([constant(result)], [], ["答え"], steps);
    })); return board;
  }
  if (id === "derivative") {
    const offset = standard ? 2 : 0;
    const functions = Array.from({ length: 5 }, (_, i) => `${sheet + i}x^${i + 1 + offset}+${sheet}x`);
    board.rows = functions.map((f) => header(f)); board.columns = [1, 2, 3, 4, 5].map((n) => header(`${n}階微分`, `D^{${n}}`));
    board.operator = "Dⁿ"; board.rule = "左の関数を、上の回数だけ x で微分します。";
    board.context = "変数はx。x^2、2(x+1)、1/2のように入力できます。定数の微分は0。";
    board.cells = functions.flatMap((f) => [1, 2, 3, 4, 5].map((n) => {
      let result = p(f); const steps = ["d(xⁿ)/dx=n xⁿ⁻¹ を使います。"];
      for (let i = 1; i <= n; i++) { result = derivative(result, "x"); steps.push(`${i}階：${polynomialText(result)}`); }
      return polynomialCell([result], ["x"], ["答え"], steps);
    })); return board;
  }
  if (id === "differential" || id === "exterior") {
    const coords = standard ? ["x", "y", "z"] : ["x", "y"];
    const aValues = [-2, -1, 0, 1, 2].map((a) => a + sheet - 1);
    const functions = ["x^2+ay", "x^2y+axy", "ax^2+y^2", "x^3+ay^2", "(x+ay)^2"].map((f) => standard ? `${f}+axyz` : f);
    const forms = [
      ["x^2y+az", "xyz", "0"], ["ay", "x^2", "z"], ["xy", "ax", "yz"], ["y^2", "axy", "az"], ["2xy+a", "x^2", "0"],
    ].map((cs) => (standard ? cs : cs.slice(0, 2)).map((s) => standard ? p(s) : substitute(p(s), { z: constant(1) })));
    const subjects = id === "differential" ? functions.map((f) => form(coords, 0, { "": p(f) })) : forms.map((cs) => oneForm(coords, cs));
    board.rows = id === "differential" ? functions.map((f) => header(f)) : subjects.map(formHeader);
    board.columns = aValues.map((a) => header(`a=${a}`)); board.operator = id === "differential" ? "df" : "dω";
    board.rule = `列の値を定数 a に代入し、左の${id === "differential" ? "関数の微分 df" : "1形式の外微分 dω"}を求めます。`;
    board.context = `座標は (${coords.join(",")})。aは定数で、微分する変数ではありません。基底ごとの係数を多項式で入力します。`;
    board.cells = subjects.flatMap((subject) => aValues.map((a) => {
      const specialized = form(coords, subject.degree, Object.fromEntries(Object.entries(subject.terms).map(([key, value]) => [key, substitute(value, { a: constant(a) })])));
      const result = exteriorDerivative(specialized);
      const steps = id === "differential" ? [`a=${a} を代入。各座標で偏微分します。`, ...coords.map((v) => `∂f/∂${v} = ${polynomialText(derivative(specialized.terms[""] || {}, v))}`)]
        : [`a=${a} を代入。d(Pᵢ dxⁱ)=dPᵢ∧dxⁱ。`, ...Object.entries(specialized.terms).flatMap(([key, value]) => coords.map((v) => `d${coords[Number(key)]}の係数を${v}で微分：${polynomialText(derivative(value, v))}`)), "同じ基底のwedge積を0にし、昇順に並べ替えて符号をそろえます。"];
      return formCell(result, steps);
    })); return board;
  }
  if (id === "pullback") {
    const s = sheet;
    const maps = [[`u+${s}v`, "uv"], [`${s}u`, "u+v"], ["u^2", `v+${s}u`], ["u-v", `u^2+${s}v`], [`u+${s}`, "v^2"]].map((fs) => fs.map(p));
    const forms = standard ? ["1", "x", "y", "x+y", "xy"].map((coefficient) => form(["x", "y"], 2, { "0,1": p(coefficient) }))
      : [["1", "0"], ["0", "1"], ["1", "1"], ["2", "-1"], ["0", "x"]].map((cs) => oneForm(["x", "y"], cs.map(p)));
    board.rows = maps.map((fs) => header(`F(u,v)=(${fs.map(polynomialText).join(", ")})`, `F(u,v)=\\begin{pmatrix}${fs.map((f) => expressionTex(polynomialText(f))).join("\\\\")}\\end{pmatrix}`));
    board.columns = forms.map(formHeader); board.operator = "F*";
    board.rule = "左の写像 F で、上の微分形式 ω を引き戻し、F*ω を求めます。";
    board.context = `F: R²(u,v) → R²(x,y)。${standard ? "2形式" : "1形式"}の答えは始域の基底 ${standard ? "du∧dv" : "du,dv"} の係数です。`;
    board.cells = maps.flatMap((fs) => forms.map((omega) => formCell(pullback(omega, ["u", "v"], fs), [
      `x=${polynomialText(fs[0])}, y=${polynomialText(fs[1])} を係数関数にも代入します。`,
      `F*(dx)=(${polynomialText(derivative(fs[0], "u"))})du+(${polynomialText(derivative(fs[0], "v"))})dv`,
      `F*(dy)=(${polynomialText(derivative(fs[1], "u"))})du+(${polynomialText(derivative(fs[1], "v"))})dv`,
      "引き戻しは和とwedge積を保ちます。代入した係数を掛けて整理します。",
    ]))); return board;
  }
  throw new Error("未対応のドリルです。");
}

export function gradeDrillCell(cell: DrillCell, answers: string[]): { status: Grade; message: string } {
  if (answers.length !== cell.expected.length || answers.some((a) => !a.trim())) return { status: "empty", message: "すべての係数を入力してください。零は0と入力します。" };
  try {
    if (cell.legacy) {
      const input = answers[0].normalize("NFKC").replace(/[−–]/g, "-").replace(/\s/g, "").toLowerCase();
      if (!/^[+\-\d./i]+$/.test(input)) return { status: "invalid", message: "数値、分数、またはa+biの形を確認してください。" };
      if (!input.includes("i")) parsePolynomial(input, []);
      else if (!/^(?:[+-]?\d+)?[+-]\d*i$|^[+-]?\d*i$/.test(input)) return { status: "invalid", message: "複素数は2-3i、i、-4のように入力してください。" };
      return { status: isGridAnswerCorrect(input, cell.legacy) ? "correct" : "incorrect", message: "" };
    }
    const parsed = answers.map((a) => parsePolynomial(a, cell.variables));
    return { status: parsed.every((value, i) => equalPoly(value, parsePolynomial(cell.expected[i], cell.variables))) ? "correct" : "incorrect", message: "" };
  } catch (error) { return { status: "invalid", message: error instanceof Error ? error.message : "入力を確認してください。" }; }
}
