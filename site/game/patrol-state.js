import {displayedWinChance} from './win-chance-display.js';
import { classifyOutgoingRoads } from './patrol-branches.js';
import { createPatrolMap, PATROL_RULES } from './patrol-map.js';
import { createPatrolEnemies } from './game-session.js';
export { createPatrolMap, PATROL_RULES } from './patrol-map.js';
// Compatibility for integrations that used the earlier fixture entry point.
export const createPrototypeMap=createPatrolMap;
const clone=value=>JSON.parse(JSON.stringify(value));

export class PatrolState {
 constructor({rng=Math.random,map=createPatrolMap(),enemies=null}={}) {
  if(typeof rng!=='function')throw new TypeError('乱数の入力が正しくありません。');
  this.rng=rng;this.map=clone(map);this.providedEnemies=enemies===null?null:clone(enemies);
  this.nodeById=new Map(this.map.nodes.map(node=>[node.id,node]));
  if(!this.nodeById.has(this.map.origin))throw new TypeError('始点が見つかりません。');
  this.adj=new Map(this.map.nodes.map(node=>[node.id,[]]));
  for(const [a,b] of this.map.edges){
   if(a===b||!this.adj.has(a)||!this.adj.has(b))throw new TypeError('地図の辺が正しくありません。');
   if(this.adj.get(a).includes(b))throw new TypeError('地図の辺が重複しています。');
   this.adj.get(a).push(b);this.adj.get(b).push(a);
  }
  if([...this.adj.values()].some(neighbors=>neighbors.length>4))throw new TypeError('道の最大次数は4です。');
  this.phase='idle';this.current=this.map.origin;this.previous=null;this.route=[this.current];this.target=null;
  this.moves=0;this.throws=0;this.tomatoThrows=0;this.tomatoCache=new Map();this.windowUsed=false;this.decision=null;this.battleEnemy=null;this.enemies=[];
 }
 random(){const value=Number(this.rng());if(!Number.isFinite(value))throw new TypeError('乱数が正しくありません。');return Math.min(1-Number.EPSILON,Math.max(0,value));}
 pick(items){return items.length?items[Math.floor(this.random()*items.length)]:null;}
 weightedPick(items){
  if(!items.length)return null;
  const weights=items.map(enemy=>Math.max(0,enemy.winChanceRaw??enemy.winChance)),total=weights.reduce((sum,weight)=>sum+weight,0);
  if(!Number.isFinite(total))throw new TypeError('勝敗推測の重みが正しくありません。');
  if(total<=0)return this.pick(items);
  let draw=this.random()*total;for(let i=0;i<items.length;i++){draw-=weights[i];if(draw<0)return items[i];}return items.at(-1);
 }
 shuffled(items){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
 shortestPath(from,to,{firstNeighbors=null,shuffleNeighbors=true}={}) {
  if(from===to)return [from];
  const queue=[from],parents=new Map([[from,null]]);
  for(let index=0;index<queue.length;index++){
   const current=queue[index],neighbors=current===from&&firstNeighbors!==null?firstNeighbors:this.adj.get(current);
   for(const next of (shuffleNeighbors?this.shuffled(neighbors):neighbors)){
    if(parents.has(next))continue;parents.set(next,current);
    if(next===to){const route=[to];let at=current;while(at!==null){route.unshift(at);at=parents.get(at);}return route;}
    queue.push(next);
   }
  }
  return null;
 }
 makeEnemies(){
  return createPatrolEnemies({map:this.map,rng:()=>this.random()});
 }
 start(){
  this.current=this.map.origin;this.previous=null;this.moves=0;this.throws=0;this.tomatoThrows=0;this.tomatoCache=new Map();this.windowUsed=false;this.decision=null;this.battleEnemy=null;this.target=null;this.route=[this.current];
  this.enemies=this.providedEnemies===null?this.makeEnemies():clone(this.providedEnemies);
  const occupied=new Set();
  for(const enemy of this.enemies){
   if(!this.nodeById.has(enemy.nodeId)||occupied.has(enemy.nodeId)||enemy.nodeId===this.map.origin||typeof enemy.winChance!=='number'||enemy.winChance<0||enemy.winChance>100||!Number.isFinite(enemy.winChance))throw new TypeError('珍生物の配置または仮の勝率が正しくありません。');
   occupied.add(enemy.nodeId);
   if(enemy.members!==undefined&&(!Array.isArray(enemy.members)||enemy.members.length<1||enemy.members.length>3))throw new TypeError('同じ頂点の珍生物は1〜3体です。');
   if(enemy.winChanceRaw!==undefined&&(!Number.isFinite(enemy.winChanceRaw)||enemy.winChanceRaw<0))throw new TypeError('勝敗推測が正しくありません。');
  }
  const first=this.map.firstStep&&this.adj.get(this.current).includes(this.map.firstStep)?this.map.firstStep:null;
  // Initial targets have no minimum win chance; only reachability and move budget apply.
  const candidates=this.enemies.filter(enemy=>{
   const path=first?this.shortestPath(first,enemy.nodeId,{firstNeighbors:this.adj.get(first).filter(id=>id!==this.current)}):this.shortestPath(this.current,enemy.nodeId);
   return path&&(path.length-1+(first?1:0))<=PATROL_RULES.maxMoves;
  });
  const target=this.weightedPick(candidates);
  if(!target){this.phase='unavailable';return this.snapshot();}
  this.target=target.nodeId;
  this.route=first?[this.current,...this.shortestPath(first,target.nodeId,{firstNeighbors:this.adj.get(first).filter(id=>id!==this.current)})]:this.shortestPath(this.current,target.nodeId);
  this.phase='walking';return this.snapshot();
 }
 enemyAt(nodeId){return this.enemies.find(enemy=>enemy.nodeId===nodeId)||null;}
 branches(){
  const junction=this.route[1];if(!junction||this.enemyAt(junction))return [];
  const origin=this.nodeById.get(this.current),next=this.nodeById.get(junction);
  const roads=this.adj.get(junction).map(id=>this.nodeById.get(id));
  return classifyOutgoingRoads({incoming:origin,junction:next,roads}).sort((a,b)=>['right','front','left'].indexOf(a.direction)-['right','front','left'].indexOf(b.direction));
 }
 approach(){
  if(this.phase!=='walking')return this.snapshot();
  this.windowUsed=false;this.decision=null;
  if(this.branches().length>=2)this.phase='approaching';
  return this.snapshot();
 }
 throwEggplant(nodeId){
  if(this.phase!=='approaching')return {ok:false,reason:'outside-window',snapshot:this.snapshot()};
  if(this.windowUsed)return {ok:false,reason:'already-thrown',snapshot:this.snapshot()};
  if(this.throws>=PATROL_RULES.maxThrows)return {ok:false,reason:'no-throws-left',snapshot:this.snapshot()};
  const branches=this.branches();
  if(branches.length<2)return {ok:false,reason:'no-choice',snapshot:this.snapshot()};
  if(!branches.some(branch=>branch.nodeId===nodeId))return {ok:false,reason:'invalid-road',snapshot:this.snapshot()};
  this.windowUsed=true;this.throws++;
  const junction=this.route[1],oldTarget=this.target,original=[...this.route];
  const firstNeighbors=this.adj.get(junction).filter(id=>id!==nodeId&&id!==this.current);
  // Uniform among reachable other occupied vertices, within the remaining
  // move budget. A failed candidate can no longer hide a valid alternative.
  const reachable=this.enemies.filter(enemy=>enemy.nodeId!==oldTarget).map(enemy=>({enemy,path:this.shortestPath(junction,enemy.nodeId,{firstNeighbors})})).filter(({path})=>path&&this.moves+path.length<=PATROL_RULES.maxMoves);
  const choice=this.pick(reachable),newEnemy=choice?.enemy,path=choice?.path;
  const totalMoves=path?this.moves+path.length:Infinity;
  const outcome=path&&totalMoves<=PATROL_RULES.maxMoves?'rerouted':'reluctant';
  if(outcome==='rerouted'){this.route=[this.current,...path];this.target=newEnemy.nodeId;}
  this.decision={junction,blockedNodeId:nodeId,outcome,oldTarget,newTarget:this.target,attemptedTarget:newEnemy?.nodeId||null,reachableCandidates:reachable.map(({enemy})=>enemy.nodeId),crossesEggplant:outcome==='reluctant'&&original[2]===nodeId,totalMoves:outcome==='rerouted'?totalMoves:this.moves+original.length-1};
  return {ok:true,outcome,newTarget:this.target,snapshot:this.snapshot()};
 }
 tomatoChoices(nodeId){
  const junction=this.route[1],key=[this.current,junction,this.moves,nodeId].join('|');if(this.tomatoCache.has(key))return this.tomatoCache.get(key);
  if(!junction||!this.branches().some(b=>b.nodeId===nodeId))return [];
  const choices=this.enemies.map(enemy=>{const tail=this.shortestPath(nodeId,enemy.nodeId,{firstNeighbors:this.adj.get(nodeId).filter(id=>id!==junction),shuffleNeighbors:false});return {enemy,path:tail?[junction,...tail]:null};}).filter(choice=>choice.path&&this.moves+choice.path.length<=PATROL_RULES.maxMoves);
  this.tomatoCache.set(key,choices);return choices;
 }
 throwTomato(nodeId){
  if(this.phase!=='approaching')return {ok:false,reason:'outside-window',snapshot:this.snapshot()};
  if(this.windowUsed)return {ok:false,reason:'already-thrown',snapshot:this.snapshot()};
  if(this.tomatoThrows>=2)return {ok:false,reason:'no-throws-left',snapshot:this.snapshot()};
  if(this.branches().length<2)return {ok:false,reason:'no-choice',snapshot:this.snapshot()};
  const choices=this.tomatoChoices(nodeId);if(!choices.length)return {ok:false,reason:'no-reachable-target',snapshot:this.snapshot()};
  const choice=this.pick(choices),oldTarget=this.target;this.windowUsed=true;this.tomatoThrows++;this.route=[this.current,...choice.path];this.target=choice.enemy.nodeId;
  this.decision={kind:'tomato',junction:this.route[1],attractedNodeId:nodeId,outcome:'attracted',oldTarget,newTarget:this.target,totalMoves:this.moves+choice.path.length};return {ok:true,outcome:'attracted',newTarget:this.target,snapshot:this.snapshot()};
 }
 advance(){
  if(!['walking','approaching'].includes(this.phase)||!this.route[1])return {ok:false,reason:'not-moving',snapshot:this.snapshot()};
  this.previous=this.current;this.route.shift();this.current=this.route[0];this.moves++;this.windowUsed=false;
  const enemy=this.enemyAt(this.current);
  if(enemy){this.battleEnemy=enemy;this.phase='battle';this.route=[this.current];}
  else if(this.moves>=PATROL_RULES.maxMoves||this.route.length<2){this.phase='unavailable';}
  else this.phase='walking';
  return {ok:true,outcome:enemy?'battle':'arrived',snapshot:this.snapshot()};
 }
 snapshot(){
  const tomatoNodes=this.phase==='approaching'&&!this.windowUsed&&this.tomatoThrows<2&&this.branches().length>=2?this.branches().filter(b=>this.tomatoChoices(b.nodeId).length).map(b=>b.nodeId):[];
  return clone({remainingTomatoThrows:2-this.tomatoThrows,maxTomatoThrows:2,canThrowTomato:tomatoNodes.length>0,tomatoAvailableNodes:tomatoNodes,maxMoves:PATROL_RULES.maxMoves,maxThrows:PATROL_RULES.maxThrows,map:this.map,enemies:this.enemies,current:this.current,previous:this.previous,next:this.route[1]||null,target:this.target,moves:this.moves,remainingThrows:PATROL_RULES.maxThrows-this.throws,phase:this.phase,branches:this.phase==='approaching'?this.branches():[],route:this.route,battleEnemy:this.battleEnemy,decision:this.decision,windowUsed:this.windowUsed,canThrow:this.phase==='approaching'&&!this.windowUsed&&this.throws<PATROL_RULES.maxThrows&&this.branches().length>=2});
 }
}

/** Planned-route target takes precedence over the immediately adjacent creature. */
export function branchWinChance(snapshot,nodeId){const planned=snapshot.route?.[2]===nodeId,target=planned?snapshot.enemies.find(e=>e.nodeId===snapshot.target):snapshot.enemies.find(e=>e.nodeId===nodeId);return target?{chance:displayedWinChance(target),planned,target:target.nodeId}:null;}
