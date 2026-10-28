import {ADDED_CREATURES} from './creature-expansion.js';
import {NO_ADDITIONAL_EFFECTS} from './additional-effects.js';
import {INITIAL_PLAYER_LEVEL,INITIAL_CALM_POINTS} from './initial-state.js';
import {normalizeVisitorName} from './visitor-profile.js';
import {currentTimeOfDay} from './world-time.js';
import {SUPPORT_ITEMS,DEFENSE_ITEMS,equipmentMultipliers} from './equipment-rules.js';
export {SUPPORT_ITEMS,DEFENSE_ITEMS,equipmentMultipliers} from './equipment-rules.js';
import {getRegionAt} from './patrol-map.js';
import {ENCOUNTER_PROFILES,TRAINING_COURSES,overlapLevelBand,patrolSpeciesEligible,trainingLevelRange} from './encounter-rules.js';
export {TRAINING_COURSES} from './encounter-rules.js';
import {selectOkoteiyuReward,eligibleOkoteiyuRewards} from './okoteiyu-events.js';
import {TECHNIQUES,ADDED_TECHNIQUE_IDS,PLAYER_TECHNIQUE_IDS,playerTechniqueLevel,availableTechniqueIds,defaultTechniqueSlots,validateTechniqueSlots,SUPER_CONFIGURATIONS,superStateDetails,SUPER_MAX_LEVEL,clampTechniqueLevel,techniquePower} from './technique-rules.js';
/** Pure game rules shared by the browser and native WebView. */
const clone=value=>JSON.parse(JSON.stringify(value));
const EPSILON=1e-10;
const STAT_KEYS=['hp','attack','ki','speed'];
export const CREATURE_CATEGORIES=Object.freeze({normal:Object.freeze({label:'通常',description:'パトロールなどに登場する、特別ではない珍生物。'}),threat:Object.freeze({label:'脅威',description:'通常カテゴリに比べて戦闘力が高い種族。'}),unique:Object.freeze({label:'ユニーク',description:'その個体しか存在せず、ストーリーやイベントに登場する。レベルなどは固定。'})});
export const CREATURES=Object.freeze({
 okoteiyu:Object.freeze({id:'okoteiyu',techniques:PLAYER_TECHNIQUE_IDS,additionalEffects:NO_ADDITIONAL_EFFECTS,auraAdditionalEffects:NO_ADDITIONAL_EFFECTS,name:'おこていゆ',height:.45,ranks:Object.freeze({hp:4,attack:6,ki:5,speed:5})}),
 horarara_horaran:Object.freeze({...ENCOUNTER_PROFILES.horarara_horaran,id:'horarara_horaran',additionalEffects:NO_ADDITIONAL_EFFECTS,auraAdditionalEffects:NO_ADDITIONAL_EFFECTS,techniques:Object.freeze(['normal_attack','energy_ray']),name:'ホラララホララン',category:'normal',height:.4,ranks:Object.freeze({hp:5,attack:5,ki:5,speed:5})}),
 moai_king:Object.freeze({...ENCOUNTER_PROFILES.moai_king,id:'moai_king',additionalEffects:NO_ADDITIONAL_EFFECTS,auraAdditionalEffects:NO_ADDITIONAL_EFFECTS,techniques:Object.freeze(['normal_attack','energy_ray']),name:'モアイの戦士',category:'normal',height:2.5,ranks:Object.freeze({hp:14,attack:9,ki:9,speed:2})}),
 ...ADDED_CREATURES
});
export const PATROL_CALM_COST=1;
export const PROTOTYPE_CHOICES=Object.freeze({
 initialCharacterLevel:INITIAL_PLAYER_LEVEL,initialTechniqueLevel:1,superLevelIncrement:1,
 initialRecovery:`A fresh game starts with ${INITIAL_CALM_POINTS} calm points; saved progress retains its stored balance.`,
 unlockedCommandsAfterBattle:true,angerPointsRetainedBetweenBattles:true,
 angerOutcomeAtCap:'Remove capped rewards and draw from the remaining relative weights; no reward when all entries are capped.',
 statOrder:'Base -> equipped aura -> equipment parameter multipliers -> attack and ki super multiplier; truncate resulting stats to one decimal and clamp speed to at least one.',
 winPrediction:'Use maximum aura-adjusted self parameters and mean opponent parameters, excluding held equipment and temporary super; multiply by 0.7 to (opponent count minus one).',
 firstAttack:'Wait one jittered interval; the next interval starts when the current motion completes.',
 jitterDistribution:'Uniform over minus/plus ten percent, redrawn for every action.',
 simultaneousCompletions:'Player completes first, then opponents in stable order; a fatigued actor cancels only its own unfinished action.',
 enemyCommonAttack:'Normal attack is attack times 0.8 plus technique level; Energy Ray uses ki times 1.1 plus technique level. Enemy technique levels are capped by their individual technique definition.',
 automaticTechnique:'Player cycles through the equipped slots; each opponent cycles through its assigned repertoire. A call chooses the next equipped attack once.',
 awakening:'Reserve the single use, finish the current player attack, then a fixed 1.5 second awakening; enemy continues.',
 superDuration:'Count from the beginning of awakening, including its 1.5 seconds.',
 experience:'Use (enemy level + sum of its four parameter ranks) / 2, preserve fractional experience and carry excess across floor(current level ** 1.3 * 15) thresholds.',
 levelOneSpawn:'Ten to twelve eligible vertices, one to three members independently. Species habitat and native band intersect player level minus/plus five; previous ratio-based samples are replaced.',
 saveScope:'Home only, outside an anger cut-in; calm points are stored by the host separately, retaining the legacy relaxStreak key.',
 groupBattle:'All opponents act independently; player attacks the first living opponent. Win when all opponents fatigue. Group wins settle all rewards and journal defeats; losses retain XP only for fatigued opponents.',
 groupSpeed:'All participants use the slowest equipped parameter speed in the group as one reference; super divides the player interval afterward.',
 initialTargetPool:'All reachable occupied vertices are eligible without a win-prediction threshold; select by raw win-prediction weight.'
});

