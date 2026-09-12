export type GridMode = "addition" | "multiplication" | "fractions" | "complex";
export type GridValue = { real: number; denominator: number; imaginary: number };

export const gridModes: { id: GridMode; title: string; operation: string; description: string; hint: string }[] = [
  { id: "addition", title: "整数の加算", operation: "+", description: "正負の数を、素早く正確に。", hint: "整数で入力（例：-3）" },
  { id: "multiplication", title: "整数の乗算", operation: "×", description: "符号も含めて、掛け算の基礎を反復。", hint: "整数で入力（例：12）" },
  { id: "fractions", title: "分数の加算", operation: "+", description: "通分と約分を、25回の計算で練習。", hint: "分数か有限小数で入力（例：5/6）。約分前の分数も正解です。" },
  { id: "complex", title: "複素数の乗算", operation: "×", description: "展開して i² = -1 を使う計算を習慣に。", hint: "a+bi の形で入力（例：2-3i、i、-4）" },
];

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : Math.abs(a);
}

function fraction(n: number, d = 1): GridValue {
  const divisor = gcd(n, d) || 1;
  return { real: n / divisor * Math.sign(d), denominator: Math.abs(d) / divisor, imaginary: 0 };
}

export function formatGridValue(value: GridValue): string {
  if (value.imaginary) {
    const imaginary = Math.abs(value.imaginary) === 1 ? "i" : `${Math.abs(value.imaginary)}i`;
    return `${value.real || ""}${value.imaginary < 0 ? "-" : value.real ? "+" : ""}${imaginary}`;
  }
  return value.denominator === 1 ? String(value.real) : `${value.real}/${value.denominator}`;
}

export function gridAnswer(mode: GridMode, row: GridValue, column: GridValue): GridValue {
  if (mode === "complex") return {
    real: row.real * column.real - row.imaginary * column.imaginary,
    imaginary: row.real * column.imaginary + row.imaginary * column.real,
    denominator: 1,
  };
  if (mode === "multiplication") return fraction(row.real * column.real);
  return fraction(row.real * column.denominator + column.real * row.denominator, row.denominator * column.denominator);
}

export function createGrid(mode: GridMode, sheet: number) {
  // Set numbers reproduce the same questions on every device.
  let seed = (sheet * 2654435761 + gridModes.findIndex((item) => item.id === mode) * 97) >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const pool: GridValue[] = [];
  if (mode === "fractions") {
    for (let d = 2; d <= 9; d++) for (let n = 1; n < d; n++) if (gcd(n, d) === 1) pool.push(fraction(n, d));
  } else if (mode === "complex") {
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (a && b) pool.push({ real: a, imaginary: b, denominator: 1 });
  } else {
    for (let n = -9; n <= 9; n++) if (n) pool.push(fraction(n));
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return { rows: pool.slice(0, 5), columns: pool.slice(5, 10) };
}

export function isGridAnswerCorrect(input: string, expected: GridValue): boolean {
  const text = input.normalize("NFKC").replace(/[−–]/g, "-").replace(/\s/g, "").toLowerCase();
  if (!text) return false;
  if (expected.imaginary || text.includes("i")) {
    const complex = text.match(/^([+-]?\d+)?([+-](?:\d+)?)i$/);
    const pure = text.match(/^([+-]?\d*)i$/);
    const coefficient = (value: string) => value === "" || value === "+" ? 1 : value === "-" ? -1 : Number(value);
    if (complex) return Number(complex[1] || 0) === expected.real && coefficient(complex[2]) === expected.imaginary;
    if (pure) return expected.real === 0 && coefficient(pure[1]) === expected.imaginary;
    return false;
  }
  const rational = text.match(/^([+-]?\d+)\/([+-]?\d+)$/);
  if (rational) {
    const n = Number(rational[1]);
    const d = Number(rational[2]);
    return d !== 0 && Number.isSafeInteger(n) && Number.isSafeInteger(d)
      && Number.isSafeInteger(n * expected.denominator) && Number.isSafeInteger(expected.real * d)
      && n * expected.denominator === expected.real * d;
  }
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return false;
  const digits = text.split(".")[1]?.length || 0;
  const denominator = 10 ** digits;
  const numerator = Number(text.replace(".", ""));
  return Number.isSafeInteger(denominator) && Number.isSafeInteger(numerator)
    && Number.isSafeInteger(numerator * expected.denominator) && Number.isSafeInteger(expected.real * denominator)
    && numerator * expected.denominator === expected.real * denominator;
}
