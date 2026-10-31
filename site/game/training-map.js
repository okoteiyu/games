// Plan coordinates follow the current training GLB: +Z is right, +X is down.
// Rooms outside the existing hall are schematic; the guest lounge awaits 3D art.
const SCALE=28.8,ORIGIN={x:70,y:220},WORLD={minX:-5.36,minZ:-28.12,maxX:5.36,maxZ:3.46};
export const TRAINING_MAP_VIEWBOX='0 55 1200 685';
export function trainingMapPoint(position){return {x:ORIGIN.x+(position[2]-WORLD.minZ)*SCALE,y:ORIGIN.y+(position[0]-WORLD.minX)*SCALE};}
const rect=(x,y,w,h,fill,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${fill}" ${extra}/>`;
const text=(x,y,value,size=34,extra='')=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="#645b49" ${extra}>${value}</text>`;
function worldRect(x,z,width,depth,fill,extra=''){
 const p=trainingMapPoint([x-width/2,0,z-depth/2]);return rect(p.x,p.y,depth*SCALE,width*SCALE,fill,extra);
}
function feature(id,position,body){const p=trainingMapPoint(position);return `<g data-training-feature="${id}" data-world-x="${position[0]}" data-world-z="${position[2]}" transform="translate(${p.x} ${p.y})">${body}</g>`;}
function equipmentLabel(compact,x,y,label){return compact?'':text(x,y,label,32);}

/** One floor drawing shared by the building dialog and the compact area map. */
export function trainingMapDrawing({selected=null,compact=false,current=false}={}){
 const far=trainingMapPoint([WORLD.minX,0,WORLD.minZ]),near=trainingMapPoint([WORLD.maxX,0,WORLD.maxZ]),width=near.x-far.x,height=near.y-far.y;
 const zone=(id,x,y,w,h,fill,extra='')=>rect(x,y,w,h,fill,`data-building-zone="${id}" ${extra}`);
 let drawing=rect(30,160,1140,570,'#edf0e0','stroke="#b2bc9e" stroke-width="4"')+
  '<path data-training-access="core" d="M975 374H1102M1006 374V639H900" fill="none" stroke="#e2d9c4" stroke-width="44" stroke-linejoin="round"/>'+
  '<path data-training-access="guest-lounge" d="M1006 639V711H628V628H605" fill="none" stroke="#e2d9c4" stroke-width="32" stroke-linejoin="round"/>'+
  zone('training',far.x,far.y,width,height,'#ece8dd','data-map-marker-x="500" data-map-marker-y="95" data-map-marker-unit="1.6"')+
  worldRect(0,-12.1,6.92,24.5,'#bacbbb','data-training-feature="mat" stroke="#879d8c" stroke-width="3"')+
  worldRect(0,-12.1,6.69,24.1,'none','stroke="#f5f3df" stroke-width="3"')+
  '<g stroke="#d1ddca" stroke-width="1.4" opacity=".65">'+Array.from({length:15},(_,i)=>{const p=trainingMapPoint([-3.35,0,-1.52-i*1.51]);return `<path d="M${p.x} ${p.y}v${6.7*SCALE}"/>`;}).join('')+'</g>'+
  feature('arena-centre',[0,0,-12.1],'<circle r="28" fill="none" stroke="#f7f7e8" stroke-width="3"/><circle r="4" fill="#b5a27d"/>');
 // Dashed overhead fixtures remain distinct from devices standing on the floor.
 for(const [index,x]of[-3.85,3.85].entries()){
  const a=trainingMapPoint([x,0,-26.9]),b=trainingMapPoint([x,0,.5]);
  drawing+=`<path data-training-feature="ceiling-rail-${index}" d="M${a.x} ${a.y}H${b.x}" fill="none" stroke="#9eac9c" stroke-width="2" stroke-dasharray="8 8"/>`;
 }
 for(const [index,x]of[-2.7,-.9,.9,2.7].entries())drawing+=feature('overhead-light-'+index,[x,5.36,-9.28],rect(-18,-8,36,16,'#fff9d5','stroke="#b7a979" stroke-width="2" stroke-dasharray="4 3"'));
 for(const [id,x]of[['left',-4.2],['right',4.2]])drawing+=feature('wind-'+id,[x,1.65,-5.35],'<circle r="18" fill="#eef0e5" stroke="#778d84" stroke-width="3"/><path d="M-11-5Q0-14 3-2Q15-1 7 8Q-4 17-4 3Q-17 4-11-5Z" fill="#91a9a1"/><circle r="3" fill="#617c72"/>');
 for(const [id,x]of[['left',-4.15],['right',4.15]])drawing+=feature('light-'+id,[x,3.6,-10.5],'<circle r="16" fill="none" stroke="#a39572" stroke-width="2" stroke-dasharray="4 3"/>'+rect(-13,-6,26,12,'#fff2b7','stroke="#ad9b64" stroke-width="2"')+'<path d="M-7 10H7M0 6V16" stroke="#8c8c79" stroke-width="2"/>');
 drawing+=worldRect(-4.55,-7.7,.92,2.6,'#d3c7af','data-training-feature="storage" stroke="#a69370" stroke-width="2"')+
  worldRect(4.23,-1.05,.69,2.8,'#d7bf98','data-training-feature="bench" stroke="#ad946d" stroke-width="2"');
 for(const [index,[x,z]]of[[-4.25,-4],[4.3,-8.55]].entries())drawing+=feature('pad-'+index,[x,0,z],'<circle r="12" fill="#80978a" stroke="#596e64" stroke-width="2"/><circle r="5" fill="none" stroke="#eef0db" stroke-width="2"/>');
 drawing+=feature('selector',[-1.15,0,.3],rect(-10,-15,20,30,'#536d65','stroke="#b5a07c" stroke-width="2"')+'<path d="M-6-9H6M-6-4H6M-6 1H6M-6 6H6M-6 11H6" stroke="#e9e9cb" stroke-width="2"/>');
 const door=trainingMapPoint([0,0,3.22]),glassStart=trainingMapPoint([5.11,0,-6.95]),glassEnd=trainingMapPoint([5.11,0,-1.05]);
 drawing+=`<path d="M${near.x} ${door.y-44}V${far.y}H${far.x}V${near.y}H${near.x}V${door.y+44}" fill="none" stroke="${selected==='training'?'#936843':'#a89c80'}" stroke-width="4" stroke-linejoin="round"/>`+
  feature('entrance',[0,0,3.22],'<path d="M3-44V44M-2-42V-4M-2 4V42" stroke="#9abeb6" stroke-width="4" fill="none"/>')+
  `<path data-training-feature="observation-glass" d="M${glassStart.x} ${glassStart.y}H${glassEnd.x}" fill="none" stroke="#96c5c2" stroke-width="8"/>`+
  rect(glassStart.x,glassStart.y+6,glassEnd.x-glassStart.x,15,'#d5e6df');
 // An invited guest's lounge: soft seating, gold trim, refreshments and an open entry.
 drawing+=zone('guest-lounge',70,550,535,145,'#f8f0de',`stroke="${selected==='guest-lounge'?'#936843':'#b89b62'}" stroke-width="${selected==='guest-lounge'?5:2}"`)+
  '<g data-guest-feature="gold-trim" fill="none" stroke="#d1b87a" stroke-width="2"><path d="M86 588V565H589V588M86 674V683H589V674"/><path d="m96 571 6-5 6 5-6 5Zm471 0 6-5 6 5-6 5Z"/></g>'+
  rect(compact?220:184,552,compact?234:306,36,'#f8f0de','data-guest-label-backdrop="true"')+
  text(337,581,compact?'待機エリア':'珍生物待機エリア',compact?40:34)+
  '<g data-guest-feature="rug"><rect x="254" y="594" width="174" height="84" rx="16" fill="#657b7b" stroke="#c4a466" stroke-width="4"/><rect x="264" y="603" width="154" height="66" rx="11" fill="none" stroke="#e2d6ad" stroke-width="2"/></g>'+
  '<g data-guest-feature="sofa"><rect x="103" y="602" width="115" height="64" rx="17" fill="#b88e9c" stroke="#a78a60" stroke-width="2"/><rect x="113" y="611" width="94" height="44" rx="12" fill="#ead4ce"/><path d="M144 612v42m31-42v42" fill="none" stroke="#c6a9a3" stroke-width="2"/><rect x="99" y="605" width="15" height="56" rx="7" fill="#c5a2ab"/><rect x="205" y="605" width="15" height="56" rx="7" fill="#c5a2ab"/></g>'+
  '<g data-guest-feature="armchairs">'+[594,651].map(y=>`<rect x="465" y="${y}" width="60" height="29" rx="10" fill="#b6c5b8" stroke="#b59a64" stroke-width="2"/><rect x="476" y="${y+5}" width="38" height="19" rx="6" fill="#e4ebe0"/>`).join('')+'</g>'+
  '<g data-guest-feature="tea-table"><ellipse cx="341" cy="636" rx="38" ry="21" fill="#e8d6b4" stroke="#b7975a" stroke-width="3"/><ellipse cx="341" cy="636" rx="29" ry="14" fill="#fff8e7"/><circle cx="332" cy="634" r="4" fill="#b7cfc8" stroke="#9eaf99"/><circle cx="349" cy="641" r="4" fill="#d5b8a3"/></g>'+
  '<g data-guest-feature="refreshments">'+rect(550,650,32,25,'#d1b57f','stroke="#ad9059" stroke-width="2"')+'<circle cx="559" cy="658" r="4" fill="#fffbeb"/><circle cx="572" cy="658" r="4" fill="#fffbeb"/><path d="M555 671h23" stroke="#fff8e5" stroke-width="2"/></g>'+
  '<g data-guest-feature="plants">'+[[568,608],[91,662]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="12" fill="#b6cdb1"/><path d="M${x} ${y+8}v-15m0 12-7-7m7 3 7-7" stroke="#7e9e7c" stroke-width="2" fill="none"/>`).join('')+'</g>'+
  '<path data-training-access="guest-open-entry" d="M605 600v56" fill="none" stroke="#e2d9c4" stroke-width="8"/><path d="M598 595h10m-10 66h10" stroke="#b59a64" stroke-width="3"/>';
 // The management room stays map-only, aligned with the observation glass.
 drawing+=zone('control',650,550,250,145,'#e4ece5',`stroke="${selected==='control'?'#936843':'#a2b7a7'}" stroke-width="${selected==='control'?5:2}"`)+
  '<path data-training-access="control-door" d="M900 618v32" stroke="#e2d9c4" stroke-width="8"/><path d="M900 618h-30M900 648a30 30 0 0 1-30-30" fill="none" stroke="#9ba995" stroke-width="2"/>'+
  text(775,635,compact?'管理室':'訓練管理室',compact?48:36)+
  (compact?'':text(775,543,'観測ガラス',27))+
  zone('core',1034,299,136,151,'#d4dfd0',`stroke="${selected==='core'?'#936843':'#a7b59c'}" stroke-width="${selected==='core'?5:2}"`)+
  '<g data-training-feature="stairs" stroke="#9e8a69" stroke-width="3">'+Array.from({length:6},(_,i)=>`<path d="M1053 ${320+i*10}h41"/>`).join('')+'</g>'+rect(1110,317,40,58,'#f5f7ed','stroke="#a7b59c" stroke-width="2"')+text(1130,355,'EV',22)+text(1102,compact?421:413,compact?'階段・EV':'階段・EV',compact?32:28);
 if(!compact){
  drawing+=text(200,198,'訓練所',42)+text(1021,285,'入口',34)+
   equipmentLabel(false,822,286,'送風機')+equipmentLabel(false,561,286,'照明')+
   equipmentLabel(false,656,286,'収納')+equipmentLabel(false,901,319,'端末')+
   equipmentLabel(false,914,478,'ベンチ')+equipmentLabel(false,617,478,'パッド')+
   text(345,393,'訓練マット',36);
 }
 if(current)drawing+=feature('current-position',[0,0,.9],'<path d="m-20 0 10-8v16Z" fill="#8d7c5b"/><circle r="12" fill="#fff7e9" stroke="#bb817a" stroke-width="3"/><circle cx="-5" cy="2" r="2" fill="#d8a1a0"/><circle cx="5" cy="2" r="2" fill="#d8a1a0"/>');
 return `<g data-training-plan="right-entrance" font-family="system-ui, sans-serif">${drawing}</g>`;
}
export function trainingMapSvg({compact=true,current=true}={}){
 return `<svg class="room-map" viewBox="${compact?'30 160 1140 580':TRAINING_MAP_VIEWBOX}" role="img" aria-label="右側が入口の訓練所。訓練マット、操作端末、送風機、照明、収納、ベンチ、観測ガラスと管理室。招待した珍生物がくつろぐ待機エリア。${current?'おこていゆは入口付近で待機しています。':''}">${trainingMapDrawing({compact,current})}</svg>`;
}
