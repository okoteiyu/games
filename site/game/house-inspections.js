/** Front views in the approved room's Y-up metre coordinates.
 * Static meshes share materials and are merged; classify the actual nearest
 * triangle's point inside these furniture bounds, never a screen rectangle.
 * These bounds and camera directions are authoring values, not game balance.
 */
export const HOUSE_INSPECTIONS=Object.freeze([
 {id:'moai_kun',label:'モアイくん',type:'daily',front:[1,.45,0],text:'おこていゆについてまわるおもちゃだ。おこていゆには、特別な思い入れがあるようだ。'},
 {id:'bookshelf',label:'本棚',type:'research',min:[2.118,.01,-3.964],max:[2.58,1.482,-2.916],front:[-1,.08,0],text:'本棚には「イースター島大全集」が並んでいる。ずいぶん、じっくり読み込まれているようだ。'},
 {id:'food',label:'食べ物',type:'meal',front:[0,.9,1],text:'美味しそうにできている。どうやら、ひと休みの準備は万全らしい。'},
 {id:'computer',label:'パソコン',type:'research',min:[1.93,.84,-2.174],max:[2.395,1.30,-1.539],front:[-1,.18,0],text:'画面には、凝った研究ファイルが開かれている。見出しにも、少し気合いが入っている。'},
 {id:'whiteboard',label:'ホワイトボード',type:'research',min:[-2.602,.01,-1.622],max:[-2.338,.941,-.478],front:[1,.05,0],text:'ホワイトボードには、研究のアイデアが記されている。ひらめきは、すぐ書き留めることにしているようだ。'},
 {id:'bed',label:'ベッド',type:'daily',min:[-1.162,.63,-5.405],max:[-.278,1.19,-4.545],front:[0,.65,1],text:'小さくて、かわいいベッドだ。ふかふかで、横になるだけで眠くなりそうだ。'},
 {id:'fridge',label:'冷蔵庫',type:'daily',min:[-2.573,.01,-2.372],max:[-1.974,.553,-1.827],front:[1,.18,0],text:'冷蔵庫は、いつでも満タンだ。戦うための元気は、ここにも蓄えているらしい。'}
].map(value=>Object.freeze(value)));
