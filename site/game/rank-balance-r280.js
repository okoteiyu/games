/** R280 adjusts this already-registered roster once, after regional species
 * have been authored. Later species keep their own explicitly assigned ranks.
 * Source definitions remain the pre-adjustment authoring values. */
export const R280_REGISTERED_SPECIES_IDS=Object.freeze([
 'okoteiyu','horarara_horaran','moai_king','great_fairy',
 'mystery_015','mystery_020','mystery_025','mystery_030','mystery_035','mystery_040',
 'mystery_045','mystery_050','mystery_055','mystery_060','mystery_065','mystery_070',
 'mystery_075','mystery_080','mystery_085','mystery_095','mystery_100',
 'wind_kurukuru','steel_maru','eleki_kun','armored_tank','railway_cannon','star_soul',
 'void_space','perfect_cosmos','chaos','holy_white_dragon_pegasus','koke_atama',
 'iron_senpai','eyeball_gate','punim','angry_punim','dark_punim','celestial_punim',
 'angry_moai_warrior','dark_moai_warrior','celestial_moai_warrior',
 'angry_great_fairy','dark_great_fairy','celestial_great_fairy',
 'angry_horarara_horaran','dark_horarara_horaran','celestial_horarara_horaran',
 'angry_wind_kurukuru','dark_wind_kurukuru','celestial_wind_kurukuru',
 'fake_moai','car','mini_elephant','rookie_kun','fae_dragon','transparent_knight',
 'crystal_striker','unknown_low','unknown_danger','unknown_extreme','gold_moai',
 'dragon','great_beast_lord'
]);
const registeredIds=new Set(R280_REGISTERED_SPECIES_IDS);
const completedCatalogs=new WeakSet();
const adjustedRank=value=>value<=10?value+5:value<=17?value+3:value;

/** The catalog is assembled only at module load, never from saved player data
 * or temporary combat ranks. Reusing a completed catalog cannot compound it. */
export function applyR280RankBalance(catalog){
 if(completedCatalogs.has(catalog))return catalog;
 const balanced=Object.fromEntries(Object.entries(catalog).map(([id,creature])=>[
  id,registeredIds.has(id)?Object.freeze({...creature,ranks:Object.freeze(Object.fromEntries(
   Object.entries(creature.ranks).map(([stat,value])=>[stat,adjustedRank(value)])
  ))}):creature
 ]));
 completedCatalogs.add(balanced);
 return Object.freeze(balanced);
}
