import {CAMP_WORLD,getCampNode} from './camp-world.js';
import {migrateLegacyCampBag,normalizeUnpackedCampBag} from './camp-bag-migration.js';
import {normalizeCampBaseProgress} from './camp-bases.js';
export const BAG_WIDTH=6,BAG_HEIGHT=6,CAMP_MAX_DAYS=15;
export const CAMP_TOOL_USES_PER_ITEM=2;
export const CAMP_DURABLE_TOOL_IDS=Object.freeze(['gloves','goggles','rope','mask']);
export const isCampDurableTool=id=>CAMP_DURABLE_TOOL_IDS.includes(id);
export const CAMP_SUPPLY_CATEGORIES=Object.freeze({support:'サポート',exploration:'探索',resupply:'補給',route_guidance:'ルート誘導'});
const categoryFor=id=>id==='food'?'resupply':id==='moai_compass'?'route_guidance':['flashlight','gloves','goggles','rope','mask'].includes(id)?'exploration':'support';
const supply=(id,name,width,height,repeatable,description,color,icon,maxUses=1,maxCount=repeatable?null:1)=>{const category=categoryFor(id);return Object.freeze({id,name,width,height,repeatable,description,color,icon,maxUses,maxCount,category,categoryName:CAMP_SUPPLY_CATEGORIES[category],...(id==='moai_compass'?{routeDestinationId:'moai_village'}:{})});};
export const CAMP_SUPPLIES=Object.freeze({
 food:supply('food','携帯食料',1,2,true,'1個で1日分の行動ができる。「あなた」の分は消費しない。何個でも持ち込める。','#d4ab67','▣'),
 flashlight:supply('flashlight','懐中電灯',1,2,false,'洞窟のルートを進める。1日の活動時間が16時間になる。','#dfc770','☼'),
 phone:supply('phone','スマホ',1,1,false,'出発時に使う穏やかポイントを2減らす。','#8da9bb','▯'),
 battery:supply('battery','バッテリー',1,1,true,'1個につき、出発時に使う穏やかポイントをさらに1減らす。最大4個まで持ち込める。','#7f9c8f','▰',1,4),
 survival_kit:supply('survival_kit','サバイバルキット',2,3,false,'日付が変わるたび、30%の確率で行動可能日数が1日増える。','#92aa78','✦'),
 medical_kit:supply('medical_kit','医療キット',2,2,false,'キャンプ道中の戦闘終了ごとに最大HPの15%を回復する。HPが0のときは発動しない。','#cb9598','＋'),
 compass:supply('compass','コンパス',1,1,false,'各エリアを進む時間を0.6倍にする。','#9eabbd','◇'),
 moai_compass:supply('moai_compass','モアイコンパス',1,1,false,'今の物資でモアイ郷まで進める探索最適経路を案内する。到達後は案内を終え、設定した目標へ探索を続ける。ルート誘導アイテムは合計1個まで。','#c4b476','⌖'),
 gloves:supply('gloves','グローブ',1,2,true,'1個で悪路を2回通れる。来た道を戻るときは使用回数が減らない。使える間は怪我イベントの発生率を0.7倍にする。','#b6a18d','✋',CAMP_TOOL_USES_PER_ITEM),
 goggles:supply('goggles','ゴーグル',1,2,true,'1個で見通しの悪いルートを2回通れる。来た道を戻るときは使用回数が減らない。使える間は怪我の発生率を0.7倍にする。','#8caeb5','∞',CAMP_TOOL_USES_PER_ITEM),
 rope:supply('rope','ロープ',1,3,true,'1個で崖の険しいルートを2回通れる。来た道を戻るときは使用回数が減らない。','#c4ad7d','⌁',CAMP_TOOL_USES_PER_ITEM),
 mask:supply('mask','ガスマスク',1,3,true,'1個で毒ガスのルートを2回通れる。来た道を戻るときは使用回数が減らない。','#afa7bd','◒',CAMP_TOOL_USES_PER_ITEM)
});
/** JSON-safe ownership: null denotes unlimited. Finite acquisition/consumption
 * is reserved for a later design; the current catalogue is unlimited. */
