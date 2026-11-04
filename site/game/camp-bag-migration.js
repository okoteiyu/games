/** Registered bags are plans, not the expedition's remaining tool uses. */
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const fail=()=>new TypeError('登録バッグの物資が正しくありません。');

function records(placements,{supplies,width,height},legacy=false){
 if(!Array.isArray(placements)||placements.length>width*height)throw fail();
 const ids=new Set(),singles=new Set(),occupied=new Set();
 return Array.from(placements).map((placement,index)=>{
  if(!plain(placement))throw fail();
  const {supplyId,x,y}=placement,item=typeof supplyId==='string'&&Object.hasOwn(supplies,supplyId)?supplies[supplyId]:null;
  if(!item||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height||placement.rotated!==undefined&&typeof placement.rotated!=='boolean')throw fail();
  const id=placement.id===undefined?`supply-${index}`:placement.id;
  if(typeof id!=='string'||!id.length||id.length>96||ids.has(id))throw fail();ids.add(id);
  const rotated=placement.rotated===true;
  if(legacy){
   const legacyHeight=['gloves','goggles','rope'].includes(supplyId)?2:item.height,legacyWidth=item.width;
   const w=rotated?legacyHeight:legacyWidth,h=rotated?legacyWidth:legacyHeight;
   if(x+w>width||y+h>height||(!item.repeatable||supplyId==='gloves')&&singles.has(supplyId))throw fail();singles.add(supplyId);
   for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++){const cell=row*width+col;if(occupied.has(cell))throw fail();occupied.add(cell);}
  }
  return {id,supplyId,x,y,rotated};
 });
}

function piecesFor(items,supplies){
 const pieces=items.map((record,order)=>{const item=supplies[record.supplyId];return {record,order,short:Math.min(item.width,item.height),long:Math.max(item.width,item.height)};});
 return pieces.sort((a,b)=>b.short*b.long-a.short*a.long||b.long-a.long||a.order-b.order);
}

function packGreedy(items,{supplies,width,height}){
 const occupied=new Set(),bag=[],unpacked=[];
 for(const piece of piecesFor(items,supplies)){
  let placement=null;
  for(let cell=0;cell<width*height&&!placement;cell++)for(const [w,h]of piece.short===piece.long?[[piece.short,piece.long]]:[[piece.short,piece.long],[piece.long,piece.short]]){
   const x=cell%width,y=Math.floor(cell/width);if(x+w>width||y+h>height)continue;
   const cells=[];for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++)cells.push(row*width+col);
   if(cells.some(index=>occupied.has(index)))continue;
   cells.forEach(index=>occupied.add(index));const item=supplies[piece.record.supplyId];placement={...piece.record,x,y,rotated:w!==item.width||h!==item.height};break;
  }
  if(placement)bag.push(placement);else unpacked.push(piece.record);
 }
 return {bag,unpacked};
}

function packAll(items,{supplies,width,height}){
 let area=0;
 const pieces=piecesFor(items,supplies);for(const piece of pieces)area+=piece.short*piece.long;
 if(area>width*height)return null;
 const placed=[],failed=new Set();let remainingAttempts=20000;
 function search(index,occupied,previousCode){
  if(index===pieces.length)return true;
  const piece=pieces[index],previous=pieces[index-1],same=previous&&piece.short===previous.short&&piece.long===previous.long,start=same?previousCode+1:0,key=index+':'+occupied.toString(16)+':'+start;
  if(failed.has(key))return false;
  const orientations=piece.short===piece.long?[[piece.short,piece.long]]:[[piece.short,piece.long],[piece.long,piece.short]];
  for(let cell=0;cell<width*height;cell++)for(let orientation=0;orientation<orientations.length;orientation++){
   if(remainingAttempts--<=0)return false;
   const code=cell*2+orientation;if(code<start)continue;
   const [w,h]=orientations[orientation],x=cell%width,y=Math.floor(cell/width);if(x+w>width||y+h>height)continue;
   let mask=0n;for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++)mask|=1n<<BigInt(row*width+col);
   if(mask&occupied)continue;
   const item=supplies[piece.record.supplyId];placed.push({...piece.record,x,y,rotated:w!==item.width||h!==item.height});
   if(search(index+1,occupied|mask,code))return true;placed.pop();
  }
  failed.add(key);return false;
 }
 return search(0,0n,-1)?placed:null;
}

/** First validate the historical geometry, then fit the same records safely. */
export function migrateLegacyCampBag(placements,options){
 const original=records(placements,options,true);
 try{return {bag:options.validateCurrent(original),unpacked:[],adjusted:false};}catch{}
 const greedy=packGreedy(original,options);
 if(!greedy.unpacked.length)return {bag:options.validateCurrent(greedy.bag),unpacked:[],adjusted:true};
 // Bound work during save import. Even when a difficult packing is not solved
 // within this budget, every record survives in either the grid or the pool.
 const packed=packAll(original,options);
 if(packed)return {bag:options.validateCurrent(packed),unpacked:[],adjusted:true};
 return {bag:options.validateCurrent(greedy.bag),unpacked:greedy.unpacked,adjusted:true};
}

/** Unpacked records retain their original coordinates only as a reference. */
export function normalizeUnpackedCampBag(placements,bag,options){
 const unpacked=records(placements,options),ids=new Set(bag.map(item=>item.id));
 for(const item of unpacked){if(ids.has(item.id))throw fail();ids.add(item.id);}
 return unpacked;
}
