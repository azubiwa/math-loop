import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import katex from 'katex';
import {createDrillBoard,drills} from '../lib/grid-drills.ts';
import {parsePolynomial as p, derivative, equalPoly, constant, substitute, addPoly, multiplyPoly, scalePoly} from '../lib/grid-math.ts';
const poly=s=>p(s,['x','y','u']);
const eq=(a,b)=>assert.ok(equalPoly(a,b));
test('all topics have guides with valid math',()=>{
 const gs=JSON.parse(fs.readFileSync(new URL('../lib/grid-guides.json',import.meta.url)));
 assert.equal(gs.length,21);assert.equal(new Set(gs.map(g=>g.id)).size,21);
 for(const d of drills)assert.ok(gs.some(g=>g.id===d.id));
 for(const g of gs){assert.ok(g.steps.length>=2&&g.work.length);for(const t of [g.formula,...g.work])assert.doesNotThrow(()=>katex.renderToString(t,{throwOnError:true}));}
});
test('ODE solutions satisfy the equation and both initial conditions',()=>{
 for(const level of ['basic','standard'])for(const s of [1,10]){
 const b=createDrillBoard('ode',s,level);
 b.cells.forEach((c,i)=>{const row=Math.floor(i/5),col=i%5,y=poly(c.expected[0]);let dy=derivative(y,'x');if(level==='standard'){eq(substitute(dy,{x:constant(0)}),constant(col-2+s));dy=derivative(dy,'x');}eq(dy,poly(`${s+row}x^${row+1}+${s}`));eq(substitute(y,{x:constant(0)}),constant(col-2));});
 }
});
test('Lie bracket first pair matches independently expanded formula',()=>{
 // X=(x+1, y+x), Y=(6x+1, 6y+x)
 const c=createDrillBoard('lie',1).cells[0];eq(poly(c.expected[0]),constant(5));eq(poly(c.expected[1]),constant(0));
 // DX/DY calculation on arbitrary f: [X,Y]f = 5 fx.
 const f=poly('x^2y');const X=[poly('x+1'),poly('y+x')],Y=[poly('6x+1'),poly('6y+x')];
 const act=(V,f)=>addPoly(multiplyPoly(V[0],derivative(f,'x')),multiplyPoly(V[1],derivative(f,'y')));
 eq(addPoly(act(X,act(Y,f)),scalePoly(act(Y,act(X,f)),-1)),scalePoly(derivative(f,'x'),5));
});
test('metric, Christoffel, differential and complex examples',()=>{
 assert.deepEqual(createDrillBoard('metric',1).cells[0].expected,['-11']);
 assert.deepEqual(createDrillBoard('christoffel',2,'standard').cells.slice(0,5).map(c=>c.expected[0]),['1','0','-2','2','0']);
 assert.deepEqual(createDrillBoard('tangent',1).cells[0].expected,['-3','1']);
 assert.deepEqual(createDrillBoard('complex-analysis',1).cells[5].expected,['-4+2i']);
});
test('Taylor polynomial matches derivatives at its center through truncation degree',()=>{
 for(const level of ['basic','standard']){
 const b=createDrillBoard('taylor',2,level),n=level==='basic'?3:5;
 b.cells.forEach((c,i)=>{const r=Math.floor(i/5),a=i%5-2;let f=poly(`${2+r}x^${r+2}+2x+1`),t=poly(c.expected[0]);for(let k=0;k<=n;k++){eq(substitute(f,{x:constant(a)}),substitute(t,{u:constant(0)}));f=derivative(f,'x');t=derivative(t,'u');}});
 }
});
test('Christoffel values agree with the full indexed connection formula',()=>{
 const triples=[[0,0,0],[0,0,1],[0,1,1],[1,0,1],[1,1,1]];
 for(const level of ['basic','standard'])for(const sheet of [1,10]){
 const b=createDrillBoard('christoffel',sheet,level);
 for(let row=0;row<5;row++){
 const a=sheet+row,c=level==='standard'?row+1:0;
 const dg=(axis,i,j)=>axis===0&&i===j?2*(i===0?c:a):0;
 triples.forEach(([k,i,j],col)=>{
 let sum=0;for(let l=0;l<2;l++)sum+=(k===l?1:0)*(dg(i,j,l)+dg(j,i,l)-dg(l,i,j))/2;
 assert.equal(Number(b.cells[row*5+col].expected[0]),sum);
 });}
 }
});