function finite(value,label){if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(label+' must be finite.');return value;}
function integer(value,label,min=0,max=Number.MAX_SAFE_INTEGER){if(!Number.isSafeInteger(value)||value<min||value>max)throw new RangeError(label+' is outside its allowed range.');return value;}
function checkedCreature(id){if(!Object.hasOwn(CREATURES,id))throw new RangeError('Unknown creature: '+id);return CREATURES[id];}
export function truncateStat(value){finite(value,'stat');if(value<0)throw new RangeError('A stat cannot be negative.');return Math.floor((value+Number.EPSILON*Math.max(1,value)*2)*10)/10;}
/** Super boosts both offensive parameters, without mutating permanent stats. */
export function normalizeStat(stat,value){const rounded=truncateStat(value);return stat==='speed'?Math.max(1,rounded):rounded;}
export function applySuperStats(stats,multiplier=1){
 finite(multiplier,'super multiplier');if(multiplier<=0)throw new RangeError('Invalid super multiplier.');
 return {...stats,speed:normalizeStat('speed',stats.speed),attack:truncateStat(stats.attack*multiplier),ki:truncateStat(stats.ki*multiplier)};
}
export function creatureStats(speciesId,level){
 const {ranks}=checkedCreature(speciesId);integer(level,'character level',1,106);
 return Object.fromEntries(STAT_KEYS.map(key=>[key,parameterValue(ranks[key],level,key)]));
}
export function parameterValue(rank,level,stat='attack'){integer(rank,'parameter rank',0,15);integer(level,'character level',1,106);if(!STAT_KEYS.includes(stat))throw new RangeError('Unknown parameter.');return normalizeStat(stat,(rank===0?1:rank*level*6/10)*(stat==='hp'?5:1));}
export function applyAuraStats(stats,auraId='okoteiyu',auraLevel=1){
 if(auraId===null)return Object.fromEntries(STAT_KEYS.map(key=>[key,normalizeStat(key,finite(stats[key],key))]));
 const aura=checkedCreature(auraId);integer(auraLevel,'aura level',1,auraId==='okoteiyu'?1:30);
 return Object.fromEntries(STAT_KEYS.map(key=>{const base=finite(stats[key],key);if(base<=0)throw new RangeError('A combat stat must be positive.');return[key,normalizeStat(key,auraId==='okoteiyu'?base*1.2:base+aura.ranks[key]*auraLevel*6/10*(key==='hp'?5:1))];}));
}
export function statTotal(stats){return STAT_KEYS.reduce((sum,key)=>sum+finite(stats[key],key),0);}
export function defeatedEnemyExperience(speciesId,level){
 const {ranks}=checkedCreature(speciesId);integer(level,'opponent level',1,106);
 return (level+statTotal(ranks))/2;
}
export function requiredLevelExperience(level){
 integer(level,'character level',1,106);return Math.floor(level**1.3*15);
}
export function estimateWinChance(playerStats,enemyStats){
 const opponents=Array.isArray(enemyStats)?enemyStats:[enemyStats];integer(opponents.length,'opponent count',1,3);
 const average=opponents.reduce((sum,stats)=>sum+statTotal(stats),0)/opponents.length;
 if(average<=0)throw new RangeError('Opponent stat total must be positive.');
 return 50*statTotal(playerStats)/average*.7**(opponents.length-1);
}
export function actionIntervals(playerSpeed,enemySpeed,superMultiplier=1){
 finite(playerSpeed,'player speed');finite(enemySpeed,'enemy speed');finite(superMultiplier,'super multiplier');
 if(playerSpeed<=0||enemySpeed<=0||superMultiplier<=0)throw new RangeError('Speeds and multiplier must be positive.');
 let player=3,enemy=3;if(playerSpeed>enemySpeed)player=Math.max(1.2,3*enemySpeed/playerSpeed);else if(enemySpeed>playerSpeed)enemy=Math.max(1.2,3*playerSpeed/enemySpeed);
 return {player:player/superMultiplier,enemy};
}
export function auraDropPercent(level){integer(level,'opponent level',1,106);return Math.floor(10+level*level*.00008);}

function randomValue(rng){const value=Number(rng());if(!Number.isFinite(value))throw new TypeError('The random source must return a finite number.');return Math.min(1-Number.EPSILON,Math.max(0,value));}
function shuffle(items,rng){const result=[...items];for(let index=result.length-1;index>0;index--){const at=Math.floor(randomValue(rng)*(index+1));[result[index],result[at]]=[result[at],result[index]];}return result;}
function prototypePlayer(){return {speciesId:'okoteiyu',name:'おこていゆ',level:INITIAL_PLAYER_LEVEL,xp:0,superLevel:1,punchLevel:1,energyRayLevel:1,energyRayUnlocked:false,unlockedTechniques:[],techniqueLevels:Object.fromEntries(ADDED_TECHNIQUE_IDS.map(id=>[id,1])),techniqueSlots:['punch',null,null],superConfiguration:'none',equipmentRulesVersion:1,ownedItems:{support:['moai_kun','hard_glove','stored_ki'],defense:['acrylic_shield','iron_shield','aura_shield']},equipment:{support:'moai_kun',defense:'acrylic_shield'},equippedAura:'okoteiyu',auras:{okoteiyu:{speciesId:'okoteiyu',name:'おこていゆのオーラ',level:1,copies:1,progress:0}},journal:{},battlesWon:0,battlesLost:0};}
function recordJournalEncounter(player,enemy){
 const speciesId=enemy.speciesId,entry=player.journal[speciesId]||{speciesId,name:enemy.name,encounters:0,defeats:0,patrolDefeats:0,lastLevel:enemy.level};
 entry.encounters++;entry.lastLevel=enemy.level;player.journal[speciesId]=entry;return entry;
}
export function playerStats(player,{equipment=true}={}){const aura=player.auras?.[player.equippedAura],base=applyAuraStats(creatureStats('okoteiyu',player.level||1),player.equippedAura??null,aura?.level||1);if(!equipment)return base;const factors=equipmentMultipliers(player.equipment);return Object.fromEntries(STAT_KEYS.map(key=>[key,normalizeStat(key,base[key]*factors[key])]));}

