/** Story data is separate from playback, progress and scene rendering. */
const scene=(id,stage,text,options={})=>({id,type:'scene',stage,shot:'medium',animation:'idle',expression:'neutral',speaker:'ナレーション',...options,text});
const manager=(id,stage,who,text,options={})=>scene(id,stage,text,{speaker:who==='a'?'管理人A':'管理人B',portrait:who==='a'?'manager_a':'manager_b',...options});

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
 },
 {
  id:'chapter-1',arcId:'hero',number:1,nextChapter:1,title:'知ること、強くなること',
  description:'研究も、訓練も、ひとりきりではない。いつもの場所から、新しい発見へ。',
  episodes:[
   {
    id:'ch1-01',title:'研究の前に、ごあいさつ',description:'地下のコンピュータ室へ。研究を支える人と、最初のご挨拶。',readingMinutes:1,
    staffPlacements:{worker_008:'analysis-room'},
    scenes:[
     scene('ch1-01-01','house','暮らしが少し落ち着いた朝。おこていゆの研究ノートから、建物の案内がはらりと落ちた。地下には、まだ挨拶していない人たちがいる。',{animation:'thinking',prop:'book'}),
     manager('ch1-01-02','house','a','研究を支えてくれる人にも、ご挨拶を。地下1階のコンピュータ室で、会員No.008がお待ちです。',{prop:'book'}),
     scene('ch1-01-03','house','おこていゆは案内を確かめ、こくりとうなずいた。モアイくんも一度跳ねる。まずは建物の地図で、行き先を確かめよう。',{animation:'nod',expression:'determined',prop:'book'}),
     {
      id:'ch1-01-greet',type:'objective',
      objective:{kind:'talk_staff',staffId:'worker_008',roomId:'analysis-room',floorId:'b1',areaId:'analysis',title:'会員No.008にご挨拶',description:'2DマップでB1のコンピュータ室へ向かい、会員No.008に話しかけよう。',roomLabel:'B1 · コンピュータ室',staffLabel:'会員No.008'},
      lines:[
       {speaker:'会員No.008',kind:'speech',category:'conversation',text:'はじめまして、会員No.008です。珍生物の記録を整理しています。お持ちのノート、少し見せてもらっても？'},
       {speaker:'会員No.008',kind:'speech',category:'conversation',text:'なるほど、この空白を、これから埋めていくんですね。おや、と思ったことを教えてください。記録を残すのは、ここで手伝います。'},
       {speaker:'会員No.008',kind:'speech',category:'conversation',text:'……「ベーコンが一番おいしく焼ける時間」。これも研究ですね。世界を護る研究者も、おなかは空きますから。'}
      ]
     },
     scene('ch1-01-04','computer-room','今度は、もっとすごい研究を持ってこよう。ベーコン以外の。',{shot:'close',animation:'thinking',expression:'happy',prop:'book',category:'innerThought'}),
     scene('ch1-01-05','computer-room','知らないことを、一緒に考えてくれる人がいる。今日の最初の発見は、珍生物のことではなかった。',{animation:'nod',expression:'happy',prop:'book'})
    ]
   },
   {
    id:'ch1-02',title:'大きな冷蔵庫、小さな発見',description:'倉庫の正面に並ぶ、大きな冷蔵庫。近づいて見ると、気づくことがある。',readingMinutes:1,
    scenes:[
     scene('ch1-02-01','house','挨拶を終えたおこていゆは、研究ノートを開いた。珍生物のことだけでなく、施設のことも知っておきたいらしい。余白には、まだ小さな疑問が残っている。',{animation:'thinking',prop:'book'}),
     manager('ch1-02-02','house','b','次は倉庫を見てみる？　正面に並んだ大きな冷蔵庫も、暮らしを支える設備のひとつだよ。気になったものは、近くでじっくり観察してみよう。',{prop:'book'}),
     scene('ch1-02-03','house','冷蔵庫、と聞いて、おこていゆの目が少しだけ開いた。研究者としての好奇心なのか、おなかの好奇心なのか。まずは、実物を見に行こう。',{animation:'nod',expression:'happy',prop:'book'}),
     {
      id:'ch1-02-inspect',type:'objective',
      objective:{kind:'inspect_object',roomId:'warehouse',floorId:'outdoor',areaId:'warehouse',targetId:'warehouse_fridge',title:'冷蔵庫を詳しく観察',description:'倉庫の3Dビューで、正面に並ぶ大型冷蔵庫をひとつタップし、詳細観測してみよう。',roomLabel:'屋外 · 倉庫',targetLabel:'正面の大型冷蔵庫'},
      inspectionMessage:'近づくと、厚い扉と丈夫な取っ手がよく分かった。ここで働く人や、招かれた珍生物の食事を支える、大きな備え。おこていゆは、しばらく真剣に見つめていた。'
     },
     scene('ch1-02-04','house','大きい。ベーコンも、たくさん入る。……すごく大事な設備だ。',{shot:'close',animation:'thinking',expression:'happy',prop:'book',category:'innerThought'}),
     scene('ch1-02-05','house','部屋へ戻ると、おこていゆは「よく見てみる」とノートに書いた。遠くからでは分からないことが、近づくと見えてくる。研究の第一歩を、またひとつ見つけたようだ。',{animation:'nod',expression:'happy',prop:'book'})
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
