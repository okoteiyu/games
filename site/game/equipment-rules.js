/** Numeric equipment effects multiply; the tag determines visible battle helpers. */
export const SUPPORT_SLOT_LIMIT=4;
export const SUPPORT_TAG_LABELS=Object.freeze({support:'サポート',helper:'助っ人'});
const supportItem=definition=>Object.freeze({initialLevel:1,maxLevel:1,initiallyOwned:true,initiallyEquipped:false,...definition,tagLabel:SUPPORT_TAG_LABELS[definition.tag],displayInBattle:definition.tag==='helper'});
export const SUPPORT_ITEMS=Object.freeze({
 moai_kun:supportItem({id:'moai_kun',tag:'helper',initiallyEquipped:true,name:'モアイくん',description:'おこていゆについてくる、身長20cmのモアイのおもちゃ。特別な思い入れがあります。戦闘では最初に受けるダメージを1回だけ、前に出て黄色い光をまとって吸収。1秒後に相手へ向かい、被ダメージ軽減前の30%の威力で反撃します。その後はおこていゆの後ろで見守ります。',multipliers:Object.freeze({})}),
 hard_glove:supportItem({id:'hard_glove',tag:'support',name:'かたいグローブ',description:'小さく丸い手がすっぽり収まる、かたいグローブ。与えるダメージが1.25倍になります。',multipliers:Object.freeze({damageDealt:1.25})}),
 stored_ki:supportItem({id:'stored_ki',tag:'support',name:'溜めた気',description:'ぼんやりと白く光る、溜めた気の塊。HP・攻撃力・気・速さが1.1倍になります。',multipliers:Object.freeze({hp:1.1,attack:1.1,ki:1.1,speed:1.1})}),
 green_moai:supportItem({id:'green_moai',tag:'helper',initiallyEquipped:true,name:'回復モアイさん',description:'薄い緑色の、モアイくんと同じ形の助っ人。戦闘ではおこていゆの後ろで待機し、HPが半分以下になると、1戦闘に1回だけ最大HPの30%を回復します。HPが0になった場合は回復しません。その後も後ろで見守ります。',multipliers:Object.freeze({})})
});
export const DEFAULT_OWNED_SUPPORT_IDS=Object.freeze(Object.values(SUPPORT_ITEMS).filter(item=>item.initiallyOwned).map(item=>item.id));
export const DEFAULT_EQUIPPED_SUPPORT_IDS=Object.freeze(Object.values(SUPPORT_ITEMS).filter(item=>item.initiallyEquipped).map(item=>item.id));

/** Accept the former scalar shape for read-only callers and old-save migration. */
export function equippedSupportIds(equipment={}){
 const value=equipment?.support,ids=Array.isArray(value)?value:value==null?[]:[value];
 return [...new Set(ids.filter(id=>typeof id==='string'&&Object.hasOwn(SUPPORT_ITEMS,id)))];
}
export function supportItemLevel(player,id){
 const maximum=SUPPORT_ITEMS[id]?.maxLevel??1,value=player?.supportLevels?.[id];
 return Number.isSafeInteger(value)&&value>=1?Math.min(maximum,value):1;
}
export function validateSupportSelection(ids,{owned}={}){
 if(!Array.isArray(ids))throw new TypeError('Support selection must be an array.');
 if(ids.length>SUPPORT_SLOT_LIMIT)throw new RangeError('At most four support items can be equipped.');
 if(new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!Object.hasOwn(SUPPORT_ITEMS,id)))throw new TypeError('Invalid support selection.');
 if(owned!==undefined&&(!Array.isArray(owned)||ids.some(id=>!owned.includes(id))))throw new TypeError('An equipped support item is not owned.');
 return [...ids];
}
/** Preview a single add/remove while keeping every other equipped item in place. */
export function supportSelectionChange(equipment,id){
 const current=equippedSupportIds(equipment),removing=current.includes(id);
 if(!Object.hasOwn(SUPPORT_ITEMS,id))return {ids:current,removing:false,allowed:false,reason:'unknown-item'};
 const next=removing?current.filter(value=>value!==id):[...current,id];
 if(next.length>SUPPORT_SLOT_LIMIT)return {ids:current,removing,allowed:false,reason:'support-slots-full'};
 return {ids:next,removing,allowed:true,reason:null};
}
export const DEFENSE_ITEMS=Object.freeze({
 iron_shield:Object.freeze({id:'iron_shield',name:'鉄の盾',description:'重厚な鉄の盾。受けるダメージが0.75倍、速さが0.8倍になります。',multipliers:Object.freeze({damageReceived:.75,speed:.8})}),
 aura_shield:Object.freeze({id:'aura_shield',name:'オーラの盾',description:'ぼやけた白いモヤが守る盾。受けるダメージが0.9倍、与えるダメージが1.1倍になります。',multipliers:Object.freeze({damageReceived:.9,damageDealt:1.1})}),
 acrylic_shield:Object.freeze({id:'acrylic_shield',name:'アクリル盾',description:'透き通ったアクリルの盾。戦闘中、おこていゆの前に浮かび、受けるダメージを0.9倍にします。',multipliers:Object.freeze({damageReceived:.9,damageDealt:1})})
});
export function equipmentMultipliers(equipment={}){
 const items=[...equippedSupportIds(equipment).map(id=>SUPPORT_ITEMS[id]),DEFENSE_ITEMS[equipment.defense]].filter(Boolean);
 return Object.fromEntries(['damageReceived','damageDealt','hp','attack','ki','speed'].map(key=>[key,items.reduce((n,item)=>n*(item.multipliers[key]??1),1)]));
}