/** Existing PatrolState uses bounded color probabilities; preserve the raw formula separately. */
export function createPatrolEnemies({map,player,rng=Math.random,patrolId=1,timeOfDay=currentTimeOfDay()}={}){
 if(!map?.nodes||!map?.edges||!map.nodes.some(node=>node.id===map.origin))throw new TypeError('A patrol map is required.');
 const profile=player?.player||player||prototypePlayer();integer(profile.level,'player level',1,106);const ownStats=playerStats({...prototypePlayer(),...profile},{equipment:false});
 const excluded=new Set([map.origin]);for(const [a,b]of map.edges){if(a===map.origin)excluded.add(b);if(b===map.origin)excluded.add(a);}
 const available=map.nodes.filter(node=>!excluded.has(node.id)).map(node=>({node,region:Number.isFinite(node.x)&&Number.isFinite(node.y)?getRegionAt(node):node.region,pool:[]}));
 for(const entry of available)entry.pool=Object.values(CREATURES).filter(c=>patrolSpeciesEligible(c,profile.level,entry.region,timeOfDay));
 const eligible=available.filter(entry=>entry.pool.length);if(!eligible.length)return [];
 const occupiedCount=Math.min(eligible.length,10+Math.floor(randomValue(rng)*3));
 const nodes=shuffle(eligible,rng).slice(0,occupiedCount);
 return nodes.map(({node,pool,region},index)=>{
  const count=1+Math.floor(randomValue(rng)*3),id='patrol-'+patrolId+'-'+(index+1);
  const members=Array.from({length:count},(_,member)=>{
   // Retain the prototype's 1:7 species weight among eligible habitats only.
   const weights=pool.map(c=>c.id==='moai_king'?1:c.id==='horarara_horaran'?7:1),total=weights.reduce((a,b)=>a+b,0);let draw=randomValue(rng)*total,creature=pool.at(-1);
   for(let i=0;i<pool.length;i++){draw-=weights[i];if(draw<0){creature=pool[i];break;}}
   const band=overlapLevelBand(creature,profile.level-5,profile.level+5),level=band.min+Math.floor(randomValue(rng)*(band.max-band.min+1)),speciesId=creature.id;
   return {id:id+'-'+(member+1),speciesId,name:creature.name,category:creature.category,level,stats:creatureStats(speciesId,level)};
  });
  const stats=Object.fromEntries(STAT_KEYS.map(key=>[key,members.reduce((sum,member)=>sum+member.stats[key],0)/count])),raw=estimateWinChance(ownStats,members.map(member=>member.stats));
  return {...members[0],id,nodeId:node.id,region,members,count,stats,name:count===1?members[0].name:count+'体の珍生物',winChance:Math.min(100,Math.max(0,raw)),winChanceRaw:raw,temporary:false,prototypeLevelSample:true};
 });
}
export function eligibleTrainingCreatures(player,tier='easy',catalog=CREATURES){return Object.values(catalog).filter(creature=>trainingLevelRange(player,creature,tier));}
export function createTrainingEnemy({player,tier='easy',rng=Math.random}={}){
 integer(player?.level,'player level',1,106);const pool=eligibleTrainingCreatures(player,tier);
 if(!pool.length)throw new Error('この訓練の条件に合う珍生物がいません。');
 const creature=pool[Math.floor(randomValue(rng)*pool.length)],band=trainingLevelRange(player,creature,tier),level=band.min+Math.floor(randomValue(rng)*(band.max-band.min+1));
 return {id:'training-opponent',speciesId:creature.id,name:creature.name,category:creature.category,level,trainingTier:tier};
}

function restorePlayer(saved){
 if(!saved||typeof saved!=='object')throw new TypeError('A player profile is required.');
 const player=prototypePlayer();for(const [key,min,max]of [['level',1,106],['superLevel',1,SUPER_MAX_LEVEL],['punchLevel',1,Number.MAX_SAFE_INTEGER],['energyRayLevel',1,Number.MAX_SAFE_INTEGER],['battlesWon',0,Number.MAX_SAFE_INTEGER],['battlesLost',0,Number.MAX_SAFE_INTEGER]])player[key]=integer(saved[key],key,min,max);
 player.punchLevel=clampTechniqueLevel('punch',player.punchLevel);player.energyRayLevel=clampTechniqueLevel('energy_ray',player.energyRayLevel);
 player.xp=finite(saved.xp,'experience');if(player.xp<0)throw new RangeError('Experience cannot be negative.');
 if(saved.unlockedTechniques!==undefined){if(!Array.isArray(saved.unlockedTechniques)||new Set(saved.unlockedTechniques).size!==saved.unlockedTechniques.length||saved.unlockedTechniques.some(id=>!ADDED_TECHNIQUE_IDS.includes(id)))throw new TypeError('Invalid unlocked techniques.');player.unlockedTechniques=[...saved.unlockedTechniques];}
 if(saved.techniqueLevels!==undefined){if(!saved.techniqueLevels||typeof saved.techniqueLevels!=='object'||Array.isArray(saved.techniqueLevels)||Object.keys(saved.techniqueLevels).some(id=>!ADDED_TECHNIQUE_IDS.includes(id)))throw new TypeError('Invalid technique levels.');for(const [id,level]of Object.entries(saved.techniqueLevels))player.techniqueLevels[id]=clampTechniqueLevel(id,integer(level,'technique level',1));}
 if(typeof saved.energyRayUnlocked!=='boolean')throw new TypeError('Energy Ray unlock must be boolean.');player.energyRayUnlocked=saved.energyRayUnlocked;player.techniqueSlots=validateTechniqueSlots(saved.techniqueSlots===undefined?defaultTechniqueSlots(player):saved.techniqueSlots,player);player.superConfiguration=saved.superConfiguration??'none';if(!Object.hasOwn(SUPER_CONFIGURATIONS,player.superConfiguration))throw new TypeError('Unknown super configuration.');
 if(!saved.auras||typeof saved.auras!=='object'||Array.isArray(saved.auras))throw new TypeError('Aura collection is required.');
 player.auras={};for(const [id,aura]of Object.entries(saved.auras)){
  checkedCreature(id);if(!aura||typeof aura!=='object')throw new TypeError('Invalid aura entry.');const copies=integer(aura.copies,'aura copies',1);
  const level=id==='okoteiyu'?1:Math.min(30,1+Math.floor((copies-1)/3)),progress=id==='okoteiyu'||level===30?0:(copies-1)%3;
  if(aura.level!==level||aura.progress!==progress||(id==='okoteiyu'&&copies!==1))throw new RangeError('Aura level does not match its acquired copies.');
  player.auras[id]={speciesId:id,name:CREATURES[id].name+'のオーラ',copies,level,progress};
 }
 if(!Object.hasOwn(player.auras,'okoteiyu')||(saved.equippedAura!==null&&!Object.hasOwn(player.auras,saved.equippedAura)))throw new RangeError('The equipped aura is not owned.');player.equippedAura=saved.equippedAura;
 if(saved.ownedItems!==undefined){
  const owned=saved.ownedItems;if(!owned||typeof owned!=='object'||!Array.isArray(owned.support)||!Array.isArray(owned.defense)||owned.support.some(id=>!Object.hasOwn(SUPPORT_ITEMS,id))||owned.defense.some(id=>!Object.hasOwn(DEFENSE_ITEMS,id))||new Set(owned.defense).size!==owned.defense.length||new Set(owned.support).size!==owned.support.length)throw new TypeError('Invalid item inventory.');
  player.ownedItems={support:[...owned.support],defense:[...owned.defense]};
 }
 if(saved.equipment!==undefined){
  const gear=saved.equipment;if(!gear||typeof gear!=='object'||(gear.support!==null&&!player.ownedItems.support.includes(gear.support))||(gear.defense!==null&&!player.ownedItems.defense.includes(gear.defense)))throw new TypeError('Invalid equipped items.');
  player.equipment={support:gear.support,defense:gear.defense};
 }else if(!player.ownedItems.support.includes(player.equipment.support))player.equipment.support=null;
 if(saved.equipmentRulesVersion===undefined){if(!player.ownedItems.defense.includes('acrylic_shield'))player.ownedItems.defense.push('acrylic_shield');player.equipment.defense='acrylic_shield';}
 else integer(saved.equipmentRulesVersion,'equipment rules version',1,1);
 for(const id of ['hard_glove','stored_ki'])if(!player.ownedItems.support.includes(id))player.ownedItems.support.push(id);
 for(const id of ['iron_shield','aura_shield'])if(!player.ownedItems.defense.includes(id))player.ownedItems.defense.push(id);
 if(!saved.journal||typeof saved.journal!=='object'||Array.isArray(saved.journal))throw new TypeError('Journal must be a record.');
 player.journal={};for(const [id,entry]of Object.entries(saved.journal)){
  checkedCreature(id);if(!entry||typeof entry!=='object')throw new TypeError('Invalid journal entry.');
  const defeats=integer(entry.defeats,'defeats',0),patrolDefeats=entry.patrolDefeats===undefined?defeats:integer(entry.patrolDefeats,'patrol defeats',0,defeats);
  player.journal[id]={speciesId:id,name:CREATURES[id].name,encounters:integer(entry.encounters,'encounters',0),defeats,patrolDefeats,lastLevel:integer(entry.lastLevel,'journal level',1,106)};
 }
 return player;
}

