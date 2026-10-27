/** Real wall clock shared by browser and native WebView; never a saved game clock. */
export const WORLD_TIME_POLICY=Object.freeze({timeZone:'device',dayStartsAt:6,nightStartsAt:18,boundariesStatus:'confirmed'});
export function currentTimeOfDay(date=new Date(),policy=WORLD_TIME_POLICY){
 if(!(date instanceof Date)||!Number.isFinite(date.getTime()))throw new TypeError('現在時刻が正しくありません。');
 const hour=policy.timeZone==='Asia/Tokyo'?Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',hour:'numeric',hourCycle:'h23'}).format(date)):date.getHours();
 return hour>=policy.dayStartsAt&&hour<policy.nightStartsAt?'day':'night';
}
export const TIME_LABELS=Object.freeze({day:'昼',night:'夜'});
