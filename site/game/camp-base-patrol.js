/** Presentation-only patrol cadence. Sampling absolute elapsed time makes
 * pauses and camera/GPU restoration reproduce the same pose at any frame rate. */
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const smooth=v=>{const x=clamp(v,0,1);return x*x*(3-2*x);};
const mixAngle=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
const heading=(a,b)=>Math.atan2(b[0]-a[0],b[2]-a[2]);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>b[i]-v));
const xyz=p=>Array.isArray(p)?p.slice(0,3):[p.x,p.y,p.z];
export function createCampPatrolPlan(points,index=0){
 const path=points.map(xyz);
 if(path.length<3||path.some(p=>p.length!==3||p.some(v=>!Number.isFinite(v))))throw new TypeError('巡回経路が正しくありません。');
 const yaws=path.map((p,i)=>heading(p,path[(i+1)%path.length])),turns=yaws.map((yaw,i)=>Math.abs(Math.atan2(Math.sin(yaws[(i+1)%path.length]-yaw),Math.cos(yaws[(i+1)%path.length]-yaw))));
 const pauses=path.map((_,i)=>(i+index)%3===0?2.9+((i+index)%4)*.23:turns[i]>Math.PI/2?2.4:0),segments=[];
 let duration=0,length=0;
 for(let i=0;i<path.length;i++){
  const from=path[i],to=path[(i+1)%path.length],size=distance(from,to);if(size<=.001)throw new TypeError('巡回経路が重複しています。');
  const previous=(i-1+path.length)%path.length,acceleration=pauses[previous]>.001?Math.max(.65,turns[previous]/1.3):0,deceleration=pauses[i]>.001?.75:0,speed=Math.min(.34*(1+.065*Math.sin(index*1.9+i*.67)),acceleration+deceleration?size/(.55*(acceleration+deceleration)):Infinity),walkDuration=size/speed+(acceleration+deceleration)/2;
  segments.push({from,to,length:size,speed,acceleration,deceleration,walkDuration,pauseDuration:pauses[i],start:duration,distanceStart:length,yaw:heading(from,to)});
  duration+=walkDuration+pauses[i];length+=size;
 }
 return {segments,duration,length,offset:duration*((.09+index*.197)%1),index};
}
function progress(segment,t){
 const {speed,acceleration:a,deceleration:d,walkDuration:duration}=segment;
 let amount,rate;
 if(a&&t<a){amount=speed*(t/2-a*Math.sin(Math.PI*t/a)/(2*Math.PI));rate=(1-Math.cos(Math.PI*t/a))/2;}
 else if(d&&t>duration-d){const x=t-(duration-d);amount=speed*(duration-d-a/2+x/2+d*Math.sin(Math.PI*x/d)/(2*Math.PI));rate=(1+Math.cos(Math.PI*x/d))/2;}
 else{amount=speed*(t-a/2);rate=1;}
 return {amount:clamp(amount,0,segment.length),rate:clamp(rate,0,1)};
}
function lookAround(t,duration){
 // Glance left, briefly inspect, then right and settle before walking on.
 const keys=[[0,0],[.22,.48],[.35,.48],[.62,-.40],[.77,-.40],[1,0]];
 const x=clamp(t/duration,0,1);
 for(let i=1;i<keys.length;i++)if(x<=keys[i][0]){const[a,av]=keys[i-1],[b,bv]=keys[i];return av+(bv-av)*smooth((x-a)/(b-a));}
 return 0;
}
export function sampleCampPatrol(plan,time){
 if(!plan?.segments?.length||!Number.isFinite(time))throw new TypeError('巡回時刻が正しくありません。');
 const absolute=Math.max(0,time)+plan.offset,cycle=Math.floor(absolute/plan.duration),local=absolute%plan.duration;
 let index=plan.segments.findIndex(s=>local<s.start+s.walkDuration+s.pauseDuration);if(index<0)index=plan.segments.length-1;
 const segment=plan.segments[index],previous=plan.segments[(index-1+plan.segments.length)%plan.segments.length],next=plan.segments[(index+1)%plan.segments.length],elapsed=local-segment.start;
 if(elapsed>=segment.walkDuration){
  const paused=elapsed-segment.walkDuration,lookYaw=lookAround(paused,segment.pauseDuration),yaw=segment.yaw;
  return {position:[...segment.to],yaw,lookYaw,walkBlend:0,animationTime:(cycle*plan.length+segment.distanceStart+segment.length)/.34,phase:'watch',segment:index};
 }
 const {amount,rate}=progress(segment,elapsed),fraction=amount/segment.length,position=segment.from.map((v,i)=>v+(segment.to[i]-v)*fraction);
 let yaw=segment.yaw;
 // Entry/exit windows cannot overlap, even on a short link between corners.
 const entryWindow=Math.min(Math.max(.65,segment.acceleration),segment.walkDuration/2),exitWindow=Math.min(.65,segment.walkDuration/2);
 if(segment.acceleration&&elapsed<entryWindow)yaw=mixAngle(previous.yaw,segment.yaw,smooth(elapsed/entryWindow));
 else if(!segment.acceleration&&elapsed<entryWindow)yaw=mixAngle(previous.yaw,segment.yaw,.5+.5*smooth(elapsed/entryWindow));
 else if(!segment.deceleration&&elapsed>segment.walkDuration-exitWindow)yaw=mixAngle(segment.yaw,next.yaw,.5*smooth((elapsed-segment.walkDuration+exitWindow)/exitWindow));
 return {position,yaw,lookYaw:0,walkBlend:smooth(rate),animationTime:(cycle*plan.length+segment.distanceStart+amount)/.34,phase:'walk',segment:index};
}