/** Validate and normalize the persistent home-only save payload without side effects. */
export function validateSessionState(saved){
 if(!saved||saved.schemaVersion!==1)throw new TypeError('Unsupported game-session save schema.');
 const pending=saved.pendingAngerEvent===true;if(saved.pendingAngerEvent!==undefined&&typeof saved.pendingAngerEvent!=='boolean')throw new TypeError('Invalid pending anger event.');const angerPoints=saved.angerPoints===undefined?0:integer(saved.angerPoints,'anger points',0,pending?3:2);if(pending&&angerPoints!==3)throw new TypeError('Pending anger requires three points.');
 const player=restorePlayer(saved.player),angerEvents=integer(saved.angerEvents,'anger events',0),patrolCount=integer(saved.patrolCount,'patrol count',0);
 if(typeof saved.commandsLocked!=='boolean')throw new TypeError('Command lock must be boolean.');
 const interferenceUsedSinceBattle=saved.interferenceUsedSinceBattle===undefined?false:saved.interferenceUsedSinceBattle;
 if(typeof interferenceUsedSinceBattle!=='boolean')throw new TypeError('Interference lock must be boolean.');
 const patrolUsedSinceRecovery=saved.patrolUsedSinceRecovery??false;if(typeof patrolUsedSinceRecovery!=='boolean')throw new TypeError('Patrol cooldown must be boolean.');
 return clone({schemaVersion:1,visitorName:normalizeVisitorName(saved.visitorName),player,angerPoints,...(pending?{pendingAngerEvent:true}:{}),commandsLocked:saved.commandsLocked,interferenceUsedSinceBattle,patrolUsedSinceRecovery,angerEvents,patrolCount});
}

