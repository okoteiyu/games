import {trainingMapSvg} from './training-map.js';

const DEFAULT_BOUNDS={min:[-2.72,-.1,-5.72],max:[2.72,2.8,.15]};
/** Project the actual Y-up room coordinates: rear at the top, entrance below. */
export function roomMapPoint(position,bounds=DEFAULT_BOUNDS){
 const x=position?.[0]??0,z=position?.[2]??0;
 return {x:10+(x-bounds.min[0])/(bounds.max[0]-bounds.min[0])*220,y:10+(z-bounds.min[2])/(bounds.max[2]-bounds.min[2])*240};
}
export class AreaMap {
 constructor(element,{onOpenHouse=()=>{},onHouseUpdate=()=>{}}={}){
  this.onHouseUpdate=onHouseUpdate;this.contentClick=event=>{if(['house','training'].includes(this.mode)){const button=event.target.closest('[data-house-map-open]');if(button)onOpenHouse(button);}};element.addEventListener('click',this.contentClick);
  this.element=element;this.content=element.querySelector('#areaMapContent');this.title=element.querySelector('#areaMapTitle');this.hint=element.querySelector('#areaMapHint');this.mode=null;this.markerKey=null;
 }
 showHouse(life,metadata){
  if(this.mode!=='house'){
   this.mode='house';this.element.dataset.area='house';this.title.textContent='おこていゆハウス';this.hint.textContent='';this.bounds=metadata?.roomBounds||DEFAULT_BOUNDS;
   this.buildHouse();this.markerKey=null;
  }
  const actor=life?.actor?.position?.toArray()||metadata?.life?.landmarks?.entrance?.position||[0,0,-.45];
  const companion=life?.companion?.position?.toArray()||[-.28,0,-.3];
  const key=[...actor,...companion].map(v=>v.toFixed(3)).join('|');if(key===this.markerKey)return;this.markerKey=key;
  for(const [id,position]of [['roomMapOkoteiyu',actor],['roomMapMoai',companion]]){
   const p=roomMapPoint(position,this.bounds);this.content.querySelector('#'+id).setAttribute('transform',`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
  }
  this.onHouseUpdate(this.content.querySelector('svg'));
 }
 showPatrol(map){
  this.mode='patrol';this.element.dataset.area='patrol';this.title.textContent='道中マップ';this.hint.textContent='タップで拡大';this.content.replaceChildren(map);
 }
 showTraining(){
  this.mode='training';this.element.dataset.area='training';this.title.textContent='訓練所';this.hint.textContent='';
  this.content.innerHTML='<button class="area-map__house-trigger" data-house-map-open type="button" aria-label="訓練所の建物マップを開く" aria-haspopup="dialog" aria-controls="buildingMapDialog" aria-expanded="false">'+trainingMapSvg()+'</button>';
 }
 buildHouse(){
  const point=(x,z)=>roomMapPoint([x,0,z],this.bounds);
  const rect=(x1,z1,x2,z2,fill,stroke='#baac94',radius=3)=>{const a=point(x1,z1),b=point(x2,z2);return `<rect x="${a.x}" y="${a.y}" width="${b.x-a.x}" height="${b.y-a.y}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.1"/>`;};
  const bed=point(-.72,-5.12),chair=point(1.98,-4.8);
  this.content.innerHTML=`<button class="area-map__house-trigger" data-house-map-open type="button" aria-label="おこていゆハウスの建物マップを開く" aria-haspopup="dialog" aria-controls="buildingMapDialog" aria-expanded="false"><svg class="room-map" viewBox="7 7 226 248" role="img" aria-label="入口が下側、奥がロフトのお部屋の地図。おこていゆとモアイくんの現在位置">
   <defs><pattern id="roomMapFloor" width="18" height="24" patternUnits="userSpaceOnUse"><rect width="18" height="24" fill="#f6efdf"/><path d="M0 0H18M0 12H9M9 12V24M0 0V12" fill="none" stroke="#d7c6a7" stroke-width=".5"/></pattern></defs>
   <rect x="10" y="10" width="220" height="240" rx="6" fill="url(#roomMapFloor)"/>
   ${rect(-2.55,-5.5,2.55,-3.78,'#e6e8d9')}
   ${rect(-1.15,-5.34,-.28,-4.55,'#fffdf6')}
   <rect x="${bed.x-12}" y="${bed.y-2}" width="24" height="10" rx="4" fill="#f3ebd8" stroke="#c4b496" stroke-width=".7"/>
   ${rect(1.60,-5.17,2.36,-4.39,'#c9d1be','#a8b394',7)}
   <path d="M${chair.x-8} ${chair.y+9}h16" stroke="#a5b18f" fill="none"/>
   ${rect(-2.36,-3.74,-1.40,-2.79,'#e4d0ae')}
   ${[-3.48,-3.20,-2.94].map(z=>{const a=point(-2.36,z),b=point(-1.40,z);return `<path d="M${a.x} ${a.y}H${b.x}" stroke="#bda681"/>`;}).join('')}
   <path d="M17 88H70M103 88H223" stroke="#9fac8a" stroke-width="2" stroke-dasharray="3 3"/>
   ${rect(-.92,-2.68,.92,-.95,'#fffdf5','#d9d9c7',12)}
   ${rect(-.70,-2.28,.70,-1.54,'#dcc9a4','#baa17b',8)}
   ${[[-.8,-1.91],[.8,-1.91],[0,-2.55],[0,-1.23]].map(([x,z],i)=>rect(x-.13,z-.13,x+.13,z+.13,['#bfcbc0','#d9c1a8','#d0c0cf','#d4d4b6'][i],'#bec0a5',3)).join('')}
   ${rect(1.95,-2.55,2.53,-.75,'#e2d1b2')}
   ${rect(2.12,-3.96,2.58,-2.92,'#c3ad89')}
   ${rect(-2.57,-2.37,-1.98,-1.83,'#fcfff6')}
   ${rect(-2.59,-1.62,-2.34,-.48,'#ffffff')}
   <path d="M99 250H10V10H230V250H141" stroke="#ae9a79" stroke-width="3" fill="none" stroke-linejoin="round"/>
   <path d="M100 250H140M101 247H120V253H101M121 247H139" stroke="#bfa67f" fill="none" stroke-width="1.2"/>
   <path data-room-window="right" d="M230 163v38" stroke="#9dbfbd" stroke-width="3"/>
   <g id="roomMapMoai"><path d="M0-5 4-2 3 5H-3L-4-2Z" fill="#8e9687" stroke="#fffef7" stroke-width="1.3"/></g>
   <g id="roomMapOkoteiyu"><circle r="6" fill="#fff7e9" stroke="#bb817a" stroke-width="1.8"/><circle cx="-2.5" cy="1" r="1.1" fill="#d8a1a0"/><circle cx="2.5" cy="1" r="1.1" fill="#d8a1a0"/></g>
  </svg><span class="area-map__tap-cue" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><path d="M13 19V9a2 2 0 0 1 4 0v7a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v2a2 2 0 0 1 4 0v4c0 4-2 7-6 7h-6c-2 0-3-1-4-2L7 21c-1-2 1-4 3-3l3 2Z" fill="#f4e6ce"/><path d="M9 7a6 6 0 0 1 12 0M11.5 7a3.5 3.5 0 0 1 7 0"/></svg></span></button>`;
  this.houseSvg=this.content.querySelector('.room-map');
 }
}
