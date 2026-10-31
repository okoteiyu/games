import {equipmentChangePreview} from './equipment-preview.js';
import {CREATURES} from './game-session.js';

const stats=[['hp','HP'],['attack','攻撃力'],['ki','気'],['speed','速さ']];
const number=value=>Number(value).toLocaleString('ja-JP',{maximumFractionDigits:1});
const percent=value=>(value*100).toLocaleString('ja-JP',{maximumFractionDigits:4})+'%';

/** Compare the next equip action with the current loadout, without changing it. */
export function equipmentPreviewMarkup(player,kind,id){
 const {removing,before,after}=equipmentChangePreview(player,kind,id),action=removing?'外すと':'装備すると';
 const rows=stats.map(([key,label])=>{
  const delta=Math.round((after.stats[key]-before.stats[key])*10)/10;
  return '<tr data-equipment-stat="'+key+'"><th scope="row">'+label+'</th><td>'+number(before.stats[key])+'</td><td>'+number(after.stats[key])+'</td><td class="equipment-preview__change" data-direction="'+(delta>0?'up':delta<0?'down':'same')+'">'+(delta===0?'±0':(delta>0?'+':'−')+number(Math.abs(delta)))+'</td></tr>';
 }).join('');
 let damage=[['damageDealt','与えるダメージ'],['damageReceived','受けるダメージ']].map(([key,label])=>'<div data-equipment-damage="'+key+'"><dt>'+label+'</dt><dd><span>'+percent(before[key])+'</span><span aria-label="から">→</span><strong>'+percent(after[key])+'</strong></dd></div>').join('');
 const grouped=[player.equippedAura,kind==='aura'?id:null].some(aura=>CREATURES[aura]?.auraAdditionalEffects.some(effect=>effect.type==='living_opponent_species_group_damage_dealt'));
 if(grouped){
  const context={opponents:[{id:'preview-1',speciesId:'preview',hp:1},{id:'preview-2',speciesId:'preview',hp:1}]},conditional=equipmentChangePreview(player,kind,id,context);
  damage+='<div data-equipment-damage="groupDamageDealt"><dt>同種の相手が2体以上いる時の与ダメージ</dt><dd><span>'+percent(conditional.before.damageDealt)+'</span><span aria-label="から">→</span><strong>'+percent(conditional.after.damageDealt)+'</strong></dd></div>';
 }
 const taller=[player.equippedAura,kind==='aura'?id:null].some(aura=>CREATURES[aura]?.auraAdditionalEffects.some(effect=>effect.type==='taller_attacker_damage_received'));
 if(taller){const conditional=equipmentChangePreview(player,kind,id,{attackerHeight:CREATURES.okoteiyu.height+1});damage+='<div data-equipment-damage="tallerDamageReceived"><dt>自分より大きい相手からの被ダメージ</dt><dd><span>'+percent(conditional.before.damageReceived)+'</span><span>→</span><strong>'+percent(conditional.after.damageReceived)+'</strong></dd></div>';}
 return '<section class="equipment-preview" aria-label="着脱によるステータスの変化"><h4>'+(removing?'外した場合の変化':'装備した場合の変化')+'</h4><table><thead><tr><th scope="col">能力</th><th scope="col">現在</th><th scope="col">'+action+'</th><th scope="col">変化</th></tr></thead><tbody>'+rows+'</tbody></table><dl class="equipment-preview__damage">'+damage+'</dl><p class="equipment-preview__note">ほかの装備を含む通常時の値です。HPは最大値、ダメージ補正は通常を100%として表示します。</p></section>';
}