export class GameSession{
 constructor({rng=Math.random,onEvent=()=>{},state=null,now=()=>new Date()}={}){
  if(typeof rng!=='function'||typeof onEvent!=='function')throw new TypeError('Invalid session callbacks.');
  this.rng=rng;this.now=now;this.onEvent=onEvent;this.eventLog=[];
  this.state={schemaVersion:1,visitorName:null,location:'home',player:prototypePlayer(),angerPoints:0,commandsLocked:false,interferenceUsedSinceBattle:false,interferenceBonusAvailable:false,patrolUsedSinceRecovery:false,pendingAngerEvent:false,angerEvents:0,patrolCount:0,battle:null,lastBattle:null};
  if(state!==null)this.importState(state);
 }
 emit(type,detail={}){const event={type,...detail};this.eventLog.push(clone(event));if(this.eventLog.length>120)this.eventLog.shift();this.onEvent(event);return event;}
 random(){return randomValue(this.rng);}
 get player(){return this.state.player;}
 observation(){const aura=this.player.auras[this.player.equippedAura];return {level:this.player.level,experience:{current:this.player.xp,required:this.player.level<100?requiredLevelExperience(this.player.level):null},stats:playerStats(this.player),equipment:{support:this.player.equipment.support||'none',defense:this.player.equipment.defense||'none'},items:{support:SUPPORT_ITEMS[this.player.equipment.support]?.name||'なし',defense:DEFENSE_ITEMS[this.player.equipment.defense]?.name||'なし'},aura:aura?{id:this.player.equippedAura,name:aura.name,level:aura.level}:null};}
 snapshot(){return clone({...this.state,player:{...this.player,stats:playerStats(this.player),nextLevelExperience:this.player.level<100?requiredLevelExperience(this.player.level):null},battle:this.snapshotBattle()});}
 commandAvailability(relaxStreak=0){
  const home=this.state.location==='home'&&!this.state.pendingAngerEvent,points=Number.isSafeInteger(relaxStreak)&&relaxStreak>=0?relaxStreak:0,interfereBonus=home&&this.state.interferenceBonusAvailable;
  const trainings=Object.fromEntries(Object.keys(TRAINING_COURSES).map(tier=>[tier,home&&points>=1&&eligibleTrainingCreatures(this.player,tier).length>0])),patrolAvailable=Object.values(CREATURES).some(c=>patrolSpeciesEligible(c,this.player.level,null,currentTimeOfDay(this.now())));
  return {patrol:home&&points>=PATROL_CALM_COST&&patrolAvailable,patrolAvailable,training:trainings.easy,trainings,meal:home,research:home,rest:home,food:home,chair:home,bed:home,interfere:home&&(interfereBonus||points>=3),interfereBonus,commandsLocked:false,recovered:points>=3};
 }
 requestInterference({relaxStreak=0,spendCalmPoints=null}={}){
  if(!this.commandAvailability(relaxStreak).interfere)return {ok:false,reason:'interference-unavailable'};
  const bonusUsed=this.state.interferenceBonusAvailable,calmPointsCost=bonusUsed?0:3,calmCostCommitted=spendCalmPoints!==null;
  if(calmCostCommitted&&calmPointsCost>0&&spendCalmPoints(calmPointsCost)!==true)return {ok:false,reason:'not-enough-calm'};
  this.state.interferenceUsedSinceBattle=true;this.state.interferenceBonusAvailable=false;
  return {ok:true,bonusUsed,calmPointsSpent:calmPointsCost,...this.addAngerPoint({reason:'relax-interference',calmPointsCost,calmCostCommitted,bonusUsed})};
 }
 requestPatrol({relaxStreak=0,spendCalmPoints=null}={}){
  if(this.state.location!=='home')return {ok:false,reason:'not-home',resetRelaxStreak:false};
  if(this.state.pendingAngerEvent)return {ok:false,reason:'anger-event-pending',resetRelaxStreak:false};
  if(!Object.values(CREATURES).some(c=>patrolSpeciesEligible(c,this.player.level,null,currentTimeOfDay(this.now()))))return {ok:false,reason:'no-patrol-opponents',resetRelaxStreak:false};
  if(!Number.isSafeInteger(relaxStreak)||relaxStreak<PATROL_CALM_COST)return {ok:false,reason:'not-recovered',resetRelaxStreak:false};
  const calmCostCommitted=spendCalmPoints!==null;
  if(calmCostCommitted&&spendCalmPoints(PATROL_CALM_COST)!==true)return {ok:false,reason:'not-recovered',resetRelaxStreak:false};
  this.state.location='patrol';this.state.patrolCount++;this.emit('patrol-start',{patrolCount:this.state.patrolCount,calmPointsCost:PATROL_CALM_COST,calmCostCommitted});return {ok:true,calmPointsCost:PATROL_CALM_COST,resetRelaxStreak:false};
 }
 requestTraining({relaxStreak=0,tier='easy',spendCalmPoints=null}={}){
  if(this.state.location!=='home')return {ok:false,reason:'not-home'};
  if(this.state.pendingAngerEvent)return {ok:false,reason:'anger-event-pending'};
  if(!Object.hasOwn(TRAINING_COURSES,tier))return {ok:false,reason:'unknown-training'};
  if(!eligibleTrainingCreatures(this.player,tier).length)return {ok:false,reason:'no-training-opponents'};
  if(!this.commandAvailability(relaxStreak).trainings[tier])return {ok:false,reason:'not-enough-calm'};
  const enemy=createTrainingEnemy({player:this.player,tier,rng:()=>this.random()}),calmCostCommitted=spendCalmPoints!==null;
  if(calmCostCommitted&&spendCalmPoints(1)!==true)return {ok:false,reason:'not-enough-calm'};
  this.state.location='training';this.emit('training-start',{calmPointsCost:1,calmCostCommitted,tier,enemy});return {ok:true,calmPointsCost:1,tier,enemy};
 }
 addAngerPoint({reason='system',calmPointsCost=reason==='relax-interference'?3:0,calmCostCommitted=false,bonusUsed=false}={}){
  if(this.state.location!=='home'||this.state.pendingAngerEvent)return {ok:false,reason:this.state.location!=='home'?'not-home':'anger-event-pending'};
  this.state.angerPoints++;this.state.pendingAngerEvent=this.state.angerPoints>=3;this.state.commandsLocked=false;this.emit('anger-point',{reason,angerPoints:this.state.angerPoints,calmPointsCost,calmCostCommitted,bonusUsed,commandsLocked:false});
  if(this.state.angerPoints>=3){this.state.pendingAngerEvent=true;this.emit('anger-ready',{angerPoints:this.state.angerPoints});}
  return {angerPoints:this.state.angerPoints,angerReady:this.state.pendingAngerEvent,commandsLocked:false};
 }
 resolveAngerEvent(){
  if(!this.state.pendingAngerEvent)return null;
  this.state.pendingAngerEvent=false;this.state.angerPoints-=3;this.state.angerEvents++;
  const pool=eligibleOkoteiyuRewards(this.player),draw=pool.length?this.random():null,reward=pool.length?selectOkoteiyuReward(draw,this.player):null,id=reward?.id??null;let changed=false,reason=id?null:'all-rewards-max-level',newlyLearned=false;
  if(id==='super_state_level_up'){this.player.superLevel=Math.min(SUPER_MAX_LEVEL,this.player.superLevel+1);changed=true;}
  else if(id==='unlock_energy_ray'){if(!this.player.energyRayUnlocked){this.player.energyRayUnlocked=true;this.player.energyRayLevel=1;newlyLearned=true;}else this.player.energyRayLevel=clampTechniqueLevel('energy_ray',this.player.energyRayLevel+1);changed=true;}
  else if(id==='punch_level_up'){this.player.punchLevel=clampTechniqueLevel('punch',this.player.punchLevel+1);changed=true;}
  else if(reward?.collectionLevel){const technique=reward.techniqueId;if(!this.player.unlockedTechniques.includes(technique)){this.player.unlockedTechniques.push(technique);this.player.techniqueLevels[technique]=1;newlyLearned=true;}else this.player.techniqueLevels[technique]=clampTechniqueLevel(technique,this.player.techniqueLevels[technique]+1);changed=true;}
  const result={id,changed,reason,newlyLearned,draw,techniqueId:reward?.techniqueId??null,techniqueName:reward?.label??null,superLevel:this.player.superLevel,punchLevel:this.player.punchLevel,energyRayLevel:this.player.energyRayLevel,energyRayUnlocked:this.player.energyRayUnlocked,angerPoints:this.state.angerPoints,angerEvents:this.state.angerEvents};this.emit('anger-result',result);return clone(result);
 }

