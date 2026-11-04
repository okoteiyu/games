import {trainingMapSvg} from './training-map.js';
import {analysisMapSvg} from './analysis-map.js';
import {CampLog} from './camp-log.js';
import {BattleLog} from './battle-log.js';
import {interiorMapSvg,staffCountDrawing} from './interior-map.js';
import {getFacilityStaffCounts} from './facility-staff.js';
import {INTERIOR_ROOMS} from './interior-rules.js';
import {outdoorMapDrawing,OUTDOOR_MAP_VIEWBOX} from './outdoor-map.js';

// Decorative cue stays outside the map SVGs copied into the dialogs.
const MAP_TAP_CUE='<span class="area-map__tap-cue" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><path d="M13 19V9a2 2 0 0 1 4 0v7a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v2a2 2 0 0 1 4 0v4c0 4-2 7-6 7h-6c-2 0-3-1-4-2L7 21c-1-2 1-4 3-3l3 2Z" fill="#f4e6ce"/><path d="M9 7a6 6 0 0 1 12 0M11.5 7a3.5 3.5 0 0 1 7 0"/></svg></span>';
const addMapTapCue=button=>{if(!button.querySelector(':scope > .area-map__tap-cue'))button.insertAdjacentHTML('beforeend',MAP_TAP_CUE);};

