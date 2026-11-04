import {CAMP_WORLD,CAMP_TERRAINS,CAMP_DESTINATIONS} from './camp-world.js';
import {CAMP_REGIONS,CAMP_REGION_BOUNDS} from './camp-regions.js';

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
// Reveal the ground around a reached point, not only its tiny center. A fully
// transparent inner disk removes overlapping cloud fragments; its soft border
// blends into the still unknown land. These are drawing distances, not visits.
const CLEARING_INNER_RADIUS=200,CLEARING_RADIUS=320,CLOUD_REACH=195;
// A known clearing can only affect clouds whose disks touch its erase disk.
// This avoids stamping thousands of transparent holes into an empty fog layer.
const clearingNeighbors=NODES.map(node=>visibleIndices({minX:node.x,minY:node.y,maxX:node.x,maxY:node.y},CLEARING_RADIUS+CLOUD_REACH).filter(index=>{
 const cloud=clouds[index];return Math.hypot(cloud.x-node.x,cloud.y-node.y)<=cloud.radius+CLEARING_RADIUS;
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
  const inner=erase?CLEARING_INNER_RADIUS/CLEARING_RADIUS: .15,gradient=c.createRadialGradient(center,center,center*inner,center,center,center);
  if(erase){gradient.addColorStop(0,'#000');gradient.addColorStop(.45,'#000d');gradient.addColorStop(1,'#0000');}
  else{gradient.addColorStop(0,'#26332be0');gradient.addColorStop(.58,'#303c34c5');gradient.addColorStop(1,'#37433700');}
  c.fillStyle=gradient;c.fillRect(0,0,size,size);return canvas;
 };
 sharedSprites={cloud:make(false),clearing:make(true)};return sharedSprites;
}
function worldRect(view){return {minX:-view.pan.x/view.zoom,minY:-view.pan.y/view.zoom,maxX:(view.width-view.pan.x)/view.zoom,maxY:(view.height-view.pan.y)/view.zoom};}
function intersects(a,b){return a.maxX>=b.minX&&a.minX<=b.maxX&&a.maxY>=b.minY&&a.minY<=b.maxY;}
function disk(path,x,y,radius){path.moveTo(x+radius,y);path.arc(x,y,radius,0,Math.PI*2);}
function drawFogCache(target,cache,view){
 const r=worldRect(view),clip={minX:Math.max(r.minX,FOG_BOUNDS.minX),minY:Math.max(r.minY,FOG_BOUNDS.minY),maxX:Math.min(r.maxX,FOG_BOUNDS.maxX),maxY:Math.min(r.maxY,FOG_BOUNDS.maxY)};if(clip.minX>=clip.maxX||clip.minY>=clip.maxY)return;
 const sx=(clip.minX-FOG_BOUNDS.minX)*ATLAS_SCALE,sy=(clip.minY-FOG_BOUNDS.minY)*ATLAS_SCALE,sw=(clip.maxX-clip.minX)*ATLAS_SCALE,sh=(clip.maxY-clip.minY)*ATLAS_SCALE;
 target.drawImage(cache,sx,sy,sw,sh,clip.minX*view.zoom+view.pan.x,clip.minY*view.zoom+view.pan.y,(clip.maxX-clip.minX)*view.zoom,(clip.maxY-clip.minY)*view.zoom);
}

// One shared decoded atlas and six transparent terrain illustrations. New
// region records may add a backgroundUrl without moving this authored extent.
const REGION_LIST=Object.values(CAMP_REGIONS).sort((a,b)=>(a.order??0)-(b.order??0));
const BASE_ART={bounds:CAMP_REGION_BOUNDS,url:'assets/camp/r225-world-atlas.webp'};
const ART_LAYERS=[BASE_ART,...REGION_LIST.filter(region=>region.backgroundUrl).map(region=>({bounds:region.bounds,url:region.backgroundUrl}))];
const PATCH_URLS=Object.fromEntries(Object.keys(CAMP_TERRAINS).map(id=>[id,'assets/camp/terrain-'+id+'.svg']));
const REGION_STYLES=Object.fromEntries(REGION_LIST.map(region=>[region.id,{fill:region.palette?.background||'#586754',tint:region.palette?.land||region.palette?.background||'#70865d'}]));
const ART_RECORDS=new Map(),ART_LISTENERS=new Set();
function artRecord(path){
 const url=new URL(path,import.meta.url).href;if(ART_RECORDS.has(url))return ART_RECORDS.get(url);
 const image=new Image(),record={url,image,status:'loading'};ART_RECORDS.set(url,record);
 const complete=status=>{record.status=status;for(const listener of ART_LISTENERS)listener();};
 image.onload=()=>complete('ready');image.onerror=()=>complete('failed');image.src=url;return record;
}
const PATCH_WIDTH={normal:156,rough:210,cliff:258,gas:250,cave:235,poor_visibility:245};
const OVERVIEW_ZOOM=.14,OVERVIEW_CELL=720,OVERVIEW_LIMIT=180,DETAIL_LIMIT=420,SPRITE_LIMIT=30;
function limitedPatches(indices,limit){
 if(indices.length<=limit)return indices;
 // Keep a visible example of each region/terrain pair before sampling the rest.
 const types=new Set(),required=[],rest=[];
 for(const index of indices){const node=NODES[index],key=node.regionId+'|'+node.terrain;if(types.has(key))rest.push(index);else{types.add(key);required.push(index);}}
 const remaining=Math.max(0,limit-required.length),selected=required.slice(0,limit);
 for(let i=0;i<remaining&&rest.length;i++)selected.push(rest[Math.floor(i*rest.length/remaining)]);
 return selected;
}
function clippedWorldImage(c,image,bounds,rect){
 const clip={minX:Math.max(bounds.minX,rect.minX),minY:Math.max(bounds.minY,rect.minY),maxX:Math.min(bounds.maxX,rect.maxX),maxY:Math.min(bounds.maxY,rect.maxY)};
 if(clip.minX>=clip.maxX||clip.minY>=clip.maxY)return false;
 const width=bounds.maxX-bounds.minX,height=bounds.maxY-bounds.minY;
 c.drawImage(image,(clip.minX-bounds.minX)/width*image.naturalWidth,(clip.minY-bounds.minY)/height*image.naturalHeight,(clip.maxX-clip.minX)/width*image.naturalWidth,(clip.maxY-clip.minY)/height*image.naturalHeight,clip.minX,clip.minY,clip.maxX-clip.minX,clip.maxY-clip.minY);return true;
}

/** Canvas-only cache. Its memory is bounded independently of world-map size. */
export class CampMapRenderer{
 constructor({onInvalidate=()=>{}}={}){
  this.onInvalidate=onInvalidate;this.destroyed=false;this.spriteCache=new Map();this.overviewPatchDirty=true;this.regionKnownCounts=new Map();this.artStats={};
  this.assetListener=()=>{if(this.destroyed)return;for(const sprite of this.spriteCache.values())sprite.width=sprite.height=0;this.spriteCache.clear();this.onInvalidate();};ART_LISTENERS.add(this.assetListener);
  this.backgroundLayers=ART_LAYERS.map(layer=>({...layer,asset:artRecord(layer.url)}));this.patchAssets=Object.fromEntries(Object.entries(PATCH_URLS).map(([id,url])=>[id,artRecord(url)]));
  this.known=new Uint8Array(NODES.length);this.unknown=new Uint8Array(NODES.length);this.clearings=[];this.unknownCount=NODES.length;
  this.discoveryDirty=true;this.pathsDirty=true;this.atlasDirty=true;this.atlas=null;this.clearingAtlasDirty=true;this.clearingAtlas=null;
  this.scratch=document.createElement('canvas');this.scratchContext=this.scratch.getContext('2d');
  this.setDiscovered(new Set());
 }
 setDiscovered(discovered){
  let changed=false;
  for(let i=0;i<NODES.length;i++){const known=discovered.has(NODES[i].id)||i===START_INDEX?1:0;if(this.known[i]!==known){this.known[i]=known;changed=true;}}
  if(!changed&&!this.discoveryDirty)return false;
  this.discoveryDirty=false;this.pathsDirty=true;this.atlasDirty=true;this.clearingAtlasDirty=true;this.unknownCount=0;
  for(let i=0;i<NODES.length;i++){this.unknown[i]=this.known[i]?0:1;this.unknownCount+=this.unknown[i];}
  this.overviewPatchDirty=true;this.regionKnownCounts.clear();for(let i=0;i<NODES.length;i++)if(this.known[i]){const id=NODES[i].regionId;this.regionKnownCounts.set(id,(this.regionKnownCounts.get(id)||0)+1);}
  this.clearings=[];
  if(this.unknownCount)for(let i=0;i<NODES.length;i++)if(this.known[i]&&clearingNeighbors[i].some(index=>this.unknown[index]))this.clearings.push(i);
  return true;
 }
 overviewPatches(){
  if(!this.overviewPatchDirty)return this.overviewPatchIndices;
  const cells=new Map();
  for(let index=0;index<NODES.length;index++){
   const node=NODES[index];if(!this.known[index]||node.terrain==='normal')continue;
   const x=Math.floor(node.x/OVERVIEW_CELL),y=Math.floor(node.y/OVERVIEW_CELL),key=node.regionId+'|'+node.terrain+'|'+x+'|'+y;
   const distance=Math.hypot(node.x-(x+.5)*OVERVIEW_CELL,node.y-(y+.5)*OVERVIEW_CELL),previous=cells.get(key);
   if(!previous||distance<previous.distance)cells.set(key,{index,distance});
  }
  this.overviewPatchIndices=limitedPatches([...cells.values()].map(value=>value.index).sort((a,b)=>a-b),OVERVIEW_LIMIT);this.overviewPatchDirty=false;return this.overviewPatchIndices;
 }
 terrainSprite(node){
  const asset=this.patchAssets[node.terrain];if(asset?.status!=='ready')return null;
  const key=node.regionId+'|'+node.terrain;
  if(this.spriteCache.has(key)){const sprite=this.spriteCache.get(key);this.spriteCache.delete(key);this.spriteCache.set(key,sprite);return sprite;}
  const sprite=document.createElement('canvas');sprite.width=160;sprite.height=128;const c=sprite.getContext('2d');c.drawImage(asset.image,0,0,160,128);
  const style=REGION_STYLES[node.regionId]||REGION_STYLES.wilds;c.globalCompositeOperation='source-atop';c.globalAlpha=.2;c.fillStyle=style.tint;c.fillRect(0,0,160,128);c.globalAlpha=1;c.globalCompositeOperation='source-over';
  while(this.spriteCache.size>=SPRITE_LIMIT){const oldest=this.spriteCache.keys().next().value,old=this.spriteCache.get(oldest);old.width=old.height=0;this.spriteCache.delete(oldest);}
  this.spriteCache.set(key,sprite);return sprite;
 }
 drawBackground(c,view){
  const rect=worldRect(view),overview=view.zoom<OVERVIEW_ZOOM;
  this.artStats={atlasReady:this.backgroundLayers[0].asset.status==='ready',atlasDrawn:false,patchesDrawn:0,lod:overview?'overview':'detail',regionLabelsDrawn:0,spriteCacheSize:this.spriteCache.size,failedAssets:[...this.backgroundLayers.map(layer=>layer.asset),...Object.values(this.patchAssets)].filter(asset=>asset.status==='failed').length};
  c.save();c.translate(view.pan.x,view.pan.y);c.scale(view.zoom,view.zoom);
  // Flat palette fallback is visible while the illustration loads, never a
  // blocking loader or a retry loop. Its extent is also stable across expansion.
  for(const region of REGION_LIST){if(!intersects(region.bounds,rect))continue;c.fillStyle=REGION_STYLES[region.id]?.fill||'#586754';c.fillRect(region.bounds.minX,region.bounds.minY,region.bounds.maxX-region.bounds.minX,region.bounds.maxY-region.bounds.minY);}
  for(const layer of this.backgroundLayers)if(layer.asset.status==='ready'&&clippedWorldImage(c,layer.asset.image,layer.bounds,rect))this.artStats.atlasDrawn=true;
  const candidates=overview?this.overviewPatches().filter(index=>{const n=NODES[index];return n.x>=rect.minX-160&&n.x<=rect.maxX+160&&n.y>=rect.minY-160&&n.y<=rect.maxY+160;}):limitedPatches(visibleIndices(rect,160).filter(index=>this.known[index]),DETAIL_LIMIT);
  for(const index of candidates){const node=NODES[index],sprite=this.terrainSprite(node);if(!sprite)continue;const width=(PATCH_WIDTH[node.terrain]||210)*(overview?1.2:1);c.globalAlpha=node.terrain==='normal'?0.58:0.84;c.drawImage(sprite,node.x-width/2,node.y-width*.4,width,width*.8);this.artStats.patchesDrawn++;}
  c.restore();this.artStats.spriteCacheSize=this.spriteCache.size;
 }
 drawRegionLabels(c,view){
  const destinations=Object.values(CAMP_DESTINATIONS).filter(destination=>destination.nodeId).map(destination=>NODES[NODE_INDEX.get(destination.nodeId)]).filter(Boolean).map(node=>({x:node.x*view.zoom+view.pan.x,y:node.y*view.zoom+view.pan.y})).filter(point=>point.x>-100&&point.x<view.width+100&&point.y>-50&&point.y<view.height+50).map(point=>({left:point.x-34,right:point.x+34,top:point.y-30,bottom:point.y-7}));
  for(const region of REGION_LIST){
   if(!this.regionKnownCounts.get(region.id))continue;
   const width=(region.bounds.maxX-region.bounds.minX)*view.zoom,height=(region.bounds.maxY-region.bounds.minY)*view.zoom;if(width<70||height<42)continue;
   const point=region.labelPoint||{x:(region.bounds.minX+region.bounds.maxX)/2,y:(region.bounds.minY+region.bounds.maxY)/2},x=point.x*view.zoom+view.pan.x;let y=point.y*view.zoom+view.pan.y;if(x<-100||x>view.width+100||y<-35||y>view.height+35)continue;
   c.save();const font=clamp(width/12,10,16);c.font='600 '+font+'px sans-serif';c.textAlign='center';c.textBaseline='middle';const labelWidth=c.measureText(region.name).width+20,minY=region.bounds.minY*view.zoom+view.pan.y+14,maxY=region.bounds.maxY*view.zoom+view.pan.y-14;
   // Region names share the atlas with destination pills. Move just the name,
   // never the geography, so the two labels cannot cover each other at overview.
   const overlaps=box=>x+labelWidth/2>box.left-5&&x-labelWidth/2<box.right+5&&y+12>box.top-5&&y-12<box.bottom+5;
   for(const box of destinations)if(overlaps(box)){const above=box.top-18,below=box.bottom+18;y=above>=minY?above:below<=maxY?below:y;}
   if(destinations.some(overlaps)){c.restore();continue;}
   c.fillStyle='#f8f4e4e8';c.strokeStyle='#53614a90';c.lineWidth=1;c.beginPath();c.roundRect(x-labelWidth/2,y-12,labelWidth,24,7);c.fill();c.stroke();c.fillStyle='#435341';c.fillText(region.name,x,y+.5);c.restore();this.artStats.regionLabelsDrawn=(this.artStats.regionLabelsDrawn||0)+1;
  }
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
 buildClearingAtlas(){
  if(!this.clearingAtlas){this.clearingAtlas=document.createElement('canvas');this.clearingAtlas.width=Math.ceil((FOG_BOUNDS.maxX-FOG_BOUNDS.minX)*ATLAS_SCALE);this.clearingAtlas.height=Math.ceil((FOG_BOUNDS.maxY-FOG_BOUNDS.minY)*ATLAS_SCALE);this.clearingAtlasContext=this.clearingAtlas.getContext('2d');}
  const c=this.clearingAtlasContext,{clearing}=fogSprites();c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.clearingAtlas.width,this.clearingAtlas.height);c.setTransform(ATLAS_SCALE,0,0,ATLAS_SCALE,-FOG_BOUNDS.minX*ATLAS_SCALE,-FOG_BOUNDS.minY*ATLAS_SCALE);
  for(const i of this.clearings){const n=NODES[i];c.drawImage(clearing,n.x-CLEARING_RADIUS,n.y-CLEARING_RADIUS,CLEARING_RADIUS*2,CLEARING_RADIUS*2);}this.clearingAtlasDirty=false;
 }
 buildAtlas(){
  if(!this.atlas){this.atlas=document.createElement('canvas');this.atlas.width=Math.ceil((FOG_BOUNDS.maxX-FOG_BOUNDS.minX)*ATLAS_SCALE);this.atlas.height=Math.ceil((FOG_BOUNDS.maxY-FOG_BOUNDS.minY)*ATLAS_SCALE);this.atlasContext=this.atlas.getContext('2d');}
  if(this.clearingAtlasDirty)this.buildClearingAtlas();
  const c=this.atlasContext,{cloud}=fogSprites();c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.atlas.width,this.atlas.height);c.setTransform(ATLAS_SCALE,0,0,ATLAS_SCALE,-FOG_BOUNDS.minX*ATLAS_SCALE,-FOG_BOUNDS.minY*ATLAS_SCALE);
  c.globalCompositeOperation='source-over';
  for(let i=0;i<NODES.length;i++){if(!this.unknown[i])continue;const f=clouds[i];c.drawImage(cloud,f.x-f.radius,f.y-f.radius,f.radius*2,f.radius*2);}
  c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='destination-out';c.drawImage(this.clearingAtlas,0,0);c.globalCompositeOperation='source-over';this.atlasDirty=false;
 }
 drawFog(target,view){
  if(!this.unknownCount)return;
  const projectedPixel=ATLAS_SCALE/(view.zoom*view.dpr);
  // The same cloud/clearing sprites define both levels; only sampling density
  // changes. Zoomed views stamp just their nearby clouds at display resolution.
  if(projectedPixel>=.48){
   if(this.atlasDirty)this.buildAtlas();
   drawFogCache(target,this.atlas,view);return;
  }
  if(this.clearingAtlasDirty)this.buildClearingAtlas();
  const width=Math.round(view.width*view.dpr),height=Math.round(view.height*view.dpr);if(this.scratch.width!==width||this.scratch.height!==height){this.scratch.width=width;this.scratch.height=height;}
  const c=this.scratchContext,{cloud}=fogSprites(),rect=worldRect(view);c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,width,height);c.setTransform(view.dpr*view.zoom,0,0,view.dpr*view.zoom,view.pan.x*view.dpr,view.pan.y*view.dpr);c.globalCompositeOperation='source-over';
  for(const index of visibleIndices(rect,CLOUD_REACH).sort((a,b)=>a-b)){if(!this.unknown[index])continue;const f=clouds[index];if(f.x+f.radius<rect.minX||f.x-f.radius>rect.maxX||f.y+f.radius<rect.minY||f.y-f.radius>rect.maxY)continue;c.drawImage(cloud,f.x-f.radius,f.y-f.radius,f.radius*2,f.radius*2);}
  // The broader holes share one bounded mask in both LODs. Sampling its soft
  // edge once avoids overpainting many large transparent disks every pan frame.
  c.setTransform(view.dpr,0,0,view.dpr,0,0);c.globalCompositeOperation='destination-out';drawFogCache(c,this.clearingAtlas,view);c.globalCompositeOperation='source-over';target.drawImage(this.scratch,0,0,view.width,view.height);
 }
 destroy(){this.destroyed=true;ART_LISTENERS.delete(this.assetListener);for(const sprite of this.spriteCache.values())sprite.width=sprite.height=0;this.spriteCache.clear();this.backgroundLayers=[];this.patchAssets={};if(this.atlas)this.atlas.width=this.atlas.height=0;this.atlas=null;this.atlasContext=null;if(this.clearingAtlas)this.clearingAtlas.width=this.clearingAtlas.height=0;this.clearingAtlas=null;this.clearingAtlasContext=null;this.scratch.width=this.scratch.height=0;this.scratch=null;this.scratchContext=null;this.paths=null;}
}