 makePatrolEnemies(map,{timeOfDay=currentTimeOfDay(this.now())}={}){return createPatrolEnemies({map,player:this.player,rng:()=>this.random(),patrolId:this.state.patrolCount,timeOfDay});}
 cancelPatrol(){if(this.state.location!=='patrol')return false;this.state.location='home';this.state.interferenceUsedSinceBattle=false;this.emit('home-return',{afterBattle:false});return true;}
 startBattle(encounter,{kind=this.state.location==='training'?'training':'patrol'}={}){
  if(!['patrol','training'].includes(kind))throw new RangeError('Unsupported battle kind.');
  if(this.state.location==='battle')throw new Error('A battle is already open.');if(this.state.pendingAngerEvent)throw new Error('Finish the anger event first.');
  const members=Array.isArray(encounter)?encounter:encounter?.members||[encounter];integer(members.length,'opponent count',1,3);
  const actor=(id,speciesId,level,stats)=>({id,speciesId,name:CREATURES[speciesId].name,category:CREATURES[speciesId].category??null,level,stats:{...stats},maxHp:stats.hp,hp:stats.hp,action:null,nextActionAt:0,requestedTechnique:null,attackIndex:0});
  const enemies=members.map((enemy,index)=>{const speciesId=enemy?.speciesId||enemy?.creatureId;if(!Object.hasOwn(CREATURES,speciesId)||!Object.hasOwn(CREATURE_CATEGORIES,CREATURES[speciesId].category))throw new RangeError('Unsupported prototype opponent.');const level=integer(enemy.level,'opponent level',1,106);return {...actor(index?'enemy-'+(index+1):'enemy',speciesId,level,creatureStats(speciesId,level)),techniqueLevels:Object.fromEntries(CREATURES[speciesId].techniques.map(id=>[id,clampTechniqueLevel(id,level)])),sourceId:enemy.id||null};});
  const battle={kind,phase:'active',status:'active',time:0,player:actor('player','okoteiyu',this.player.level,playerStats(this.player)),enemies,enemy:enemies[0],targetId:enemies[0].id,super:{used:false,pending:false,active:false,until:0,multiplier:1,duration:0},result:null,rewards:null,enemyId:encounter?.id||enemies[0].speciesId};
  this.state.battle=battle;this.state.location='battle';
  for(const id of this.actorIds())this.combatant(id).nextActionAt=this.nextInterval(id);
  if(kind==='patrol')for(const enemy of enemies)recordJournalEncounter(this.player,enemy);
  this.emit('battle-start',{battle:this.snapshotBattle()});return this.snapshotBattle();
 }
 actorIds(){const b=this.state.battle;return b?['player',...b.enemies.map(enemy=>enemy.id)]:[];}
 combatant(id){const b=this.state.battle;return id==='player'?b?.player:b?.enemies.find(enemy=>enemy.id===id);}
 selectTarget(){const b=this.state.battle;if(!b)return null;const target=b.enemies.find(enemy=>enemy.hp>0)||null;b.targetId=target?.id||null;b.enemy=target||b.enemies[0];return target;}
 nextInterval(actorId){
  const b=this.state.battle,actor=this.combatant(actorId);if(!b||!actor)return Infinity;
  const slowest=Math.min(...this.actorIds().map(id=>this.combatant(id).stats.speed));
  const interval=Math.max(1.2,3*slowest/actor.stats.speed)/(actorId==='player'&&b.super.active?b.super.multiplier:1);
  return interval*(.9+.2*this.random());
 }