const DEFAULT_BOUNDS={min:[-2.72,-.1,-5.72],max:[2.72,2.8,.15]};
/** Project the actual Y-up room coordinates: rear at the top, entrance below. */
export function roomMapPoint(position,bounds=DEFAULT_BOUNDS){
 const x=position?.[0]??0,z=position?.[2]??0;
 return {x:10+(x-bounds.min[0])/(bounds.max[0]-bounds.min[0])*220,y:10+(z-bounds.min[2])/(bounds.max[2]-bounds.min[2])*240};
}
export class AreaMap {
 constructor(element,{onOpenHouse=()=>{},onHouseUpdate=()=>{},readStaff=()=>null}={}){
  this.onHouseUpdate=onHouseUpdate;this.readStaff=readStaff;this.interiorId=null;this.contentClick=event=>{if(['house','training','analysis','interior'].includes(this.mode)){const button=event.target.closest('[data-house-map-open]');if(button)onOpenHouse(button);}};element.addEventListener('click',this.contentClick);
  this.element=element;this.content=element.querySelector('#areaMapContent');this.title=element.querySelector('#areaMapTitle');this.hint=element.querySelector('#areaMapHint');this.mode=null;this.markerKey=null;
 }
 showHouse(life,metadata){
  if(this.mode!=='house'){
   this.clearBattleLog();
   this.mode='house';this.element.dataset.area='house';this.title.textContent='おこていゆハウス';this.hint.textContent='';this.bounds=metadata?.roomBounds||DEFAULT_BOUNDS;
   this.buildHouse();this.markerKey=null;
  }
  const actor=life?.actor?.position?.toArray()||metadata?.life?.landmarks?.entrance?.position||[0,0,-.45];
  const companion=life?.companion?.position?.toArray()||[-.28,0,-.3];
  this.refreshStaff();
  const key=[...actor,...companion].map(v=>v.toFixed(3)).join('|');if(key===this.markerKey)return;this.markerKey=key;
  for(const [id,position]of [['roomMapOkoteiyu',actor],['roomMapMoai',companion]]){
   const p=roomMapPoint(position,this.bounds);this.content.querySelector('#'+id).setAttribute('transform',`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
  }
  this.onHouseUpdate(this.content.querySelector('svg'));
 }
 showPatrol(map){
  this.clearBattleLog();
  this.mode='patrol';this.element.dataset.area='patrol';this.title.textContent='道中マップ';this.hint.textContent='タップで拡大';addMapTapCue(map);this.content.replaceChildren(map);
 }
 showTraining(){
  this.clearBattleLog();
  this.mode='training';this.element.dataset.area='training';this.title.textContent='訓練所';this.hint.textContent='';
  this.content.innerHTML='<button class="area-map__house-trigger" data-house-map-open type="button" aria-label="訓練所の建物マップを開く" aria-haspopup="dialog" aria-controls="buildingMapDialog" aria-expanded="false">'+trainingMapSvg()+MAP_TAP_CUE+'</button>';this.refreshStaff();
 }
 showAnalysis(){
  this.clearBattleLog();
  this.mode='analysis';this.element.dataset.area='analysis';this.title.textContent='コンピュータ室';this.hint.textContent='';
  this.content.innerHTML='<button class="area-map__house-trigger" data-house-map-open type="button" aria-label="コンピュータ室の建物マップを開く" aria-haspopup="dialog" aria-controls="buildingMapDialog" aria-expanded="false">'+analysisMapSvg({compact:true,current:true})+MAP_TAP_CUE+'</button>';this.refreshStaff();
 }
 showInterior(id){
  const room=INTERIOR_ROOMS[id];if(!room||id==='analysis-room')return false;this.clearBattleLog();this.mode='interior';this.interiorId=id;this.element.dataset.area='interior';this.title.textContent=room.title;this.hint.textContent='';
  const drawing=id==='outdoor'?'<svg class="room-map" viewBox="'+OUTDOOR_MAP_VIEWBOX+'" role="img" aria-label="拠点の屋外の地図">'+outdoorMapDrawing({selected:'grounds'})+'</svg>':interiorMapSvg(id);
  this.content.innerHTML='<button class="area-map__house-trigger" data-house-map-open type="button" aria-label="'+room.title+'の建物マップを開く" aria-haspopup="dialog" aria-controls="buildingMapDialog" aria-expanded="false">'+drawing+MAP_TAP_CUE+'</button>';this.refreshStaff();return true;
 }
 refreshStaff(){
  const button=this.content.querySelector('[data-house-map-open]');if(!button)return false;
  const state=this.readStaff(),counts=state?getFacilityStaffCounts(state):{},key=JSON.stringify([this.mode,this.interiorId,counts]);
  if(this.staffKey===key&&this.staffButton===button)return false;this.staffKey=key;this.staffButton=button;
  button.querySelector(':scope > .area-map__staff-count')?.remove();
  const svg=button.querySelector(':scope > svg');svg?.querySelector('[data-mini-staff-counts]')?.remove();
  const scene=this.mode==='analysis'?'analysis-room':this.mode==='interior'?this.interiorId:null,count=counts[scene]||0;
  const base=button.getAttribute('data-label-without-staff')||button.getAttribute('aria-label');button.setAttribute('data-label-without-staff',base);button.setAttribute('aria-label',base+(count?'。従業員'+count+'人がいます':''));
  if(count){
   const badge=document.createElement('span');badge.className='area-map__staff-count';badge.dataset.staffRoom=scene;badge.dataset.staffCount=String(count);badge.setAttribute('aria-hidden','true');
   badge.innerHTML='<svg viewBox="0 0 80 34" focusable="false">'+staffCountDrawing(scene,count)+'</svg>';button.append(badge);
  }
  if(this.mode==='training'&&svg){
   const badges=[['guest-lounge',70,550,535,145],['management-room',650,550,250,145]].filter(([id])=>counts[id]).map(([id,x,y,w,h])=>staffCountDrawing(id,counts[id],{x:x+w-142,y:y+h-64,scale:1.65})).join('');
   if(badges)svg.insertAdjacentHTML('beforeend','<g data-mini-staff-counts="true" pointer-events="none">'+badges+'</g>');
  }
  return true;
 }
 showCamp(events=[]){this.clearBattleLog();this.mode='camp';this.element.dataset.area='camp';this.title.textContent='キャンプログ';this.hint.textContent='';this.battleLog=new CampLog(this.content);for(const event of events)this.battleLog.appendEvent(event);}
 showCampBase(map,name='キャンプ拠点'){this.clearBattleLog();this.mode='camp-base';this.element.dataset.area='camp-base';this.title.textContent=name;this.hint.textContent='タップで拡大';this.content.replaceChildren(map);addMapTapCue(map);}
 handleCampEvent(event){return this.mode==='camp'?this.battleLog?.appendEvent(event)??false:false;}
 handleBattleEvent(event){
  if(this.mode==='camp'&&(event?.battle?.kind==='camp'||event?.battle?.kind==='camp-final'||event?.type!=='battle-start'))return this.battleLog?.appendEvent(event)??false;
  if(event?.type==='battle-start'){
   this.clearBattleLog();this.mode='battle';this.element.dataset.area='battle';this.title.textContent='行動ログ';this.hint.textContent='';this.battleLog=new BattleLog(this.content,event.battle);
  }
  return this.mode==='battle'?this.battleLog?.appendEvent(event)??false:false;
 }
 clearBattleLog(){this.battleLog?.destroy();this.battleLog=null;}
 buildHouse(){
  const point=(x,z)=>roomMapPoint([x,0,z],this.bounds);
  const rect=(x1,z1,x2,z2,fill,stroke='#baac94',radius=3)=>{const a=point(x1,z1),b=point(x2,z2);return `<rect x="${a.x}" y="${a.y}" width="${b.x-a.x}" height="${b.y-a.y}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.1"/>`;};
  const bed=point(-.72,-5.12),chair=point(1.98,-4.8);
  // Physical model bounds, distinct from the character's stairsTop/Bottom anchors.
  const loft={minX:-2.595,maxX:2.595,minZ:-5.60,frontZ:-3.96},stairs={minX:-2.24,maxX:-1.52,minZ:-3.96,maxZ:-3.00};
  const railZ=-3.985,railStart=point(loft.minX,railZ),railEnd=point(loft.maxX,railZ),openingStart=point(-2.2525,railZ),openingEnd=point(-1.5075,railZ);
  this.content.innerHTML=`<button class="area-map__house-trigger" data-house-map-open type="button" aria-label="おこていゆハウスの建物マップを開く" aria-haspopup="dialog" aria-controls="buildingMapDialog" aria-expanded="false"><svg class="room-map" viewBox="7 7 226 248" role="img" aria-label="入口が下側、奥がロフトのお部屋の地図。おこていゆとモアイくんの現在位置">
   <defs><pattern id="roomMapFloor" width="18" height="24" patternUnits="userSpaceOnUse"><rect width="18" height="24" fill="#f6efdf"/><path d="M0 0H18M0 12H9M9 12V24M0 0V12" fill="none" stroke="#d7c6a7" stroke-width=".5"/></pattern></defs>
   <rect x="10" y="10" width="220" height="240" rx="6" fill="url(#roomMapFloor)"/>
   <g data-room-feature="loft">${rect(loft.minX,loft.minZ,loft.maxX,loft.frontZ,'#e6e8d9')}</g>
   ${rect(-1.15,-5.34,-.28,-4.55,'#fffdf6')}
   <rect x="${bed.x-12}" y="${bed.y-2}" width="24" height="10" rx="4" fill="#f3ebd8" stroke="#c4b496" stroke-width=".7"/>
   ${rect(1.60,-5.17,2.36,-4.39,'#c9d1be','#a8b394',7)}
   <path d="M${chair.x-8} ${chair.y+9}h16" stroke="#a5b18f" fill="none"/>
   <g data-room-feature="loft-stairs">${rect(stairs.minX,stairs.minZ,stairs.maxX,stairs.maxZ,'#e4d0ae')}
   ${[-3.64,-3.32].map(z=>{const a=point(stairs.minX,z),b=point(stairs.maxX,z);return `<path d="M${a.x} ${a.y}H${b.x}" stroke="#bda681"/>`;}).join('')}</g>
   <path data-room-feature="loft-rail" data-opening-start-x="${openingStart.x}" data-opening-end-x="${openingEnd.x}" d="M${railStart.x} ${railStart.y}H${openingStart.x}M${openingEnd.x} ${railEnd.y}H${railEnd.x}" stroke="#9fac8a" stroke-width="2" stroke-dasharray="3 3"/>
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
  </svg>${MAP_TAP_CUE}</button>`;
  this.houseSvg=this.content.querySelector('.room-map');
 }
}
