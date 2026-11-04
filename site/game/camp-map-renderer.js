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
// Fog is one continuous field, not one round cloud per unknown vertex. Only
// drawing distances live here: revealing nearby ground never discovers IDs.
const CLEARING_INNER_RADIUS=200,CLEARING_RADIUS=440,FOG_EDGE_FADE=180;
const FOG_BOUNDS={minX:extent.minX-210,minY:extent.minY-210,maxX:extent.maxX+210,maxY:extent.maxY+210};
const ATLAS_SIDE=1024;
const ATLAS_SCALE=ATLAS_SIDE/Math.max(FOG_BOUNDS.maxX-FOG_BOUNDS.minX,FOG_BOUNDS.maxY-FOG_BOUNDS.minY);
const ATLAS_WIDTH=Math.ceil((FOG_BOUNDS.maxX-FOG_BOUNDS.minX)*ATLAS_SCALE),ATLAS_HEIGHT=Math.ceil((FOG_BOUNDS.maxY-FOG_BOUNDS.minY)*ATLAS_SCALE);
const smooth=value=>value*value*(3-2*value);
let sharedFogPixels=null;
function fogPixels(){
 if(sharedFogPixels)return sharedFogPixels;
 const pixels=new Uint8ClampedArray(ATLAS_WIDTH*ATLAS_HEIGHT*4);
 // Broad deterministic value noise gives the cover a cloud texture without
 // tying its shape to the graph or changing the game's random-number stream.
 const hash=(x,y)=>{let value=Math.imul(x,374761393)^Math.imul(y,668265263);value=Math.imul(value^(value>>>13),1274126177);return((value^(value>>>16))>>>0)/4294967295;};
 const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy),a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);return(a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;};
 for(let y=0;y<ATLAS_HEIGHT;y++)for(let x=0;x<ATLAS_WIDTH;x++){
  const wx=FOG_BOUNDS.minX+(x+.5)/ATLAS_SCALE,wy=FOG_BOUNDS.minY+(y+.5)/ATLAS_SCALE;
  const cloud=noise(wx/1400,wy/1400)*.72+noise(wx/550+19,wy/550-7)*.28;
  const border=Math.min(wx-FOG_BOUNDS.minX,FOG_BOUNDS.maxX-wx,wy-FOG_BOUNDS.minY,FOG_BOUNDS.maxY-wy),fade=smooth(clamp(border/FOG_EDGE_FADE,0,1)),offset=(y*ATLAS_WIDTH+x)*4;
  pixels[offset]=38+cloud*19;pixels[offset+1]=47+cloud*20;pixels[offset+2]=44+cloud*20;pixels[offset+3]=(232+cloud*13)*fade;
 }
 sharedFogPixels=pixels;return pixels;
}
// Exact squared Euclidean distance transform of a one-dimensional line.
// Two passes over the bounded atlas build one nearest-reveal distance field;
// overlapping clearings therefore cannot accumulate dark rings or islands.
function distanceLine(input,output,length,vertices,boundaries){
 let last=0;vertices[0]=0;boundaries[0]=-Infinity;boundaries[1]=Infinity;
 for(let q=1;q<length;q++){
  let p=vertices[last],cross=((input[q]+q*q)-(input[p]+p*p))/(2*(q-p));
  while(cross<=boundaries[last]){p=vertices[--last];cross=((input[q]+q*q)-(input[p]+p*p))/(2*(q-p));}
  vertices[++last]=q;boundaries[last]=cross;boundaries[last+1]=Infinity;
 }
 last=0;for(let q=0;q<length;q++){while(boundaries[last+1]<q)last++;const delta=q-vertices[last];output[q]=delta*delta+input[vertices[last]];}
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
  this.discoveryDirty=true;this.pathsDirty=true;this.atlasDirty=true;this.atlas=null;this.fogDistances=null;this.fogImage=null;this.fogWork=null;
  this.fogStats={builds:0,width:ATLAS_WIDTH,height:ATLAS_HEIGHT,knownSeeds:0,knownSegments:0,innerRadius:CLEARING_INNER_RADIUS,outerRadius:CLEARING_RADIUS,byteLength:0};
  this.setDiscovered(new Set());
 }
 setDiscovered(discovered){
  let changed=false;
  for(let i=0;i<NODES.length;i++){const known=discovered.has(NODES[i].id)||i===START_INDEX?1:0;if(this.known[i]!==known){this.known[i]=known;changed=true;}}
  if(!changed&&!this.discoveryDirty)return false;
  this.discoveryDirty=false;this.pathsDirty=true;this.atlasDirty=true;this.unknownCount=0;
  for(let i=0;i<NODES.length;i++){this.unknown[i]=this.known[i]?0:1;this.unknownCount+=this.unknown[i];}
  this.overviewPatchDirty=true;this.regionKnownCounts.clear();for(let i=0;i<NODES.length;i++)if(this.known[i]){const id=NODES[i].regionId;this.regionKnownCounts.set(id,(this.regionKnownCounts.get(id)||0)+1);}
  this.clearings=[];
  if(this.unknownCount)for(let i=0;i<NODES.length;i++)if(this.known[i])this.clearings.push(i);
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
 buildAtlas(){
  const width=ATLAS_WIDTH,height=ATLAS_HEIGHT,length=width*height;
  if(!this.atlas){
   this.atlas=document.createElement('canvas');this.atlas.width=width;this.atlas.height=height;this.atlasContext=this.atlas.getContext('2d');
   this.fogImage=this.atlasContext.createImageData(width,height);this.fogDistances=new Float32Array(length);
   const side=Math.max(width,height);this.fogWork={input:new Float64Array(side),output:new Float64Array(side),vertices:new Int32Array(side),boundaries:new Float64Array(side+1)};
  }
  const distances=this.fogDistances;distances.fill(1e9);
  const pixel=node=>({x:clamp(Math.round((node.x-FOG_BOUNDS.minX)*ATLAS_SCALE-.5),0,width-1),y:clamp(Math.round((node.y-FOG_BOUNDS.minY)*ATLAS_SCALE-.5),0,height-1)});
  for(const index of this.clearings){const point=pixel(NODES[index]);distances[point.y*width+point.x]=0;}
  let segments=0;
  // Both endpoints must already be reached. Joining their reveal centers is
  // visual interpolation only; the node/edge records remain untouched.
  for(const edge of edges){
   if(!this.known[edge.a]||!this.known[edge.b])continue;
   const a=pixel(NODES[edge.a]),b=pixel(NODES[edge.b]),steps=Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y),1);
   for(let step=0;step<=steps;step++){const t=step/steps,x=Math.round(a.x+(b.x-a.x)*t),y=Math.round(a.y+(b.y-a.y)*t);distances[y*width+x]=0;}segments++;
  }
  const{input,output,vertices,boundaries}=this.fogWork;
  for(let y=0;y<height;y++){const row=y*width;for(let x=0;x<width;x++)input[x]=distances[row+x];distanceLine(input,output,width,vertices,boundaries);for(let x=0;x<width;x++)distances[row+x]=output[x];}
  for(let x=0;x<width;x++){for(let y=0;y<height;y++)input[y]=distances[y*width+x];distanceLine(input,output,height,vertices,boundaries);for(let y=0;y<height;y++)distances[y*width+x]=output[y];}
  const source=fogPixels(),pixels=this.fogImage.data,feather=CLEARING_RADIUS-CLEARING_INNER_RADIUS;
  for(let i=0;i<length;i++){
   const offset=i*4,amount=smooth(clamp((Math.sqrt(distances[i])/ATLAS_SCALE-CLEARING_INNER_RADIUS)/feather,0,1));
   pixels[offset]=source[offset];pixels[offset+1]=source[offset+1];pixels[offset+2]=source[offset+2];pixels[offset+3]=source[offset+3]*amount;
  }
  this.atlasContext.putImageData(this.fogImage,0,0);this.atlasDirty=false;
  this.fogStats={...this.fogStats,builds:this.fogStats.builds+1,knownSeeds:this.clearings.length,knownSegments:segments,byteLength:length*12+input.byteLength+output.byteLength+vertices.byteLength+boundaries.byteLength};
 }
 drawFog(target,view){
  if(!this.unknownCount)return;
  if(this.atlasDirty)this.buildAtlas();
  // Every zoom samples this same field. The expensive distance/texture work
  // runs only after discovery changes, never while panning or sitting idle.
  // Bilinear sampling keeps the broad feather smooth without the costly
  // high-quality resize filter on every overview pan or zoom frame.
  target.save();target.imageSmoothingEnabled=true;target.imageSmoothingQuality='low';drawFogCache(target,this.atlas,view);target.restore();
 }
 destroy(){this.destroyed=true;ART_LISTENERS.delete(this.assetListener);for(const sprite of this.spriteCache.values())sprite.width=sprite.height=0;this.spriteCache.clear();this.backgroundLayers=[];this.patchAssets={};if(this.atlas)this.atlas.width=this.atlas.height=0;this.atlas=null;this.atlasContext=null;this.fogImage=null;this.fogDistances=null;this.fogWork=null;this.paths=null;}
}