 requestBattleAction(technique){
  const battle=this.state.battle;if(!battle||battle.phase!=='active')return {ok:false,reason:'not-battling'};
  if(technique==='auto'){battle.player.requestedTechnique=null;this.emit('battle-call',{actor:'player',technique:'auto',time:battle.time});return {ok:true,queued:false};}
  if(technique==='super'){
   if(battle.super.used)return {ok:false,reason:'super-already-used'};
   battle.super.used=true;battle.super.pending=true;this.emit('super-requested',{actor:'player',source:'command',time:battle.time});if(!battle.player.action)this.beginSuper();return {ok:true,queued:battle.super.pending};
  }
  if(!PLAYER_TECHNIQUE_IDS.includes(technique))return {ok:false,reason:'unknown-technique'};
  if(!availableTechniqueIds(this.player).includes(technique))return {ok:false,reason:'technique-locked'};
  if(!this.player.techniqueSlots.includes(technique))return {ok:false,reason:'technique-not-equipped'};
  battle.player.requestedTechnique=technique;this.emit('battle-call',{actor:'player',technique,time:battle.time});return {ok:true,queued:true};
 }
 beginSuper(){
  const battle=this.state.battle;if(!battle||battle.phase!=='active'||!battle.super.pending||battle.player.action)return false;
  const {multiplier,duration}=superStateDetails(this.player);
  Object.assign(battle.super,{pending:false,active:true,multiplier,duration,until:battle.time+duration});this.emit('super-start',{actor:'player',active:true,multiplier,duration,time:battle.time});this.startAction('player','super_awaken');return true;
 }
 autoSuper(){
  const b=this.state.battle;if(!b||b.phase!=='active'||b.super.used||b.player.hp<=0)return;
  const living=b.enemies.filter(enemy=>enemy.hp>0);if(!living.length)return;
  if(b.player.hp/b.player.maxHp<=.25+EPSILON||living.some(enemy=>enemy.hp/enemy.maxHp<=.25+EPSILON)){b.super.used=true;b.super.pending=true;this.emit('super-requested',{actor:'player',source:'automatic',time:b.time});if(!b.player.action)this.beginSuper();}
 }
 startAction(actorId,technique=null){
  const battle=this.state.battle,actor=this.combatant(actorId);if(!actor||battle.phase!=='active'||actor.hp<=0||actor.action)return false;
  if(!technique){if(actorId!=='player'){const pool=CREATURES[actor.speciesId].techniques;technique=pool[actor.attackIndex++%pool.length];}else{const pool=this.player.techniqueSlots.filter(Boolean);technique=actor.requestedTechnique||pool[actor.attackIndex%pool.length];actor.requestedTechnique=null;actor.attackIndex++;}}
  const target=actorId==='player'?this.selectTarget():battle.player;if(!target)return false;
  const duration=technique==='super_awaken'?1.5:TECHNIQUES[technique]?.duration??.5;
  actor.action={id:technique,technique,targetId:target.id,startedAt:battle.time,endsAt:battle.time+duration,duration};actor.nextActionAt=Infinity;
  this.emit('action-start',{actor:actorId,actorName:actor.name,target:target.id,technique,duration,time:battle.time});return true;
 }
 finishAction(actorId){
  const b=this.state.battle,actor=this.combatant(actorId),action=actor?.action;if(!action||b.phase!=='active')return;
  actor.action=null;this.emit('action-complete',{actor:actorId,technique:action.technique,duration:action.duration,time:b.time});
  if(action.technique!=='super_awaken'){
   const target=actorId==='player'?(this.combatant(action.targetId)?.hp>0?this.combatant(action.targetId):this.selectTarget()):b.player;if(!target)return;
   const stats=actorId==='player'?applySuperStats(actor.stats,b.super.active?b.super.multiplier:1):actor.stats;
   const power=techniquePower(action.technique,stats,actorId!=='player'?actor.techniqueLevels[action.technique]:playerTechniqueLevel(this.player,action.technique));
   const factors=equipmentMultipliers(this.player.equipment),amount=power*(actorId==='player'?factors.damageDealt:factors.damageReceived);
   const remaining=Math.max(0,target.hp-amount);target.hp=remaining<EPSILON?0:remaining;
   this.emit('damage',{actor:actorId,actorName:actor.name,target:target.id,targetName:target.name,technique:action.technique,amount,hp:target.hp,maxHp:target.maxHp,time:b.time});
   if(target.hp<=0){target.action=null;target.nextActionAt=Infinity;this.emit('fatigue',{actor:target.id,name:target.name,time:b.time});if(target.id==='player'){this.endBattle('loss');return;}if(!this.selectTarget()){this.endBattle('win');return;}}
   this.autoSuper();
  }
  if(actorId==='player'&&b.super.pending){this.beginSuper();return;}
  actor.nextActionAt=b.time+this.nextInterval(actorId);
 }
 update(deltaSeconds){
  finite(deltaSeconds,'elapsed seconds');if(deltaSeconds<0)throw new RangeError('Elapsed seconds cannot be negative.');const b=this.state.battle;if(!b||b.phase!=='active'||deltaSeconds===0)return this.snapshotBattle();
  const targetTime=b.time+deltaSeconds;let iterations=0;
  while(b.phase==='active'&&b.time<targetTime-EPSILON){
   if(++iterations>100000)throw new Error('Battle event budget exceeded.');
   const ids=this.actorIds();let next=targetTime;
   for(const id of ids){const a=this.combatant(id);if(a.hp>0)next=Math.min(next,a.action?a.action.endsAt:a.nextActionAt);}
   if(b.super.active)next=Math.min(next,b.super.until);
   b.time=Math.max(b.time,next);
   if(b.super.active&&b.time+EPSILON>=b.super.until){const multiplier=b.super.multiplier;if(!b.player.action&&Number.isFinite(b.player.nextActionAt))b.player.nextActionAt=b.time+Math.max(0,b.player.nextActionAt-b.time)*multiplier;b.super.active=false;b.super.multiplier=1;this.emit('super-end',{actor:'player',active:false,time:b.time});}
   for(const id of ids){const a=this.combatant(id);if(b.phase==='active'&&a.hp>0&&a.action&&a.action.endsAt<=b.time+EPSILON)this.finishAction(id);}
   if(b.phase!=='active')break;
   this.autoSuper();if(b.super.pending&&!b.player.action)this.beginSuper();
   for(const id of ids){const a=this.combatant(id);if(b.phase==='active'&&a.hp>0&&!a.action&&a.nextActionAt<=b.time+EPSILON)this.startAction(id);}
   if(next>=targetTime-EPSILON)break;
  }
  if(b.phase==='active')b.time=targetTime;return this.snapshotBattle();
 }
 endBattle(result){
  const b=this.state.battle;if(!b||b.phase!=='active')return false;b.phase=b.status='ended';b.result=result;for(const id of this.actorIds()){const a=this.combatant(id);a.action=null;a.nextActionAt=Infinity;}b.super.pending=false;
  // Aura draws occur only on a full win, once for every opponent.
  if(result==='win'){
   this.player.battlesWon++;let experience=0;const drops=[],opponents=[];
   for(const enemy of b.enemies){if(b.kind==='training')recordJournalEncounter(this.player,enemy);this.player.journal[enemy.speciesId].defeats++;if(b.kind==='patrol')this.player.journal[enemy.speciesId].patrolDefeats=(this.player.journal[enemy.speciesId].patrolDefeats||0)+1;const xp=defeatedEnemyExperience(enemy.speciesId,enemy.level),dropPercent=auraDropPercent(enemy.level),draw=this.random(),aura=draw<dropPercent/100?this.acquireAura(enemy.speciesId):null;experience+=xp;if(aura)drops.push(aura);opponents.push({speciesId:enemy.speciesId,level:enemy.level,experience:xp,dropPercent,dropDraw:draw,aura});}
   const levels=this.addExperience(experience);b.rewards={experience,levelsGained:levels,level:this.player.level,xp:this.player.xp,aura:drops[0]||null,auras:drops,opponents,dropPercent:opponents[0].dropPercent,dropDraw:opponents[0].dropDraw};
  }else{this.player.battlesLost++;const opponents=b.enemies.filter(enemy=>enemy.hp<=0).map(enemy=>({speciesId:enemy.speciesId,level:enemy.level,experience:defeatedEnemyExperience(enemy.speciesId,enemy.level)})),experience=opponents.reduce((sum,enemy)=>sum+enemy.experience,0),levels=experience>0?this.addExperience(experience):0;b.rewards={experience,levelsGained:levels,level:this.player.level,xp:this.player.xp,aura:null,auras:[],opponents};}
  this.emit('battle-end',{result,time:b.time,battle:this.snapshotBattle(),rewards:clone(b.rewards)});if(result==='win'||b.rewards.experience>0)this.emit('rewards',clone(b.rewards));return true;
 }
 addExperience(amount){finite(amount,'experience reward');if(amount<0)throw new RangeError('Experience reward cannot be negative.');this.player.xp+=amount;let gained=0;while(this.player.level<100){const required=requiredLevelExperience(this.player.level);if(this.player.xp+EPSILON<required)break;this.player.xp=Math.max(0,this.player.xp-required);this.player.level++;gained++;}return gained;}
 acquireAura(speciesId){
  const creature=checkedCreature(speciesId),old=this.player.auras[speciesId];if(speciesId==='okoteiyu')return {speciesId,name:'おこていゆのオーラ',first:false,level:1,copies:1,progress:0,levelsGained:0};
  const copies=(old?.copies||0)+1,level=Math.min(30,1+Math.floor((copies-1)/3)),progress=level===30?0:(copies-1)%3;
  const aura={speciesId,name:creature.name+'のオーラ',level,copies,progress};this.player.auras[speciesId]=aura;return {...aura,first:!old,levelsGained:level-(old?.level||1)};
 }
 equipAura(speciesId){if(this.state.location!=='home'||this.state.pendingAngerEvent)return false;if(speciesId!==null&&!Object.hasOwn(this.player.auras,speciesId))return false;this.player.equippedAura=speciesId;this.emit('aura-equipped',{speciesId});return true;}
 assignTechnique(slot,id){
  if(this.state.location!=='home'||this.state.pendingAngerEvent||!Number.isInteger(slot)||slot<0||slot>2||id!==null&&!availableTechniqueIds(this.player).includes(id))return false;
  const next=this.player.techniqueSlots.map((value,index)=>id!==null&&value===id&&index!==slot?null:value);next[slot]=id;if(!next.some(Boolean))return false;
  this.player.techniqueSlots=validateTechniqueSlots(next,this.player);this.emit('technique-equipped',{slot,technique:id});return true;
 }
 setSuperConfiguration(id){if(this.state.location!=='home'||this.state.pendingAngerEvent||!Object.hasOwn(SUPER_CONFIGURATIONS,id))return false;this.player.superConfiguration=id;this.emit('super-configuration',{id});return true;}
 equipItem(kind,id){if(this.state.location!=='home'||this.state.pendingAngerEvent||!['support','defense'].includes(kind))return false;if(id!==null&&!this.player.ownedItems[kind].includes(id))return false;this.player.equipment[kind]=id;this.emit('item-equipped',{kind,id});return true;}
 returnHomeAfterBattle(){
  const b=this.state.battle;if(!b||b.phase!=='ended')return false;this.state.lastBattle={result:b.result,enemy:{speciesId:b.enemy.speciesId,name:b.enemy.name,level:b.enemy.level},enemies:b.enemies.map(enemy=>({speciesId:enemy.speciesId,name:enemy.name,level:enemy.level})),rewards:clone(b.rewards)};this.state.battle=null;this.state.location='home';this.state.commandsLocked=false;this.state.interferenceUsedSinceBattle=false;this.state.interferenceBonusAvailable=true;this.state.patrolUsedSinceRecovery=false;this.emit('home-return',{afterBattle:true,resetRelaxStreak:false});return true;
 }
 snapshotBattle(){
  const b=this.state.battle;if(!b)return null;
  const snapshotActor=a=>({...a,stats:a.id==='player'&&b.super.active?applySuperStats(a.stats,b.super.multiplier):{...a.stats},action:a.action?{...a.action,elapsed:Math.max(0,Math.min(a.action.duration,b.time-a.action.startedAt))}:null,superActive:a.id==='player'&&b.super.active,superUsed:a.id==='player'&&b.super.used});
  const enemies=b.enemies.map(snapshotActor);
  return clone({...b,player:{...snapshotActor(b.player),auraId:this.player.equippedAura,equipment:{...this.player.equipment}},enemies,enemy:enemies.find(enemy=>enemy.id===b.targetId)||enemies[0],enemyCount:enemies.length,techniques:{slots:[...this.player.techniqueSlots],superConfiguration:this.player.superConfiguration,superDetails:superStateDetails(this.player),energyRayUnlocked:this.player.energyRayUnlocked,punchLevel:this.player.punchLevel,energyRayLevel:this.player.energyRayLevel}});
 }
 exportState({allowPending=false,allowDepartureCheckpoint=false}={}){
  // The accepted departure still has a brief home phase: checkpoint its cost
  // before the cut-in. Loading this checkpoint resumes at home, not on a route.
  const departing=allowDepartureCheckpoint&&['patrol','training'].includes(this.state.location);
  if((this.state.location!=='home'&&!departing)||this.state.battle||this.state.pendingAngerEvent&&!allowPending)throw new Error('Save only at home, outside patrol, battle, and the anger cut-in.');
  return clone({schemaVersion:1,visitorName:this.state.visitorName,player:this.player,angerPoints:this.state.angerPoints,...(this.state.pendingAngerEvent?{pendingAngerEvent:true}:{}),commandsLocked:this.state.commandsLocked,interferenceUsedSinceBattle:this.state.interferenceUsedSinceBattle,patrolUsedSinceRecovery:this.state.patrolUsedSinceRecovery,angerEvents:this.state.angerEvents,patrolCount:this.state.patrolCount});
 }
 importState(saved){
  if(this.state.location!=='home'||this.state.battle||this.state.pendingAngerEvent)throw new Error('Load only at home, outside an event.');
  const normalized=validateSessionState(saved);
  this.state={...normalized,commandsLocked:false,interferenceUsedSinceBattle:false,interferenceBonusAvailable:false,patrolUsedSinceRecovery:false,angerPoints:normalized.angerPoints,location:'home',pendingAngerEvent:normalized.pendingAngerEvent??false,battle:null,lastBattle:null};return this.snapshot();
 }
}
