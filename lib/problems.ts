export type Difficulty = "A" | "B" | "C" | "D";
export type GradeRule =
  | { type: "exact"; accepted: string[]; hint: string }
  | { type: "keywords"; groups: string[][]; hint: string };

export type Problem = {
  id: string;
  contest: string;
  difficulty: Difficulty;
  score: number;
  title: string;
  field: string;
  tags: string[];
  minutes: number;
  answerType: "short" | "proof";
  prompt: string[];
  note?: string;
  explanation: {
    summary: string;
    steps: string[];
    knowledge: { title: string; body: string }[];
  };
  grade: GradeRule;
};

export const problems: Problem[] = [
  {
    id: "MABC001-A1", contest: "数学ABC #001", difficulty: "A", score: 120,
    title: "指数関数の基本極限", field: "解析学", tags: ["極限", "指数関数"], minutes: 4, answerType: "short",
    prompt: ["次の極限を求めよ。", "lim[x→0] (eˣ − 1) / x"],
    explanation: {
      summary: "答えは 1。指数関数の x = 0 における微分係数そのものです。",
      steps: ["f(x)=eˣ とおくと、式は (f(x)−f(0))/(x−0) である。", "微分係数の定義より極限は f′(0)=e⁰=1。"],
      knowledge: [{ title: "微分係数", body: "f′(a)=lim[h→0](f(a+h)−f(a))/h。極限の式を見たら差商の形を探します。" }]
    },
    grade: { type: "exact", accepted: ["1", "1.0"], hint: "値だけ入力すれば採点できます。" }
  },
  {
    id: "MABC001-A2", contest: "数学ABC #001", difficulty: "A", score: 180,
    title: "一様収束の ε–N 定義", field: "解析学", tags: ["関数列", "一様収束"], minutes: 7, answerType: "proof",
    prompt: ["関数列 fₙ:X→ℝ が f:X→ℝ に一様収束するとは何か。", "ε–N を用いて定義を書け。"],
    explanation: {
      summary: "点 x を選ぶ前に、すべての x に共通する N を選べることが要点です。",
      steps: ["任意の ε>0 を取る。", "ある N∈ℕ が存在し、n≥N ならば、すべての x∈X について |fₙ(x)−f(x)|<ε が成り立つ。"],
      knowledge: [{ title: "量化記号の順序", body: "一様収束は ∀ε ∃N ∀n≥N ∀x。各点収束では N が x に依存してよく、∀x ∀ε ∃N となります。" }]
    },
    grade: { type: "keywords", groups: [["任意のε", "任意の ε", "∀ε"], ["あるn", "ある n", "∃n"], ["すべてのx", "すべての x", "∀x"], ["|fn(x)-f(x)|<ε", "|f_n(x)-f(x)|<ε", "|fₙ(x)−f(x)|<ε"]], hint: "日本語でも TeX でも構いません。量化の順序を意識してください。" }
  },
  {
    id: "LABC001-A", contest: "線形代数ABC #001", difficulty: "A", score: 160,
    title: "2次正方行列の行列式と逆行列", field: "線形代数", tags: ["行列式", "逆行列"], minutes: 7, answerType: "proof",
    prompt: ["A = [[1, 2], [3, 4]] について、det A と A⁻¹ を求めよ。"],
    explanation: {
      summary: "det A=−2、A⁻¹=[[-2,1],[3/2,−1/2]] です。",
      steps: ["det A=1·4−2·3=−2。", "2×2 行列の公式 A⁻¹=(1/det A)[[d,−b],[−c,a]] を使う。", "よって A⁻¹=[[-2,1],[3/2,−1/2]]。"],
      knowledge: [{ title: "逆行列の存在", body: "正方行列 A が可逆であることと det A≠0 は同値です。" }]
    },
    grade: { type: "keywords", groups: [["-2", "−2"], ["[[-2,1]", "−2,1"], ["3/2", "1.5"], ["-1/2", "−1/2", "-0.5"]], hint: "det と A⁻¹ の両方を書いてください。配列記法でも採点できます。" }
  },
  {
    id: "AABC001-B", contest: "代数ABC #001", difficulty: "A", score: 170,
    title: "剰余類の元の位数", field: "代数学", tags: ["群", "巡回群", "元の位数"], minutes: 5, answerType: "short",
    prompt: ["加法群 ℤ/12ℤ の元 8̄ の位数を求めよ。"],
    explanation: {
      summary: "答えは 3。8̄+8̄+8̄=24̄=0̄ です。",
      steps: ["k·8≡0 (mod 12) となる最小の正整数 k を探す。", "k=1,2 では 0 にならず、k=3 で 24≡0。"],
      knowledge: [{ title: "元の位数", body: "群の元 a の位数は aᵏ=e となる最小の正整数 k。加法群では ka=0 と読み替えます。" }]
    },
    grade: { type: "exact", accepted: ["3", "3個", "位数3", "位数は3"], hint: "整数で答えてください。" }
  },
  {
    id: "TABC001-A", contest: "位相ABC #001", difficulty: "A", score: 220,
    title: "半開区間の内部・閉包・境界", field: "位相空間", tags: ["内部", "閉包", "境界"], minutes: 8, answerType: "proof",
    prompt: ["A=(0,1]⊂ℝ とする。通常の位相における次の集合を求めよ。", "内部 A°、閉包 Ā、境界 ∂A"],
    explanation: {
      summary: "A°=(0,1)、Ā=[0,1]、∂A={0,1} です。",
      steps: ["0 と 1 を除く各点には A に含まれる開近傍がある。1 のどの開近傍も A の外側を含む。", "0,1 はいずれも A の点列の極限として近づけるため閉包に入る。", "境界は Ā\A° なので {0,1}。"],
      knowledge: [{ title: "境界", body: "∂A=Ā\A°。同値に、どの近傍も A とその補集合の両方に交わる点の集合です。" }]
    },
    grade: { type: "keywords", groups: [["(0,1)"], ["[0,1]"], ["{0,1}", "{0, 1}"]], hint: "内部・閉包・境界の順に書いてください。" }
  },
  {
    id: "MNFABC001-B", contest: "多様体ABC #001", difficulty: "A", score: 260,
    title: "円周の接空間", field: "多様体", tags: ["接空間", "正則値"], minutes: 10, answerType: "proof",
    prompt: ["S¹={(x,y)∈ℝ² | x²+y²=1} とする。", "p=(1,0) における接空間 TₚS¹ を求めよ。"],
    explanation: {
      summary: "TₚS¹={(0,t) | t∈ℝ}=span{(0,1)} です。",
      steps: ["F(x,y)=x²+y² とおく。dFₚ(u,v)=2u。", "レベル集合の接空間は ker dFₚ なので u=0。", "したがって接ベクトルは (0,t) の形。"],
      knowledge: [{ title: "レベル集合の接空間", body: "c が F の正則値なら、F⁻¹(c) は部分多様体で TₚF⁻¹(c)=ker(dFₚ) です。" }]
    },
    grade: { type: "keywords", groups: [["(0,t)", "(0, t)"], ["span", "張る", "一次結合"], ["(0,1)", "(0, 1)"]], hint: "集合表示または span を使って答えてください。" }
  },
  {
    id: "MEAS001-A", contest: "測度・確率ABC #001", difficulty: "A", score: 150,
    title: "Dirac測度による積分", field: "測度・確率", tags: ["Dirac測度", "積分"], minutes: 5, answerType: "short",
    prompt: ["Dirac 測度 δₓ を定義せよ。さらに次の積分を求めよ。", "∫ₓ f dδₓ"],
    explanation: {
      summary: "δₓ(A)=1（x∈A）、0（x∉A）であり、∫f dδₓ=f(x) です。",
      steps: ["δₓ は質量 1 を一点 x に集中させた測度。", "単関数から確認し、可測関数へ近似すれば積分は x での評価になる。"],
      knowledge: [{ title: "点質量", body: "Dirac 測度は連続的な積分を『一点での値の取り出し』に変えます。確率論では退化分布に対応します。" }]
    },
    grade: { type: "keywords", groups: [["x∈a", "x in a", "xがaに属"], ["1"], ["0"], ["f(x)", "f（x）"]], hint: "測度の定義と積分の値を両方書いてください。" }
  },
  {
    id: "MABC001-B1", contest: "数学ABC #001", difficulty: "B", score: 420,
    title: "xⁿ の各点収束と一様収束", field: "解析学", tags: ["関数列", "各点収束", "一様収束"], minutes: 12, answerType: "proof",
    prompt: ["fₙ(x)=xⁿ（x∈[0,1]）とする。", "各点極限 f を求め、fₙ→f が一様収束するか判定せよ。"],
    explanation: {
      summary: "極限は x<1 で 0、x=1 で 1。一様収束しません。",
      steps: ["0≤x<1 なら xⁿ→0、x=1 なら常に 1。", "各 fₙ は連続だが極限 f は x=1 で不連続。連続関数列の一様極限は連続なので一様収束ではない。", "直接には sup[0≤x<1]xⁿ=1 が 0 に近づかない。"],
      knowledge: [{ title: "一様極限定理", body: "連続関数の列が一様収束すると、その極限も連続です。不連続な各点極限は一様収束でないことを即座に示します。" }]
    },
    grade: { type: "keywords", groups: [["x<1", "0≤x<1"], ["0"], ["x=1"], ["1"], ["一様収束しない", "一様収束ではない"], ["sup", "上限", "不連続"]], hint: "極限関数を場合分けし、一様収束の判定理由も書いてください。" }
  },
  {
    id: "LABC001-B", contest: "線形代数ABC #001", difficulty: "B", score: 450,
    title: "線形写像の核と像", field: "線形代数", tags: ["線形写像", "核", "像"], minutes: 14, answerType: "proof",
    prompt: ["T:ℝ³→ℝ², T(x,y,z)=(x+y,y+z) とする。", "ker T と Im T の基底および次元を求めよ。"],
    explanation: {
      summary: "ker T=span{(1,−1,1)}, dim ker T=1。Im T=ℝ²、dim Im T=2。",
      steps: ["x+y=0, y+z=0 より (x,y,z)=t(1,−1,1)。", "T(1,0,0)=(1,0), T(0,0,1)=(0,1) なので像は ℝ²。", "次元定理 3=1+2 とも整合する。"],
      knowledge: [{ title: "次元定理", body: "有限次元では dim V=dim ker T+dim Im T。計算結果の検算にも使えます。" }]
    },
    grade: { type: "keywords", groups: [["(1,-1,1)", "(1,−1,1)"], ["dimker", "dim ker", "次元1"], ["r²", "ℝ²", "span{(1,0),(0,1)}"], ["dimim", "dim im", "次元2"]], hint: "基底と次元を ker、Im のそれぞれについて書いてください。" }
  },
  {
    id: "PROB001-B", contest: "測度・確率ABC #001", difficulty: "B", score: 360,
    title: "離散確率変数の分散", field: "測度・確率", tags: ["期待値", "分散", "確率変数"], minutes: 8, answerType: "proof",
    prompt: ["P(X=0)=1/2、P(X=2)=1/2 とする。", "E[X]、E[X²]、Var(X) を求めよ。"],
    explanation: {
      summary: "E[X]=1、E[X²]=2、Var(X)=1 です。",
      steps: ["E[X]=0·1/2+2·1/2=1。", "E[X²]=0²·1/2+2²·1/2=2。", "Var(X)=E[X²]−E[X]²=2−1=1。"],
      knowledge: [{ title: "分散の計算公式", body: "Var(X)=E[(X−E[X])²]=E[X²]−E[X]²。後者が計算に便利です。" }]
    },
    grade: { type: "keywords", groups: [["e[x]=1", "e(x)=1", "期待値は1"], ["e[x²]=2", "e[x^2]=2", "2次モーメントは2"], ["var(x)=1", "分散は1"]], hint: "3つの値を式とともに書いてください。" }
  },
  {
    id: "ODE001-B", contest: "微分方程式ABC #001", difficulty: "B", score: 400,
    title: "変数分離形の初期値問題", field: "微分方程式", tags: ["常微分方程式", "変数分離", "初期値問題"], minutes: 10, answerType: "short",
    prompt: ["初期値問題 y′=2y、y(0)=3 を解け。"],
    explanation: {
      summary: "解は y=3e²ˣ です。",
      steps: ["y≠0 として dy/y=2dx。", "積分して log|y|=2x+C、よって y=Ce²ˣ。", "y(0)=3 から C=3。"],
      knowledge: [{ title: "変数分離法", body: "y′=g(x)h(y) を dy/h(y)=g(x)dx と分けて積分します。除外した定数解がないかも確認します。" }]
    },
    grade: { type: "exact", accepted: ["y=3e^(2x)", "y=3e^{2x}", "3e^(2x)", "3e^{2x}", "3exp(2x)"], hint: "y=... の形で入力してください。" }
  },
  {
    id: "MABC001-C1", contest: "数学ABC #001", difficulty: "C", score: 650,
    title: "コンパクト集合上の正の最小値", field: "位相空間", tags: ["コンパクト", "連続関数", "最大値最小値定理"], minutes: 18, answerType: "proof",
    prompt: ["K⊂ℝ をコンパクト集合、f:K→ℝ を連続関数とする。すべての x∈K で f(x)>0 と仮定する。", "ある ε>0 が存在し、すべての x∈K について f(x)≥ε となることを示せ。", "使ってよいもの：連続関数はコンパクト集合上で最小値を取る。"],
    explanation: {
      summary: "最小値を取る点 x₀ を選び、ε=f(x₀) とすれば終わります。",
      steps: ["最大値最小値定理により、ある x₀∈K で f(x₀)=minₓ∈K f(x)。", "仮定はすべての点で f>0 なので ε=f(x₀)>0。", "最小値の定義から任意の x∈K に対して f(x)≥ε。"],
      knowledge: [{ title: "コンパクト性の役割", body: "f>0 だけでは inf f=0 の可能性があります。コンパクト性と連続性が infimum を実際の正の最小値にします。" }]
    },
    grade: { type: "keywords", groups: [["最小値", "min"], ["x₀", "x_0", "x0"], ["ε=f", "epsilon=f", "ε := f"], [">0"], ["f(x)≥ε", "f(x)>=ε", "f(x)\ge"]], hint: "使ってよい定理を、どの点と ε に適用したか明記してください。" }
  },
  {
    id: "AABC001-C", contest: "代数ABC #001", difficulty: "C", score: 690,
    title: "準同型の核は正規部分群", field: "代数学", tags: ["群準同型", "核", "正規部分群"], minutes: 20, answerType: "proof",
    prompt: ["群準同型 φ:G→H について、ker φ が G の正規部分群であることを示せ。"],
    explanation: {
      summary: "部分群であることを確認し、共役 gxg⁻¹ が再び核に入ることを示します。",
      steps: ["e∈kerφ。また x,y∈kerφ なら φ(xy⁻¹)=φ(x)φ(y)⁻¹=e なので部分群。", "x∈kerφ, g∈G に対し φ(gxg⁻¹)=φ(g)eφ(g)⁻¹=e。", "よって gxg⁻¹∈kerφ であり、kerφ◁G。"],
      knowledge: [{ title: "正規性の判定", body: "N≤G に対し、N◁G ⇔ すべての g∈G で gNg⁻¹=N。包含 gNg⁻¹⊂N を示すだけでも逆元を使って等号が従います。" }]
    },
    grade: { type: "keywords", groups: [["部分群", "subgroup"], ["gxg", "共役"], ["φ(g)", "phi(g)"], ["=e", "単位元"], ["正規", "◁"]], hint: "部分群であることと共役で閉じることの両方を確認してください。" }
  },
  {
    id: "TABC001-C", contest: "位相ABC #001", difficulty: "C", score: 720,
    title: "連結空間の連続像", field: "位相空間", tags: ["連結", "連続写像", "中間値の定理"], minutes: 18, answerType: "proof",
    prompt: ["X が連結で、f:X→ℝ が連続であるとする。f(X) が区間になることを示せ。"],
    explanation: {
      summary: "連続像は連結であり、ℝ の連結部分集合は区間です。",
      steps: ["仮に f(X) が非連結なら、相対位相で分離 U,V を持つ。", "f⁻¹(U),f⁻¹(V) は X の互いに素な非空開集合で X を分離し、連結性に反する。", "よって f(X) は連結。ℝ の連結部分集合は区間だから結論を得る。"],
      knowledge: [{ title: "連続像と連結性", body: "連結性だけでなくコンパクト性も連続像で保たれます。位相的性質を像へ運ぶ基本原理です。" }]
    },
    grade: { type: "keywords", groups: [["連続像", "f(x)"], ["連結", "connected"], ["rの連結部分集合", "ℝの連結部分集合", "実数の連結部分集合"], ["区間", "interval"]], hint: "『連続像』と『ℝ の連結部分集合』という2つの事実をつないでください。" }
  },
  {
    id: "MEAS001-C", contest: "測度・確率ABC #001", difficulty: "C", score: 780,
    title: "測度の下からの連続性", field: "測度・確率", tags: ["測度", "単調列", "可算加法性"], minutes: 22, answerType: "proof",
    prompt: ["可測集合列 A₁⊂A₂⊂⋯ と A=⋃ₙ₌₁∞Aₙ に対し、μ(Aₙ)→μ(A) を示せ。"],
    explanation: {
      summary: "差集合で互いに素な列へ分解し、可算加法性を使います。",
      steps: ["B₁=A₁、Bₙ=Aₙ\Aₙ₋₁ (n≥2) とおくと Bₙ は互いに素。", "Aₙ=⋃ₖ₌₁ⁿBₖ、A=⋃ₖ₌₁∞Bₖ。", "可算加法性より μ(A)=Σₖ₌₁∞μ(Bₖ)=limₙΣₖ₌₁ⁿμ(Bₖ)=limₙμ(Aₙ)。"],
      knowledge: [{ title: "単調連続性", body: "下からの連続性には μ(A₁)<∞ の仮定は不要です。減少列に対する上からの連続性では、最初の集合の測度が有限という条件が必要です。" }]
    },
    grade: { type: "keywords", groups: [["bn", "bₙ", "差集合"], ["互いに素", "disjoint"], ["可算加法", "σ加法"], ["和", "Σ"], ["lim", "極限"]], hint: "増加列を互いに素な差集合の列へ直すのが標準的です。" }
  },
  {
    id: "LABC001-D", contest: "線形代数ABC #001", difficulty: "D", score: 980,
    title: "冪等行列の対角化", field: "線形代数", tags: ["対角化", "固有値", "最小多項式"], minutes: 28, answerType: "proof",
    prompt: ["A∈Mₙ(ℝ) が A²=A を満たすとする。A が対角化可能であることを示せ。"],
    explanation: {
      summary: "最小多項式が t(t−1) を割り、重根を持たないため対角化可能です。像と核の直和を使う証明もできます。",
      steps: ["A²−A=0 より A は多項式 t(t−1) で零化される。", "最小多項式 m_A(t) は t(t−1) を割る。", "t(t−1) は ℝ 上で相異なる一次因子の積なので、最小多項式も重根を持たない。", "最小多項式による対角化判定から A は対角化可能。"],
      knowledge: [{ title: "別証：像と核", body: "任意の v を Av+(v−Av) と分けると、Av∈Im A、v−Av∈ker A。交わりは {0} なので V=Im A⊕ker A。各部分空間で A は 1 または 0 倍です。" }]
    },
    grade: { type: "keywords", groups: [["最小多項式", "minimal polynomial"], ["t(t-1)", "x(x-1)", "λ(λ-1)"], ["割", "divides"], ["重根", "相異なる"], ["対角化", "diagonalizable"]], hint: "最小多項式による証明、または Im A⊕ker A による証明を書けます。" }
  },
  {
    id: "MABC001-D1", contest: "数学ABC #001", difficulty: "D", score: 1050,
    title: "一様収束と積分の交換", field: "解析学", tags: ["一様収束", "Riemann積分", "不等式評価"], minutes: 30, answerType: "proof",
    prompt: ["連続関数 fₙ:[a,b]→ℝ が f に一様収束しているとする。", "∫ₐᵇ fₙ(x)dx → ∫ₐᵇ f(x)dx を、積分差の絶対値を評価して示せ。既知の定理として使ってはならない。"],
    explanation: {
      summary: "積分差を区間長×一様ノルムで抑えます。",
      steps: ["|∫fₙ−∫f|=|∫(fₙ−f)|≤∫|fₙ−f|。", "各 x で |fₙ(x)−f(x)|≤supₓ∈[a,b]|fₙ(x)−f(x)|。", "したがって |∫fₙ−∫f|≤(b−a)‖fₙ−f‖∞。", "一様収束より右辺は 0 に収束する。"],
      knowledge: [{ title: "一様ノルム", body: "‖g‖∞=sup|g(x)|。一様収束 fₙ→f は ‖fₙ−f‖∞→0 と同値で、積分作用素の連続性を表します。" }]
    },
    grade: { type: "keywords", groups: [["|∫", "絶対値"], ["∫|", "三角不等式"], ["sup", "一様ノルム", "∞ノルム"], ["b-a", "b−a"], ["→0", "0に収束"], ["一様収束"]], hint: "まず積分差を1つの積分にまとめ、sup で評価してください。" }
  }
];

