import {CAMP_WORLD,CAMP_DESTINATIONS,CAMP_TERRAINS,getCampNode} from './camp-world.js';
import {createPatrolMap} from './patrol-map.js';
import {CampMapRenderer} from './camp-map-renderer.js';
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
 constructor(element,{onCamp=()=>{},onNodeSelect=()=>{},interactive=true,follow=false}={}){
  Object.assign(this,{element,onCamp,onNodeSelect,interactive,follow});this.discovered=new Set();this.pointers=new Map();this.zoom=1;this.pan={x:0,y:0};this.state={};this.dirty=true;this.pendingDraw=true;this.visible=false;this.autoFollow=follow;this.destroyed=false;
  this.root=document.createElement('div');this.root.className='camp-map';this.root.dataset.interactive=String(interactive);
  this.canvas=document.createElement('canvas');this.canvas.className='camp-map__canvas';this.canvas.tabIndex=interactive?0:-1;this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','森林の奥へ続くワールドマップ。未到達の土地には黒い雲がかかっています。');
  this.root.append(this.canvas);element.append(this.root);this.context=this.canvas.getContext('2d');this.staticCanvas=document.createElement('canvas');this.staticContext=this.staticCanvas.getContext('2d');this.renderer=new CampMapRenderer();
  this.controls=document.createElement('div');this.controls.className='camp-map__controls';this.controls.innerHTML='<button type="button" data-camp-zoom="in" aria-label="マップを拡大">＋</button><button type="button" data-camp-zoom="out" aria-label="マップを縮小">−</button><button type="button" data-camp-zoom="current" aria-label="現在位置を表示">◎</button><button type="button" data-camp-zoom="all" aria-label="マップ全体を表示">全体</button>';this.root.append(this.controls);
  this.legend=document.createElement('div');this.legend.className='camp-map__legend';this.legend.innerHTML=Object.entries(TERRAINS).map(([id,t])=>'<span><i style="--terrain:'+t.color+'"></i>'+t.label+'</span>').join('');this.root.append(this.legend);
  this.note=document.createElement('div');this.note.className='camp-map__place';this.note.textContent='未開の地';this.root.append(this.note);
  this.clickControls=event=>{const action=event.target.closest('[data-camp-zoom]')?.dataset.campZoom;if(!action)return;event.stopPropagation();if(action==='all')this.fitAll();else if(action==='current')this.centerCurrent();else this.scaleAt(action==='in'?1.4:1/1.4);};this.controls.addEventListener('click',this.clickControls);
  this.pointerDown=event=>this.onPointerDown(event);this.pointerMove=event=>this.onPointerMove(event);this.pointerUp=event=>this.onPointerUp(event);this.canvasClick=event=>this.onCanvasClick(event);this.wheel=event=>{this.tapCandidate=null;if(!this.interactive)return;event.preventDefault();const r=this.canvas.getBoundingClientRect();this.scaleAt(Math.exp(-clamp(event.deltaY,-100,100)*.005),{x:event.clientX-r.left,y:event.clientY-r.top});};
  this.keyDown=event=>{this.tapCandidate=null;if(!this.interactive)return;const delta={ArrowLeft:[45,0],ArrowRight:[-45,0],ArrowUp:[0,45],ArrowDown:[0,-45]}[event.key];if(delta){event.preventDefault();this.autoFollow=false;this.pan.x+=delta[0];this.pan.y+=delta[1];this.invalidate();}else if(['+','=','-','Home'].includes(event.key)){event.preventDefault();if(event.key==='Home')this.centerCurrent();else this.scaleAt(event.key==='-'?1/1.3:1.3);}};
  for(const [name,handler]of [['pointerdown',this.pointerDown],['pointermove',this.pointerMove],['pointerup',this.pointerUp],['pointercancel',this.pointerUp],['click',this.canvasClick],['keydown',this.keyDown]])this.canvas.addEventListener(name,handler);
  this.canvas.addEventListener('wheel',this.wheel,{passive:false});this.visibilityChange=()=>{if(!document.hidden&&(this.pendingDraw||this.dirty))this.requestDraw();};document.addEventListener('visibilitychange',this.visibilityChange);this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(element);this.resize();
 }
 update(state={}){
  const before=this.drawStateKey;this.state={...this.state,...state};const visited=state.discovered??state.visited;
  if(visited){
   const values=visited instanceof Set?[...visited]:Array.isArray(visited)?visited:Object.keys(visited),next=new Set(values);
   if(next.size!==this.discovered.size||[...next].some(id=>!this.discovered.has(id))){this.discovered=next;this.discoveryKey=values.join('|');this.renderer.setDiscovered(next);this.dirty=true;}
  }
  const s=this.state;this.drawStateKey=[s.nodeId||CAMP_WORLD.startId,s.nextNodeId||'',clamp(Number(s.travelProgress)||0,0,1),s.phase||'',s.day??'',s.targetId||''].join('|');
  if(before===this.drawStateKey&&!this.dirty)return;
  if(this.autoFollow&&this.width)this.ensureVisible();this.requestDraw();
 }
 resize(){
  const r=this.element.getBoundingClientRect();this.visible=r.width>0&&r.height>0&&this.element.isConnected;
  if(!this.visible){cancelAnimationFrame(this.raf);this.raf=0;return;}
  const width=Math.max(1,r.width),height=Math.max(1,r.height),dpr=Math.min(2,window.devicePixelRatio||1),changed=this.width!==width||this.height!==height||this.dpr!==dpr;
  this.width=width;this.height=height;this.dpr=dpr;
  if(changed){for(const canvas of [this.canvas,this.staticCanvas]){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}this.backgroundGradient=null;}
  if(!this.initialized){this.initialized=true;this.centerCurrent();}this.invalidate();
 }
 currentPoint(){const a=nodeAt(this.state.nodeId||CAMP_WORLD.startId)||nodes[0],b=nodeAt(this.state.nextNodeId),t=clamp(Number(this.state.travelProgress)||0,0,1);return b?{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}:a;}
 centerCurrent(){this.autoFollow=this.follow;const point=this.currentPoint();this.zoom=clamp(Math.min(this.width,this.height)/620,.16,1.4);this.pan={x:this.width*.54-point.x*this.zoom,y:this.height*.56-point.y*this.zoom};this.invalidate();}
 fitAll(){this.autoFollow=false;const patrolDepth=430;this.zoom=Math.min((this.width-36)/(bounds.maxX-bounds.minX+180),(this.height-54)/(bounds.maxY-bounds.minY+patrolDepth));this.zoom=clamp(this.zoom,.025,2.4);this.pan={x:(this.width-(bounds.maxX-bounds.minX)*this.zoom)/2-bounds.minX*this.zoom,y:25-bounds.minY*this.zoom};this.invalidate();}
 scaleAt(factor,position={x:this.width/2,y:this.height/2}){this.autoFollow=false;const old=this.zoom,next=clamp(old*factor,.025,2.4);this.pan.x=position.x-(position.x-this.pan.x)*next/old;this.pan.y=position.y-(position.y-this.pan.y)*next/old;this.zoom=next;this.invalidate();}
 ensureVisible(){const point=this.currentPoint(),p=this.project(point),marginX=Math.min(125,this.width*.30),marginY=Math.min(100,this.height*.25);let moved=false;if(p.x<marginX){this.pan.x+=marginX-p.x;moved=true;}if(p.x>this.width-marginX){this.pan.x+=this.width-marginX-p.x;moved=true;}if(p.y<marginY){this.pan.y+=marginY-p.y;moved=true;}if(p.y>this.height-marginY){this.pan.y+=this.height-marginY-p.y;moved=true;}if(moved)this.dirty=true;}
 project(point){return{x:point.x*this.zoom+this.pan.x,y:point.y*this.zoom+this.pan.y};}
 unproject(point){return{x:(point.x-this.pan.x)/this.zoom,y:(point.y-this.pan.y)/this.zoom};}
 invalidate(){this.dirty=true;this.requestDraw();}
 requestDraw(){this.pendingDraw=true;if(this.destroyed||this.raf||!this.visible||document.hidden||!this.element.isConnected)return;this.raf=requestAnimationFrame(()=>{this.raf=0;this.draw();});}
 onPointerDown(event){
  this.tapCandidate=null;if(!this.interactive||event.button!==0)return;
  this.canvas.setPointerCapture?.(event.pointerId);this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});this.startPointer={x:event.clientX,y:event.clientY};this.lastPointer={x:event.clientX,y:event.clientY};this.moved=false;
  if(this.pointers.size>1){this.moved=true;if(this.pointers.size===2){const p=[...this.pointers.values()];this.pinchDistance=distance(p[0],p[1]);}}
  event.preventDefault();
 }
 onPointerMove(event){if(!this.pointers.has(event.pointerId))return;this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});this.autoFollow=false;if(this.pointers.size===2){const p=[...this.pointers.values()],d=distance(p[0],p[1]);if(this.pinchDistance>0){const r=this.canvas.getBoundingClientRect();this.scaleAt(d/this.pinchDistance,{x:(p[0].x+p[1].x)/2-r.left,y:(p[0].y+p[1].y)/2-r.top});}this.pinchDistance=d;this.moved=true;}else{this.pan.x+=event.clientX-this.lastPointer.x;this.pan.y+=event.clientY-this.lastPointer.y;this.moved ||=Math.hypot(event.clientX-this.startPointer.x,event.clientY-this.startPointer.y)>6;this.invalidate();}if(this.moved)this.tapCandidate=null;this.lastPointer={x:event.clientX,y:event.clientY};}
 onPointerUp(event){
  if(!this.pointers.has(event.pointerId))return;
  const wasSingle=this.pointers.size===1;this.pointers.delete(event.pointerId);this.tapCandidate=null;
  if(event.type==='pointerup'&&wasSingle&&!this.moved){const r=this.canvas.getBoundingClientRect();this.tapCandidate={x:event.clientX-r.left,y:event.clientY-r.top};}
  if(this.pointers.size===1){const p=[...this.pointers.values()][0];this.lastPointer=p;this.startPointer=p;this.moved=true;}
  this.pinchDistance=0;
 }
 onCanvasClick(event){
  // Commit navigation after the click target/path is fixed. Opening the next
  // dialog during pointerup lets a touch's later compatibility click hit it.
  event.preventDefault();event.stopPropagation();const candidate=this.tapCandidate;this.tapCandidate=null;
  if(this.interactive&&candidate&&!this.pointers.size&&!this.destroyed)this.tap(candidate);
 }
 tap(point){const start=nodeAt(CAMP_WORLD.startId)||nodes[0],s=this.project(start),rect=this.patrolRect();if(Math.hypot(point.x-s.x,point.y-s.y)<24||point.x>=rect.x&&point.x<=rect.x+rect.w&&point.y>=rect.y&&point.y<=rect.y+rect.h){this.onCamp({nodeId:CAMP_WORLD.startId});return;}let best=null,bestD=20;for(const node of nodes){const p=this.project(node),d=Math.hypot(p.x-point.x,p.y-point.y);if(d<bestD){bestD=d;best=node;}}if(best){this.onNodeSelect(best);this.note.textContent=best.id===CAMP_DESTINATIONS.moai_village?.nodeId?'モアイ郷':this.discovered.has(best.id)?TERRAINS[best.terrain]?.label||'未開の地':'まだ訪れていない土地';}this.onCamp({nodeId:best?.id??null,source:best?'node':'terrain'});}
 patrolRect(){const start=nodeAt(CAMP_WORLD.startId)||nodes[0],p=this.project({x:start.x-210,y:start.y+85});return{x:p.x,y:p.y,w:420*this.zoom,h:300*this.zoom};}
 drawStatic(){
  const c=this.staticContext;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.width,this.height);
  if(!this.backgroundGradient){const bg=c.createLinearGradient(0,0,this.width,this.height);bg.addColorStop(0,'#e8edda');bg.addColorStop(1,'#d7e0c7');this.backgroundGradient=bg;}
  c.fillStyle=this.backgroundGradient;c.fillRect(0,0,this.width,this.height);this.renderer.drawNetwork(c,this);this.drawFog(c);this.drawPatrol(c);
  const destination=CAMP_DESTINATIONS.moai_village,moai=nodeAt(destination?.nodeId);
  if(moai){const p=this.project(moai);if(p.x>-100&&p.x<this.width+100&&p.y>-50&&p.y<this.height+50){c.fillStyle='#fdf5d8';c.strokeStyle='#9d8259';c.lineWidth=1;c.beginPath();c.roundRect(p.x-34,p.y-30,68,23,6);c.fill();c.stroke();c.font='600 11px sans-serif';c.textAlign='center';c.fillStyle='#6d583d';c.fillText('モアイ郷',p.x,p.y-14);c.beginPath();c.moveTo(p.x,p.y-7);c.lineTo(p.x,p.y);c.stroke();}}
  this.dirty=false;
 }
 drawFog(target){this.renderer.drawFog(target,this);}
 drawPatrol(c){const rect=this.patrolRect();if(rect.y>this.height+40||rect.y+rect.h<-40)return;const start=this.project(nodeAt(CAMP_WORLD.startId)||nodes[0]);c.strokeStyle='#7f9168';c.setLineDash([3,4]);c.beginPath();c.moveTo(start.x,start.y+9);c.lineTo(start.x,rect.y);c.stroke();c.setLineDash([]);c.fillStyle='#f4efd8';c.strokeStyle='#acb990';c.lineWidth=1;c.beginPath();c.roundRect(rect.x,rect.y,rect.w,rect.h,Math.min(16,rect.w*.05));c.fill();c.stroke();const h=rect.h;c.fillStyle='#bac8a0';c.fillRect(rect.x+2,rect.y+2,rect.w-4,h*.36);c.fillStyle='#e1d9bd';c.fillRect(rect.x+2,rect.y+h*.36,rect.w-4,h*.39);c.fillStyle='#c4bbae';c.beginPath();c.ellipse(rect.x+rect.w*.5,rect.y+h*.94,rect.w*.17,h*.20,0,Math.PI,Math.PI*2);c.fill();if(rect.w>75){c.textAlign='center';c.font='600 11px sans-serif';c.fillStyle='#536a45';c.fillText('森林',rect.x+rect.w/2,rect.y+h*.23);c.fillStyle='#7f725c';c.fillText('パトロールエリア',rect.x+rect.w/2,rect.y+h*.64);c.font='10px sans-serif';c.fillText('おこていゆハウス',rect.x+rect.w/2,rect.y+h*.87);}if(rect.w>90){c.save();c.globalAlpha=.35;c.strokeStyle='#7c806d';c.lineWidth=.7;for(const [a,b] of PATROL_MAP.edges){const pa=PATROL_BY_ID.get(a),pb=PATROL_BY_ID.get(b);c.beginPath();c.moveTo(rect.x+pa.x*rect.w,rect.y+pa.y*h);c.lineTo(rect.x+pb.x*rect.w,rect.y+pb.y*h);c.stroke();}for(const node of PATROL_MAP.nodes){c.fillStyle=node.id==='home'?'#ba8277':'#fffef3';c.beginPath();c.arc(rect.x+node.x*rect.w,rect.y+node.y*h,node.id==='home'?3:1.5,0,Math.PI*2);c.fill();}c.restore();}if(rect.w>95){const a=this.project(nodeAt(CAMP_WORLD.startId)||nodes[0]);c.fillStyle='#fffff3';c.strokeStyle='#8c9c70';c.beginPath();c.roundRect(a.x-58,a.y+14,116,25,8);c.fill();c.stroke();c.font='600 11px sans-serif';c.fillStyle='#526545';c.fillText('キャンプへ出発',a.x,a.y+31);}}
 draw(){if(this.destroyed||!this.width||!this.visible||document.hidden)return;this.pendingDraw=false;if(this.dirty)this.drawStatic();const c=this.context;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.canvas.width,this.canvas.height);c.drawImage(this.staticCanvas,0,0);c.setTransform(this.dpr,0,0,this.dpr,0,0);const node=this.currentPoint(),p=this.project(node),target=nodeAt(this.state.nextNodeId);if(target){const q=this.project(target);c.strokeStyle='#ebc674';c.lineWidth=3;c.setLineDash([4,5]);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();c.setLineDash([]);}this.drawOkoteiyu(c,p);const phase=this.state.phase;if(phase==='night'){c.fillStyle='#192a3d66';c.fillRect(0,0,this.width,this.height);}const label='ワールドマップ。'+(this.state.day?this.state.day+'日目。':'')+'現在位置と、到達した土地を表示。ドラッグで移動、ピンチまたは＋−で拡大縮小。';if(this.canvas.getAttribute('aria-label')!==label)this.canvas.setAttribute('aria-label',label);}
 drawOkoteiyu(c,p){const r=11;c.save();c.translate(p.x,p.y);c.fillStyle='#4d5d4220';c.beginPath();c.ellipse(0,12,13,4,0,0,Math.PI*2);c.fill();c.fillStyle='#fff1df';c.strokeStyle='#b19c7f';c.lineWidth=1.25;c.beginPath();c.moveTo(-r,8);c.lineTo(-r,-1);c.bezierCurveTo(-r,-15,r,-15,r,-1);c.lineTo(r,8);c.quadraticCurveTo(0,14,-r,8);c.fill();c.stroke();c.strokeStyle='#685f54';c.lineWidth=1.5;for(const x of [-4,4]){c.beginPath();c.moveTo(x-2,-1);c.lineTo(x+2,-1);c.stroke();}c.beginPath();c.moveTo(-2,6);c.lineTo(0,4.5);c.lineTo(2,6);c.stroke();c.strokeStyle='#dc9d9e';c.lineWidth=1.2;for(const x of [-7,7]){c.beginPath();c.arc(x,3,1.8,0,Math.PI*1.7);c.stroke();}c.restore();}
 destroy(){this.destroyed=true;cancelAnimationFrame(this.raf);this.observer.disconnect();this.renderer.destroy();document.removeEventListener('visibilitychange',this.visibilityChange);this.controls.removeEventListener('click',this.clickControls);for(const [name,handler]of [['pointerdown',this.pointerDown],['pointermove',this.pointerMove],['pointerup',this.pointerUp],['pointercancel',this.pointerUp],['click',this.canvasClick],['keydown',this.keyDown]])this.canvas.removeEventListener(name,handler);this.canvas.removeEventListener('wheel',this.wheel);this.root.remove();}
}
export const CAMP_TERRAIN_LABELS=Object.freeze(Object.fromEntries(Object.entries(TERRAINS).map(([id,value])=>[id,value.label])));
