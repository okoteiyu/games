/** Classify outgoing roads by their left-to-right angular order, using the
 * incoming travel direction. Map coordinates grow rightward and downward. */
const labels={left:'左',front:'前',right:'右'};
const directionsByCount={0:[],1:['front'],2:['left','right'],3:['left','front','right']};
export function classifyOutgoingRoads({incoming,junction,roads=[]}={}){
 if(!incoming||!junction)return [];
 const incomingId=incoming.nodeId??incoming.id,dx=junction.x-incoming.x,dy=junction.y-incoming.y;
 const outgoing=roads.filter(road=>(road.nodeId??road.id)!==incomingId).map(road=>{
  const x=road.x-junction.x,y=road.y-junction.y;
  return {nodeId:road.nodeId??road.id,angle:Math.atan2(dx*y-dy*x,dx*x+dy*y)};
 }).sort((a,b)=>a.angle-b.angle||String(a.nodeId).localeCompare(String(b.nodeId)));
 const slots=directionsByCount[outgoing.length];
 if(!slots)throw new RangeError('進入路を除いた道は最大3本です。');
 return outgoing.map((road,index)=>({...road,direction:slots[index],label:labels[slots[index]]}));
}
