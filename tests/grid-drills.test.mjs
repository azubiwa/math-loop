import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePolynomial as p, equalPoly, constant, form, oneForm, wedge, exteriorDerivative as d, pullback} from '../lib/grid-math.ts';
import {createDrillBoard as board, drills, gradeDrillCell as grade} from '../lib/grid-drills.ts';
import {createGrid, gridAnswer, gridModes, formatGridValue} from '../lib/grid25.ts';
import {createRun, confirmCell, finishRun, eligibleBest, cellMedian, emptyGridSaved, parseGridSaved, mergeGridSaved, migrateLegacy, runKey} from '../lib/grid-history.ts';
const poly = s => p(s, ['x','y','z','u','v','a']);
const eq = (a,b) => assert.ok(equalPoly(a,poly(b)), b);

test('polynomial parsing preserves exact equivalence, precedence and input limits', () => {
  for(const [a,b] of [['2(x+y)','2x+2y'],['-x^2','-1*x*x'],['(-x)^2','x*x'],['0.5x+x/2','x'],['x²−y²','(x-y)(x+y)'],['1/3+1/6','1/2']]) eq(poly(a),b);
  for(const s of ['1/0','1/x','x^-1','x^9','sin(x)','process.exit()','x;alert(1)','('.repeat(17)+'x'+')'.repeat(17),'x'.repeat(301)]) assert.throws(()=>poly(s),s);
  assert.throws(()=>p('y',['x']));
});

test('wedge signs, exterior derivative and d squared match independent formulas', () => {
  const coords=['x','y','z'];
  const dx=oneForm(coords,[constant(1),{},{}]);
  const dy=oneForm(coords,[{},constant(1),{}]);
  eq(wedge(dx,dy).terms['0,1'],'1'); eq(wedge(dy,dx).terms['0,1'],'-1');
  assert.deepEqual(wedge(dx,dx).terms,{});
  const omega=oneForm(coords,[poly('x^2y+az'),poly('xyz'),{}]);
  const result=d(omega);
  eq(result.terms['0,1'],'yz-x^2'); eq(result.terms['0,2'],'-a'); eq(result.terms['1,2'],'-xy');
  assert.deepEqual(d(result).terms,{});
  const f=form(coords,0,{'':poly('x^2y+2xy+xyz')});
  assert.deepEqual(d(d(f)).terms,{});
});

test('pullback substitutes coefficient functions and commutes with d', () => {
  const omega=oneForm(['x','y'],[{},poly('x')]);
  const map=[poly('u+v'),poly('uv')];
  const result=pullback(omega,['u','v'],map);
  eq(result.terms['0'],'v(u+v)'); eq(result.terms['1'],'u(u+v)');
  const area=pullback(form(['x','y'],2,{'0,1':constant(1)}),['u','v'],map);
  eq(area.terms['0,1'],'u-v');
  assert.deepEqual(d(result),pullback(d(omega),['u','v'],map));
});

test('all 240 boards are deterministic, complete and accept canonical answers', () => {
  let count=0;
  for(const def of drills) for(const level of def.levels?['basic','standard']:['basic']) for(let sheet=1;sheet<=10;sheet++) {
    const b=board(def.id,sheet,level); count++;
    assert.equal(b.rows.length,5); assert.equal(b.columns.length,5); assert.equal(b.cells.length,25);
    assert.deepEqual(b,board(def.id,sheet,level));
    for(const c of b.cells) assert.equal(grade(c,c.expected).status,'correct',`${def.id} ${sheet} ${c.expected}`);
  }
  assert.equal(count,240);
});

