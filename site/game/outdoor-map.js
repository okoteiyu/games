import {interiorMapDrawing} from './interior-map.js';
import {OUTDOOR_LAYOUT as layout} from './outdoor-layout.js';
// Focus on the grounds and frontage present in the exported exterior model.
export const OUTDOOR_MAP_VIEWBOX=layout.mapViewBox.join(' ');

const rect=(x,y,width,height,fill,extra='')=>`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="9" fill="${fill}" ${extra}/>`;
const text=(x,y,value,size=30,extra='')=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="#645b49" ${extra}>${value}</text>`;
const line=points=>points.map(([x,y],index)=>`${index?'L':'M'}${x} ${y}`).join('');
const featureRect=(feature,fill,extra='')=>rect(...feature.rect,fill,extra);

function fenceDrawing(){
 const [x,y,w,h]=layout.site.rect,bottom=y+h,gates=[layout.entry.freightGate,layout.entry.warehouseGate,layout.entry.mainGate].sort((a,b)=>a[0]-b[0]);
 let start=x,south='';for(const [gx,,width]of gates){south+=`M${start} ${bottom}H${gx}`;start=gx+width;}south+=`M${start} ${bottom}H${x+w}`;
 return `<g data-outdoor-feature="perimeter-wall" data-wall-height="${layout.site.wallHeight}" fill="none" stroke-linejoin="round"><path d="M${x} ${bottom}V${y}H${x+w}V${bottom}${south}" stroke="#8b9183" stroke-width="14"/><path d="M${x} ${bottom}V${y}H${x+w}V${bottom}${south}" stroke="#d7d7c9" stroke-width="6"/></g>`+
  gates.map(([gx,gy,width],index)=>`<g data-outdoor-feature="${['freight-gate','warehouse-gate','main-gate'][index]}" fill="#bbb7a6" stroke="#85897c" stroke-width="3">${rect(gx-7,gy-13,14,26,'#cbc9bb')}${rect(gx+width-7,gy-13,14,26,'#cbc9bb')}<path d="M${gx+8} ${gy-2}H${gx+width-8}" fill="none" stroke="#9c9d8b" stroke-width="5" stroke-dasharray="13 7"/></g>`).join('');
}

function securityDrawing(x,y,{id='entry',side=1}={}){
 return `<g data-outdoor-feature="${id}-security" aria-hidden="true">`+
  rect(x,y,15,24,'#54625b','stroke="#aab9ab" stroke-width="3"')+
  rect(x+4,y+4,7,7,'#c7d9c2')+
  `<path d="M${x+3} ${y+17}h9" stroke="#c8d4c3" stroke-width="3"/>`+
  `<path d="M${x-10*side} ${y-11}l${-15*side}-8 6-13 19 9Z" fill="#66736b" stroke="#a7afa0" stroke-width="3"/><circle cx="${x-12*side}" cy="${y-16}" r="4" fill="#cbdcc7"/>`+
  '</g>';
}

/** Ground-level buildings, secured entrances, roofed connection and garden. */
export function outdoorMapDrawing({selected=null}={}){
 const zone=(id,x,y,width,height,fill,extra='')=>rect(x,y,width,height,fill,`data-building-zone="${id}" stroke="${selected===id?'#936843':'#ad9d7d'}" stroke-width="${selected===id?6:3}" ${extra}`);
 const [sx,sy,sw,sh]=layout.site.rect,[wx,wy,ww,wh]=layout.warehouse.rect,[hx,hy,hw,hh]=layout.house.rect,[fx,fy,fw,fh]=layout.freight.rect;
 const streetRect=[sx,layout.street.rect[1],sw,layout.street.rect[3]],sidewalkRect=[sx,layout.street.sidewalk[1],sw,layout.street.sidewalk[3]],northX=sx+sw-64,northY=sy+178;
 const [doorX,doorY,doorWidth]=layout.house.frontDoor,[shutterX,shutterY,shutterWidth]=layout.freight.southShutter,[humanX,humanY,humanWidth]=layout.freight.southHumanDoor;
 const corridor=line(layout.corridor.points),corridorWidth=layout.corridor.width;
 const eastWindowStart=Math.min(...layout.house.eastWindows.map(window=>window.start)),eastWindowEnd=Math.max(...layout.house.eastWindows.map(window=>window.end));
 let drawing=featureRect(layout.site,'#dbe8cc','data-outdoor-feature="grass" stroke="#b4bf9e" stroke-width="4"')+
  '<g data-outdoor-feature="lawn-grain" fill="none" stroke="#b9cd9f" stroke-width="3" opacity=".65">'+
  [[82,120],[185,150],[370,112],[550,100],[760,125],[1040,105],[1265,132],[1325,235],[1305,370],[1325,535],[66,824],[445,540],[445,720],[1330,808],[1770,814],[1900,840]].map(([x,y])=>`<path d="M${x-7} ${y+7}l7-14 7 14m-7-14v17"/>`).join('')+'</g>'+
  featureRect(layout.paved,'#d6d2c5','data-outdoor-feature="paved-yard" stroke="#b9b4a5" stroke-width="3"')+
  '<g data-outdoor-feature="pavement-joints" stroke="#c4c0b4" stroke-width="3" fill="none">'+
  [590,710,830,950,1070,1190].map(x=>`<path d="M${x} ${layout.paved.rect[1]}v${layout.paved.rect[3]}"/>`).join('')+
  `<path d="M${layout.paved.rect[0]} ${layout.paved.rect[1]+112}h${layout.paved.rect[2]}"/></g>`+
  // Roads are outside the fence; only working approaches interrupt the lawn.
  rect(...streetRect,'#cdd0c8','data-outdoor-feature="street"')+
  rect(...sidewalkRect,'#e3dece','data-outdoor-feature="sidewalk"')+
  `<path d="M${streetRect[0]} ${streetRect[1]}h${streetRect[2]}" stroke="#b4b6a7" stroke-width="4"/><path d="M${streetRect[0]} ${streetRect[1]+streetRect[3]/2}h${streetRect[2]}" stroke="#f4f1df" stroke-width="6" stroke-dasharray="60 44"/>`+
  text(1670,streetRect[1]+streetRect[3]*.825,'住宅街の道',54)+
  layout.walkways.map(path=>`<path data-outdoor-path="${path.id}" d="${line(path.points)}" fill="none" stroke="#d8d1bd" stroke-width="${path.width}"/>`).join('')+
  // Thick outer walls and a continuous opaque roof distinguish the enclosed link.
  `<g data-outdoor-feature="enclosed-corridor" data-enclosed="true" data-windows="false"><path data-outdoor-path="warehouse-freight" d="${corridor}" fill="none" stroke="#777f75" stroke-width="${corridorWidth+14}" stroke-linecap="butt" stroke-linejoin="miter"/><path d="${corridor}" fill="none" stroke="#c5c8bd" stroke-width="${corridorWidth}" stroke-linecap="butt" stroke-linejoin="miter"/><path d="${corridor}" fill="none" stroke="#e1e2d6" stroke-width="5" stroke-linecap="butt" stroke-linejoin="miter"/>`+
  [300,340,380,420,460,500].map(x=>`<path d="M${x} 267V333" stroke="#9ca393" stroke-width="3"/>`).join('')+'</g>'+
  zone('warehouse',wx,wy,ww,wh,'#eee8d9','data-map-marker-x="910" data-map-marker-y="420" data-map-marker-unit="2.5"')+
  `<g transform="translate(${wx} ${wy})" data-outdoor-feature="warehouse-interior">`+interiorMapDrawing('warehouse',{selected:selected==='warehouse'})+'</g>'+text(wx+ww*.4,wy-20,'倉庫',54)+
  '<path data-outdoor-feature="warehouse-entry-apron" d="M470 264H510L536 234H588V398H536L510 336H470Z" fill="#c4c8bc" stroke="#818d7a" stroke-width="3" stroke-linejoin="round"/>'+
  '<g data-outdoor-feature="warehouse-door" data-opening-y="234" data-opening-height="164" fill="none" stroke="#a18b66"><path d="M532 234h115m-115 164h115" stroke-width="4"/><path d="M565 316A82 82 0 0 0 647 234M565 316A82 82 0 0 1 647 398" stroke-width="3" stroke-dasharray="7 5"/></g>'+
  '<path data-outdoor-feature="warehouse-street-apron" d="M799 612H1021V664L1000 704H820L799 664Z" fill="#d8d1bd" stroke="#b7aa8b" stroke-width="3" stroke-linejoin="round"/>'+
  '<g data-outdoor-feature="warehouse-south-door" data-opening-x="799" data-opening-width="222" data-side-width="740" fill="none" stroke="#a18b66"><path d="M799 668V525M1021 668V525" stroke-width="4"/><path d="M910 636A111 111 0 0 0 799 525M910 636A111 111 0 0 1 1021 525" stroke-width="3" stroke-dasharray="7 5"/></g>'+
  // Two ordinary residential floors, one east-facing window position per floor.
  zone('building',hx,hy,hw,hh,'#f7f1df')+
  rect(hx+22,hy+22,hw-44,366,'#e3e0d4','data-outdoor-feature="building-outline" stroke="#9da194" stroke-width="4"')+
  `<path data-outdoor-feature="house-roof" d="M${hx+hw/2} ${hy+22}V${hy+388}M${hx+22} ${hy+22}L${hx+hw/2} ${hy+90}L${hx+hw-22} ${hy+22}M${hx+22} ${hy+388}L${hx+hw/2} ${hy+320}L${hx+hw-22} ${hy+388}" fill="none" stroke="#b2b5a8" stroke-width="4"/>`+
  text(hx+hw/2,hy+150,'おこていゆ',86)+text(hx+hw/2,hy+240,'ハウス',86)+text(hx+hw/2,hy+329,'F1・F2',50)+
  `<g data-outdoor-feature="east-windows" data-window-side="east" data-window-start="${eastWindowStart}" data-window-end="${eastWindowEnd}" stroke="#6caaa6" fill="#d8eeea"><rect x="${hx+hw-5}" y="${eastWindowStart}" width="12" height="${eastWindowEnd-eastWindowStart}" rx="2" stroke-width="4"/><path d="M${hx+hw+2} ${eastWindowStart}v${eastWindowEnd-eastWindowStart}" stroke="#f7fff9" stroke-width="3"/>`+
  layout.house.eastWindows.map(window=>`<path data-exterior-window-floor="${window.floor}" data-window-start="${window.start}" data-window-end="${window.end}" d="M${hx+hw+12+(window.floor-1)*7} ${window.start}v${window.end-window.start}" stroke-width="4"/>`).join('')+'</g>'+
  rect(1790,694,84,66,'#e6eadc','data-outdoor-feature="passenger-ev" stroke="#a5b294" stroke-width="3"')+text(1832,742,'EV',48)+
  zone('entrance',1390,650,300,130,'#e4ead5')+text(1540,730,'建物入口',50)+
  `<g data-outdoor-feature="front-door" data-security="reinforced"><path d="M${doorX-8} ${doorY-10}h${doorWidth+16}m-${doorWidth+16} 20h${doorWidth+16}" stroke="#778a7b" stroke-width="8"/><path d="M${doorX} ${doorY}h${doorWidth}" stroke="#b8c7b5" stroke-width="9"/></g>`+
  securityDrawing(doorX+doorWidth+12,doorY-26,{id:'front-door'})+
  featureRect(layout.entry.mailbox,'#d8ddd0','data-outdoor-feature="mailbox" stroke="#8b9c89" stroke-width="4"')+
  `<path d="M${layout.entry.mailbox.rect[0]+6} ${layout.entry.mailbox.rect[1]+10}h33m-33 0 16.5 11L${layout.entry.mailbox.rect[0]+39} ${layout.entry.mailbox.rect[1]+10}" fill="none" stroke="#899783" stroke-width="3"/>`+
  featureRect(layout.entry.parcelBox,'#c5d1bc','data-outdoor-feature="parcel-box" stroke="#819375" stroke-width="4"')+
  `<path d="M${layout.entry.parcelBox.rect[0]+8} ${layout.entry.parcelBox.rect[1]+10}h49v28h-49ZM${layout.entry.parcelBox.rect[0]+47} ${layout.entry.parcelBox.rect[1]+24}h5" fill="none" stroke="#7e8c72" stroke-width="3"/>`+
  zone('freight',fx,fy,fw,fh,'#dce4d4')+
  '<path data-outdoor-feature="freight-north-door" d="M224 350h72" stroke="#c5c8bd" stroke-width="8"/><path d="M220 343v14m80-14v14" stroke="#778a7a" stroke-width="4"/>'+
  text(fx+fw/2,fy+66,'大型搬入口',48)+text(fx+fw/2,fy+131,'EV',64)+
  rect(155,510,210,100,'#f4f2e4','data-outdoor-feature="freight-platform" stroke="#99ae96" stroke-width="4"')+
  '<path d="M260 512v96m-94-70h188m-188 44h188" fill="none" stroke="#b9c5b0" stroke-width="3"/>'+
  text(fx+fw/2,fy+344,'B1・B2へ',48)+
  `<g data-outdoor-feature="freight-south-shutter" data-opening-x="${shutterX}" data-opening-width="${shutterWidth}" stroke="#75877b" stroke-width="4">${rect(shutterX-7,shutterY-17,shutterWidth+14,34,'#afb9ae')}`+
  [0,7,14].map(offset=>`<path d="M${shutterX} ${shutterY-7+offset}h${shutterWidth}"/>`).join('')+'</g>'+
  `<g data-outdoor-feature="freight-human-door" data-opening-x="${humanX}" data-opening-width="${humanWidth}"><path d="M${humanX-4} ${humanY-14}h${humanWidth+8}v28h-${humanWidth+8}Z" fill="#bdc8b7" stroke="#788c77" stroke-width="5"/><path d="M${humanX+humanWidth-10} ${humanY-3}v9" stroke="#6b8068" stroke-width="4"/></g>`+
  securityDrawing(humanX+humanWidth+10,humanY-29,{id:'freight'})+
  fenceDrawing()+
  text(1000,118,'おこていゆハウス周辺',64)+
  zone('grounds',...layout.groundsZone.rect,'#edf2df',`data-map-marker-x="${layout.groundsZone.rect[0]+layout.groundsZone.rect[2]-50}" data-map-marker-y="${layout.groundsZone.rect[1]+15}" data-map-marker-unit="1.4"`)+
  text(layout.groundsZone.rect[0]+155,layout.groundsZone.rect[1]+75,'拠点の屋外',50)+
  `<g data-outdoor-feature="north-mark" stroke="#9aa68c" fill="none" stroke-width="5"><path d="M${northX} ${northY}v-115m-22 36 22-36 22 36"/></g>`+text(northX,northY-144,'N',44);
 return `<g data-outdoor-plan="house-surroundings" font-family="system-ui, sans-serif">${drawing}</g>`;
}