export function createCampSupplyInventory(){return Object.fromEntries(Object.keys(CAMP_SUPPLIES).map(id=>[id,null]));}
export function normalizeCampSupplyInventory(value){
 if(value===undefined)return createCampSupplyInventory();
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Object.keys(value).some(id=>!Object.hasOwn(CAMP_SUPPLIES,id)||value[id]!==null))throw new TypeError('キャンプ物資の所持数が正しくありません。');
 return createCampSupplyInventory();
}
export function campSupplyOwnedCount(progress,id){if(!Object.hasOwn(CAMP_SUPPLIES,id))throw new RangeError('不明なキャンプ物資です。');normalizeCampSupplyInventory(progress?.supplyInventory);return Infinity;}
/** Bag entries count physical items; a live journey counts available tool uses. */
export function campRuntimeSupplies(itemCounts){
 const runtime={...itemCounts};
 for(const id of CAMP_DURABLE_TOOL_IDS){const count=itemCounts?.[id]??0;if(!Number.isSafeInteger(count)||count<0)throw new TypeError('道具の個数が正しくありません。');runtime[id]=count*CAMP_SUPPLIES[id].maxUses;}
 return runtime;
}
const clone=value=>JSON.parse(JSON.stringify(value));
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
export function campSupplyDimensions(supplyId,rotated=false){const item=typeof supplyId==='string'&&Object.hasOwn(CAMP_SUPPLIES,supplyId)?CAMP_SUPPLIES[supplyId]:null;if(!item)throw new RangeError('不明なキャンプ物資です。');return rotated?{width:item.height,height:item.width}:{width:item.width,height:item.height};}
/** Strict geometry validation shared by UI, saves and departure. */
export function validateCampBag(placements){
 if(!Array.isArray(placements)||placements.length>BAG_WIDTH*BAG_HEIGHT)throw new TypeError('バッグの中身が正しくありません。');
 const occupied=new Set(),ids=new Set(),counts=new Map();let guidanceCount=0;
 return Array.from(placements).map((placement,index)=>{
  if(!plain(placement))throw new TypeError('物資の配置が正しくありません。');
  const {supplyId,x,y}=placement,item=typeof supplyId==='string'&&Object.hasOwn(CAMP_SUPPLIES,supplyId)?CAMP_SUPPLIES[supplyId]:null;if(!item)throw new RangeError('不明なキャンプ物資です。');
  const id=placement.id===undefined?`supply-${index}`:placement.id;if(typeof id!=='string'||!id.length||id.length>96||ids.has(id))throw new TypeError('物資の識別子が正しくありません。');ids.add(id);
  if(placement.rotated!==undefined&&typeof placement.rotated!=='boolean')throw new TypeError('物資の向きが正しくありません。');
  const rotated=placement.rotated===true,{width,height}=campSupplyDimensions(supplyId,rotated);
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x+width>BAG_WIDTH||y+height>BAG_HEIGHT)throw new RangeError('物資がバッグの外にはみ出しています。');
  if(item.category==='route_guidance'&&++guidanceCount>1)throw new RangeError('ルート誘導アイテムは合計1個だけ持ち込めます。');
  const count=(counts.get(supplyId)||0)+1,limit=item.maxCount??Infinity;
  if(count>limit)throw new RangeError(item.name+(limit===1?'は1個だけ持ち込めます。':'は'+limit+'個まで持ち込めます。'));counts.set(supplyId,count);
  for(let row=y;row<y+height;row++)for(let col=x;col<x+width;col++){const key=row*BAG_WIDTH+col;if(occupied.has(key))throw new RangeError('物資の置き場所が重なっています。');occupied.add(key);}
  return {id,supplyId,x,y,rotated};
 });
}
/** Include retained unpacked records when checking per-bag quantity limits. */
export function validateCampBagInventory(placements,unpacked=[]){
 const bag=validateCampBag(placements),options={supplies:CAMP_SUPPLIES,width:BAG_WIDTH,height:BAG_HEIGHT};
 return {bag,unpacked:normalizeUnpackedCampBag(unpacked,bag,options)};
}
export function campBagSummary(placements){
 const bag=validateCampBag(placements),counts=Object.fromEntries(Object.keys(CAMP_SUPPLIES).map(id=>[id,0]));let occupied=0;
 for(const placement of bag){counts[placement.supplyId]++;const item=CAMP_SUPPLIES[placement.supplyId];occupied+=item.width*item.height;}
 const runtime=campRuntimeSupplies(counts),toolUses=Object.fromEntries(CAMP_DURABLE_TOOL_IDS.map(id=>[id,runtime[id]]));
 return {counts,toolUses,occupied,capacity:BAG_WIDTH*BAG_HEIGHT,foodDays:Math.min(CAMP_MAX_DAYS,counts.food),calmCost:7-(counts.phone?2:0)-counts.battery,activityHoursPerDay:counts.flashlight?16:14,injuryProbabilityMultiplier:(counts.gloves ? .7 : 1)*(counts.goggles ? .7 : 1)};
}
export function campDepartureCost(placements){return campBagSummary(placements).calmCost;}
export function createCampProgress(){return {version:1,bagLayoutVersion:2,bags:[[],[],[]],unpackedBags:[[],[],[]],adjustedBags:[false,false,false],selectedBag:0,discovered:[CAMP_WORLD.startId],expeditions:0,supplyInventory:createCampSupplyInventory(),...normalizeCampBaseProgress()};}
/** Legacy saves have no camp field and receive a fresh, independent default. */
export function normalizeCampProgress(value){
 if(value===undefined)return createCampProgress();
 if(!plain(value))throw new TypeError('キャンプの記録が正しくありません。');
 if(value.version!==undefined&&value.version!==1)throw new TypeError('未対応のキャンプ記録です。');
 const layoutVersion=value.bagLayoutVersion??1;if(layoutVersion!==1&&layoutVersion!==2)throw new TypeError('未対応のバッグ配置です。');
 const bags=value.bags??[[],[],[]];if(!Array.isArray(bags)||bags.length!==3)throw new TypeError('登録バッグは3つです。');
 const options={supplies:CAMP_SUPPLIES,width:BAG_WIDTH,height:BAG_HEIGHT,validateCurrent:validateCampBag};
 let normalizedBags,unpackedBags,adjustedBags;
 if(layoutVersion===1){
  const migrated=Array.from(bags).map(bag=>migrateLegacyCampBag(bag,options));normalizedBags=migrated.map(item=>item.bag);unpackedBags=migrated.map(item=>item.unpacked);adjustedBags=migrated.map(item=>item.adjusted);
 }else{
  normalizedBags=Array.from(bags).map(validateCampBag);
  const unpacked=value.unpackedBags??[[],[],[]],adjusted=value.adjustedBags??[false,false,false];
  if(!Array.isArray(unpacked)||unpacked.length!==3||!Array.isArray(adjusted)||adjusted.length!==3||Array.from(adjusted).some(flag=>typeof flag!=='boolean'))throw new TypeError('登録バッグの調整記録が正しくありません。');
  unpackedBags=Array.from(unpacked).map((items,slot)=>normalizeUnpackedCampBag(items,normalizedBags[slot],options));adjustedBags=Array.from(adjusted);
 }
 const selectedBag=value.selectedBag??0;if(!Number.isInteger(selectedBag)||selectedBag<0||selectedBag>2)throw new RangeError('バッグの選択が正しくありません。');
 const discovered=value.discovered??[CAMP_WORLD.startId];if(!Array.isArray(discovered)||discovered.length>CAMP_WORLD.nodes.length||Array.from(discovered).some(id=>typeof id!=='string'||!getCampNode(id)))throw new TypeError('未開の地の記録が正しくありません。');
 const expeditions=value.expeditions??0;if(!Number.isSafeInteger(expeditions)||expeditions<0)throw new RangeError('キャンプ回数が正しくありません。');
 return clone({version:1,bagLayoutVersion:2,bags:normalizedBags,unpackedBags,adjustedBags,selectedBag,discovered:[...new Set([CAMP_WORLD.startId,...discovered])],expeditions,supplyInventory:normalizeCampSupplyInventory(value.supplyInventory),...normalizeCampBaseProgress(value)});
}
/** One copy protects the party; multiple goggles do not stack the multiplier. */
export function canTraverseCampNode(node,counts){
 if(!node||!counts||!['normal','rough','cliff','gas','cave','poor_visibility'].includes(node.terrain))return false;
 if((node.terrain==='cave'||node.cave)&&!counts.flashlight)return false;
 if((node.terrain==='poor_visibility'||node.poorVisibility)&&!counts.goggles)return false;
 if(node.terrain==='rough'&&!counts.gloves)return false;
 if(node.terrain==='cliff'&&!counts.rope)return false;
 if(node.terrain==='gas'&&!counts.mask)return false;
 return true;
}
export function campTraversalConsumption(node){return {gloves:node?.terrain==='rough'?1:0,rope:node?.terrain==='cliff'?1:0,mask:node?.terrain==='gas'?1:0,goggles:node?.terrain==='poor_visibility'||node?.poorVisibility?1:0};}
