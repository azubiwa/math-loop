import type { DrillBoard, DrillCell, Header } from './grid-drills.ts';
import { addPoly, constant, derivative, multiplyPoly, parsePolynomial, polynomialText, rational, scalePoly, substitute, type Polynomial } from './grid-math.ts';
const p = (s: string) => parsePolynomial(s, ['x','y','u']);
const h = (text: string, tex = text): Header => ({text,tex});
const cell = (values: Polynomial[], variables: string[], explanation: string[], basis = ['答え']): DrillCell => ({expected:values.map(polynomialText),variables,basis,explanation});
const vector = (v: number[]) => h(`(${v.join(',')})`, `\\begin{pmatrix}${v.join('\\\\')}\\end{pmatrix}`);
const tex = (s:string) => s.replace(/\^(\d+)/g,'^{$1}');
function integral(f: Polynomial): Polynomial {
  return Object.fromEntries(Object.entries(f).map(([k,[n,d]])=>{const powers=k.split(',').map(Number);powers[0]++;return [powers.join(','),rational(n,d*powers[0])];}));
}
export function advancedBoard(id: string, sheet: number, level: 'basic'|'standard'): DrillBoard | null {
  const std=level==='standard';
  const b:DrillBoard={drillId:id,version:1,sheet,level,rows:[],columns:[],cells:[],context:'',rule:'',operator:''};
  if(id==='ode') {
    const fs=Array.from({length:5},(_,i)=>p(`${sheet+i}x^${i+1}+${sheet}`));
    const cs=Array.from({length:5},(_,i)=>i-2);
    b.rows=fs.map(f=>h(`y${std?"''":"'"}=${polynomialText(f)}`,`y^{${std?'\\prime\\prime':'\\prime'}}=${tex(polynomialText(f))}`));
    b.columns=cs.map(c=>h(`y(0)=${c}${std?`, y'(0)=${c+sheet}`:''}`));
    b.rule=std?'左の2階方程式を、上の2つの初期条件で解きます。':'左の1階方程式を、上の初期条件で解きます。';
    b.context='独立変数はx。解y(x)を多項式で入力します。';b.operator=std?"y''":"y'";
    b.cells=fs.flatMap(f=>cs.map(c=>{let answer=integral(f);if(std)answer=addPoly(integral(answer),p(`${c+sheet}x`));answer=addPoly(answer,constant(c));return cell([answer],['x'],['xで各項を積分し、積分定数を加えます。',`初期条件を適用すると y(x)=${polynomialText(answer)}。微分して元の式を確認します。`]);}));return b;
  }
  if(id==='lie') {
    const fields=Array.from({length:10},(_,i)=>[p(`${i+1}x${std?'y':''}+${sheet}`),p(`${sheet+i}y${std?'^2':''}+x`)]);
    const head=(f:Polynomial[])=>h(`${polynomialText(f[0])}∂x+(${polynomialText(f[1])})∂y`,`(${tex(polynomialText(f[0]))})\\partial_x+(${tex(polynomialText(f[1]))})\\partial_y`);
    b.rows=fields.slice(0,5).map(head);b.columns=fields.slice(5).map(head);b.operator='[X,Y]';b.rule='左のXと上のYから、[X,Y]をこの順で計算します。';b.context='R²の座標(x,y)。∂x、∂yの係数を入力します。[X,Y]f=X(Yf)−Y(Xf)。';
    b.cells=fields.slice(0,5).flatMap(X=>fields.slice(5).map(Y=>cell(['x','y'].map((_,i)=>['x','y'].reduce((sum,v,j)=>addPoly(sum,addPoly(multiplyPoly(X[j],derivative(Y[i],v)),scalePoly(multiplyPoly(Y[j],derivative(X[i],v)),-1))),{})),['x','y'],['各成分についてXがYの係数を微分したものから、YがXの係数を微分したものを引きます。'],'∂x,∂y'.split(','))));return b;
  }
  if(id==='metric') {
    const vs=Array.from({length:10},(_,i)=>[i-4,(i%3)-1]);const a=sheet+1,d=sheet+2,c=std?1:0;
    b.rows=vs.slice(0,5).map(vector);b.columns=vs.slice(5).map(vector);b.operator='g(v,w)';b.rule='左のvと上のwの、指定された計量での内積を求めます。';b.context=`同じ座標基底で G=(${a},${c}; ${c},${d})。g(v,w)=vᵀGw。Gは対称正定値です。`;
    b.cells=vs.slice(0,5).flatMap(v=>vs.slice(5).map(w=>cell([constant(a*v[0]*w[0]+c*(v[0]*w[1]+v[1]*w[0])+d*v[1]*w[1])],[],[`Gw=(${a*w[0]+c*w[1]},${c*w[0]+d*w[1]})。`,`vの各成分を掛けて足します。`])));return b;
  }
  if(id==='christoffel') {
    const params=Array.from({length:5},(_,i)=>[sheet+i,std?i+1:0]);
    b.rows=params.map(([a,c])=>h(`g=diag(e^(${2*c}x),e^(${2*a}x))`,`g=\\operatorname{diag}(e^{${2*c}x},e^{${2*a}x})`));
    const indices=['x_xx','x_xy','x_yy','y_xy','y_yy'];b.columns=indices.map(s=>h(`Γ${s}`,`\\Gamma^{${s[0]}}_{${s.slice(2)}}`));
    b.operator='Γ(0,0)';b.rule='左の計量のLevi-Civita接続について、上の成分を点(0,0)で求めます。';b.context='R²の座標(x,y)。行の計量を偏微分してから点を代入します。係数だけを入力します。';
    b.cells=params.flatMap(([a,c])=>[c,0,-a,a,0].map((value,j)=>cell([constant(value)],[],[`gxx=e^(${2*c}x), gyy=e^(${2*a}x)。点(0,0)で逆計量は単位行列。`,`その点で ∂x gxx=${2*c}, ∂x gyy=${2*a}、y微分は0。`,`Γ${indices[j]}を公式で計算すると${value}。`])));return b;
  }
  if(id==='tangent') {
    const maps=Array.from({length:5},(_,i)=>[p(`${i+1}x^${std?3:2}+y`),p(`xy+${sheet+i}y^2`)]);const vs=Array.from({length:5},(_,i)=>[i-2,i+1]);const point={x:constant(sheet),y:constant(1)};
    b.rows=maps.map(F=>h(`F=(${F.map(polynomialText).join(',')})`,`F=\\begin{pmatrix}${F.map(f=>tex(polynomialText(f))).join('\\\\')}\\end{pmatrix}`));b.columns=vs.map(vector);b.operator='dFₚ(v)';b.rule='左の写像Fの微分を、上の接ベクトルvに作用させます。';b.context=`F:R²→R²、始域の点p=(${sheet},1)。終域の標準基底e₁,e₂の成分を入力します。`;
    b.cells=maps.flatMap(F=>vs.map(v=>cell(F.map(f=>substitute(addPoly(scalePoly(derivative(f,'x'),v[0]),scalePoly(derivative(f,'y'),v[1])),point)),[],['各成分をx,yで偏微分してJacobianを作ります。',`点pで評価し、v=(${v})を掛けます。`],['e₁','e₂'])));return b;
  }
  if(id==='taylor') {
    const n=std?5:3;const fs=Array.from({length:5},(_,i)=>p(`${sheet+i}x^${i+2}+${sheet}x+1`));const centers=[-2,-1,0,1,2];
    b.rows=fs.map(f=>h(`f(x)=${polynomialText(f)}`,`f(x)=${tex(polynomialText(f))}`));b.columns=centers.map(a=>h(`a=${a}`));b.operator=`T${n}`;b.rule=`左のfについて上の中心aで展開し、f(a+u)の${n}次Taylor多項式を求めます。`;b.context='変数u=x−aを使って入力します。uの0次から指定次数までを残します。';
    b.cells=fs.flatMap(f=>centers.map(a=>{const full=substitute(f,{x:addPoly(constant(a),p('u'))});const answer=Object.fromEntries(Object.entries(full).filter(([k])=>Number(k.split(',')[3])<=n));return cell([answer],['u'],[`x=${a}+uを代入して展開します。`,`uの${n}次以下を残すと ${polynomialText(answer)}。各係数はf^(k)(a)/k!です。`]);}));return b;
  }
  if(id==='complex-analysis') {
    const ns=[1,2,3,4,5];const zs=Array.from({length:5},(_,i)=>({real:i-2,imaginary:std?sheet:1}));
    b.rows=ns.map(n=>h(`f(z)=${sheet}z^${n}`,`f(z)=${sheet}z^{${n}}`));b.columns=zs.map(z=>h(`z₀=${z.real}+(${z.imaginary})i`));b.operator="f′(z₀)";b.rule='左の正則多項式を微分し、上の点での値を求めます。';b.context='実部・虚部は整数。a+bi形式で入力します。i²=−1。';
    b.cells=ns.flatMap(n=>zs.map(z=>{let r=1,im=0;for(let k=0;k<n-1;k++)[r,im]=[r*z.real-im*z.imaginary,r*z.imaginary+im*z.real];r*=sheet*n;im*=sheet*n;const answer=im?`${r||''}${im<0?'-':r?'+':''}${Math.abs(im)===1?'':Math.abs(im)}i`:String(r);return {expected:[answer],variables:[],basis:['答え'],legacy:{real:r,imaginary:im,denominator:1},explanation:[`f′(z)=${sheet*n}z^${n-1}。`,`z₀を代入してi²=−1で整理すると${answer}。`]};}));return b;
  }
  return null;
}