export function getProblem(id: string) {
  return problems.find((problem) => problem.id === id);
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/\\left|\\right/g, "")
    .replace(/[\s　]/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/\\mathbb\{r\}/g, "r")
    .replace(/\\/g, "");
}

export function gradeAnswer(problem: Problem, answer: string) {
  const value = normalize(answer);
  if (!value) return { status: "WA" as const, score: 0, feedback: "回答を入力してください。" };

  if (problem.grade.type === "exact") {
    const accepted = problem.grade.accepted.some((item) => normalize(item) === value);
    return accepted
      ? { status: "AC" as const, score: 100, feedback: "正解です。要点をきれいに捉えています。" }
      : { status: "WA" as const, score: 0, feedback: "まだ一致しません。式の形や計算を見直してみましょう。" };
  }

  const matched = problem.grade.groups.filter((group) =>
    group.some((keyword) => value.includes(normalize(keyword)))
  ).length;
  const score = Math.round((matched / problem.grade.groups.length) * 100);
  if (matched === problem.grade.groups.length) {
    return { status: "AC" as const, score, feedback: "必要な論点がそろっています。正解です。" };
  }
  if (matched >= Math.ceil(problem.grade.groups.length / 2)) {
    return { status: "REVIEW" as const, score, feedback: `主要な論点は書けています。あと ${problem.grade.groups.length - matched} 個の観点を補ってみましょう。` };
  }
  return { status: "WA" as const, score, feedback: "重要な論点がまだ不足しています。定義や使う定理から組み立て直してみましょう。" };
}
