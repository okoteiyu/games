import {CAMP_WORLD,getCampNode} from './camp-world.js';
export const BAG_WIDTH=6,BAG_HEIGHT=5,CAMP_MAX_DAYS=15;
const supply=(id,name,width,height,repeatable,description,color,icon)=>Object.freeze({id,name,width,height,repeatable,description,color,icon});
export const CAMP_SUPPLIES=Object.freeze({
 food:supply('food','携帯食料',1,2,true,'1個で1日分の行動ができる。何個でも持ち込める。','#d4ab67','▣'),
 flashlight:supply('flashlight','懐中電灯',1,2,false,'洞窟のルートを進める。1日の活動時間が16時間になる。','#dfc770','☼'),
 phone:supply('phone','スマホ',1,1,false,'出発時に使う穏やかポイントを2減らす。','#8da9bb','▯'),
 battery:supply('battery','バッテリー',1,1,false,'出発時に使う穏やかポイントをさらに1減らす。','#7f9c8f','▰'),
 survival_kit:supply('survival_kit','サバイバルキット',2,3,false,'日付が変わるたび、30%の確率で行動可能日数が1日増える。','#92aa78','✦'),
 medical_kit:supply('medical_kit','医療キット',2,2,false,'イベント終了時、HPが半分以下なら最大HPの30%を回復する。','#cb9598','＋'),
 compass:supply('compass','コンパス',1,1,false,'各エリアを進む時間を0.6倍にする。','#9eabbd','◇'),
 gloves:supply('gloves','グローブ',1,2,false,'消費せず、悪路を進める。怪我イベントの発生率を0.7倍にする。','#b6a18d','✋'),
 goggles:supply('goggles','ゴーグル',1,2,true,'見通しの悪いルートを1つ越えるたび1個消費。所持中は怪我の発生率を0.7倍にする。','#8caeb5','∞'),
 rope:supply('rope','ロープ',1,2,true,'崖の険しいルートを1つ越えるたび1個消費する。','#c4ad7d','⌁'),
 mask:supply('mask','マスク',1,3,true,'毒ガスのルートを1つ越えるたび1個消費する。','#afa7bd','◒')
});
const clone=value=>JSON.parse(JSON.stringify(value));
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
export function campSupplyDimensions(supplyId,rotated=false){const item=typeof supplyId==='string'&&Object.hasOwn(CAMP_SUPPLIES,supplyId)?CAMP_SUPPLIES[supplyId]:null;if(!item)throw new RangeError('不明なキャンプ物資です。');return rotated?{width:item.height,height:item.width}:{width:item.width,height:item.height};}
/** Strict geometry validation shared by UI, saves and departure. */
export function validateCampBag(placements){
 if(!Array.isArray(placements)||placements.length>BAG_WIDTH*BAG_HEIGHT)throw new TypeError('バッグの中身が正しくありません。');
 const occupied=new Set(),ids=new Set(),singles=new Set();
 return Array.from(placements).map((placement,index)=>{
  if(!plain(placement))throw new TypeError('物資の配置が正しくありません。');
  const {supplyId,x,y}=placement,item=typeof supplyId==='string'&&Object.hasOwn(CAMP_SUPPLIES,supplyId)?CAMP_SUPPLIES[supplyId]:null;if(!item)throw new RangeError('不明なキャンプ物資です。');
  const id=placement.id===undefined?`supply-${index}`:placement.id;if(typeof id!=='string'||!id.length||id.length>96||ids.has(id))throw new TypeError('物資の識別子が正しくありません。');ids.add(id);
  if(placement.rotated!==undefined&&typeof placement.rotated!=='boolean')throw new TypeError('物資の向きが正しくありません。');
  const rotated=placement.rotated===true,{width,height}=campSupplyDimensions(supplyId,rotated);
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x+width>BAG_WIDTH||y+height>BAG_HEIGHT)throw new RangeError('物資がバッグの外にはみ出しています。');
  if(!item.repeatable&&singles.has(supplyId))throw new RangeError(item.name+'は1個だけ持ち込めます。');singles.add(supplyId);
  for(let row=y;row<y+height;row++)for(let col=x;col<x+width;col++){const key=row*BAG_WIDTH+col;if(occupied.has(key))throw new RangeError('物資の置き場所が重なっています。');occupied.add(key);}
  return {id,supplyId,x,y,rotated};
 });
}
export function campBagSummary(placements){
 const bag=validateCampBag(placements),counts=Object.fromEntries(Object.keys(CAMP_SUPPLIES).map(id=>[id,0]));let occupied=0;
 for(const placement of bag){counts[placement.supplyId]++;const item=CAMP_SUPPLIES[placement.supplyId];occupied+=item.width*item.height;}
 return {counts,occupied,capacity:BAG_WIDTH*BAG_HEIGHT,foodDays:Math.min(CAMP_MAX_DAYS,counts.food),calmCost:7-(counts.phone?2:0)-(counts.battery?1:0),activityHoursPerDay:counts.flashlight?16:14,injuryProbabilityMultiplier:(counts.gloves ? .7 : 1)*(counts.goggles ? .7 : 1)};
}
export function campDepartureCost(placements){return campBagSummary(placements).calmCost;}
export function createCampProgress(){return {version:1,bags:[[],[],[]],selectedBag:0,discovered:[CAMP_WORLD.startId],expeditions:0};}
/** Legacy saves have no camp field and receive a fresh, independent default. */
export function normalizeCampProgress(value){
 if(value===undefined)return createCampProgress();
 if(!plain(value))throw new TypeError('キャンプの記録が正しくありません。');
 if(value.version!==undefined&&value.version!==1)throw new TypeError('未対応のキャンプ記録です。');
 const bags=value.bags??[[],[],[]];if(!Array.isArray(bags)||bags.length!==3)throw new TypeError('登録バッグは3つです。');
 const selectedBag=value.selectedBag??0;if(!Number.isInteger(selectedBag)||selectedBag<0||selectedBag>2)throw new RangeError('バッグの選択が正しくありません。');
 const discovered=value.discovered??[CAMP_WORLD.startId];if(!Array.isArray(discovered)||discovered.length>CAMP_WORLD.nodes.length||Array.from(discovered).some(id=>typeof id!=='string'||!getCampNode(id)))throw new TypeError('未開の地の記録が正しくありません。');
 const expeditions=value.expeditions??0;if(!Number.isSafeInteger(expeditions)||expeditions<0)throw new RangeError('キャンプ回数が正しくありません。');
 return clone({version:1,bags:Array.from(bags).map(validateCampBag),selectedBag,discovered:[...new Set([CAMP_WORLD.startId,...discovered])],expeditions});
}
/** One copy protects the party; multiple goggles do not stack the multiplier. */
export function canTraverseCampNode(node,counts){
 if(!node||!counts||!['normal','rough','cliff','gas'].includes(node.terrain))return false;
 if(node.cave&&!counts.flashlight)return false;
 if(node.poorVisibility&&!counts.goggles)return false;
 if(node.terrain==='rough'&&!counts.gloves)return false;
 if(node.terrain==='cliff'&&!counts.rope)return false;
 if(node.terrain==='gas'&&!counts.mask)return false;
 return true;
}
export function campTraversalConsumption(node){return {rope:node?.terrain==='cliff'?1:0,mask:node?.terrain==='gas'?1:0,goggles:node?.poorVisibility?1:0};}
