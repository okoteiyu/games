import {CAMP_WORLD,CAMP_TERRAINS} from './camp-world.js';

// Geometry and spatial buckets are shared by the atlas and live map. None of
// these drawing records changes the route graph or the exploration history.
const NODES=CAMP_WORLD.nodes;
const NODE_INDEX=new Map(NODES.map((node,index)=>[node.id,index]));
const ALL_INDICES=NODES.map((_,index)=>index);
const START_INDEX=NODE_INDEX.get(CAMP_WORLD.startId);
const CELL=320;
const buckets=new Map();
const extent={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
for(let i=0;i<NODES.length;i++){
 const {x,y}=NODES[i],key=Math.floor(x/CELL)+','+Math.floor(y/CELL);
 if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);
 extent.minX=Math.min(extent.minX,x);extent.maxX=Math.max(extent.maxX,x);
 extent.minY=Math.min(extent.minY,y);extent.maxY=Math.max(extent.maxY,y);
}
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function visibleIndices(rect,padding=0){
 const minX=Math.max(extent.minX,rect.minX-padding),minY=Math.max(extent.minY,rect.minY-padding);
 const maxX=Math.min(extent.maxX,rect.maxX+padding),maxY=Math.min(extent.maxY,rect.maxY+padding);
 if(minX>maxX||minY>maxY)return [];
 if(minX<=extent.minX&&maxX>=extent.maxX&&minY<=extent.minY&&maxY>=extent.maxY)return ALL_INDICES;
 const result=[];
 for(let y=Math.floor(minY/CELL);y<=Math.floor(maxY/CELL);y++)for(let x=Math.floor(minX/CELL);x<=Math.floor(maxX/CELL);x++){
  const bucket=buckets.get(x+','+y);if(!bucket)continue;
  for(const index of bucket){const node=NODES[index];if(node.x>=minX&&node.x<=maxX&&node.y>=minY&&node.y<=maxY)result.push(index);}
 }
 return result;
}
const edges=[];
if(Array.isArray(CAMP_WORLD.edges)){
 for(const [a,b]of CAMP_WORLD.edges){const ai=NODE_INDEX.get(a),bi=NODE_INDEX.get(b);if(ai===undefined||bi===undefined)continue;const na=NODES[ai],nb=NODES[bi];edges.push({a:ai,b:bi,minX:Math.min(na.x,nb.x),minY:Math.min(na.y,nb.y),maxX:Math.max(na.x,nb.x),maxY:Math.max(na.y,nb.y)});}
}else{
 const seen=new Set();for(let ai=0;ai<NODES.length;ai++)for(const id of NODES[ai].neighbors||[]){const bi=NODE_INDEX.get(id);if(bi===undefined)continue;const key=Math.min(ai,bi)+','+Math.max(ai,bi);if(seen.has(key))continue;seen.add(key);const a=NODES[ai],b=NODES[bi];edges.push({a:ai,b:bi,minX:Math.min(a.x,b.x),minY:Math.min(a.y,b.y),maxX:Math.max(a.x,b.x),maxY:Math.max(a.y,b.y)});}
}
const clouds=NODES.map((node,index)=>{
 const seed=(index*1664525+1013904223)>>>0;
 return {x:node.x+((seed>>>8)%39)-19,y:node.y+((seed>>>16)%37)-18,radius:125+(seed%51)};
});
// A known clearing can only affect clouds whose disks touch its erase disk.
// This avoids stamping thousands of transparent holes into an empty fog layer.
const clearingNeighbors=NODES.map(node=>visibleIndices({minX:node.x,minY:node.y,maxX:node.x,maxY:node.y},290).filter(index=>{
 const cloud=clouds[index];return Math.hypot(cloud.x-node.x,cloud.y-node.y)<=cloud.radius+95;
}));
const FOG_BOUNDS={minX:extent.minX-210,minY:extent.minY-210,maxX:extent.maxX+210,maxY:extent.maxY+210};
const ATLAS_SIDE=1024;
const ATLAS_SCALE=ATLAS_SIDE/Math.max(FOG_BOUNDS.maxX-FOG_BOUNDS.minX,FOG_BOUNDS.maxY-FOG_BOUNDS.minY);
let sharedSprites=null;
function fogSprites(){
 if(sharedSprites)return sharedSprites;
 const size=256,center=size/2;
 const make=erase=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const c=canvas.getContext('2d');
  const inner=erase?40/95: .15,gradient=c.createRadialGradient(center,center,center*inner,center,center,center);
  if(erase){gradient.addColorStop(0,'#000');gradient.addColorStop(.5,'#000c');gradient.addColorStop(1,'#0000');}
  else{gradient.addColorStop(0,'#26332be0');gradient.addColorStop(.58,'#303c34c5');gradient.addColorStop(1,'#37433700');}
  c.fillStyle=gradient;c.fillRect(0,0,size,size);return canvas;
 };
 sharedSprites={cloud:make(false),clearing:make(true)};return sharedSprites;
}
function worldRect(view){return {minX:-view.pan.x/view.zoom,minY:-view.pan.y/view.zoom,maxX:(view.width-view.pan.x)/view.zoom,maxY:(view.height-view.pan.y)/view.zoom};}
function intersects(a,b){return a.maxX>=b.minX&&a.minX<=b.maxX&&a.maxY>=b.minY&&a.minY<=b.maxY;}
function disk(path,x,y,radius){path.moveTo(x+radius,y);path.arc(x,y,radius,0,Math.PI*2);}

