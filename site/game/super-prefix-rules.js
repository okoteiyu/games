/** Persistent prefix progress is independent of character and technique levels.
 * The legacy superLevel field remains the level of the unprefixed base state. */
export const SUPER_MAX_LEVEL=100;
export const SUPER_CONFIGURATIONS=Object.freeze({
 none:Object.freeze({id:'none',label:'なし',prefix:'',initialLevel:1,maxLevel:SUPER_MAX_LEVEL,additionalEffects:Object.freeze([])}),
 true:Object.freeze({id:'true',label:'真の',prefix:'真の',initialLevel:1,maxLevel:1,acquisitionDescription:'モアイの戦士を20体撃退すると入手できます。',additionalEffects:Object.freeze([
  Object.freeze({type:'super_species_damage',speciesId:'fake_moai',damageDealt:3,damageReceived:.3,description:'発動中、偽モアイに与えるダメージが3倍、偽モアイから受けるダメージが0.3倍になります。'})
 ])})
});
const own=(value,key)=>Object.hasOwn(value??{},key);
const record=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value)));
function checkedId(id){if(typeof id!=='string'||!own(SUPER_CONFIGURATIONS,id))throw new TypeError('Unknown super configuration.');return id;}
function checkedLevel(value,id){const maximum=superConfigurationMaxLevel(id);if(!Number.isSafeInteger(value)||value<1||value>maximum)throw new RangeError('Invalid super configuration level.');return value;}
export function superConfigurationMaxLevel(id='none'){return SUPER_CONFIGURATIONS[checkedId(id)].maxLevel;}
export function superConfigurationLevel(player={},id=player.superConfiguration||'none'){
 checkedId(id);return checkedLevel(id==='none'?(player.superLevel??player.superConfigurationLevels?.none??1):(player.superConfigurationLevels?.[id]??1),id);
}
export function availableSuperConfigurationIds(player={}){return player.unlockedSuperConfigurations?[...player.unlockedSuperConfigurations]:['none'];}
export function superConfigurationAcquisition(id){
 const configuration=SUPER_CONFIGURATIONS[checkedId(id)];return {id,acquisitionId:'super-configuration:'+id,name:configuration.prefix+'スーパーおこていゆ状態',level:configuration.initialLevel,maxLevel:configuration.maxLevel};
}
/** Normalization has no events, RNG use, or external side effects, including
 * when the save inspector validates an older encrypted file. */
export function normalizeSuperConfigurationProgress(saved={},journal={}){
 const baseLevel=checkedLevel(saved.superLevel??1,'none'),hasOwned=own(saved,'unlockedSuperConfigurations'),hasLevels=own(saved,'superConfigurationLevels');
 if(hasOwned!==hasLevels)throw new TypeError('Incomplete super configuration progress.');
 const unlocked=hasOwned?saved.unlockedSuperConfigurations:['none'];
 if(!Array.isArray(unlocked)||!unlocked.includes('none')||new Set(unlocked).size!==unlocked.length)throw new TypeError('Invalid unlocked super configurations.');
 for(const id of unlocked)checkedId(id);
 const levels=hasLevels?saved.superConfigurationLevels:{none:baseLevel};
 if(!record(levels)||Object.keys(levels).length!==unlocked.length||!unlocked.every(id=>own(levels,id)))throw new TypeError('Invalid super configuration levels.');
 for(const [id,level]of Object.entries(levels)){checkedId(id);checkedLevel(level,id);}
 if(levels.none!==baseLevel)throw new RangeError('Base super level does not match legacy super level.');
 const pending=own(saved,'pendingSuperUnlocks')?saved.pendingSuperUnlocks:[];
 if(!Array.isArray(pending)||new Set(pending).size!==pending.length||pending.some(id=>id==='none'||!unlocked.includes(id)))throw new TypeError('Invalid pending super configuration acquisitions.');
 const progress={superLevel:baseLevel,superConfiguration:saved.superConfiguration??'none',unlockedSuperConfigurations:[...unlocked],superConfigurationLevels:{...levels},pendingSuperUnlocks:[...pending]};
 syncSuperConfigurationUnlocks(progress,journal);
 checkedId(progress.superConfiguration);if(!progress.unlockedSuperConfigurations.includes(progress.superConfiguration))throw new TypeError('The super configuration is not owned.');
 return progress;
}
/** Called only at import or after settled battle records. Persistent pending IDs
 * remain until the corresponding acquisition message is acknowledged. */
export function syncSuperConfigurationUnlocks(player,journal=player.journal){
 player.unlockedSuperConfigurations??=['none'];player.superConfigurationLevels??={none:player.superLevel??1};player.pendingSuperUnlocks??=[];
 player.superConfigurationLevels.none=superConfigurationLevel(player,'none');
 if((journal?.moai_king?.defeats??0)<20||player.unlockedSuperConfigurations.includes('true'))return [];
 player.unlockedSuperConfigurations.push('true');player.superConfigurationLevels.true=1;player.pendingSuperUnlocks.push('true');return [superConfigurationAcquisition('true')];
}
export function superPrefixDamageMultipliers(player,{active=false,configuration=player?.superConfiguration||'none',actorSpeciesId,targetSpeciesId}={}){
 if(!active)return {damageDealt:1,damageReceived:1};
 const effects=SUPER_CONFIGURATIONS[checkedId(configuration)].additionalEffects;let damageDealt=1,damageReceived=1;
 for(const effect of effects){
  if(effect.type!=='super_species_damage')continue;
  if(actorSpeciesId==='okoteiyu'&&targetSpeciesId===effect.speciesId)damageDealt*=effect.damageDealt;
  if(targetSpeciesId==='okoteiyu'&&actorSpeciesId===effect.speciesId)damageReceived*=effect.damageReceived;
 }
 return {damageDealt,damageReceived};
}
export function superStateDetails(player={}){
 const id=checkedId(player.superConfiguration||'none'),configuration=SUPER_CONFIGURATIONS[id],level=superConfigurationLevel(player,id),baseLevel=superConfigurationLevel(player,'none');
 return {configuration:id,configurationLabel:configuration.label,prefix:configuration.prefix,name:configuration.prefix+'スーパーおこていゆ状態',level,maxLevel:configuration.maxLevel,baseLevel,baseMaxLevel:SUPER_MAX_LEVEL,additionalEffects:configuration.additionalEffects,multiplier:Number((1.5+baseLevel/50).toFixed(2)),duration:Number((8+baseLevel/10).toFixed(2))};
}
