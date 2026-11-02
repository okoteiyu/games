import {INTERIOR_LAYOUTS} from './interior-layouts.js';
const n=x=>Number(x.toFixed(5));
const escape=v=>String(v).replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]));
const rect=(x,y,w,h,fill,extra='')=>`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="2" fill="${fill}" ${extra}/>`;
export function interiorMapPoint(id,position,{livingOnly=false,width,height}={}){
 const layout=INTERIOR_LAYOUTS[id];if(!layout)throw new RangeError('部屋の地図が見つかりません。');const bounds=livingOnly?layout.living.bounds:layout.room.bounds,size=livingOnly?layout.living.map:layout.map;
 return {x:(position[0]-bounds.min[0])/(bounds.max[0]-bounds.min[0])*(width||size.width),y:(position[2]-bounds.min[2])/(bounds.max[2]-bounds.min[2])*(height||size.height)};
}
function loungeFurniture(f,p,q){
 const w=q.x-p.x,d=q.y-p.y,kind=f.loungeKind||f.role,yaw=f.yaw||0,round=(x,y,ww,dd,color,r=4,extra='')=>`<rect x="${n(x)}" y="${n(y)}" width="${n(ww)}" height="${n(dd)}" rx="${n(Math.min(r,ww/2,dd/2))}" fill="${color}" ${extra}/>`;
 const outline='stroke="#b89c65" stroke-width="1"';let body='';
 if(kind==='rug')body=round(p.x,p.y,w,d,'#afc6c0',8,outline)+round(p.x+3,p.y+3,w-6,d-6,'none',6,'stroke="#e8d5a7" stroke-width="1"');
 else if(f.role==='sofa'||kind==='armchair'){
  const color=kind==='rose-sofa'?'#d9b9bd':kind==='sage-sofa'?'#b6cdbf':'#d2c4a6',vertical=Math.abs(Math.sin(yaw))>.5,back=vertical?round(Math.sin(yaw)>0?p.x+2:q.x-w*.24,p.y+2,w*.20,d-4,'#aabdb0',2):round(p.x+2,Math.cos(yaw)<0?q.y-d*.25:p.y+2,w-4,d*.20,'#aabdb0',2);
  body=round(p.x,p.y,w,d,color,5,outline)+back+round(p.x+w*.18,p.y+d*.28,w*.64,d*.49,'#f3e9db',3);
  if(f.role==='sofa'&&!vertical)body+=`<path d="M${n(p.x+w/3)} ${n(p.y+d*.28)}V${n(p.y+d*.77)}M${n(p.x+w*2/3)} ${n(p.y+d*.28)}V${n(p.y+d*.77)}" stroke="#c4b99e" stroke-width="1"/>`;
 }else if(kind==='pouf')body=round(p.x,p.y,w,d,'#dbc8a6',Math.min(w,d)*.35,outline)+`<path d="M${n(p.x+w*.25)} ${n(p.y+d*.25)}L${n(p.x+w*.75)} ${n(p.y+d*.75)}M${n(p.x+w*.75)} ${n(p.y+d*.25)}L${n(p.x+w*.25)} ${n(p.y+d*.75)}" stroke="#f4e9d5"/>`;
 else if(kind==='tea-table')body=`<ellipse cx="${n((p.x+q.x)/2)}" cy="${n((p.y+q.y)/2)}" rx="${n(w/2)}" ry="${n(d/2)}" fill="#ead8b8" ${outline}/><ellipse cx="${n((p.x+q.x)/2)}" cy="${n((p.y+q.y)/2)}" rx="${n(w*.40)}" ry="${n(d*.36)}" fill="#fff6e4"/>`+[.35,.62].map((at,i)=>`<circle cx="${n(p.x+w*at)}" cy="${n(p.y+d*(i ? .6 : .4))}" r="${n(Math.min(w,d)*.12)}" fill="${i?'#d8b7ab':'#a9c6be'}" stroke="#a6a98c" stroke-width=".6"/>`).join('');
 else if(kind==='refreshments'){
  body=round(p.x,p.y,w,d,'#d6c1a0',2,outline)+round(p.x+w*.07,p.y+d*.15,w*.86,d*.70,'#fff8e8',2);
  const sink=f.mapFixtures?.sink,tray=f.mapFixtures?.tray;
  if(sink&&tray){
   const [fx,fz,fw,fd]=f.footprint,point=(x,z)=>({x:p.x+(x-fx)/fw*w,y:p.y+(z-fz)/fd*d}),box=foot=>{const [x,z,ww,dd]=foot,a=point(x,z),b=point(x+ww,z+dd);return{x:a.x,y:a.y,w:b.x-a.x,d:b.y-a.y};};
   const bowl=box(sink.footprint),inner=box(sink.openingFootprint),tea=box(tray.footprint),tap=point(sink.faucetPosition[0],sink.faucetPosition[2]),centre=point(sink.footprint[0]+sink.footprint[2]/2,sink.footprint[1]+sink.footprint[3]/2);
   const cups=f.mapFixtures.cups.positions.map(at=>point(at[0],at[2]));
   body+=round(tea.x,tea.y,tea.w,tea.d,'#faf2dd',1,'stroke="#bca784" stroke-width=".6"')+cups.map(at=>`<circle cx="${n(at.x)}" cy="${n(at.y)}" r="${n(tea.d*.16)}" fill="#b3cec6" stroke="#8fa999" stroke-width=".6"/>`).join('');
   body+=`<g data-lounge-fixture="hot-water-sink" data-world-footprint="${escape(JSON.stringify(sink.footprint))}"><title>給湯用シンク</title>`+round(bowl.x,bowl.y,bowl.w,bowl.d,'#bdcfcc',1,'stroke="#8da6a0" stroke-width=".7"')+round(inner.x,inner.y,inner.w,inner.d,'#8eaca8',1)+`<circle cx="${n(centre.x)}" cy="${n(centre.y)}" r="1" fill="#78938d"/><path d="M${n(tap.x)} ${n(tap.y)}V${n(centre.y)}" stroke="#eaf0e9" stroke-width="1.4" stroke-linecap="round"/><circle cx="${n(tap.x)}" cy="${n(tap.y)}" r="1" fill="#c4a49a"/></g>`;
  }else body+=[.24,.40,.56,.72].map(at=>`<circle cx="${n(p.x+w*at)}" cy="${n(p.y+d*.5)}" r="${n(d*.19)}" fill="#b3cec6" stroke="#8fa999" stroke-width=".7"/>`).join('');
 }
 else if(kind==='reading-shelf')body=round(p.x,p.y,w,d,'#c9b594',2,outline)+Array.from({length:12},(_,i)=>rect(p.x+2+i*(w-4)/12,p.y+2,(w-4)/12-1,d-4,['#a1b9a9','#d8bc9a','#bec3cf'][i%3])).join('');
 else if(kind==='fridge'){
  const vertical=Math.abs(Math.sin(yaw))>.5,front=vertical?(Math.sin(yaw)<0?p.x+1:q.x-1):(Math.cos(yaw)<0?p.y+1:q.y-1),side=f.handleSide==='right'?.76:.24;
  body='<g data-lounge-fixture="fridge">'+round(p.x,p.y,w,d,'#dce5e0',2,'stroke="#91aaa2" stroke-width=".9"')+
   `<path d="${vertical?`M${n(front)} ${n(p.y+d*.08)}V${n(q.y-d*.08)}`:`M${n(p.x+w*.08)} ${n(front)}H${n(q.x-w*.08)}`}" stroke="#7f9b91" stroke-width="1.5"/>`;
  if(f.handleSide)body+=`<path d="${vertical?`M${n(front)} ${n(p.y+d*side)}V${n(p.y+d*(side+.12))}`:`M${n(p.x+w*side)} ${n(front)}H${n(p.x+w*(side+.12))}`}" stroke="#f9f6e9" stroke-width="1.8" stroke-linecap="round"/>`;
  body+='</g>';
 }
 else if(kind==='plant')body=round(p.x+w*.23,p.y+d*.25,w*.54,d*.54,'#cfbea1',3,outline)+[[-.17,-.10],[.16,-.05],[0,.17]].map(([x,y],i)=>`<ellipse cx="${n(p.x+w*(.5+x))}" cy="${n(p.y+d*(.5+y))}" rx="${n(w*.24)}" ry="${n(d*.20)}" fill="${i%2?'#a9c69a':'#8eaf86'}"/>`).join('');
 else if(kind==='welcome-relief')body=round(p.x,p.y,w,d,'#d5bc83',1,outline);
 else body=round(p.x,p.y,w,d,'#ded2bd',3,outline);
 return `<g data-interior-feature="${f.id}" data-feature-role="${f.role}" data-model-node="${f.node}" data-world-footprint="${escape(JSON.stringify(f.footprint))}"><title>${escape(f.label)}</title>${body}</g>`;
}
function managementFurniture(f,p,q){
 const w=q.x-p.x,d=q.y-p.y,kind=f.officeKind||f.role,outline='stroke="#9ea89b" stroke-width=".9"';
 let body=rect(p.x,p.y,w,d,{desk:'#dbc8a8',chair:'#b7c9bf',monitor:'#a2b7ae',shelf:'#cbb68e',storage:'#c4cec3',whiteboard:'#f6f6ec',plant:'#b7cda3',fridge:'#cbd5ca',partition:'#d3c4a6'}[f.role]||'#d2dbc7',outline);
 if(kind==='workstation')body+=rect(p.x+w*.28,p.y+d*.12,w*.44,d*.28,'#547a74')+rect(p.x+w*.31,p.y+d*.61,w*.38,d*.13,'#eee9da');
 else if(kind==='caretaker-bed'){
  const east=f.bedHeadSide==='east',headX=east?p.x+w*.77:p.x+w*.07;
  body=rect(p.x,p.y,w,d,'#d4bc97',outline)+rect(p.x+w*.04,p.y+d*.06,w*.92,d*.88,'#f3efe6')+
   rect(east?p.x+w*.04:p.x+w*.32,p.y+d*.06,w*.64,d*.88,'#afc3bc')+
   rect(headX,p.y+d*.23,w*.16,d*.54,'#fffaf0','stroke="#d8d9ca" stroke-width=".6"')+
   `<path d="M${n(east?p.x+w*.96:p.x+w*.04)} ${n(p.y+d*.06)}V${n(q.y-d*.06)}" stroke="#b29773" stroke-width="1.5"/>`;
 }
 else if(f.role==='chair'){
  const cx=p.x+w*.5,cy=p.y+d*.5,yaw=f.yaw||0;
  body=`<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(w*.40)}" ry="${n(d*.40)}" fill="#b7c9bf" ${outline}/><path d="M${n(cx-Math.cos(yaw)*w*.32-Math.sin(yaw)*w*.28)} ${n(cy-Math.sin(yaw)*d*.32+Math.cos(yaw)*d*.28)}L${n(cx+Math.cos(yaw)*w*.32-Math.sin(yaw)*w*.28)} ${n(cy+Math.sin(yaw)*d*.32+Math.cos(yaw)*d*.28)}" stroke="#7f9a8c" stroke-width="2.5" stroke-linecap="round"/>`;
 }else if(kind==='console')body+=[.10,.38,.66].map(at=>rect(p.x+w*.16,p.y+d*at,w*.65,d*.19,'#537b73')).join('');
 else if(kind==='living-divider')body=rect(p.x,p.y,w,d,'#d3c4a6','stroke="#ab9778" stroke-width="1"');
 else if(kind==='wardrobe'){
  const yaw=f.yaw||0,vertical=Math.abs(Math.sin(yaw))>.5,front=vertical?(Math.sin(yaw)<0?p.x+2:q.x-2):(Math.cos(yaw)<0?p.y+2:q.y-2);
  body=rect(p.x,p.y,w,d,'#d1bc99',outline)+`<path d="${vertical?`M${n(p.x+1)} ${n(p.y+d*.5)}H${n(q.x-1)}M${n(front)} ${n(p.y+d*.35)}V${n(p.y+d*.45)}M${n(front)} ${n(p.y+d*.55)}V${n(p.y+d*.65)}`:`M${n(p.x+w*.5)} ${n(p.y+1)}V${n(q.y-1)}M${n(p.x+w*.35)} ${n(front)}H${n(p.x+w*.45)}M${n(p.x+w*.55)} ${n(front)}H${n(p.x+w*.65)}`}" stroke="#a58e6e" stroke-width="1"/>`;
 }
 else if(kind==='living-fridge')body+=rect(p.x+w*.13,p.y+1,w*.74,2,'#91aaa0')+rect(p.x+w*.18,p.y+1,w*.26,1,'#eef2e7');
 else if(kind==='reference-shelf')body+=Array.from({length:10},(_,i)=>rect(p.x+2+i*(w-4)/10,p.y+2,(w-4)/10-1,d-4,['#9eb7a7','#d2bc91','#adbccc'][i%3])).join('');
 else if(kind==='meeting-table')body+=rect(p.x+w*.19,p.y+d*.24,w*.24,d*.42,'#f7f2e3')+`<circle cx="${n(p.x+w*.7)}" cy="${n(p.y+d*.5)}" r="${n(d*.12)}" fill="#b5c6b9"/>`;
 else if(kind==='dining-table')body+=rect(p.x+w*.13,p.y+d*.24,w*.30,d*.42,'#f7f2e3')+[.66,.84].map(at=>`<circle cx="${n(p.x+w*at)}" cy="${n(p.y+d*.45)}" r="${n(Math.min(w,d)*.08)}" fill="#f8f3e7" stroke="#a7b9ad" stroke-width=".6"/>`).join('');
 else if(kind==='supply-cabinet')body+=`<path d="M${n(p.x+w*.5)} ${n(p.y+2)}V${n(q.y-2)}M${n(p.x+w*.42)} ${n(p.y+d*.35)}V${n(p.y+d*.65)}M${n(p.x+w*.58)} ${n(p.y+d*.35)}V${n(p.y+d*.65)}" stroke="#82998b"/>`;
 else if(f.role==='plant')body=`<ellipse cx="${n(p.x+w*.5)}" cy="${n(p.y+d*.5)}" rx="${n(w*.45)}" ry="${n(d*.45)}" fill="#9ebb8c" ${outline}/><path d="M${n(p.x+w*.25)} ${n(p.y+d*.3)}L${n(p.x+w*.7)} ${n(p.y+d*.72)}M${n(p.x+w*.72)} ${n(p.y+d*.25)}L${n(p.x+w*.3)} ${n(p.y+d*.7)}" stroke="#718f68"/>`;
 return `<g data-interior-feature="${f.id}" data-feature-role="${f.role}" data-model-node="${f.node}" data-world-footprint="${escape(JSON.stringify(f.footprint))}"><title>${escape(f.label)}</title>${body}</g>`;
}
function furniture(id,f,options){
 const [x,z,w,d]=f.footprint,p=interiorMapPoint(id,[x,0,z],options),q=interiorMapPoint(id,[x+w,0,z+d],options),ww=q.x-p.x,dd=q.y-p.y;
 if(id==='guest-lounge')return loungeFurniture(f,p,q);
 if(id==='management-room')return managementFurniture(f,p,q);
 const newRoom=id==='research-room'||id==='maintenance-room';
 const palette={loft:'#e3e6d8',stairs:'#dec9a4',bed:'#c2d3d5',bookcase:'#c7b28c',sofa:'#becfc7',desk:'#d8bf96',chair:'#afc5bc',rug:'#f7f5e9',plant:'#a8c995',fridge:'#c6d2cf',rack:'#c4b79d',tools:'#c3c6b0',crate:'#e1c598',cart:'#a4b4b0',planter:'#c2ce9b',nursery:'#c6d4b7',partition:'#a1b9ae',reactor:'#a3d8cf',console:'#bac8c2',controls:'#b6cac3',cabinet:'#becbc1',monitors:'#93b6ad',pump:'#9aaba9',kitchen:'#d7c7a7',toilet:'#f7faf1',basin:'#f5faf2',bath:'#d8e9e5'};
 let detail='';
 if(f.role==='fridge')detail=`<path d="M${n(p.x+ww/2)} ${n(p.y+2)}V${n(q.y-2)}" stroke="#7d9690"/>`+rect(p.x+ww*.32,q.y-4,ww*.36,2,'#79aea3');
 if(f.role==='crate')detail=`<path d="M${n(p.x+ww/2)} ${n(p.y)}V${n(q.y)}" stroke="#f3e8c6" stroke-width="${n(ww*.09)}"/>`+rect(p.x+ww*.13,p.y+dd*.40,ww*.28,dd*.25,'#f8f4e8');
 if(f.role==='reactor'){const cx=(p.x+q.x)/2,cy=(p.y+q.y)/2,r=Math.min(ww,dd)*.32;detail=`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="#82c6b9" stroke="#6d9690" stroke-width="1.8"/><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r*.58)}" fill="#b9e2d6"/><path d="M${n(cx+r)} ${n(cy)}H${n(q.x-2)}" stroke="#76958e" stroke-width="2"/>`;}
 if(f.role==='planter'||f.role==='nursery'||f.role==='plant')detail=Array.from({length:f.role==='plant'?3:6},(_,i)=>`<ellipse cx="${n(p.x+ww*(.25+(i%3)*.25))}" cy="${n(p.y+dd*(.32+Math.floor(i/3)*.36))}" rx="${n(Math.min(ww,dd)*.11)}" ry="${n(Math.min(ww,dd)*.18)}" fill="${i%2?'#739a5f':'#92b779'}"/>`).join('');
 if(f.role==='rack'||f.role==='bookcase'){const horizontal=ww>dd;detail=Array.from({length:Math.min(14,Math.ceil(Math.max(ww,dd)/7))},(_,i)=>horizontal?rect(p.x+2+i*(ww-4)/14,p.y+2,(ww-4)/14-1,dd-4,['#a3bca8','#d5c39f','#a5b6c1'][i%3]):rect(p.x+2,p.y+2+i*(dd-4)/14,ww-4,(dd-4)/14-1,['#a3bca8','#d5c39f','#a5b6c1'][i%3])).join('');}
 if(f.role==='stairs')detail=Array.from({length:4},(_,i)=>`<path d="M${n(p.x)} ${n(p.y+dd*(i+1)/5)}H${n(q.x)}" stroke="#b49b75"/>`).join('');
 if(f.role==='bed')detail=ww>dd?rect(f.yaw>0?p.x+3:q.x-ww*.22,p.y+3,ww*.17,dd-6,'#faf9f1'):rect(p.x+3,p.y+3,ww-6,dd*.17,'#faf9f1');
 if(f.role==='sofa')detail=rect(p.x+3,p.y+3,ww-6,dd*.20,'#91aaa1')+`<path d="M${n(p.x+ww/2)} ${n(p.y+dd*.3)}V${n(q.y-2)}" stroke="#94ada2"/>`;
 if(f.role==='tools')detail=`<path d="M${n(p.x+ww*.3)} ${n(p.y+dd*.2)}V${n(p.y+dd*.8)}M${n(p.x+ww*.6)} ${n(p.y+dd*.2)}V${n(p.y+dd*.8)}" stroke="#788d84" stroke-width="2"/>`;
 if(newRoom&&f.role==='tools')detail=`<path d="M${n(p.x+ww*.3)} ${n(p.y+dd*.35)}V${n(p.y+dd*.8)}M${n(p.x+ww*.2)} ${n(p.y+dd*.17)}V${n(p.y+dd*.32)}L${n(p.x+ww*.3)} ${n(p.y+dd*.4)}L${n(p.x+ww*.4)} ${n(p.y+dd*.32)}V${n(p.y+dd*.17)}M${n(p.x+ww*.65)} ${n(p.y+dd*.25)}V${n(p.y+dd*.8)}M${n(p.x+ww*.5)} ${n(p.y+dd*.25)}H${n(p.x+ww*.8)}" fill="none" stroke="#788d84" stroke-width="2" stroke-linecap="round"/>`;
 if(f.role==='cabinet')detail=ww>=dd?`<path d="M${n(p.x+ww*.5)} ${n(p.y+dd*.1)}V${n(p.y+dd*.9)}M${n(p.x+ww*.4)} ${n(p.y+dd*.4)}V${n(p.y+dd*.6)}M${n(p.x+ww*.6)} ${n(p.y+dd*.4)}V${n(p.y+dd*.6)}" stroke="#859e92"/>`:`<path d="M${n(p.x+ww*.1)} ${n(p.y+dd*.5)}H${n(p.x+ww*.9)}M${n(p.x+ww*.4)} ${n(p.y+dd*.4)}H${n(p.x+ww*.6)}M${n(p.x+ww*.4)} ${n(p.y+dd*.6)}H${n(p.x+ww*.6)}" stroke="#859e92"/>`;
 if(newRoom&&(f.role==='console'||f.role==='controls'))detail=rect(p.x+ww*.12,p.y+dd*.15,ww*.54,dd*.56,'#668d83')+`<path d="M${n(p.x+ww*.2)} ${n(p.y+dd*.52)}L${n(p.x+ww*.3)} ${n(p.y+dd*.3)}L${n(p.x+ww*.42)} ${n(p.y+dd*.5)}H${n(p.x+ww*.58)}M${n(p.x+ww*.77)} ${n(p.y+dd*.3)}H${n(p.x+ww*.88)}M${n(p.x+ww*.77)} ${n(p.y+dd*.6)}H${n(p.x+ww*.88)}" fill="none" stroke="#d7e9ce" stroke-width="1.2"/>`;
 if(f.role==='monitors')detail=rect(p.x+ww*.06,p.y+dd*.14,ww*.88,dd*.72,'#668d83')+`<path d="M${n(p.x+ww/3)} ${n(p.y+dd*.14)}V${n(p.y+dd*.86)}M${n(p.x+ww*2/3)} ${n(p.y+dd*.14)}V${n(p.y+dd*.86)}" stroke="#c9e2ca"/>`;
 if(newRoom&&f.role==='pump'){const cx=p.x+ww*.5,cy=p.y+dd*.5,r=Math.min(ww,dd)*.28;detail=`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="#bfd1ca" stroke="#758e85" stroke-width="1.5"/><path d="M${n(cx)} ${n(cy)}L${n(cx+r*.6)} ${n(cy-r*.4)}M${n(cx+r)} ${n(cy)}H${n(p.x+ww*.9)}" stroke="#758e85" stroke-width="1.5"/>`;}
 if(newRoom&&f.role==='cart')detail=rect(p.x+ww*.16,p.y+dd*.18,ww*.68,dd*.58,'#cad6cb','fill-opacity=".6"')+[.2,.8].map(x=>`<circle cx="${n(p.x+ww*x)}" cy="${n(p.y+dd*.86)}" r="${n(Math.min(ww,dd)*.09)}" fill="#69847a"/>`).join('');
 if(id==='research-room'&&f.id==='experiment-island-west')detail=`<path d="M${n(p.x+ww*.3)} ${n(p.y+dd*.76)}H${n(p.x+ww*.6)}M${n(p.x+ww*.5)} ${n(p.y+dd*.74)}V${n(p.y+dd*.5)}L${n(p.x+ww*.4)} ${n(p.y+dd*.26)}M${n(p.x+ww*.32)} ${n(p.y+dd*.54)}H${n(p.x+ww*.56)}" fill="none" stroke="#758d87" stroke-width="2.5"/><circle cx="${n(p.x+ww*.39)}" cy="${n(p.y+dd*.25)}" r="${n(Math.min(ww,dd)*.1)}" fill="#8cafaa"/>`;
 if(id==='research-room'&&f.id==='experiment-island-east')detail=[.3,.5,.7].map((x,i)=>`<path d="M${n(p.x+ww*(x-.025))} ${n(p.y+dd*.23)}V${n(p.y+dd*.4)}L${n(p.x+ww*(x-.065))} ${n(p.y+dd*.72)}H${n(p.x+ww*(x+.065))}L${n(p.x+ww*(x+.025))} ${n(p.y+dd*.4)}V${n(p.y+dd*.23)}Z" fill="${['#b8d3c3','#c3dbe1','#dbd6b5'][i]}" stroke="#829a90"/>`).join('');
 const line=f.role==='rug'?'#e2dfcd':'#a4aa91';
 return `<g data-interior-feature="${f.id}"${newRoom?` data-feature-role="${f.role}"`:''} data-model-node="${f.node}" data-world-footprint="${escape(JSON.stringify(f.footprint))}"><title>${escape(f.label)}</title>`+rect(p.x,p.y,ww,dd,palette[f.role]||'#d2dbc7',`stroke="${line}" stroke-width="1"`)+detail+'</g>';
}
function aperture(id,entry,options){
 const half=entry.width/2,side=entry.side,alongX=side==='north'||side==='south',a=[...entry.center],b=[...entry.center];a[alongX?0:2]-=half;b[alongX?0:2]+=half;const p=interiorMapPoint(id,a,options),q=interiorMapPoint(id,b,options);
 return `<path data-interior-door="${side}" data-world-width="${entry.width}" d="M${n(p.x)} ${n(p.y)}L${n(q.x)} ${n(q.y)}" stroke="#f7f2df" stroke-width="5"/><path d="M${n(p.x)} ${n(p.y)}L${n(q.x)} ${n(q.y)}" stroke="#8dad9d" stroke-width="1.4"/>`;
}
/** A shared room-occupancy badge. Values only: worker names stay in the scene UI. */
export function staffCountDrawing(roomId,count,{x=0,y=0,scale=1}={}){
 const total=Math.max(0,Math.min(20,Math.trunc(count)));if(!total)return'';
 return `<g data-map-staff-count="${total}" data-staff-room="${escape(roomId)}" transform="translate(${n(x)} ${n(y)}) scale(${n(scale)})" pointer-events="none"><title>従業員${total}人</title><rect width="80" height="34" rx="15" fill="#fffaf0" stroke="#8c9c7b" stroke-width="1.5"/><g fill="#6f7d5b"><circle cx="17" cy="10" r="4"/><path d="M10 24v-6a7 7 0 0 1 14 0v6h-4v6h-6v-6Z"/></g><text x="50" y="25" fill="#596749" font-family="system-ui,sans-serif" font-size="24" font-weight="700" text-anchor="middle">${total}</text></g>`;
}
function managementEntryDrawing(layout,options){
 const security=layout.securityEntrance;if(!security)return'';
 const part=(name,footprint,color)=>{const [x,z,w,d]=footprint,p=interiorMapPoint(layout.id,[x,0,z],options),q=interiorMapPoint(layout.id,[x+w,0,z+d],options);return{p,q,w:q.x-p.x,d:q.y-p.y,svg:`<g data-security-part="${name}" data-world-footprint="${escape(JSON.stringify(footprint))}">`+rect(p.x,p.y,q.x-p.x,q.y-p.y,color,'stroke="#556b67" stroke-width=".9"')+'</g>'};};
 const layers=security.doors?.length?security.doors:[{id:'inner',frame:{jambFootprints:security.jambFootprints},parkedDoor:security.parkedDoor}];
 let body=`<g data-interior-security="management-entry" data-door-count="${layers.length}" data-door-state="${escape(security.doorState)}" data-model-node="${escape(security.node)}"><title>${layers.length>1?'二重の補強扉':'補強枠'}と認証端末のある入口</title>`;
 if(security.vestibule?.worldBounds){
  const b=security.vestibule.worldBounds,a=interiorMapPoint(layout.id,b.min,options),z=interiorMapPoint(layout.id,b.max,options),top=interiorMapPoint(layout.id,[b.min[0],0,security.portal.centre[2]-security.portal.clearWidth/2],options),bottom=interiorMapPoint(layout.id,[b.min[0],0,security.portal.centre[2]+security.portal.clearWidth/2],options);
  body+='<g data-security-part="vestibule">'+rect(a.x,a.y,z.x-a.x,z.y-a.y,'#d6e1d9','fill-opacity=".65"')+
   rect(a.x,a.y,z.x-a.x,top.y-a.y,'#849b94','stroke="#556b67" stroke-width=".6"')+rect(a.x,bottom.y,z.x-a.x,z.y-bottom.y,'#849b94','stroke="#556b67" stroke-width=".6"')+'</g>';
 }
 for(const [index,layer]of layers.entries()){
  body+=`<g data-security-layer="${escape(layer.id||String(index))}">`;
  for(const [i,footprint]of (layer.frame?.jambFootprints||layer.jambFootprints||[]).entries())body+=part('jamb-'+i,footprint,index?'#788e89':'#91a6a0').svg;
  const door=part('parked-door',layer.parkedDoor.footprint,index?'#879d98':'#a9b7ae');
  body+=door.svg+[.18,.50,.82].map(at=>`<path d="M${n(door.p.x+.5)} ${n(door.p.y+door.d*at)}H${n(door.q.x-.5)}" stroke="#4b635e" stroke-width="1.2"/>`).join('');
  body+=`<path d="M${n(door.p.x+door.w*.5)} ${n(door.p.y+1)}V${n(door.q.y-1)}" stroke="#d7e0d9" stroke-width=".65"/>`;
  body+='</g>';
 }
 const reader=part('reader',security.reader.footprint,'#526d65');body+=reader.svg+rect(reader.p.x+reader.w*.22,reader.p.y+reader.d*.24,reader.w*.56,reader.d*.38,'#b6d1b8');
 return body+'</g>';
}

