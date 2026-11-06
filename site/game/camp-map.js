import {CAMP_WORLD,CAMP_DESTINATIONS,CAMP_TERRAINS,getCampNode,getCampDestinationAt} from './camp-world.js';
import {createPatrolMap} from './patrol-map.js';
import {CampMapRenderer,campNodeScreenRadius,CAMP_DESTINATION_LABEL_MIN_ZOOM} from './camp-map-renderer.js';
import {getCampRegion} from './camp-regions.js';
import {CAMP_FAIRIES} from './camp-fairy-data.js';
const PATROL_MAP=createPatrolMap();
const PATROL_BY_ID=new Map(PATROL_MAP.nodes.map(node=>[node.id,node]));

const TERRAINS=Object.fromEntries(Object.entries(CAMP_TERRAINS).map(([id,value])=>[id,{label:value.label,color:value.color}]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const nodeAt=id=>getCampNode(id);
const nodes=CAMP_WORLD.nodes;
const bounds=CAMP_WORLD.bounds||{minX:Math.min(...nodes.map(n=>n.x)),minY:Math.min(...nodes.map(n=>n.y)),maxX:Math.max(...nodes.map(n=>n.x)),maxY:Math.max(...nodes.map(n=>n.y))};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

/** The atlas and expedition use one projection and one discovery mask. */
export class CampMap{
 constructor(element,{onCamp=()=>{},onNodeSelect=()=>{},onBaseSelect=()=>{},interactive=true,follow=false}={}){
  Object.assign(this,{element,onCamp,onNodeSelect,onBaseSelect,interactive,follow});this.discovered=new Set();this.pointers=new Map();this.zoom=1;this.pan={x:0,y:0};this.state={};this.bases=[];this.baseRoutes=[];this.baseKey='';this.dirty=true;this.pendingDraw=true;this.visible=false;this.autoFollow=follow;this.destroyed=false;
  this.root=document.createElement('div');this.root.className='camp-map';this.root.dataset.interactive=String(interactive);
  this.canvas=document.createElement('canvas');this.canvas.className='camp-map__canvas';this.canvas.tabIndex=interactive?0:-1;this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','森林の奥へ続くワールドマップ。未到達の土地には黒い雲がかかっています。');
  this.root.append(this.canvas);element.append(this.root);this.context=this.canvas.getContext('2d');this.staticCanvas=document.createElement('canvas');this.staticContext=this.staticCanvas.getContext('2d');this.renderer=new CampMapRenderer({onInvalidate:()=>{if(!this.destroyed)this.invalidate();}});
  this.baseIcon=new Image();this.baseIcon.onload=()=>{if(!this.destroyed)this.invalidate();};this.baseIcon.src=new URL('./assets/camp-base/base-icon.png',import.meta.url).href;
  this.patrolBackground=new Image();this.patrolBackground.onload=()=>{if(!this.destroyed)this.invalidate();};this.patrolBackground.src=new URL(PATROL_MAP.backgroundUrl,import.meta.url).href;
  this.controls=document.createElement('div');this.controls.className='camp-map__controls';this.controls.innerHTML='<button type="button" data-camp-zoom="in" aria-label="マップを拡大">＋</button><button type="button" data-camp-zoom="out" aria-label="マップを縮小">−</button><button type="button" data-camp-zoom="current" aria-label="現在位置を表示">◎</button><button type="button" data-camp-zoom="all" aria-label="マップ全体を表示">全体</button>';this.root.append(this.controls);
  this.legend=document.createElement('div');this.legend.className='camp-map__legend';this.legend.innerHTML=Object.entries(TERRAINS).map(([id,t])=>'<span><i style="--terrain:'+t.color+'"></i>'+t.label+'</span>').join('');this.legend.insertAdjacentHTML('beforeend','<span><img class="camp-map__legend-base" src="'+new URL('./assets/camp-base/base-icon.png',import.meta.url).href+'" alt="">キャンプ拠点</span><span><b class="camp-map__legend-route" aria-hidden="true">➜</b>拠点間の探索最適経路</span>');this.root.append(this.legend);
  this.note=document.createElement('div');this.note.className='camp-map__place';this.note.textContent='未開の地';this.root.append(this.note);
  this.clickControls=event=>{const action=event.target.closest('[data-camp-zoom]')?.dataset.campZoom;if(!action)return;event.stopPropagation();if(action==='all')this.fitAll();else if(action==='current')this.centerCurrent();else this.scaleAt(action==='in'?1.4:1/1.4);};this.controls.addEventListener('click',this.clickControls);
  this.pointerDown=event=>this.onPointerDown(event);this.pointerMove=event=>this.onPointerMove(event);this.pointerUp=event=>this.onPointerUp(event);this.canvasClick=event=>this.onCanvasClick(event);this.wheel=event=>{this.tapCandidate=null;if(!this.interactive)return;event.preventDefault();if(this.fairySelection)return;const r=this.canvas.getBoundingClientRect();this.scaleAt(Math.exp(-clamp(event.deltaY,-100,100)*.005),{x:event.clientX-r.left,y:event.clientY-r.top});};
  this.keyDown=event=>{this.tapCandidate=null;if(!this.interactive||this.fairySelection)return;const delta={ArrowLeft:[45,0],ArrowRight:[-45,0],ArrowUp:[0,45],ArrowDown:[0,-45]}[event.key];if(delta){event.preventDefault();this.autoFollow=false;this.pan.x+=delta[0];this.pan.y+=delta[1];if(this.follow)this.ensureVisible();this.invalidate();}else if(['+','=','-','Home'].includes(event.key)){event.preventDefault();if(event.key==='Home')this.centerCurrent();else this.scaleAt(event.key==='-'?1/1.3:1.3);}};
  for(const [name,handler]of [['pointerdown',this.pointerDown],['pointermove',this.pointerMove],['pointerup',this.pointerUp],['pointercancel',this.pointerUp],['click',this.canvasClick],['keydown',this.keyDown]])this.canvas.addEventListener(name,handler);
  this.canvas.addEventListener('wheel',this.wheel,{passive:false});this.visibilityChange=()=>{if(!document.hidden&&(this.pendingDraw||this.dirty))this.requestDraw();};document.addEventListener('visibilitychange',this.visibilityChange);this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(element);this.resize();
 }
 update(state={}){
  const before=this.drawStateKey;this.state={...this.state,...state};
  if(Object.hasOwn(state,'bases')||Object.hasOwn(state,'baseRoutes')){
   const bases=state.bases??this.bases,routes=state.baseRoutes??this.baseRoutes,key=JSON.stringify([bases,routes]);
   if(key!==this.baseKey){this.baseKey=key;this.bases=Array.isArray(bases)?bases:[];this.baseRoutes=Array.isArray(routes)?routes:[];this.routeArrows=campBaseRouteArrows(this.baseRoutes);this.routeEdges=campBaseRouteEdges(this.routeArrows);this.dirty=true;if(this.noteNodeId)this.note.textContent=this.describeNode(nodeAt(this.noteNodeId));}
  }
  const visited=state.discovered??state.visited;
  if(visited){
   const values=visited instanceof Set?[...visited]:Array.isArray(visited)?visited:Object.keys(visited),next=new Set(values);
   if(next.size!==this.discovered.size||[...next].some(id=>!this.discovered.has(id))){this.discovered=next;this.discoveryKey=values.join('|');this.renderer.setDiscovered(next);this.dirty=true;if(this.noteNodeId)this.note.textContent=this.describeNode(nodeAt(this.noteNodeId));}
  }
  if(Object.hasOwn(state,'nodeId')){this.noteNodeId=null;const current=nodeAt(state.nodeId),region=getCampRegion(current?.regionId);if(region)this.note.textContent=region.name;}
  const s=this.state;this.drawStateKey=[s.nodeId||CAMP_WORLD.startId,s.nextNodeId||'',clamp(Number(s.travelProgress)||0,0,1),s.phase||'',s.day??'',s.targetId||'',JSON.stringify(s.fairyMarks||[])].join('|');
  if(before===this.drawStateKey&&!this.dirty)return;
  if((this.follow||this.autoFollow)&&this.width)this.ensureVisible();this.requestDraw();
 }
 resize(){
  const r=this.element.getBoundingClientRect();this.visible=r.width>0&&r.height>0&&this.element.isConnected;
  if(!this.visible){cancelAnimationFrame(this.raf);this.raf=0;return;}
  const width=Math.max(1,r.width),height=Math.max(1,r.height),dpr=Math.min(2,window.devicePixelRatio||1),changed=this.width!==width||this.height!==height||this.dpr!==dpr;
  this.width=width;this.height=height;this.dpr=dpr;
  if(changed){for(const canvas of [this.canvas,this.staticCanvas]){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}this.backgroundGradient=null;}
  if(this.fairySelection){this.frameFairySelection();return;}if(!this.initialized){this.initialized=true;this.centerCurrent();}else if(this.follow)this.ensureVisible();this.invalidate();
 }
 currentPoint(){const a=nodeAt(this.state.nodeId||CAMP_WORLD.startId)||nodes[0],b=nodeAt(this.state.nextNodeId),t=clamp(Number(this.state.travelProgress)||0,0,1);return b?{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}:a;}
 centerCurrent(){this.autoFollow=this.follow;const point=this.currentPoint();this.zoom=clamp(Math.min(this.width,this.height)/620,.16,1.4);this.pan={x:this.width*(this.follow?0.62:0.54)-point.x*this.zoom,y:this.height*.56-point.y*this.zoom};this.invalidate();}
 fitAll(){this.autoFollow=false;const patrolDepth=430;this.zoom=Math.min((this.width-36)/(bounds.maxX-bounds.minX+180),(this.height-54)/(bounds.maxY-bounds.minY+patrolDepth));this.zoom=clamp(this.zoom,.025,2.4);this.pan={x:(this.width-(bounds.maxX-bounds.minX)*this.zoom)/2-bounds.minX*this.zoom,y:25-bounds.minY*this.zoom};this.invalidate();}
 scaleAt(factor,position={x:this.width/2,y:this.height/2}){this.autoFollow=false;const old=this.zoom,next=clamp(old*factor,.025,2.4);this.pan.x=position.x-(position.x-this.pan.x)*next/old;this.pan.y=position.y-(position.y-this.pan.y)*next/old;this.zoom=next;if(this.follow)this.ensureVisible();this.invalidate();}
 ensureVisible(){if(this.fairySelection)return;const point=this.currentPoint();if(this.follow){const x=this.width*.62-point.x*this.zoom,y=this.height*.56-point.y*this.zoom;if(Math.abs(this.pan.x-x)>.01||Math.abs(this.pan.y-y)>.01){this.pan={x,y};this.dirty=true;}this.autoFollow=true;return;}const p=this.project(point),marginX=Math.min(125,this.width*.30),marginY=Math.min(100,this.height*.25);let moved=false;if(p.x<marginX){this.pan.x+=marginX-p.x;moved=true;}if(p.x>this.width-marginX){this.pan.x+=this.width-marginX-p.x;moved=true;}if(p.y<marginY){this.pan.y+=marginY-p.y;moved=true;}if(p.y>this.height-marginY){this.pan.y+=this.height-marginY-p.y;moved=true;}if(moved)this.dirty=true;}
 project(point){return{x:point.x*this.zoom+this.pan.x,y:point.y*this.zoom+this.pan.y};}
 setFairySelection(selection){
  if(!selection){
   this.fairySelection=null;this.fairyFlight=null;this.fairyTargets?.replaceChildren();
   if(this.fairyCamera){const old=this.fairyCamera;this.zoom=old.zoom;this.pan={...old.pan};this.autoFollow=old.autoFollow;this.fairyCamera=null;if(this.follow||this.autoFollow)this.ensureVisible();}
   this.root.classList.remove('is-fairy-selecting');this.invalidate();return;
  }
  if(!this.fairyCamera)this.fairyCamera={zoom:this.zoom,pan:{...this.pan},autoFollow:this.autoFollow};
  this.fairySelection=selection;this.root.classList.add('is-fairy-selecting');this.root.style.setProperty('--camp-fairy-color',CAMP_FAIRIES[selection.kind].color);
  if(!this.fairyTargets){this.fairyTargets=document.createElement('div');this.fairyTargets.className='camp-map__fairy-targets';this.root.append(this.fairyTargets);}
  this.fairyTargets.replaceChildren();
  if(selection.mode!=='flight')for(const [i,id]of selection.nodeIds.entries()){
   const node=nodeAt(id);if(!node)continue;const button=document.createElement('button');button.type='button';button.className='camp-map__fairy-target';button.dataset.campFairyNode=id;button.textContent=String(i+1);
   button.setAttribute('aria-label',(i+1)+'、'+(this.discovered.has(id)?TERRAINS[node.terrain]?.label||'通常の地点':'未到達の地点')+'に'+CAMP_FAIRIES[selection.kind].name+'をお願いする');button.title=button.getAttribute('aria-label');
   button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(this.fairySelection?.mode!=='flight')this.fairySelection?.onSelect?.(id);});this.fairyTargets.append(button);
  }
  this.frameFairySelection();
 }
 frameFairySelection(){
  const selection=this.fairySelection,center=nodeAt(selection?.junctionId);if(!center||!this.width)return;
  const points=[center,...selection.nodeIds.map(nodeAt).filter(Boolean)],dx=Math.max(25,...points.map(p=>Math.abs(p.x-center.x))),dy=Math.max(25,...points.map(p=>Math.abs(p.y-center.y)));
  this.zoom=clamp(Math.min((this.width-76)/(dx*2),Math.max(50,this.height-110)/(dy*2)),.025,2.4);this.pan={x:this.width*.5-center.x*this.zoom,y:this.height*.49-center.y*this.zoom};this.invalidate();
 }
 setFairyFlight(flight){this.fairyFlight=flight;this.requestDraw();}
 drawFairyMarks(c){
  this.fairyMarkersDrawn=[];const groups=new Map();
  for(const mark of this.state.fairyMarks||[]){if(this.fairyFlight?.kind===mark.kind&&this.fairyFlight.progress<.7)continue;const key=[mark.fromNodeId,mark.toNodeId].sort().join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mark);}
  for(const marks of groups.values())for(const [index,mark]of marks.entries()){
   const fairy=CAMP_FAIRIES[mark.kind],a=nodeAt(mark.fromNodeId),b=nodeAt(mark.toNodeId);if(!fairy||!a?.neighbors.includes(b?.id))continue;
   const p=this.project(a.id<b.id?a:b),q=this.project(a.id<b.id?b:a),t=.5+(index-(marks.length-1)/2)*Math.min(.4,34/Math.max(1,Math.hypot(q.x-p.x,q.y-p.y))),mid={x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t};c.save();c.globalAlpha=mark.active?1:.60;c.strokeStyle=mark.active?fairy.color:'#8b9287';c.lineWidth=mark.active?4:2;c.setLineDash(mark.active?[]:[4,4]);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();c.setLineDash([]);c.fillStyle=mark.active?'#fffdf5':'#edf0e8';c.lineWidth=1.3;c.beginPath();c.roundRect(mid.x-15,mid.y-13,30,26,8);c.fill();c.stroke();c.font='19px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(fairy.icon,mid.x,mid.y+1);c.restore();this.fairyMarkersDrawn.push({...mark,x:mid.x,y:mid.y});
  }
 }
 drawFairySelection(c){
  const selection=this.fairySelection,center=nodeAt(selection?.junctionId);if(!center)return;const p=this.project(center);c.save();c.strokeStyle='#ebca7c';c.fillStyle='#fff7d3';c.lineWidth=3;c.beginPath();c.arc(p.x,p.y,13,0,Math.PI*2);c.fill();c.stroke();
  const targets=selection.nodeIds.map(id=>({id,...this.project(nodeAt(id))}));
  for(let k=0;k<18;k++)for(let i=0;i<targets.length;i++)for(let j=i+1;j<targets.length;j++){const a=targets[i],b=targets[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<39){const ux=d>.1?dx/d:1,uy=d>.1?dy/d:0,shift=(39-d)/2;a.x-=ux*shift;a.y-=uy*shift;b.x+=ux*shift;b.y+=uy*shift;}}
  this.fairyTargetPositions=targets.map(point=>({...point,x:clamp(point.x,24,this.width-24),y:clamp(point.y,Math.min(65,this.height*.18),this.height-Math.min(67,this.height*.18))}));
  for(const target of this.fairyTargetPositions){const q=this.project(nodeAt(target.id));c.strokeStyle='#fff9df';c.lineWidth=5;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();c.strokeStyle=CAMP_FAIRIES[selection.kind].color;c.lineWidth=2;c.stroke();c.setLineDash([2,3]);c.beginPath();c.moveTo(q.x,q.y);c.lineTo(target.x,target.y);c.stroke();c.setLineDash([]);const button=this.fairyTargets?.querySelector('[data-camp-fairy-node="'+target.id+'"]');if(button){button.style.left=target.x+'px';button.style.top=target.y+'px';}}
  c.restore();
 }
 drawFairyFlight(c){
  const flight=this.fairyFlight,goal=nodeAt(flight?.toNodeId);if(!flight||!goal)return;const a=this.project(flight.fromPoint),b=this.project(goal),t=clamp(flight.progress,0,1),u=t*t*(3-2*t),x=a.x+(b.x-a.x)*u,y=a.y+(b.y-a.y)*u-Math.sin(t*Math.PI)*Math.min(60,Math.hypot(b.x-a.x,b.y-a.y)*.3);c.save();c.translate(x,y);c.fillStyle='#ffffffdb';for(const sign of [-1,1]){c.beginPath();c.ellipse(sign*15,-5,10,5,sign*.5,0,Math.PI*2);c.fill();}c.font='27px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(CAMP_FAIRIES[flight.kind].icon,0,0);c.restore();
 }
 unproject(point){return{x:(point.x-this.pan.x)/this.zoom,y:(point.y-this.pan.y)/this.zoom};}
 invalidate(){this.dirty=true;this.requestDraw();}
 requestDraw(){this.pendingDraw=true;if(this.destroyed||this.raf||!this.visible||document.hidden||!this.element.isConnected)return;this.raf=requestAnimationFrame(()=>{this.raf=0;this.draw();});}
 onPointerDown(event){
  this.tapCandidate=null;if(!this.interactive||event.button!==0)return;
  this.canvas.setPointerCapture?.(event.pointerId);this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});this.startPointer={x:event.clientX,y:event.clientY};this.lastPointer={x:event.clientX,y:event.clientY};this.moved=false;
  if(this.pointers.size>1){this.moved=true;if(this.pointers.size===2){const p=[...this.pointers.values()];this.pinchDistance=distance(p[0],p[1]);}}
  event.preventDefault();
 }
 onPointerMove(event){if(!this.pointers.has(event.pointerId))return;if(this.fairySelection){this.moved ||=Math.hypot(event.clientX-this.startPointer.x,event.clientY-this.startPointer.y)>6||this.pointers.size>1;return;}this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});this.autoFollow=false;if(this.pointers.size===2){const p=[...this.pointers.values()],d=distance(p[0],p[1]);if(this.pinchDistance>0){const r=this.canvas.getBoundingClientRect();this.scaleAt(d/this.pinchDistance,{x:(p[0].x+p[1].x)/2-r.left,y:(p[0].y+p[1].y)/2-r.top});}this.pinchDistance=d;this.moved=true;}else{this.pan.x+=event.clientX-this.lastPointer.x;this.pan.y+=event.clientY-this.lastPointer.y;this.moved ||=Math.hypot(event.clientX-this.startPointer.x,event.clientY-this.startPointer.y)>6;this.invalidate();}if(this.follow)this.ensureVisible();if(this.moved)this.tapCandidate=null;this.lastPointer={x:event.clientX,y:event.clientY};}
 onPointerUp(event){
  if(!this.pointers.has(event.pointerId))return;
  const wasSingle=this.pointers.size===1;this.pointers.delete(event.pointerId);this.tapCandidate=null;
  if(event.type==='pointerup'&&wasSingle&&!this.moved){const r=this.canvas.getBoundingClientRect();this.tapCandidate={x:event.clientX-r.left,y:event.clientY-r.top};}
  if(this.pointers.size===1){const p=[...this.pointers.values()][0];this.lastPointer=p;this.startPointer=p;this.moved=true;}
  this.pinchDistance=0;
 }
 onCanvasClick(event){
  // Compact maps are buttons owned by their host. Let its click handler open
  // the atlas; only the interactive atlas consumes pointer navigation here.
  if(!this.interactive){this.tapCandidate=null;return;}
  // Commit navigation after the click target/path is fixed. Opening the next
  // dialog during pointerup lets a touch's later compatibility click hit it.
  event.preventDefault();event.stopPropagation();const candidate=this.tapCandidate;this.tapCandidate=null;
  if(this.interactive&&candidate&&!this.pointers.size&&!this.destroyed)this.tap(candidate);
 }
 describeNode(node){const base=node&&this.bases.find(base=>base.nodeId===node.id);if(base)return base.name+(base.foundation?' · キャンプ基礎拠点':base.frontier?' · フロンティア拠点':' · キャンプ拠点');return node&&this.discovered.has(node.id)?(getCampDestinationAt(node.id)?getCampDestinationAt(node.id).name+' · 登録地点':null)||(getCampRegion(node.regionId)?.name||'未開の地')+' · 道中地点 · '+(TERRAINS[node.terrain]?.label||'通常'):'まだ訪れていない土地';}
 tap(point){
  if(this.fairySelection){if(this.fairySelection.mode==='flight')return;const target=(this.fairyTargetPositions||[]).find(p=>Math.hypot(p.x-point.x,p.y-point.y)<24);if(target)this.fairySelection.onSelect?.(target.id);return;}
  // Base markers own their tap: do not also open the packing page beneath it.
  let selectedBase=null,baseDistance=25;for(const base of this.bases){const node=nodeAt(base.nodeId);if(!node)continue;const p=this.project(node),d=Math.hypot(p.x-point.x,p.y-point.y);if(d<baseDistance){selectedBase=base;baseDistance=d;}}
  if(selectedBase){this.noteNodeId=selectedBase.nodeId;this.note.textContent=this.describeNode(nodeAt(selectedBase.nodeId));this.onBaseSelect(selectedBase);return;}
  const start=nodeAt(CAMP_WORLD.startId)||nodes[0],s=this.project(start),rect=this.patrolRect();if(Math.hypot(point.x-s.x,point.y-s.y)<24||point.x>=rect.x&&point.x<=rect.x+rect.w&&point.y>=rect.y&&point.y<=rect.y+rect.h){this.onCamp({nodeId:CAMP_WORLD.startId});return;}let best=null,bestD=20;for(const node of nodes){const p=this.project(node),d=Math.hypot(p.x-point.x,p.y-point.y);if(d<bestD){bestD=d;best=node;}}if(best){this.onNodeSelect(best);this.noteNodeId=best.id;this.note.textContent=this.describeNode(best);}this.onCamp({nodeId:best?.id??null,source:best?'node':'terrain'});}
 patrolRect(){const start=nodeAt(CAMP_WORLD.startId)||nodes[0],p=this.project({x:start.x-210,y:start.y+85});return{x:p.x,y:p.y,w:420*this.zoom,h:300*this.zoom};}
 drawStatic(){
  const c=this.staticContext;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.width,this.height);
  if(!this.backgroundGradient){const bg=c.createLinearGradient(0,0,this.width,this.height);bg.addColorStop(0,'#e8edda');bg.addColorStop(1,'#d7e0c7');this.backgroundGradient=bg;}
  c.fillStyle=this.backgroundGradient;c.fillRect(0,0,this.width,this.height);this.renderer.drawBackground(c,this);this.renderer.drawNetwork(c,this);this.drawFog(c);this.renderer.drawRegionLabels(c,this);this.drawPatrol(c);
  this.drawBaseRouteArrows(c);this.drawDestinationLabels(c);this.drawBases(c);
  this.dirty=false;
 }
 drawDestinationLabels(c){
  this.destinationLabelsDrawn=[];this.registeredMarkersDrawn=[];const occupied=[...(this.renderer.regionLabelBoxes||[])],overlaps=(a,b)=>a.left<b.right+4&&a.right>b.left-4&&a.top<b.bottom+4&&a.bottom>b.top-4;
  const destinations=Object.values(CAMP_DESTINATIONS).sort((a,b)=>Number(b.nodeId===this.state.nodeId||b.nodeId===this.state.targetId)-Number(a.nodeId===this.state.nodeId||a.nodeId===this.state.targetId));
  for(const destination of destinations){
   if(!destination.nodeId||!this.discovered.has(destination.nodeId))continue;
   const node=nodeAt(destination.nodeId);if(!node)continue;const p=this.project(node);if(p.x<-100||p.x>this.width+100||p.y<-50||p.y>this.height+50)continue;
   const radius=Math.max(4.5,Math.min(15,campNodeScreenRadius(this.zoom)*1.2));
   // Reached registered places keep a distinct diamond at overview. Their names
   // return at detail scale; unknown places never acquire a label or marker.
   c.save();c.lineJoin='round';c.beginPath();c.moveTo(p.x,p.y-radius);c.lineTo(p.x+radius,p.y);c.lineTo(p.x,p.y+radius);c.lineTo(p.x-radius,p.y);c.closePath();c.fillStyle='#e7bd69';c.fill();c.strokeStyle='#fff8e1';c.lineWidth=3;c.stroke();c.strokeStyle='#8d6d38';c.lineWidth=1.1;c.stroke();this.registeredMarkersDrawn.push(destination.id);
   if(this.zoom<CAMP_DESTINATION_LABEL_MIN_ZOOM){c.restore();continue;}
   c.font='600 11px sans-serif';const width=Math.max(68,c.measureText(destination.name).width+18),box={left:p.x-width/2,right:p.x+width/2,top:p.y-radius-26,bottom:p.y-radius-3};
   if(!occupied.some(rect=>overlaps(box,rect))){c.fillStyle='#fdf5d8';c.strokeStyle='#9d8259';c.lineWidth=1;c.beginPath();c.roundRect(box.left,box.top,width,23,6);c.fill();c.stroke();c.textAlign='center';c.fillStyle='#6d583d';c.fillText(destination.name,p.x,box.bottom-7);c.beginPath();c.moveTo(p.x,box.bottom);c.lineTo(p.x,p.y-radius);c.stroke();occupied.push(box);this.destinationLabelsDrawn.push(destination.id);}c.restore();
  }
 }
 drawBaseRouteArrows(c){
  // Every stroke follows an actual map edge. The virtual network link itself
  // is never rendered; reciprocal directions use separate lanes on that edge.
  this.baseArrowsDrawn=0;this.baseRouteEdgesDrawn=0;this.baseRouteShaftsDrawn=0;c.save();c.lineCap='round';c.lineJoin='round';
  const radius=campNodeScreenRadius(this.zoom),segments=new Map(),visible=(p,q)=>!(Math.max(p.x,q.x)<-18||Math.min(p.x,q.x)>this.width+18||Math.max(p.y,q.y)<-18||Math.min(p.y,q.y)>this.height+18);
  for(const edge of this.routeEdges||[]){
   const a=nodeAt(edge.from),b=nodeAt(edge.to);if(!a||!b)continue;const p=this.project(a),q=this.project(b);if(!visible(p,q))continue;
   const length=Math.hypot(q.x-p.x,q.y-p.y);if(length<1)continue;const ux=(q.x-p.x)/length,uy=(q.y-p.y)/length,padding=Math.min(radius+1,length*.18),x=p.x+ux*padding,y=p.y+uy*padding,ex=q.x-ux*padding,ey=q.y-uy*padding;
   c.beginPath();c.moveTo(x,y);c.lineTo(ex,ey);c.strokeStyle='#fff5d6';c.lineWidth=edge.paired?8.4:6.4;c.stroke();c.strokeStyle='#e7c979';c.lineWidth=edge.paired?5.7:3.9;c.stroke();this.baseRouteEdgesDrawn++;
   segments.set(edge.key,{p,q,length,ux,uy});
  }
  for(const arrow of this.routeArrows||[]){
   const key=[arrow.from,arrow.to].sort().join('>'),edge=segments.get(key);if(!edge)continue;
   const a=nodeAt(arrow.from),b=nodeAt(arrow.to),p=this.project(a),q=this.project(b),length=edge.length,ux=(q.x-p.x)/length,uy=(q.y-p.y)/length;
   const lane=arrow.paired?Math.min(2.35,length*.08):0,padding=Math.min(radius+3,length*.22),available=length-padding*2;if(available<1)continue;
   const x=p.x+ux*padding-uy*lane,y=p.y+uy*padding+ux*lane,ex=q.x-ux*padding-uy*lane,ey=q.y-uy*padding+ux*lane;
   c.beginPath();c.moveTo(x,y);c.lineTo(ex,ey);c.strokeStyle='#fffbea';c.lineWidth=3.6;c.stroke();c.strokeStyle=arrow.paired&&arrow.from>arrow.to?'#94602f':'#365f65';c.lineWidth=1.8;c.stroke();this.baseRouteShaftsDrawn++;
   // Long edges carry repeated arrowheads; even a short edge retains a shaft.
   const heads=available>105?Math.min(4,Math.floor(available/70)):1,size=Math.min(5,Math.max(1.2,available*.20));
   for(let i=1;i<=heads;i++){const t=heads===1?.72:i/(heads+1),hx=x+(ex-x)*t,hy=y+(ey-y)*t;c.beginPath();c.moveTo(hx-ux*size-uy*size*.67,hy-uy*size+ux*size*.67);c.lineTo(hx,hy);c.lineTo(hx-ux*size+uy*size*.67,hy-uy*size-ux*size*.67);c.strokeStyle='#fffbea';c.lineWidth=3.7;c.stroke();c.strokeStyle=arrow.paired&&arrow.from>arrow.to?'#94602f':'#365f65';c.lineWidth=1.85;c.stroke();}
   this.baseArrowsDrawn++;
  }c.restore();
 }
 drawBases(c){
  // Overview markers shrink together, including their ring and frontier dot.
  // The independent 25px nearest-base tap radius stays comfortably selectable.
  this.basesDrawn=[];const current=this.state.nodeId,scale=clamp(Math.sqrt(Math.max(.001,this.zoom)/.16),.35,1);
  for(const base of this.bases){const node=nodeAt(base.nodeId);if(!node)continue;const p=this.project(node);if(p.x<-50||p.x>this.width+50||p.y<-50||p.y>this.height+50)continue;const size=base.foundation?29:27;c.save();c.translate(p.x,p.y);c.scale(scale,scale);c.fillStyle=current===node.id?'#fff9dc':'#f8f7e8';c.strokeStyle=base.frontier?'#bd9457':'#829782';c.lineWidth=base.frontier?1.8:1;c.beginPath();c.arc(0,0,size*.58,0,Math.PI*2);c.fill();c.stroke();
   if(this.baseIcon.complete&&this.baseIcon.naturalWidth)c.drawImage(this.baseIcon,-size/2,-size/2,size,size);else{c.fillStyle='#a1a4a0';c.strokeStyle='#707e74';c.beginPath();c.arc(0,4,10,Math.PI,0);c.lineTo(10,8);c.lineTo(-10,8);c.closePath();c.fill();c.stroke();c.fillStyle='#3f4d44';c.beginPath();c.arc(0,5,4,Math.PI,0);c.lineTo(4,9);c.lineTo(-4,9);c.closePath();c.fill();}
   if(base.foundation&&this.zoom>=CAMP_DESTINATION_LABEL_MIN_ZOOM){c.fillStyle='#617455';c.font='600 9px sans-serif';c.textAlign='center';c.fillText('基礎拠点',0,25);}else if(base.frontier){c.fillStyle='#a7814a';c.beginPath();c.arc(12,-11,3.5,0,Math.PI*2);c.fill();}c.restore();this.basesDrawn.push(base.id);
  }
 }
 drawFog(target){this.renderer.drawFog(target,this);}
 drawPatrol(c){const rect=this.patrolRect();if(rect.y>this.height+40||rect.y+rect.h<-40)return;const start=this.project(nodeAt(CAMP_WORLD.startId)||nodes[0]);c.strokeStyle='#7f9168';c.setLineDash([3,4]);c.beginPath();c.moveTo(start.x,start.y+9);c.lineTo(start.x,rect.y);c.stroke();c.setLineDash([]);c.fillStyle='#f4efd8';c.strokeStyle='#acb990';c.lineWidth=1;c.beginPath();c.roundRect(rect.x,rect.y,rect.w,rect.h,Math.min(16,rect.w*.05));c.fill();c.stroke();const h=rect.h;if(this.patrolBackground.complete&&this.patrolBackground.naturalWidth){c.save();c.clip();c.drawImage(this.patrolBackground,rect.x,rect.y,rect.w,rect.h);c.restore();c.stroke();}if(rect.w>90){c.save();c.globalAlpha=.35;c.strokeStyle='#7c806d';c.lineWidth=.7;for(const [a,b] of PATROL_MAP.edges){const pa=PATROL_BY_ID.get(a),pb=PATROL_BY_ID.get(b);c.beginPath();c.moveTo(rect.x+pa.x*rect.w,rect.y+pa.y*h);c.lineTo(rect.x+pb.x*rect.w,rect.y+pb.y*h);c.stroke();}for(const node of PATROL_MAP.nodes){c.fillStyle=node.id==='home'?'#ba8277':'#fffef3';c.beginPath();c.arc(rect.x+node.x*rect.w,rect.y+node.y*h,node.id==='home'?3:1.5,0,Math.PI*2);c.fill();}c.restore();}if(rect.w>95){const a=this.project(nodeAt(CAMP_WORLD.startId)||nodes[0]);c.fillStyle='#fffff3';c.strokeStyle='#8c9c70';c.beginPath();c.roundRect(a.x-58,a.y+14,116,25,8);c.fill();c.stroke();c.font='600 11px sans-serif';c.fillStyle='#526545';c.textAlign='center';c.fillText('キャンプへ出発',a.x,a.y+31);}}
 draw(){if(this.destroyed||!this.width||!this.visible||document.hidden)return;this.pendingDraw=false;if(this.dirty)this.drawStatic();const c=this.context;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.canvas.width,this.canvas.height);c.drawImage(this.staticCanvas,0,0);c.setTransform(this.dpr,0,0,this.dpr,0,0);const node=this.currentPoint(),p=this.project(node),target=nodeAt(this.state.nextNodeId);if(target){const q=this.project(target);c.strokeStyle='#ebc674';c.lineWidth=3;c.setLineDash([4,5]);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();c.setLineDash([]);}this.drawFairyMarks(c);this.drawFairySelection(c);this.drawOkoteiyu(c,p);this.drawFairyFlight(c);const phase=this.state.phase;if(phase==='night'){c.fillStyle='#192a3d66';c.fillRect(0,0,this.width,this.height);}const label=(this.fairySelection?'探索を一時停止しています。到着予定の分かれ道の、番号付きの隣接地点を選んでください。':'ワールドマップ。')+(this.state.day?this.state.day+'日目。':'')+'現在位置と、到達した土地を表示。ドラッグで移動、ピンチまたは＋−で拡大縮小。';if(this.canvas.getAttribute('aria-label')!==label)this.canvas.setAttribute('aria-label',label);}
 drawOkoteiyu(c,p){const r=11;c.save();c.translate(p.x,p.y);c.fillStyle='#4d5d4220';c.beginPath();c.ellipse(0,12,13,4,0,0,Math.PI*2);c.fill();c.fillStyle='#fff1df';c.strokeStyle='#b19c7f';c.lineWidth=1.25;c.beginPath();c.moveTo(-r,8);c.lineTo(-r,-1);c.bezierCurveTo(-r,-15,r,-15,r,-1);c.lineTo(r,8);c.quadraticCurveTo(0,14,-r,8);c.fill();c.stroke();c.strokeStyle='#685f54';c.lineWidth=1.5;for(const x of [-4,4]){c.beginPath();c.moveTo(x-2,-1);c.lineTo(x+2,-1);c.stroke();}c.beginPath();c.moveTo(-2,6);c.lineTo(0,4.5);c.lineTo(2,6);c.stroke();c.strokeStyle='#dc9d9e';c.lineWidth=1.2;for(const x of [-7,7]){c.beginPath();c.arc(x,3,1.8,0,Math.PI*1.7);c.stroke();}c.restore();}
 destroy(){this.destroyed=true;this.baseIcon.onload=null;this.patrolBackground.onload=null;cancelAnimationFrame(this.raf);this.observer.disconnect();this.renderer.destroy();document.removeEventListener('visibilitychange',this.visibilityChange);this.controls.removeEventListener('click',this.clickControls);for(const [name,handler]of [['pointerdown',this.pointerDown],['pointermove',this.pointerMove],['pointerup',this.pointerUp],['pointercancel',this.pointerUp],['click',this.canvasClick],['keydown',this.keyDown]])this.canvas.removeEventListener(name,handler);this.canvas.removeEventListener('wheel',this.wheel);this.root.remove();}
}
export const CAMP_TERRAIN_LABELS=Object.freeze(Object.fromEntries(Object.entries(TERRAINS).map(([id,value])=>[id,value.label])));

/** Deduplicate real directed edges shared by several base-network paths. */
export function campBaseRouteArrows(routes=[]){
 const directed=new Map();for(const route of routes){const path=Array.isArray(route)?route:route?.path;if(!Array.isArray(path))continue;for(let i=1;i<path.length;i++){const from=path[i-1],to=path[i];if(typeof from!=='string'||typeof to!=='string'||from===to)continue;const a=nodeAt(from);if(!a?.neighbors?.includes(to))continue;directed.set(from+'>'+to,{from,to});}}
 return [...directed.values()].map(arrow=>({...arrow,paired:directed.has(arrow.to+'>'+arrow.from)}));
}

/** The undirected highlight is shared even when several routes use an edge. */
export function campBaseRouteEdges(arrows=[]){
 const unique=new Map();for(const arrow of arrows){const key=[arrow.from,arrow.to].sort().join('>');if(!unique.has(key))unique.set(key,{from:arrow.from,to:arrow.to,paired:arrow.paired,key});}
 return [...unique.values()];
}
