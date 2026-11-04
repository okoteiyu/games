/** Story data is separate from playback, progress and scene rendering. */
const scene=(id,stage,text,options={})=>({id,type:'scene',stage,shot:'medium',animation:'idle',expression:'neutral',speaker:'ナレーション',...options,text});

export const STORY_CHAPTERS=Object.freeze([
 {
  id:'chapter-0',arcId:'hero',number:0,title:'小さな研究者',
  description:'独り立ちする研究者と、あなたの出会い。',
  episodes:[
   {
    id:'ch0-01',title:'出発する研究者',description:'本拠点を出たおこていゆが、新しい拠点へ向かう。',readingMinutes:3,
    scenes:[
     scene("ch0-01-01","headquarters","おれの名前はおこていゆ。今日はついに長らくお世話になったヒーロー協会施設を出て独り立ちする日である。",{"shot": "wide", "animation": "walk", "speaker": "", "sourceSceneId": "ch0-01-01", "category": "innerThought"}),
     scene("ch0-01-02","headquarters","思えば長いことお世話になったのね。おかげで珍生物研究者として様々な経験ができまちた(🍥⩌  ︿  ⩌🍥)",{"speaker": "", "sourceSceneId": "ch0-01-02", "category": "innerThought"}),
     scene("ch0-01-05","headquarters","これからは、新しい拠点で研究者かつヒーローとして、もっと成長していくのねー‼️",{"animation": "nod", "expression": "determined", "speaker": "", "sourceSceneId": "ch0-01-05", "category": "innerThought"}),
     {"id":"ch0-cut-road","type":"transition","stage":"black","text":"","auto":true,"duration":1.1,"fade":"black"},
     scene("ch0-01-11","road","うーんうーん。ここら辺はまだ来たことがないな🌀気を付けないと💦",{"shot": "wide", "animation": "walk", "speaker": "", "sourceSceneId": "ch0-01-11", "category": "innerThought"}),
     scene("ch0-01-12","road","ウム!!! 前方ヨシ💪 いっくぞー✨",{"animation": "look", "expression": "happy", "speaker": "", "sourceSceneId": "ch0-01-12", "category": "innerThought"}),
     scene("ch0-01-16","road","",{"animation": "look", "sourceSceneId": "ch0-01-16", "punimVisible": true, "punimEntry": true, "auto": true, "duration": 2, "message": false}),
     {"id":"ch0-02-call","type":"choice","sourceSceneId":"ch0-02-call","prompt":"とっさに、声をかける。","options":[{"label":"危ない!!"}]},
     scene("ch0-02-call-turn","road","",{"animation": "surprise", "expression": "surprise", "sourceSceneId": "ch0-02-call", "auto": true, "duration": 1.4, "turn": true, "speedLines": true, "punimVisible": true, "message": false}),
     {"id":"first-punim","sourceSceneId":"first-punim","type":"battle","speciesId":"punim","level":5,"profile":"initial","region":"residential","timeOfDay":"day"},
     scene("ch0-02-05","road","ふ〜、危ないところだったゼェ〜💦 サンキューな✨",{"expression": "happy", "speaker": "", "sourceSceneId": "ch0-02-05", "category": "innerThought", "punimVisible": true, "punimState": "tired"}),
     scene("ch0-02-06","road","しかしおこていゆを不意打ちしようだなんて、図々しいヤツである(🍥⩌  ︿  ⩌🍥)",{"expression": "determined", "speaker": "", "sourceSceneId": "ch0-02-06", "category": "innerThought", "punimVisible": true, "punimState": "tired"}),
     scene("ch0-02-07-record","road","ｵﾏｴのことは記録帳に書いてやる🍥 ｵﾏｴはプニプニしてるから、プニムに違いない‼️",{"expression": "determined", "speaker": "", "sourceSceneId": "ch0-02-07", "category": "innerThought", "punimVisible": true, "punimState": "tired"}),
     scene("ch0-02-07-pause","road","さて….",{"expression": "determined", "speaker": "", "sourceSceneId": "ch0-02-07", "category": "innerThought", "punimVisible": true, "punimState": "tired"}),
     scene("ch0-02-07-map","road","おこていゆは、この場所に案内しろと言わんばかりに、あなたに地図を差し出した。",{"animation": "offer-map", "sourceSceneId": "ch0-02-07", "prop": "map"}),
     scene("ch0-02-11","road","あなたは、おこていゆの圧倒的な強者の眼に押されて、断ることもできず地図の道を案内した。",{"animation": "look", "sourceSceneId": "ch0-02-11", "prop": "map"}),
     {"id":"ch0-cut-house","type":"transition","stage":"black","text":"","auto":true,"duration":1.1,"fade":"black"},
     scene("ch0-03-01","outdoor","おこていゆハウスに着くと、ふたりの管理人が出迎えた。",{"shot": "front", "sourceSceneId": "ch0-03-01"}),
     scene("ch0-03-02","outdoor","こんにちはー！！！",{"speaker": "管理人A & B", "sourceSceneId": "ch0-03-02", "portraits": ["manager_a", "manager_b"], "category": "conversation"}),
     scene("ch0-03-04","outdoor","おこていゆを出迎えたのは、おこていゆハウスの管理人だった。",{"animation": "nod", "expression": "happy", "sourceSceneId": "ch0-03-04"}),
     scene("ch0-03-05","outdoor","ここは「おこていゆハウス」‼️ これからはこの拠点で、私たちがおこていゆの活動をサポートするからね✨",{"speaker": "管理人A", "sourceSceneId": "ch0-03-05", "portrait": "manager_a", "category": "conversation"}),
     scene("ch0-03-07","outdoor","ちなみにおこていゆハウスという名前は私がつけました☺️",{"speaker": "管理人B", "sourceSceneId": "ch0-03-07", "portrait": "manager_b", "category": "conversation"}),
     scene("ch0-03-08","outdoor","おこていゆハウス….💦 ",{"speaker": "", "sourceSceneId": "ch0-03-08", "category": "innerThought"}),
     scene("ch0-03-09-tour","black","おこていゆは、中を一通り見て回った。",{"sourceSceneId": "ch0-03-09"}),
     scene("ch0-03-09-rest","house","今日は引っ越しで疲れたでしょうから、拠点内のことは体力がある時にまた確認してくださいね🍀",{"speaker": "管理人B", "sourceSceneId": "ch0-03-09", "portrait": "manager_b", "category": "conversation"}),
     scene("ch0-03-09-pause","house","さて… ",{"speaker": "管理人B", "sourceSceneId": "ch0-03-09", "portrait": "manager_b", "category": "conversation"}),
     scene("ch0-03-09-warning","house","「あなた」のことですが、この拠点の中を知ってしまった以上、このまま帰らせるわけにはいきません。",{"speaker": "管理人B", "sourceSceneId": "ch0-03-09", "portrait": "manager_b", "category": "conversation"}),
     scene("ch0-03-09-invite","house","おこていゆも「あなた」を気に入ったみたいだし、ここに住んでもらって、活動に協力してもらうことにしましょう。",{"expression": "happy", "speaker": "管理人A", "sourceSceneId": "ch0-03-09", "portrait": "manager_a", "category": "conversation"}),
     {"id":"ch0-03-home","type":"choice","sourceSceneId":"ch0-03-home","prompt":"あなたの返事を、おこていゆも待っている。","options":[{"label":"よよよよろしくお願いします。"},{"label":"よ、よろしくお願いします。"}]},
     scene("ch0-03-10","computer-room","あなたはおこていゆハウス 2F の住人になった。",{"sourceSceneId": "ch0-03-10"}),
     {"id":"ch0-register-name","sourceSceneId":"ch0-03-10","type":"registration","stage":"computer-room","text":""},
     scene("ch0-03-22","house","仕方ないから、協力してもらうか🍀🌀☺️",{"speaker": "", "sourceSceneId": "ch0-03-22", "category": "innerThought"})
    ]
   }
  ]
 }
]);

/** Only published arcs belong to the story catalogue. Coming Soon is a UI
 * placeholder rather than an invented arc, chapter or unlock requirement. */
export const STORY_ARCS=Object.freeze([
 Object.freeze({id:'hero',title:'ヒーロー編',description:'小さな研究者と、あなた。出会いを重ね、ヒーローとして歩み始める物語。',chapterIds:Object.freeze(STORY_CHAPTERS.filter(chapter=>chapter.arcId==='hero').map(chapter=>chapter.id))})
]);
