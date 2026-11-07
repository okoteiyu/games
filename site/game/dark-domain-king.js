/** R284's fixed individual. These are final authored ranks: the historical
 * R280 adjustment is intentionally not applied to a newly added species. */
export const DARK_DOMAIN_KING={
 id:'dark_domain_king',name:'暗黒域の王',description:'こわいでち。',
 category:'unique',campOnly:true,height:3,fixedLevel:80,repeatable:true,
 levelBand:{min:80,max:80},spawnRegions:[],spawnTimes:['day','night'],
 campHabitats:[{destinationId:'demon_gate'}],campLocationLabel:'魔界ゲート',
 ranks:{hp:25,attack:26,ki:26,speed:25},
 techniques:['chaos_wave','tackle','energy_punch'],
 auraColor:'#000000',auraPalette:['#000000'],auraEmphasis:true,auraDensity:1.6,auraStrength:1.35,
 additionalEffects:[{
  id:'dark_domain_king_opening_stop',type:'opening_opponents_attack_stop',duration:5,
  description:'戦闘開始から5秒間、暗黒域の王の相手チーム全員の攻撃行動を止めます。追加効果とサポートもちものの効果は止まりません。'
 }],
 auraAdditionalEffects:[{
  id:'dark_domain_king_aura_opening_stop',type:'opening_opponents_attack_stop',duration:2.5,
  description:'戦闘開始から2.5秒間、オーラをまとった珍生物の相手チーム全員の攻撃行動を止めます。追加効果とサポートもちものの効果は止まりません。'
 }]
};
