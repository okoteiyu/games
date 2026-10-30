import * as THREE from './vendor/three/three.module.js';

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const smooth=value=>value*value*(3-2*value);

/** Distance, rather than the retimed clip clock, drives the little sidesteps.
 * Each stop finishes both steps. A supporting foot keeps its world position.
 */
export function createFridgeFootwork({root,clip,samplePosition,stops,findNode}){
 const track=(node,property)=>clip.tracks.find(value=>value.name===node.name+'.'+property)?.createInterpolant();
 const rootRotation=track(root,'quaternion'),restRotation=rootRotation?new THREE.Quaternion().fromArray(rootRotation.evaluate(0)):root.quaternion.clone();
 const parentRotation=root.parent.getWorldQuaternion(new THREE.Quaternion());
 const rotation=parentRotation.multiply(restRotation);
 const feet=['L','R'].map(side=>{
  const node=findNode('Life.Okoteiyu.Foot.'+side);if(!node)return null;
  const translation=track(node,'position'),quaternion=track(node,'quaternion');
  const offset=(translation?new THREE.Vector3().fromArray(translation.evaluate(0)):node.position.clone()).applyQuaternion(rotation);
  const orientation=rotation.clone().multiply(quaternion?new THREE.Quaternion().fromArray(quaternion.evaluate(0)):node.quaternion);
  return {node,offset,orientation,phase:'support',lift:0};
 }).filter(Boolean);
 const sections=[];
 for(let index=1;index<stops.length;index++){
  const start=stops[index-1],end=stops[index],count=Math.max(8,Math.ceil((end-start)*120)),points=[],distances=[0];
  for(let i=0;i<=count;i++){
   const point=samplePosition(THREE.MathUtils.lerp(start,end,i/count));points.push(point);
   if(i)distances.push(distances[i-1]+Math.hypot(point.x-points[i-1].x,point.z-points[i-1].z));
  }
  const distance=distances[count];sections.push({start,end,points,distances,distance,cycles:Math.max(1,Math.ceil(distance/.09))});
 }
 return {feet,sections};
}

function pointAtDistance(section,distance){
 const {points,distances}=section;let low=0,high=distances.length-1;
 while(low+1<high){const middle=(low+high)>>1;if(distances[middle]<distance)low=middle;else high=middle;}
 const span=distances[high]-distances[low];
 return points[low].clone().lerp(points[high],span>1e-10?clamp((distance-distances[low])/span,0,1):0);
}

export function applyFridgeFootwork(footwork,time){
 const {sections,feet}=footwork,section=sections.find(value=>time<value.end-1e-8)||sections.at(-1);
 if(!section)return;
 const progress=clamp((time-section.start)/(section.end-section.start),0,1)*(section.points.length-1),index=Math.min(section.points.length-2,Math.floor(progress));
 const distance=THREE.MathUtils.lerp(section.distances[index],section.distances[index+1],progress-index),stride=section.distance/section.cycles;
 for(const [side,foot] of feet.entries()){
  let point=section.points[0].clone(),lift=0,swing=false;
  if(stride>1e-5){
   const shift=side*.5,phase=distance/stride-shift,cycle=Math.floor(Math.max(0,phase)),fraction=phase-cycle;
   const landing=number=>number===section.cycles-1?section.distance:clamp((number+.65+shift)*stride,0,section.distance);
   if(phase>=0){
    const to=pointAtDistance(section,landing(cycle));
    swing=fraction<.44&&distance<section.distance-1e-8;
    if(swing){
     const from=pointAtDistance(section,cycle?landing(cycle-1):0),u=clamp(fraction/.44,0,1);
     point=from.lerp(to,smooth(u));lift=.012*Math.sin(Math.PI*u)**2;
    }else point=to;
   }
  }
  point.add(foot.offset);point.y+=lift;
  foot.node.position.copy(foot.node.parent.worldToLocal(point));
  foot.node.quaternion.copy(foot.node.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(foot.orientation));
  foot.phase=swing?'swing':'support';foot.lift=lift;
 }
}