/** Canvas-only cache. Its memory is bounded independently of world-map size. */
export class CampMapRenderer{
 constructor(){
  this.known=new Uint8Array(NODES.length);this.unknown=new Uint8Array(NODES.length);this.clearings=[];this.unknownCount=NODES.length;
  this.discoveryDirty=true;this.pathsDirty=true;this.atlasDirty=true;this.atlas=null;
  this.scratch=document.createElement('canvas');this.scratchContext=this.scratch.getContext('2d');
  this.setDiscovered(new Set());
 }
 setDiscovered(discovered){
  let changed=false;
  for(let i=0;i<NODES.length;i++){const known=discovered.has(NODES[i].id)||i===START_INDEX?1:0;if(this.known[i]!==known){this.known[i]=known;changed=true;}}
  if(!changed&&!this.discoveryDirty)return false;
  this.discoveryDirty=false;this.pathsDirty=true;this.atlasDirty=true;this.unknownCount=0;
  for(let i=0;i<NODES.length;i++){this.unknown[i]=this.known[i]?0:1;this.unknownCount+=this.unknown[i];}
  this.clearings=[];
  if(this.unknownCount)for(let i=0;i<NODES.length;i++)if(this.known[i]&&clearingNeighbors[i].some(index=>this.unknown[index]))this.clearings.push(i);
  return true;
 }
 edgePaths(){
  if(!this.pathsDirty)return this.paths;
  const known=new Path2D(),unknown=new Path2D();
  for(const edge of edges){const a=NODES[edge.a],b=NODES[edge.b],path=this.known[edge.a]||this.known[edge.b]?known:unknown;path.moveTo(a.x,a.y);path.lineTo(b.x,b.y);}
  this.paths={known,unknown};this.pathsDirty=false;return this.paths;
 }
 drawNetwork(c,view){
  const rect=worldRect(view),edgeClip={minX:rect.minX-2/view.zoom,minY:rect.minY-2/view.zoom,maxX:rect.maxX+2/view.zoom,maxY:rect.maxY+2/view.zoom},full=rect.minX<=extent.minX&&rect.minY<=extent.minY&&rect.maxX>=extent.maxX&&rect.maxY>=extent.maxY;
  let paths;
  if(full)paths=this.edgePaths();
  else{
   const known=new Path2D(),unknown=new Path2D();
   for(const edge of edges){if(!intersects(edge,edgeClip))continue;const a=NODES[edge.a],b=NODES[edge.b],path=this.known[edge.a]||this.known[edge.b]?known:unknown;path.moveTo(a.x,a.y);path.lineTo(b.x,b.y);}
   paths={known,unknown};
  }
  c.save();c.translate(view.pan.x,view.pan.y);c.scale(view.zoom,view.zoom);c.lineWidth=1.2/view.zoom;
  c.globalAlpha=.3;c.strokeStyle='#c1cbb2';c.stroke(paths.unknown);
  c.globalAlpha=.68;c.strokeStyle='#8b9a79';c.stroke(paths.known);c.globalAlpha=1;
  const radius=clamp(5/view.zoom,5,25),groups=Object.fromEntries(Object.keys(CAMP_TERRAINS).map(id=>[id,new Path2D()])),visible=visibleIndices(rect,radius+24+6/view.zoom),decorated=[];
  for(const index of visible){if(!this.known[index])continue;const node=NODES[index];disk(groups[node.terrain]||groups.normal,node.x,node.y,radius);if(view.zoom>=.4&&(node.cave||node.poorVisibility))decorated.push(node);}
  // At overview scale the old white stroke was larger than the colored dot.
  // Keep terrain colors, and reserve subpixel outlines/icons for closer views.
  c.strokeStyle='#fffef0';c.lineWidth=1.6/view.zoom;
  for(const [id,path]of Object.entries(groups)){c.fillStyle=CAMP_TERRAINS[id].color;c.fill(path);if(view.zoom>=.12)c.stroke(path);}
  if(decorated.length){c.fillStyle='#fffdf1';c.font=`${clamp(10/view.zoom,10,24)}px sans-serif`;c.textAlign='center';for(const node of decorated)c.fillText(node.cave?'⌂':'≋',node.x,node.y-radius-6/view.zoom);}
  c.restore();
 }
 buildAtlas(){
  if(!this.atlas){this.atlas=document.createElement('canvas');this.atlas.width=Math.ceil((FOG_BOUNDS.maxX-FOG_BOUNDS.minX)*ATLAS_SCALE);this.atlas.height=Math.ceil((FOG_BOUNDS.maxY-FOG_BOUNDS.minY)*ATLAS_SCALE);this.atlasContext=this.atlas.getContext('2d');}
  const c=this.atlasContext,{cloud,clearing}=fogSprites();c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.atlas.width,this.atlas.height);c.setTransform(ATLAS_SCALE,0,0,ATLAS_SCALE,-FOG_BOUNDS.minX*ATLAS_SCALE,-FOG_BOUNDS.minY*ATLAS_SCALE);
  c.globalCompositeOperation='source-over';
  for(let i=0;i<NODES.length;i++){if(!this.unknown[i])continue;const f=clouds[i];c.drawImage(cloud,f.x-f.radius,f.y-f.radius,f.radius*2,f.radius*2);}
  c.globalCompositeOperation='destination-out';for(const i of this.clearings){const n=NODES[i];c.drawImage(clearing,n.x-95,n.y-95,190,190);}c.globalCompositeOperation='source-over';this.atlasDirty=false;
 }
 drawFog(target,view){
  if(!this.unknownCount)return;
  const projectedPixel=ATLAS_SCALE/(view.zoom*view.dpr);
  // The same cloud/clearing sprites define both levels; only sampling density
  // changes. Zoomed views stamp just their nearby clouds at display resolution.
  if(projectedPixel>=.48){
   if(this.atlasDirty)this.buildAtlas();
   const r=worldRect(view),clip={minX:Math.max(r.minX,FOG_BOUNDS.minX),minY:Math.max(r.minY,FOG_BOUNDS.minY),maxX:Math.min(r.maxX,FOG_BOUNDS.maxX),maxY:Math.min(r.maxY,FOG_BOUNDS.maxY)};if(clip.minX>=clip.maxX||clip.minY>=clip.maxY)return;
   const sx=(clip.minX-FOG_BOUNDS.minX)*ATLAS_SCALE,sy=(clip.minY-FOG_BOUNDS.minY)*ATLAS_SCALE,sw=(clip.maxX-clip.minX)*ATLAS_SCALE,sh=(clip.maxY-clip.minY)*ATLAS_SCALE;
   target.drawImage(this.atlas,sx,sy,sw,sh,clip.minX*view.zoom+view.pan.x,clip.minY*view.zoom+view.pan.y,(clip.maxX-clip.minX)*view.zoom,(clip.maxY-clip.minY)*view.zoom);return;
  }
  const width=Math.round(view.width*view.dpr),height=Math.round(view.height*view.dpr);if(this.scratch.width!==width||this.scratch.height!==height){this.scratch.width=width;this.scratch.height=height;}
  const c=this.scratchContext,{cloud,clearing}=fogSprites(),rect=worldRect(view);c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,width,height);c.setTransform(view.dpr*view.zoom,0,0,view.dpr*view.zoom,view.pan.x*view.dpr,view.pan.y*view.dpr);c.globalCompositeOperation='source-over';
  for(const index of visibleIndices(rect,200).sort((a,b)=>a-b)){if(!this.unknown[index])continue;const f=clouds[index];if(f.x+f.radius<rect.minX||f.x-f.radius>rect.maxX||f.y+f.radius<rect.minY||f.y-f.radius>rect.maxY)continue;c.drawImage(cloud,f.x-f.radius,f.y-f.radius,f.radius*2,f.radius*2);}
  c.globalCompositeOperation='destination-out';for(const index of this.clearings){const n=NODES[index];if(n.x+95<rect.minX||n.x-95>rect.maxX||n.y+95<rect.minY||n.y-95>rect.maxY)continue;c.drawImage(clearing,n.x-95,n.y-95,190,190);}c.globalCompositeOperation='source-over';target.drawImage(this.scratch,0,0,view.width,view.height);
 }
 destroy(){if(this.atlas)this.atlas.width=this.atlas.height=0;this.atlas=null;this.atlasContext=null;this.scratch.width=this.scratch.height=0;this.scratch=null;this.scratchContext=null;this.paths=null;}
}
