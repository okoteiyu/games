// A schematic overview, not a survey or a new destination in the game.
export const OUTDOOR_MAP_VIEWBOX='0 0 1200 860';

const rect=(x,y,width,height,fill,extra='')=>`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="9" fill="${fill}" ${extra}/>`;
const text=(x,y,value,size=30,extra='')=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="#645b49" ${extra}>${value}</text>`;

/** Four explanation-only areas, shared with the building map's region controls. */
export function outdoorMapDrawing({selected=null}={}){
 const zone=(id,x,y,width,height,fill)=>rect(x,y,width,height,fill,`data-building-zone="${id}" stroke="${selected===id?'#936843':'#ad9d7d'}" stroke-width="${selected===id?5:3}"`);
 let drawing=rect(30,40,1140,644,'#edf0df','stroke="#b4bf9e" stroke-width="3"')+
  text(600,104,'おこていゆハウス周辺',36)+
  // The neighbourhood street and sidewalk sit outside the building grounds.
  rect(0,744,1200,116,'#cdd0c8','data-outdoor-feature="street"')+
  rect(0,684,1200,60,'#e3dece','data-outdoor-feature="sidewalk"')+
  '<path d="M0 744H1200" stroke="#b4b6a7" stroke-width="3"/><path d="M0 807H1200" stroke="#f4f1df" stroke-width="5" stroke-dasharray="42 30"/>'+
  text(1014,836,'住宅街の道',28)+
  // Separate the ordinary front access from the broad outdoor access route.
  '<path data-outdoor-path="front-entry" d="M828 714V656M828 530V510" fill="none" stroke="#d9cfb8" stroke-width="72"/>'+
  '<path data-outdoor-path="large-entry" d="M70 714V306H104M232 392V446" fill="none" stroke="#d8d1bd" stroke-width="56" stroke-linejoin="round"/>'+
  '<path d="m815 675 13-13 13 13M221 424l11 11 11-11" fill="none" stroke="#aa9b78" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'+
  zone('building',446,176,664,334,'#f7f1df')+
  rect(464,194,628,298,'none','stroke="#d8c7a6" stroke-width="2"')+
  '<g data-outdoor-feature="building-outline" stroke="#a89570" fill="none" stroke-linejoin="round"><path d="m744 250 34-26 34 26v35h-68Z" stroke-width="4"/><path d="M769 285v-21h18v21" stroke-width="3"/></g>'+
  text(778,331,'おこていゆハウス',40)+
  text(778,391,'F1 おこていゆの部屋',27)+
  text(778,438,'F2 あなたの居住スペース',27)+
  zone('entrance',688,530,280,126,'#e4ead5')+
  text(828,574,'建物入口',34)+
  text(842,616,'セキュリティ付き',24)+
  '<g data-outdoor-feature="security-lock" fill="none" stroke="#8b936b" stroke-width="3"><path d="M709 600v-6a8 8 0 0 1 16 0v6"/><rect x="705" y="600" width="24" height="19" rx="3"/><path d="M717 607v5"/></g>'+
  zone('loading',104,218,256,174,'#e9dfc7')+
  text(232,260,'大型搬入口',34)+
  text(232,294,'大型の珍生物はこちら',22)+
  rect(142,315,180,55,'#f5f0e0','data-outdoor-feature="arrival-pad" stroke="#b4a17a" stroke-width="2" stroke-dasharray="8 6"')+
  '<path d="M232 324v32m-11-10 11 11 11-11" fill="none" stroke="#a18b61" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'+
  zone('freight',104,446,256,218,'#d8e4d4')+
  text(232,485,'屋外大型EV',32)+
  rect(141,505,182,42,'#f5f5e8','data-outdoor-feature="freight-platform" stroke="#99ae96" stroke-width="2"')+
  '<path d="M152 515h160m-160 11h160m-160 11h160" fill="none" stroke="#c0ccba" stroke-width="2"/>'+
  text(232,586,'B1 研究・生産側',25)+
  text(232,628,'B2 訓練所の奥',25)+
  // Small planting beds distinguish the grounds from the paved approaches.
  '<g data-outdoor-feature="planting" fill="#b9cda7" stroke="#9db68b" stroke-width="2"><rect x="1017" y="568" width="72" height="68" rx="18"/><circle cx="1041" cy="593" r="15"/><circle cx="1066" cy="611" r="16"/><circle cx="405" cy="602" r="18"/></g>';
 return `<g data-outdoor-plan="house-surroundings" font-family="system-ui, sans-serif">${drawing}</g>`;
}
