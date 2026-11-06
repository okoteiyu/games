/** A fairy occupies an undirected road, independently of travel direction. */
export const campEdgeKey=(a,b)=>JSON.stringify(a<b?[a,b]:[b,a]);
export function campBlockedEdges(edges=[],nodes=[]){
 if(!Array.isArray(edges))throw new TypeError('避けるキャンプの道は配列で指定してください。');
 if(!edges.length)return {pairs:[],keys:new Set(),key:''};
 const index=new Map(nodes.map(node=>[node.id,node])),pairs=new Map();
 for(const pair of edges){
  if(!Array.isArray(pair)||pair.length!==2||pair.some(id=>typeof id!=='string')||pair[0]===pair[1]||!index.get(pair[0])?.neighbors.includes(pair[1])||!index.get(pair[1])?.neighbors.includes(pair[0]))throw new TypeError('避けるキャンプの道が正しくありません。');
  const [a,b]=pair,key=campEdgeKey(a,b);pairs.set(key,a<b?[a,b]:[b,a]);
 }
 const keys=[...pairs.keys()].sort();return {pairs:keys.map(key=>pairs.get(key)),keys:new Set(keys),key:keys.join(';')};
}
