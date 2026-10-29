/** Advice only: opening this guide does not change game progress. */
export const GROWTH_GUIDE_TABS=[['flow','超効率フロー'],['calm','穏やか Pt 効率化'],['strategy','戦闘力強化と戦略'],['after','成長後']];
const picture=(file,alt,caption,classes='')=>{
 const [width,height]=({chair:[512,512],'chair-button':[352,164],'collection-button':[172,158],'aura-grid':[696,836]})[file];
 return `<figure class="growth-guide__figure ${classes}"><img src="assets/growth-guide/${file}.webp" alt="${alt}" width="${width}" height="${height}" loading="lazy" decoding="async"><figcaption>${caption}</figcaption></figure>`;
};
const jump=(id,label)=>`<button type="button" class="growth-guide__jump" data-growth-tab="${id}">${label}<span aria-hidden="true"> ↗</span></button>`;

export function growthGuideMarkup(){
 const pages={
  flow:`<header class="growth-guide__intro"><span class="growth-guide__eyebrow">まずは、この順番で</span><h3>育成に関する超効率フロー</h3><p>少しコツをつかむと、成長がぐっと楽になります。おこていゆと、ひとつずつ試してみましょう。</p></header>
   <ol class="growth-flow">
    <li><span class="growth-flow__number" aria-hidden="true">1</span><div><h4>穏やか Pt を貯める</h4><p>戦闘に出かけるには、穏やか Pt が必要です。まずは、ゆっくり休んでもらって貯めておきましょう。</p>${jump('calm','穏やか Pt 効率化を読む')}</div></li>
    <li><span class="growth-flow__number" aria-hidden="true">2</span><div><h4>訓練周回</h4><p>まずは、最初から相手をしてくれるプニムとの訓練から。勝利を狙いやすい相手と繰り返し戦って、経験値集めとオーラ強化を進めましょう。序盤は、特にオーラのレベル上げがよく効きます。</p>${jump('strategy','戦闘力強化と戦略を読む')}</div></li>
    <li><span class="growth-flow__number" aria-hidden="true">3</span><div><h4>怒り Pt 収集の同時並行</h4><p>パトロールや訓練の戦闘を終えて帰ると、勝ち負けにかかわらず、穏やか Pt の消費 0 で「ちょっかいをかける」ボーナスが使えます。帰ってきたら、忘れずに。</p><p>怒り Pt が 3 貯まるたびに「おこていゆイベント」が起こり、技などの取得が抽選されます。戦闘の合間に、こちらも進めましょう。</p></div></li>
    <li><span class="growth-flow__number" aria-hidden="true">4</span><div><h4>周回対象の厳選</h4><p>パトロールに出かけて、新たな珍生物に出会いましょう。戦闘に勝利すると、その珍生物とは訓練でも戦えるようになります。</p><p>パトロールには強敵もたくさん登場します。もちもの・オーラ・技を見直して、準備を万全にしてから出発しましょう。</p>${jump('strategy','戦闘力強化と戦略を読む')}</div></li>
   </ol><p class="growth-guide__loop"><span>訓練</span><b aria-hidden="true">→</b><span>ボーナスでちょっかい</span><b aria-hidden="true">→</b><span>また訓練へ</span></p><p class="growth-guide__aside">穏やか Pt が足りなくなったら、最初の手順に戻って、ひと休みです。</p>`,
  calm:`<header class="growth-guide__intro"><span class="growth-guide__eyebrow">出発の準備</span><h3>穏やか Pt 効率化</h3><p>のんびり待つのも、少し手伝うのも。遊び方に合わせて貯めてみましょう。</p></header>
   <section class="growth-guide__chapter"><h4>ホーム画面で放置</h4><p>ホーム画面の「おこていゆハウス」では、おこていゆが自分で行動しています。ときどき食べたり、寝転がったり、座ったりして、休み終わるたびに穏やか Pt が貯まります。</p><p>画面を開いたまま、のんびり見守るだけでも大丈夫です。この手引きを読んでいる間も、おこていゆは過ごしています。</p></section>
   <section class="growth-guide__chapter"><h4>効率的な行動をタップ</h4><p>時間を節約したいなら、「椅子を掃除する」を繰り返し選ぶのがおすすめです。今ある行動の中では、これがいちばん時間効率よく穏やか Pt を貯められます。</p>${picture('chair','ふかふかの椅子のイメージ','ロフト奥のふかふかの椅子。','growth-guide__figure--chair')}${picture('chair-button','ホーム画面の「椅子を掃除する」ボタン','このボタンで、椅子での休憩をお願いできます。','growth-guide__figure--button')}<p>今の動作が終わると、お願いした行動を始めます。予約はまとめて積み重ならないので、椅子での休憩が終わったら、またタップしてみてください。</p><p class="growth-guide__tip">早く貯められる代わりに、自分で画面をタップする手間はかかります。気楽に遊びたいときは、おまかせでも。</p></section>`,
  strategy:`<header class="growth-guide__intro"><span class="growth-guide__eyebrow">少しだけ、作戦を</span><h3>戦闘力強化と戦略</h3><p>強さの差は、準備で埋められることもあります。出発前に、ひと工夫してみましょう。</p></header>
   <section class="growth-guide__chapter"><h4>序盤のステータス差</h4><p>序盤は、素のステータスだけでは、おこていゆが圧倒的に不利なことも多いです。レベルを上げるのに加えて、もちもの・オーラ・技や行動の工夫を頼ってみてください。</p></section>
   <section class="growth-guide__chapter"><h4>もちものの変更</h4><p>まずは「コレクション」を開いて、初期装備からもちものを替えてみましょう。始めたばかりでも、いくつか所持しています。与えるダメージを増やすものや、受けるダメージを減らすものを試すだけでも、戦いやすさが変わります。</p>${picture('collection-button','ビューの下にある「コレクション」ボタン','もちもの・オーラ・技の準備は、ここから。','growth-guide__figure--collection')}</section>
   <section class="growth-guide__chapter"><h4>オーラの効果</h4><p>戦闘に勝つと、倒した相手から一定の確率でオーラを入手できます。珍生物の種類ごとに、オーラの強さや伸びやすいステータスは違います。</p><p>序盤は、強い相手のオーラを狙うより、オーラのレベルを上げるほうが効率的です。弱めの相手と何度も戦い、同じオーラを集めて育てると、ステータスを大きく底上げできます。</p>${picture('aura-grid','おこていゆがさまざまなオーラをまとった、コレクションのオーラ一覧','オーラ一覧の例です。入手したオーラが、ここに並びます。')}<p class="growth-guide__tip">集めたら、装備するのも忘れずに。序盤は、よく育ったオーラを一つ用意するのが心強いです。</p></section>
   <section class="growth-guide__chapter"><h4>技強化</h4><p>怒り Pt を貯めて「おこていゆイベント」を起こすと、技などを取得できます。すでに持っているものなら、レベルを上げる機会にもなります。</p><p>一撃で相手を疲れさせられると、反撃されにくく、周回も速くなります。コレクションの「技」で、育った技や威力の高い技を、使えるスロットにきちんと設定しておきましょう。</p></section>
   <section class="growth-guide__chapter"><h4>戦略</h4><p>戦闘が始まったら、早めに「スーパーおこていゆ状態」をお願いするのがおすすめです。最初から畳み掛けることで、強化されている時間を攻撃にたっぷり使えます。</p><p>自動で発動するのを待つより、最初のひと押し。もちものやオーラの準備と合わせて試してみてください。</p></section>`,
  after:`<header class="growth-guide__intro"><span class="growth-guide__eyebrow">強くなった、その先へ</span><h3>成長後</h3><p>準備が整ってきたら、またパトロールへ。まだ見ぬ珍生物を探してみましょう。</p></header>
   <section class="growth-guide__chapter"><h4>新しい出会いを探そう</h4><p>おこていゆが成長すると、パトロールで出会う相手も変わっていきます。別の場所や時間帯も歩きながら、記録帳を少しずつにぎやかにしてみてください。</p><p>新しいオーラを育てたり、もちものや技の組み合わせを変えたり。自分なりの戦い方を見つけるのも、楽しみのひとつです。</p></section>
   <section class="growth-guide__chapter growth-guide__chapter--future"><h4>iOS版では、さらに</h4><p>iOS版では、ストーリーや新たな珍生物の追加も予定しています。おこていゆの世界は、もう少し先へ続く予定です。</p><p>詳しくは、オプションの「iOSのLite版・フル版のご案内」をのぞいてみてください。</p></section>`
 };
 return '<div class="growth-guide"><nav class="growth-guide__tabs" role="tablist" aria-label="育成の手引きのページ">'+GROWTH_GUIDE_TABS.map(([id,label],i)=>`<button type="button" role="tab" id="growth-tab-${id}" aria-controls="growth-panel-${id}" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-growth-tab="${id}">${label}</button>`).join('')+'</nav>'+GROWTH_GUIDE_TABS.map(([id],i)=>`<article class="growth-guide__page" id="growth-panel-${id}" role="tabpanel" aria-labelledby="growth-tab-${id}" tabindex="0"${i?' hidden':''}>${pages[id]}</article>`).join('')+'</div>';
}

export function selectGrowthGuideTab(root,id){
 if(!GROWTH_GUIDE_TABS.some(([key])=>key===id))return false;
 for(const tab of root.querySelectorAll('[role=tab][data-growth-tab]')){const selected=tab.dataset.growthTab===id;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;}
 for(const [key]of GROWTH_GUIDE_TABS)root.querySelector('#growth-panel-'+key).hidden=key!==id;
 root.scrollTop=0;root.querySelector('[role=tab][data-growth-tab="'+id+'"]').focus({preventScroll:true});return true;
}
