/** Formal route-map geometry, authored offline with tools/build-patrol-map.py; no runtime generation dependency. */
const POINTS=[[0.5,0.5],[0.43,0.95],[0.55,0.94],[0.48,0.87],[0.2573291,0.3369149],[0.7646553,0.6568667],[0.4030875,0.3512044],[0.5874948,0.2211934],[0.6537529,0.8932046],[0.2759387,0.8995042],[0.6488413,0.1403492],[0.6757336,0.3455608],[0.7081961,0.2509201],[0.1276192,0.1973071],[0.3576892,0.4690219],[0.2921147,0.781041],[0.227032,0.1702275],[0.1365816,0.5877255],[0.8844696,0.7000554],[0.8208907,0.8821106],[0.4955393,0.2986581],[0.457083,0.6468846],[0.3063206,0.115598],[0.8012496,0.2153162],[0.6050705,0.5329018],[0.2758664,0.6644925],[0.1269758,0.8338155],[0.3336639,0.2142769],[0.1068003,0.4187732],[0.5463253,0.3816248],[0.1631568,0.7205845],[0.9250035,0.8263717],[0.0960361,0.3133881],[0.7339567,0.0563517],[0.1376307,0.9392187],[0.9271984,0.5030934],[0.7353264,0.4234451],[0.9282444,0.0946494],[0.6241864,0.6363217],[0.4421593,0.2074825]];
const CONNECTIONS=[[0,6],[0,14],[0,24],[0,29],[1,2],[1,3],[1,9],[1,34],[2,3],[2,8],[3,8],[3,38],[4,16],[4,27],[4,28],[4,32],[5,8],[5,19],[5,35],[5,38],[6,20],[6,29],[6,39],[7,10],[7,11],[7,20],[7,39],[8,19],[9,15],[9,34],[10,12],[10,22],[10,33],[11,12],[11,29],[11,36],[12,23],[12,36],[13,16],[13,22],[13,32],[14,17],[14,21],[14,28],[15,21],[15,25],[15,26],[16,22],[16,27],[17,26],[17,30],[18,19],[18,31],[18,35],[19,31],[20,29],[21,24],[21,38],[22,39],[23,33],[23,35],[23,37],[24,36],[24,38],[26,30],[26,34],[27,39],[28,32],[33,37],[35,36]];
export const PATROL_RULES=Object.freeze({maxMoves:6,maxThrows:2,minEnemyVertices:10,maxEnemyVertices:12,maxEnemiesPerVertex:3});
export const REGION_GEOMETRY=Object.freeze({center:[.5,1],cityRadius:.15,residentialRadius:.7});
export const REGION_LABELS=Object.freeze({city:'都市部',residential:'住宅街',forest:'森林'});
/** Normalized image coordinates; x grows right and y grows down. */
export function getRegionAt(x,y){
 if(typeof x==='object'&&x!==null){y=x.y;x=x.x;}
 const radius=Math.hypot(x-.5,y-1);
 return radius<=.15+1e-12?'city':radius<=.7+1e-12?'residential':'forest';
}
/** Boundary precedence for battles: city beats housing, forest beats housing. */
export function getBattleRegionAt(point){
 const radius=Math.hypot(point.x-.5,point.y-1);
 return radius<=.15+1e-8?'city':radius>=.7-1e-8?'forest':'residential';
}
/** Split an edge exactly at the two zone circles, including cross-zone edges. */
export function segmentRegions(a,b){
 const dx=b.x-a.x,dy=b.y-a.y,ox=a.x-.5,oy=a.y-1,A=dx*dx+dy*dy;
 if(A<1e-20)return [{start:0,end:1,region:getRegionAt(a)}];
 const cuts=[0,1],B=2*(ox*dx+oy*dy);
 for(const radius of [.15,.7]){
  const C=ox*ox+oy*oy-radius*radius,discriminant=B*B-4*A*C;
  if(discriminant<0)continue;
  const root=Math.sqrt(discriminant);
  for(const t of [(-B-root)/(2*A),(-B+root)/(2*A)])if(t>1e-10&&t<1-1e-10)cuts.push(t);
 }
 cuts.sort((x,y)=>x-y);const unique=cuts.filter((t,i)=>i===0||t-cuts[i-1]>1e-10),segments=[];
 for(let i=0;i<unique.length-1;i++){
  const start=unique[i],end=unique[i+1],t=(start+end)/2;
  segments.push({start,end,region:getRegionAt(a.x+dx*t,a.y+dy*t)});
 }
 return segments;
}
export function createPatrolMap(){
 const nodes=POINTS.map(([x,y],index)=>({id:index===0?'home':`n${String(index).padStart(2,'0')}`,x,y,region:getRegionAt(x,y)}));
 const edges=CONNECTIONS.map(([a,b])=>[nodes[a].id,nodes[b].id]);
 const edgeRegions=CONNECTIONS.map(([a,b])=>({edge:[nodes[a].id,nodes[b].id],segments:segmentRegions(nodes[a],nodes[b])}));
 return {id:'road-map-01',schemaVersion:1,nodes,edges,edgeRegions,origin:'home',backgroundUrl:'assets/patrol-map-background.webp?v=90ed7765751e4f360c15f8db5a86f75c0d4c20952e9697dc87d3608e922b8b41',temporary:false,bounds:{minX:0,minY:0,maxX:1,maxY:1},rules:{...PATROL_RULES},regionGeometry:{...REGION_GEOMETRY,center:[.5,1]}};
}
