/** Device-clock rules for a single startup or genuine browser return. */
export function normalizeSavedAt(value){return Number.isSafeInteger(value)&&value>=0&&value<=8640000000000000?value:null;}
const localDay=value=>{const d=new Date(value);return d.getFullYear()*372+d.getMonth()*31+d.getDate();};
export function calculateOfflineCalm({lastSavedAt,now,calmPoints}){
 if(!Number.isSafeInteger(calmPoints)||calmPoints<0||calmPoints>99)throw new RangeError('穏やかポイントが正しくありません。');
 const before=normalizeSavedAt(lastSavedAt),current=normalizeSavedAt(now),elapsedSeconds=before!==null&&current!==null&&current>=before?Math.floor((current-before)/1000):0;
 const elapsedPoints=Math.min(25,Math.floor(elapsedSeconds/100)),calendarBonus=before!==null&&current!==null&&current>before&&localDay(current)>localDay(before)?10:0,requested=elapsedPoints+calendarBonus,gained=Math.min(99-calmPoints,requested);
 return {elapsedSeconds,elapsedPoints,calendarBonus,requested,gained,calmPoints:calmPoints+gained};
}
