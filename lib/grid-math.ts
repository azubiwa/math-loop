/** Exact, bounded polynomial arithmetic. User expressions are parsed, never evaluated as code. */
export type Rational = [number, number];
export type Polynomial = Record<string, Rational>;
const variables = ["x", "y", "z", "u", "v", "a"];
const zeroKey = "0,0,0,0,0,0";
const exponents = (key: string) => key.split(",").map(Number);

function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : Math.abs(a); }
export function rational(n: number, d = 1): Rational {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || !d) throw new Error("数が大きすぎるか、分母が0です。");
  const g = gcd(n, d) || 1;
  return [n / g * Math.sign(d), Math.abs(d) / g];
}
function addR(a: Rational, b: Rational): Rational { return rational(a[0] * b[1] + b[0] * a[1], a[1] * b[1]); }
function mulR(a: Rational, b: Rational): Rational { return rational(a[0] * b[0], a[1] * b[1]); }
export function constant(n: number, d = 1): Polynomial { return n ? { [zeroKey]: rational(n, d) } : {}; }

export function addPoly(a: Polynomial, b: Polynomial): Polynomial {
  const result = { ...a };
  for (const [key, value] of Object.entries(b)) {
    const sum = addR(result[key] || [0, 1], value);
    if (sum[0]) result[key] = sum; else delete result[key];
  }
  if (Object.keys(result).length > 128) throw new Error("式が長すぎます。簡単な多項式に整理してください。");
  return result;
}
export function scalePoly(a: Polynomial, n: number, d = 1): Polynomial {
  return n ? Object.fromEntries(Object.entries(a).map(([key, value]) => [key, mulR(value, rational(n, d))])) : {};
}
export function multiplyPoly(a: Polynomial, b: Polynomial): Polynomial {
  let result: Polynomial = {};
  if (Object.keys(a).length * Object.keys(b).length > 2048) throw new Error("式が複雑すぎます。");
  for (const [ka, va] of Object.entries(a)) for (const [kb, vb] of Object.entries(b)) {
    const ea = exponents(ka); const eb = exponents(kb);
    const powers = ea.map((n, i) => n + eb[i]);
    if (powers.some((n) => n > 24)) throw new Error("次数が大きすぎます。");
    result = addPoly(result, { [powers.join(",")]: mulR(va, vb) });
  }
  return result;
}
export function powerPoly(a: Polynomial, n: number): Polynomial {
  if (!Number.isInteger(n) || n < 0 || n > 24) throw new Error("指数は0〜24の整数にしてください。");
  let result = constant(1);
  for (let i = 0; i < n; i++) result = multiplyPoly(result, a);
  return result;
}
export function derivative(a: Polynomial, variable: string): Polynomial {
  const i = variables.indexOf(variable);
  if (i < 0) throw new Error("未知の変数です。");
  const result: Polynomial = {};
  for (const [key, value] of Object.entries(a)) {
    const powers = exponents(key); const degree = powers[i];
    if (!degree) continue;
    powers[i]--;
    result[powers.join(",")] = mulR(value, [degree, 1]);
  }
  return result;
}
export function substitute(a: Polynomial, replacements: Record<string, Polynomial>): Polynomial {
  let result: Polynomial = {};
  for (const [key, value] of Object.entries(a)) {
    let term = constant(value[0], value[1]);
    exponents(key).forEach((n, i) => {
      if (n) term = multiplyPoly(term, powerPoly(replacements[variables[i]] ?? parsePolynomial(variables[i], variables), n));
    });
    result = addPoly(result, term);
  }
  return result;
}
export function equalPoly(a: Polynomial, b: Polynomial): boolean {
  return Object.keys(addPoly(a, scalePoly(b, -1))).length === 0;
}

export function parsePolynomial(input: string, allowed: string[] = ["x", "y", "z"]): Polynomial {
  if (input.length > 300) throw new Error("入力は300文字以内にしてください。");
  const superscript = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const source = input.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (s) => `^${[...s].map((c) => superscript.indexOf(c)).join("")}`)
    .normalize("NFKC").replace(/[−–]/g, "-").replace(/[·×]/g, "*");
  const tokens = source.match(/\d+(?:\.\d*)?|\.\d+|[a-zA-Z]|[+\-*/^()]|[^\s]/g) || [];
  if (!tokens.length || tokens.length > 160) throw new Error("多項式を入力してください。");
  let position = 0; let depth = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];
  function atom(): Polynomial {
    const token = take();
    if (token === "(") {
      if (++depth > 16) throw new Error("括弧が深すぎます。");
      const result = sum();
      if (take() !== ")") throw new Error("括弧の対応を確認してください。");
      depth--; return result;
    }
    if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token || "")) {
      const decimals = token.split(".")[1]?.length || 0;
      return constant(Number(token.replace(".", "")), 10 ** decimals);
    }
    if (allowed.includes(token) && variables.includes(token)) {
      const powers = variables.map((variable) => variable === token ? 1 : 0);
      return { [powers.join(",")]: [1, 1] };
    }
    throw new Error(`使える変数は${allowed.length ? allowed.join(", ") : "ありません（数値のみ）"}。+ - * / ^ と括弧で入力してください。`);
  }
  function power(): Polynomial {
    const value = atom();
    if (peek() !== "^") return value;
    take(); const exponent = take();
    if (!/^\d+$/.test(exponent || "") || Number(exponent) > 8) throw new Error("入力の指数は0〜8の整数にしてください。");
    return powerPoly(value, Number(exponent));
  }
  function unary(): Polynomial {
    let sign = 1; let count = 0;
    while (peek() === "+" || peek() === "-") { if (take() === "-") sign *= -1; if (++count > 8) throw new Error("符号を整理してください。"); }
    return scalePoly(power(), sign);
  }
  function product(): Polynomial {
    let value = unary();
    while (position < tokens.length) {
      const operator = peek();
      if (operator === "*" || operator === "/") {
        take(); const other = unary();
        if (operator === "*") value = multiplyPoly(value, other);
        else {
          const divisor = other[zeroKey];
          if (!divisor || Object.keys(other).length !== 1) throw new Error("分母には0以外の定数を使ってください。");
          value = scalePoly(value, divisor[1], divisor[0]);
        }
      } else if (operator === "(" || /^[a-zA-Z]$/.test(operator || "")) value = multiplyPoly(value, unary());
      else break;
    }
    return value;
  }
  function sum(): Polynomial {
    let value = product();
    while (peek() === "+" || peek() === "-") {
      const sign = take() === "+" ? 1 : -1;
      value = addPoly(value, scalePoly(product(), sign));
    }
    return value;
  }
  const result = sum();
  if (position !== tokens.length) throw new Error("式の記号や括弧を確認してください。");
  return result;
}

