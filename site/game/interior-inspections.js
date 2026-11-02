/** Authored object groups, independent of story progression and game rewards. */
export const INTERIOR_INSPECTIONS=Object.freeze({
 warehouse:Object.freeze([
  Object.freeze({id:'warehouse_fridge',label:'正面の大型冷蔵庫',featureIds:Object.freeze(Array.from({length:6},(_,i)=>'fridge-'+(i+1))),front:Object.freeze([0,0,1]),description:'正面には、大きな冷蔵庫が並んでいる。施設の人たちや、招かれた珍生物の食事を支える、頼もしい備えだ。'})
 ])
});
export function interiorInspections(roomId){return INTERIOR_INSPECTIONS[roomId]||[];}
