"use client";
import { useState } from 'react';
import katex from 'katex';
import guides from '@/lib/grid-guides.json';
function MathLine({text}:{text:string}) {
  return <div className="gridGuideMath" dangerouslySetInnerHTML={{__html:katex.renderToString(text,{throwOnError:false,trust:false,output:'htmlAndMathml'})}} />;
}
export default function Grid25Guide({drillId,locked}:{drillId:string;locked:boolean}) {
  const [topic,setTopic]=useState(drillId);
  const guide=guides.find(g=>g.id===topic) ?? guides[0];
  if(locked) return <section className="panel gridGuide"><p>基本の解き方・計算例は、計測の終了後に確認できます。</p></section>;
  return <details className="panel gridGuide"><summary>基本の解き方と計算例 <span>{guide.title}</span></summary>
    <div className="gridGuideBody"><label>学習する項目<select value={topic} onChange={e=>setTopic(e.target.value)}>{guides.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select></label>
      <h3>{guide.title}</h3><p>{guide.intro}</p><MathLine text={guide.formula} />
      <h4>基本の解き方</h4><ol>{guide.steps.map(s=><li key={s}>{s}</li>)}</ol>
      <section className="gridGuideExample"><h4>計算例</h4><p>{guide.example}</p>{guide.work.map(s=><MathLine key={s} text={s} />)}</section>
      <p className="gridGuideNote"><b>確認するポイント</b><br />{guide.note}</p>
      {(topic==='ode') && <p>このドリルでは、まず y′=p(x) または y″=p(x) を項別に積分し、y(0)・y′(0)から定数を決める練習をします。</p>}
      {['wedge','differential','exterior','pullback','lie','tangent','evaluation','metric','christoffel'].includes(topic) && <p className="gridGuideSource">定義・規約の参考：<a href={['metric','christoffel'].includes(topic)?'https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S3.html':'https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S2.html'} target="_blank" rel="noreferrer">David Tong 講義ノート（英語）</a></p>}
    </div></details>;
}