export function polynomialText(a: Polynomial): string {
  const entries = Object.entries(a).sort(([ka], [kb]) => {
    const ea = exponents(ka); const eb = exponents(kb);
    return eb.reduce((s, n) => s + n, 0) - ea.reduce((s, n) => s + n, 0) || kb.localeCompare(ka);
  });
  return entries.map(([key, [n, d]], index) => {
    const monomial = exponents(key).map((power, i) => !power ? "" : power === 1 ? variables[i] : `${variables[i]}^${power}`).join("");
    const coefficient = monomial && Math.abs(n) === d ? "" : d === 1 ? String(Math.abs(n)) : `${Math.abs(n)}/${d}`;
    return `${n < 0 ? "-" : index ? "+" : ""}${coefficient}${monomial}`;
  }).join("") || "0";
}

export type DifferentialForm = { coordinates: string[]; degree: number; terms: Record<string, Polynomial> };
export function form(coordinates: string[], degree: number, terms: Record<string, Polynomial>): DifferentialForm {
  return { coordinates, degree, terms: Object.fromEntries(Object.entries(terms).filter(([, p]) => Object.keys(p).length)) };
}
export function oneForm(coordinates: string[], coefficients: Polynomial[]): DifferentialForm {
  return form(coordinates, 1, Object.fromEntries(coefficients.map((p, i) => [String(i), p])));
}
export function wedge(a: DifferentialForm, b: DifferentialForm): DifferentialForm {
  if (a.coordinates.join() !== b.coordinates.join()) throw new Error("座標が一致しません。");
  const terms: Record<string, Polynomial> = {};
  for (const [ka, va] of Object.entries(a.terms)) for (const [kb, vb] of Object.entries(b.terms)) {
    const indices = [...(ka ? ka.split(",").map(Number) : []), ...(kb ? kb.split(",").map(Number) : [])];
    if (new Set(indices).size !== indices.length) continue;
    let sign = 1;
    for (let i = 0; i < indices.length; i++) for (let j = i + 1; j < indices.length; j++) if (indices[i] > indices[j]) sign *= -1;
    const key = indices.sort((x, y) => x - y).join(",");
    terms[key] = addPoly(terms[key] || {}, scalePoly(multiplyPoly(va, vb), sign));
  }
  return form(a.coordinates, a.degree + b.degree, terms);
}
export function exteriorDerivative(a: DifferentialForm): DifferentialForm {
  const terms: Record<string, Polynomial> = {};
  for (const [key, coefficient] of Object.entries(a.terms)) a.coordinates.forEach((variable, i) => {
    const piece = wedge(form(a.coordinates, 1, { [i]: derivative(coefficient, variable) }), form(a.coordinates, a.degree, { [key]: constant(1) }));
    for (const [basis, value] of Object.entries(piece.terms)) terms[basis] = addPoly(terms[basis] || {}, value);
  });
  return form(a.coordinates, a.degree + 1, terms);
}
export function pullback(a: DifferentialForm, coordinates: string[], components: Polynomial[]): DifferentialForm {
  if (components.length !== a.coordinates.length) throw new Error("写像の次元が一致しません。");
  const replacements = Object.fromEntries(a.coordinates.map((v, i) => [v, components[i]]));
  const terms: Record<string, Polynomial> = {};
  for (const [key, coefficient] of Object.entries(a.terms)) {
    let piece = form(coordinates, 0, { "": substitute(coefficient, replacements) });
    for (const i of key ? key.split(",").map(Number) : []) piece = wedge(piece, oneForm(coordinates, coordinates.map((v) => derivative(components[i], v))));
    for (const [basis, value] of Object.entries(piece.terms)) terms[basis] = addPoly(terms[basis] || {}, value);
  }
  return form(coordinates, a.degree, terms);
}