export function interiorMapDrawing(id,{livingOnly=false,width,height,current=false,selected=false}={}){
 const l=INTERIOR_LAYOUTS[id];if(!l)return'';const dimensions=livingOnly?l.living.map:l.map,W=width||dimensions.width,H=height||dimensions.height,o={livingOnly,width:W,height:H};
 let content=rect(0,0,W,H,id==='production-room'?'#edf0df':'#f3eedf','data-interior-floor="true"');
 if(l.zones)for(const zone of l.zones){const [x,z,w,d]=zone.bounds,a=interiorMapPoint(id,[x,0,z],o),b=interiorMapPoint(id,[x+w,0,z+d],o);content+=rect(a.x,a.y,b.x-a.x,b.y-a.y,zone.id==='planters'?'#e6ecd4':'#e0eeea')+`<text x="${n((a.x+b.x)/2)}" y="${n(a.y+19)}" text-anchor="middle" font-size="16" fill="#718572">${zone.label}</text>`;}
 const order=f=>f.role==='loft'?0:f.role==='rug'?1:2;
 content+=l.features.filter(f=>!livingOnly||f.area==='living').slice().sort((a,b)=>order(a)-order(b)).map(f=>furniture(id,f,o)).join('');
 content+=rect(0,0,W,H,'none',`data-interior-outer-wall="true" stroke="${selected?'#936843':'#a3b59e'}" stroke-width="${selected?4:2}"`);
 if(id==='player-room'){
  if(livingOnly)content+=aperture(id,l.entrance,o);
  else{
   const a=l.apartmentPlan,point=(x,z)=>interiorMapPoint(id,[(x-a.origin[0])*a.scale,0,(z-a.origin[1])*a.scale],o);
   const line=(x,z,xx,zz)=>{const p=point(x,z),q=point(xx,zz);return `<path d="M${n(p.x)} ${n(p.y)}L${n(q.x)} ${n(q.y)}" fill="none" stroke="#a9b49e" stroke-width="1.8"/>`;};
   for(const [x,z,w,d]of[a.living,a.toilet,a.washBath]){const p=point(x,z),q=point(x+w,z+d);content+=rect(p.x,p.y,q.x-p.x,q.y-p.y,'none','stroke="#adb6a0" stroke-width="1.8"');}
   for(const[x,z,w]of[a.livingDoor,a.apartmentDoor]){const p=point(x,z),q=point(x+w,z);content+=`<path d="M${n(p.x)} ${n(p.y)}H${n(q.x)}" stroke="#f3eedf" stroke-width="5"/>`+line(x,z,x+w,z);}
   for(const[x,z,d]of[a.toiletDoor,a.washDoor]){const p=point(x,z),q=point(x,z+d);content+=`<path d="M${n(p.x)} ${n(p.y)}V${n(q.y)}" stroke="#f3eedf" stroke-width="5"/>`+line(x,z,x-28,z)+`<path d="M${n(p.x)} ${n(q.y)}Q${n(p.x-28*a.scale/(l.room.width)*W)} ${n(q.y)} ${n(point(x-28,z).x)} ${n(p.y)}" fill="none" stroke="#a9b49e"/>`;}
   content+=line(169,224,203,224);
  }
  const a=interiorMapPoint(id,[2.448,0,.036],o),b=interiorMapPoint(id,[2.448,0,1.656],o);content+=`<path data-interior-window="right" d="M${n(a.x)} ${n(a.y)}L${n(b.x)} ${n(b.y)}" stroke="#97bdbc" stroke-width="3"/>`;
 }else for(const e of[l.entrance,...l.secondaryEntrances||[]])content+=aperture(id,e,o);
 if(id==='management-room')content+=managementEntryDrawing(l,o);
 if(current){const p=interiorMapPoint(id,l.entrance.heroStand,o);content+=`<g data-interior-current="true" transform="translate(${n(p.x)} ${n(p.y)})"><circle r="${id==='warehouse'?8:5}" fill="#fff7e9" stroke="#bb817a" stroke-width="2"/></g>`;}
 return `<g data-interior-plan="${id}" font-family="system-ui,sans-serif">${content}</g>`;
}
export function interiorMapSvg(id,{current=true}={}){const l=INTERIOR_LAYOUTS[id],p=l.map.svgPadding||{},left=p.left??4,top=p.top??4,right=p.right??4,bottom=p.bottom??4;return `<svg class="room-map" viewBox="${-left} ${-top} ${l.map.width+left+right} ${l.map.height+top+bottom}" role="img" aria-label="${l.title}の地図。設備は3Dモデルと同じ配置。">${interiorMapDrawing(id,{current})}</svg>`;}
