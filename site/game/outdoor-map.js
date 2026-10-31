// A schematic overview, not a survey or a new destination in the game.
export const OUTDOOR_MAP_VIEWBOX='0 0 1200 860';

const rect=(x,y,width,height,fill,extra='')=>`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="9" fill="${fill}" ${extra}/>`;
const text=(x,y,value,size=30,extra='')=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="#645b49" ${extra}>${value}</text>`;

/** A single ground-floor footprint and its combined cargo entrance/lift. */
export function outdoorMapDrawing({selected=null}={}){
 const zone=(id,x,y,width,height,fill)=>rect(x,y,width,height,fill,`data-building-zone="${id}" stroke="${selected===id?'#936843':'#ad9d7d'}" stroke-width="${selected===id?5:3}"`);
 let drawing=rect(30,40,1140,644,'#edf0df','stroke="#b4bf9e" stroke-width="3"')+
  text(600,104,'おこていゆハウス周辺',36)+
  // The neighbourhood street and sidewalk sit outside the building grounds.
  rect(0,744,1200,116,'#cdd0c8','data-outdoor-feature="street"')+
  rect(0,684,1200,60,'#e3dece','data-outdoor-feature="sidewalk"')+
  '<path d="M0 744H1200" stroke="#b4b6a7" stroke-width="3"/><path d="M0 807H1200" stroke="#f4f1df" stroke-width="5" stroke-dasharray="42 30"/>'+
  text(1014,836,'住宅街の道',28)+
  '<path data-outdoor-path="front-entry" d="M690 714V660" fill="none" stroke="#d9cfb8" stroke-width="72"/>'+
  '<path data-outdoor-path="large-entry" d="M260 714V660" fill="none" stroke="#d8d1bd" stroke-width="100"/>'+
  '<path d="m677 684 13-13 13 13m-456 0 13-13 13 13" fill="none" stroke="#aa9b78" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'+
  // The near-square outline follows the existing F1 plan's proportions.
  // Entrance is intentionally inside this footprint, not a detached building.
  zone('building',570,140,540,520,'#f7f1df')+
  rect(592,162,496,366,'#f2e9d5','data-outdoor-feature="building-outline" stroke="#d8c7a6" stroke-width="2"')+
  '<path d="M612 182H1068M612 508H1068M592 548H1088" fill="none" stroke="#d7c4a0" stroke-width="2"/>'+
  text(840,307,'おこていゆハウス',40)+
  text(840,380,'F1 おこていゆの部屋',27)+
  text(840,427,'F2 あなたの居住スペース',27)+
  rect(1008,578,62,54,'#e6eadc','data-outdoor-feature="passenger-ev" stroke="#a5b294" stroke-width="2"')+text(1039,613,'EV',24)+
  zone('entrance',590,570,200,90,'#e4ead5')+
  text(690,606,'建物入口',30)+text(704,642,'セキュリティ付き',20)+
  '<g data-outdoor-feature="security-lock" fill="none" stroke="#8b936b" stroke-width="3"><path d="M606 628v-6a7 7 0 0 1 14 0v6"/><rect x="602" y="628" width="22" height="18" rx="3"/><path d="M613 635v5"/></g>'+
  '<path data-outdoor-feature="front-door" d="M650 660h80" stroke="#9ab7a8" stroke-width="6"/>'+
  // One area: the outdoor loading entrance is the freight lift itself.
  zone('freight',110,230,300,430,'#dce4d4')+
  text(260,281,'大型搬入口・EV',34)+
  rect(155,315,210,120,'#f4f2e4','data-outdoor-feature="freight-platform" stroke="#99ae96" stroke-width="3"')+
  '<path d="M260 317v116m-94-88h188m-188 57h188" fill="none" stroke="#b9c5b0" stroke-width="2"/>'+
  '<path d="M260 486v-36m-11 10 11-11 11 11" fill="none" stroke="#a18b61" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'+
  text(260,549,'B1 研究・生産側',27)+
  text(260,601,'B2 訓練所の奥',27)+
  // Small planting beds distinguish the grounds from the paved approaches.
  '<g data-outdoor-feature="planting" fill="#b9cda7" stroke="#9db68b" stroke-width="2"><rect x="466" y="566" width="66" height="68" rx="18"/><circle cx="488" cy="589" r="15"/><circle cx="513" cy="611" r="16"/><circle cx="74" cy="190" r="18"/></g>';
 return `<g data-outdoor-plan="house-surroundings" font-family="system-ui, sans-serif">${drawing}</g>`;
}
