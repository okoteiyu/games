/** One percentage for map fills, route fills and visible probability labels. */
export function displayedWinChance(enemy){
 const raw=Number.isFinite(enemy?.winChanceRaw)?enemy.winChanceRaw:enemy?.winChance;
 if(!Number.isFinite(raw))throw new TypeError('勝敗推測が正しくありません。');
 return Math.max(0,Math.min(100,raw));
}
export function winChanceColor(chance,{soft=false}={}){
 const value=displayedWinChance({winChance:chance});
 return `hsl(${value*1.2} ${soft?'46% 80%':'51% 48%'})`;
}