test('original 40 sets and independent sample answers stay correct', () => {
  for(const mode of gridModes) for(let sheet=1;sheet<=10;sheet++) {
    const old=createGrid(mode.id,sheet); const b=board(mode.id,sheet);
    old.rows.forEach((r,i)=>old.columns.forEach((c,j)=>assert.equal(b.cells[i*5+j].expected[0],formatGridValue(gridAnswer(mode.id,r,c)))));
  }
  assert.deepEqual(board('wedge',1).cells[1].expected,['1','0','0']);
  assert.deepEqual(board('wedge',1).cells[5].expected,['-1','0','0']);
  assert.deepEqual(board('pullback',1).cells[4].expected,['uv+v^2','u^2+uv']);
  assert.equal(grade(board('differential',1).cells[0],['2*x','-2']).status,'correct');
  assert.equal(grade(board('differential',1).cells[0],['2*x','']).status,'empty');
  assert.equal(grade(board('differential',1).cells[0],['2*x','q']).status,'invalid');
  const b=board('matrix',2,'standard');
  b.rows.forEach((r,i)=>b.columns.forEach((c,j)=>{
    const a=r.text.slice(1,-1).split(',').map(Number), v=c.text.slice(1,-1).split(',').map(Number);
    assert.equal(Number(b.cells[i*5+j].expected[0]),a.reduce((sum,x,k)=>sum+x*v[k],0));
  }));
  const m=board('mod',1,'standard');
  m.rows.forEach((r,i)=>m.columns.forEach((c,j)=>{const rem=Number(m.cells[i*5+j].expected[0]),n=Number(c.text);assert.ok(rem>=0&&rem<n);assert.ok((Number(r.text)-rem)%n===0);}));
});

function completed(id='run') {
  let r=createRun(board('addition',1),'timed','keyboard',false,id);r.startedAt=1000;r.answers=r.board.cells.map(c=>[...c.expected]);
  for(let i=0;i<25;i++) r=confirmCell(r,i,2000+i*1000).run;
  return finishRun(r,27000);
}
test('first submissions survive correction and timed grades remain hidden', () => {
  let r=createRun(board('addition',1),'timed','keyboard',false,'a');r.startedAt=1000;r.answers[0]=['9999'];
  r=confirmCell(r,0,2000).run; assert.equal(r.checked[0],null);assert.equal(r.firstGrades[0],'incorrect');
  r.answers=r.answers.map((a,i)=>i===0?[...r.board.cells[0].expected]:a);
  r=confirmCell(r,0,3000).run;const finished=finishRun(r,4000);
  assert.equal(finished.checked[0],'correct');assert.equal(finished.firstGrades[0],'incorrect');assert.deepEqual(finished.firstAnswers[0],['9999']);assert.equal(eligibleBest(finished),false);
});
test('best and cell timing exclude interruption, help, revision and bulk timing', () => {
  const r=completed();assert.ok(eligibleBest(r));assert.equal(cellMedian(r),1000);
  assert.equal(eligibleBest({...r,interrupted:true}),false);
  assert.equal(eligibleBest({...r,assisted:Array(25).fill(true)}),false);
  assert.equal(eligibleBest({...r,reviewIndices:[0]}),false);
  assert.equal(cellMedian({...r,revised:true}),null);
  const bulk=createRun(r.board,'timed','keyboard',false,'bulk');bulk.startedAt=1;bulk.answers=r.answers;
  assert.equal(cellMedian(finishRun(bulk,100)),null);
});
test('history roundtrip, import deduplication, preservation and legacy migration', () => {
  const r=completed();const data=emptyGridSaved();data.history=[r];data.drafts[runKey(r.board,'timed')]=r;
  assert.deepEqual(parseGridSaved(JSON.stringify(data)),data);
  const corrupt=structuredClone(data);corrupt.history[0].board.cells[0].expected=['999'];assert.throws(()=>parseGridSaved(JSON.stringify(corrupt)));
  const incoming=structuredClone(data);incoming.drafts[runKey(r.board,'timed')]={...r,id:'other'};incoming.history.push(completed('second'));
  const merged=mergeGridSaved(data,incoming);assert.equal(merged.history.length,2);assert.equal(merged.drafts[runKey(r.board,'timed')].id,r.id);
  const old=JSON.stringify({sessions:{'addition-1':{answers:r.answers.flat(),startedAt:1000,finishedAt:27000}}});
  const migrated=migrateLegacy(emptyGridSaved(),old);assert.equal(migrated.history[0].mode,'legacy');assert.equal(eligibleBest(migrated.history[0]),false);
  assert.deepEqual(migrateLegacy(migrated,old),migrated);assert.deepEqual(parseGridSaved(JSON.stringify(migrated)),migrated);
});
