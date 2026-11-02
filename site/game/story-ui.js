import {isModalBlocked,tryOpenModal,releaseModal} from './modal-layer.js';
import {setPaintedText,releasePaintedLabels} from './painted-label.js';
import {isStoryEpisodeAvailable} from './story-progress.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
 book:'<path d="M12 5c-3-2-6-2-9 0v15c3-2 6-2 9 0 3-2 6-2 9 0V5c-3-2-6-2-9 0Zm0 0v15M16 4v7l2-1 2 1V4"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>',
 pause:'<path d="M8 5v14M16 5v14"/>',
 play:'<path d="m8 4 12 8-12 8V4Z"/>',
 back:'<path d="m14 6-6 6 6 6M8 12h12"/>',
 next:'<path d="m9 5 7 7-7 7"/>',
 check:'<path d="m5 12 5 5L20 7"/>',
 lock:'<rect x="6" y="10" width="12" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
 home:'<path d="m3 11 9-8 9 8M5 9v12h14V9M10 21v-7h4v7"/>',
 map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16"/>',
 clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>'
};
const icon=name=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+paths[name]+'</svg>';
const episodeId=progress=>progress?.activeEpisode?.episodeId||null;
const allEpisodes=chapters=>chapters.flatMap(chapter=>(chapter.episodes||[]).map((episode,index)=>({chapter,episode,index})));

/** The library owns only presentation. The director validates and applies progress. */
export class StoryUI {
 constructor({view,game,homeElement,contextElement=null,chapters=[],readProgress=()=>({}),onEpisode=()=>{},onExit=()=>{},onPause=()=>{},onChoice=()=>{},onOpenMap=()=>{},onNextEpisode=null,onFinish=null,onError=()=>{}}={}){
  if(!view?.element||!game||!homeElement)throw new TypeError('物語の表示先がありません。');
  Object.assign(this,{view,game,homeElement,contextElement,chapters,readProgress,onEpisode,onExit,onPause,onChoice,onOpenMap,onNextEpisode,onFinish,onError});
  this.playback={active:false};this.available=false;this.selectedChapterId=chapters[0]?.id||null;this.closeAction=null;this.lastPanelKey='';this.libraryKey=null;
  this.trigger=document.createElement('button');this.trigger.type='button';this.trigger.id='storyTrigger';this.trigger.className='story-trigger';this.trigger.hidden=true;
  this.trigger.setAttribute('aria-haspopup','dialog');this.trigger.setAttribute('aria-controls','storyDialog');this.trigger.setAttribute('aria-expanded','false');this.trigger.innerHTML=icon('book')+'<span>物語</span><i class="story-trigger__bookmark" aria-hidden="true"></i>';view.element.append(this.trigger);
  this.toolbar=document.createElement('section');this.toolbar.className='story-toolbar';this.toolbar.hidden=true;this.toolbar.setAttribute('aria-label','物語の進行と操作');
  this.toolbar.innerHTML='<button type="button" class="story-toolbar__back" data-story-exit aria-label="ここまでを保存してホームへ" title="ここまでを保存してホームへ">'+icon('back')+'</button><div class="story-toolbar__copy"><span data-story-heading></span><strong data-story-episode-title></strong></div><span class="story-toolbar__progress" data-story-position></span><button type="button" class="story-toolbar__pause" data-story-pause aria-label="物語を一時停止">'+icon('pause')+'</button>';view.element.append(this.toolbar);
  this.panel=document.createElement('section');this.panel.className='lower-right story-actions';this.panel.hidden=true;this.panel.setAttribute('aria-label','物語でのあなたの選択');homeElement.after(this.panel);
  if(contextElement){this.context=document.createElement('section');this.context.className='story-context';this.context.hidden=true;this.context.setAttribute('aria-label','読書のしおり');this.context.innerHTML='<span class="story-context__symbol" aria-hidden="true">'+icon('book')+'</span><small data-story-context-chapter></small><strong data-story-context-title></strong><div class="story-context__dots" data-story-context-dots></div>';contextElement.after(this.context);}
  this.dialog=document.createElement('dialog');this.dialog.id='storyDialog';this.dialog.className='story-dialog';this.dialog.setAttribute('aria-labelledby','storyDialogTitle');
  this.dialog.innerHTML='<header class="story-library-heading"><span class="story-library-heading__icon">'+icon('book')+'</span><div><span class="story-library-heading__eyebrow">OKOTEIYU / STORY</span><h2 id="storyDialogTitle" tabindex="-1">物語</h2></div><button type="button" data-story-close aria-label="物語の一覧を閉じる">'+icon('close')+'</button></header><div class="story-library-body"></div><p class="story-library-status" role="status" aria-live="polite"></p>';document.body.append(this.dialog);
  this.body=this.dialog.querySelector('.story-library-body');this.status=this.dialog.querySelector('.story-library-status');
  this.trigger.addEventListener('click',()=>this.open());
  this.toolbar.addEventListener('click',event=>{
   if(!this.playback.active||isModalBlocked())return;
   if(event.target.closest('[data-story-exit]')){this.onExit();return;}
   if(event.target.closest('[data-story-pause]'))this.onPause(!this.playback.paused);
  });
  this.panel.addEventListener('click',event=>{
   const button=event.target.closest('button');if(!button||button.disabled||isModalBlocked()||!this.playback.active)return;
   if(button.hasAttribute('data-story-choice')){this.onChoice(Number(button.dataset.storyChoice));return;}
   if(button.hasAttribute('data-story-map')){if(!this.playback.paused&&!this.playback.objectiveTalking)this.onOpenMap(button);return;}
   if(button.hasAttribute('data-story-next')){(this.onNextEpisode||((id)=>this.onEpisode(id,{replay:false})))(button.dataset.storyNext);return;}
   if(button.hasAttribute('data-story-finish')){(this.onFinish||this.onExit)();return;}
   if(button.hasAttribute('data-story-resume'))this.onPause(false);
  });
  this.dialog.addEventListener('click',event=>{
   if(event.target.closest('[data-story-close]')){this.dialog.close();return;}
   const tab=event.target.closest('[data-story-chapter]');if(tab){this.selectedChapterId=tab.dataset.storyChapter;this.renderLibrary();this.body.querySelector('[data-story-chapter="'+CSS.escape(this.selectedChapterId)+'"]')?.focus({preventScroll:true});return;}
   const button=event.target.closest('[data-story-episode]');if(button&&!button.disabled){
    const id=button.dataset.storyEpisode,replay=button.dataset.storyReplay==='true';this.closeAction=()=>this.onEpisode(id,{replay});this.dialog.close('episode');return;
   }
   if(event.target===this.dialog){const box=this.dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)this.dialog.close();}
  });
  this.dialog.addEventListener('keydown',event=>{
   const tab=event.target.closest('[data-story-chapter]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();const tabs=[...this.body.querySelectorAll('[data-story-chapter]')],index=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
   tabs[next]?.click();
  });
  this.dialog.addEventListener('close',()=>{
   if(this.dialog.open)return;releaseModal(this.dialog);this.trigger.setAttribute('aria-expanded','false');const action=this.closeAction;this.closeAction=null;
   if(!action&&this.opener?.isConnected&&!isModalBlocked())this.opener.focus({preventScroll:true});
   if(action)Promise.resolve().then(action).catch(error=>this.onError(error));
  });
  this.resizeObserver=new ResizeObserver(()=>this.updateWidth());this.resizeObserver.observe(game);this.updateWidth();
 }
 updateWidth(){this.dialog.style.setProperty('--story-dialog-width',Math.max(1,Math.min(480,innerWidth-16,Math.max(this.game.getBoundingClientRect().width-12,Math.min(350,innerWidth-16))))+'px');}
 refresh({available=this.available}={}){
  this.available=available;this.trigger.hidden=!available||Boolean(this.playback.active);this.trigger.disabled=!available;
  const progress=this.readProgress(),active=episodeId(progress);this.trigger.dataset.resume=String(Boolean(active));this.trigger.setAttribute('aria-label',active?'物語のつづきを開く':'物語を開く');
  if(this.dialog.open){const focused=document.activeElement?.dataset.storyEpisode,scroll=this.body.scrollTop;const changed=this.renderLibrary();if(changed){this.body.scrollTop=scroll;if(focused)this.body.querySelector('[data-story-episode="'+CSS.escape(focused)+'"]')?.focus({preventScroll:true});}}
 }
 open(opener=this.trigger){
  if(!this.available||this.playback.active||isModalBlocked())return false;
  const progress=this.readProgress(),active=episodeId(progress),resumeChapter=allEpisodes(this.chapters).find(({episode})=>episode.id===active)?.chapter,currentChapter=this.chapters.find(chapter=>chapter.number===progress?.currentChapter);
  this.selectedChapterId=(resumeChapter||currentChapter)?.id||this.selectedChapterId;
  this.opener=opener?.focus?opener:this.trigger;this.renderLibrary();this.status.textContent='';
  if(!tryOpenModal(this.dialog))return false;this.trigger.setAttribute('aria-expanded','true');
  const resume=active&&this.body.querySelector('[data-story-episode="'+CSS.escape(active)+'"]');
  (resume||this.dialog.querySelector('#storyDialogTitle')).focus({preventScroll:true});return true;
 }
 close(){if(this.dialog.open)this.dialog.close();}
 renderLibrary(){
  const progress=this.readProgress()||{},completed=new Set(progress.completedEpisodes||[]),active=episodeId(progress),chapters=this.chapters;
  const selected=chapters.find(chapter=>chapter.id===this.selectedChapterId)||chapters[0];if(!selected){this.body.innerHTML='<p class="story-library-empty">物語は、これから続いていきます。</p>';return;}
  this.selectedChapterId=selected.id;const key=JSON.stringify([progress,selected.id,chapters]);if(key===this.libraryKey)return false;this.libraryKey=key;const episodes=selected.episodes||[],done=episodes.filter(episode=>completed.has(episode.id)).length;
  const tabs=chapters.length>1?'<nav class="story-chapter-tabs" role="tablist" aria-label="物語の章">'+chapters.map(chapter=>'<button type="button" role="tab" id="story-tab-'+esc(chapter.id)+'" data-story-chapter="'+esc(chapter.id)+'" aria-selected="'+(chapter.id===selected.id)+'" aria-controls="storyChapterPanel" tabindex="'+(chapter.id===selected.id?'0':'-1')+'">第'+chapter.number+'章</button>').join('')+'</nav>':'';
  const header='<section class="story-chapter-intro"><div class="story-chapter-intro__top"><span>第'+selected.number+'章</span><div class="story-chapter-dots" role="img" aria-label="全'+episodes.length+'話のうち'+done+'話を読了">'+episodes.map(episode=>'<i'+(completed.has(episode.id)?' class="is-complete"':'')+'></i>').join('')+'</div></div><h3>'+esc(selected.title)+'</h3><p>'+esc(selected.description||'')+'</p></section>';
  const list=episodes.map((episode,index)=>{
   const finished=completed.has(episode.id),resume=active===episode.id;
   const unlocked=isStoryEpisodeAvailable({currentChapter:0,...progress,completedEpisodes:[...completed]},episode.id,chapters);
   const label=finished?'読み返す':resume?'つづきから':unlocked?'はじめる':'未開放',state=finished?'complete':resume?'resume':unlocked?'ready':'locked';
   return '<li class="story-episode" data-state="'+state+'"><button type="button" class="story-episode__button" data-story-episode="'+esc(episode.id)+'" data-story-replay="'+finished+'"'+(!unlocked?' disabled':'')+' aria-label="第'+(index+1)+'話 '+esc(episode.title)+'、'+label+'"><span class="story-episode__number" aria-hidden="true">'+(finished?icon('check'):unlocked?String(index+1).padStart(2,'0'):icon('lock'))+'</span><span class="story-episode__copy"><span class="story-episode__top"><small>第'+(index+1)+'話</small><small class="story-episode__time">'+icon('clock')+'約'+(episode.readingMinutes||3)+'分</small></span><strong>'+esc(episode.title)+'</strong><span class="story-episode__description">'+esc(episode.description||'')+'</span><span class="story-episode__state">'+label+(unlocked?'<b aria-hidden="true"> →</b>':'')+'</span></span></button></li>';
  }).join('');
  const future=Number(progress.currentChapter)>selected.number&&!chapters.some(chapter=>chapter.number===selected.number+1)?'<section class="story-next-chapter"><span>物語の、その先へ</span><h4>知ること、強くなること</h4><p>珍生物との出会いを重ね、おこていゆと一緒に力をつけていこう。</p><small>次の章は、これから追加されます。</small></section>':'';
  this.body.innerHTML=tabs+'<div id="storyChapterPanel"'+(chapters.length>1?' role="tabpanel" aria-labelledby="story-tab-'+esc(selected.id)+'"':'')+'>'+header+'<ol class="story-episode-list" aria-label="第'+selected.number+'章の各話">'+list+'</ol>'+future+'</div>';
  return true;
 }
 setPlayback(state={}){
  const previous=this.playback.active;this.playback={...this.playback,...state};const p=this.playback,active=Boolean(p.active);
  if(active&&!previous){this.homeWasHidden=this.homeElement.hidden;if(this.contextElement)this.contextWasHidden=this.contextElement.hidden;}
  if(active)this.homeElement.hidden=true;
  if(!active&&previous){this.homeElement.hidden=Boolean(this.homeWasHidden);if(this.contextElement)this.contextElement.hidden=Boolean(this.contextWasHidden);}
  const battle=p.mode==='battle',exploring=active&&(p.mode==='objective'||p.mode==='explore');this.toolbar.hidden=!active||battle;this.panel.hidden=!active||battle;this.trigger.hidden=!this.available||active;
  if(exploring)this.game.dataset.storyExploring='true';else delete this.game.dataset.storyExploring;
  if(this.context){this.context.hidden=!active||battle||exploring;this.contextElement.hidden=exploring?false:active&&!battle?true:Boolean(this.contextWasHidden);}
  this.view.element.dataset.storyActive=String(active);this.view.element.dataset.storyMode=active?p.mode||'read':'';
  if(!active){releasePaintedLabels(this.toolbar);this.lastPanelKey='';this.panel.replaceChildren();return;}
  const found=allEpisodes(this.chapters).find(({episode})=>episode.id===p.episodeId),chapter=found?.chapter||this.chapters.find(c=>c.id===p.chapterId),episode=found?.episode;
  const index=found?.index??0,chapterLabel='第'+(chapter?.number??0)+'章 · 第'+(index+1)+'話'+(p.replay?' · 再読':'');
  if(this.context){
   setPaintedText(this.context.querySelector('[data-story-context-chapter]'),chapterLabel,{background:'#fbf7eb',lines:1,align:'center',immutableImage:true});
   setPaintedText(this.context.querySelector('[data-story-context-title]'),episode?.title||p.title||'物語',{background:'#fbf7eb',lines:2,align:'center',immutableImage:true});
   const completed=new Set(this.readProgress()?.completedEpisodes||[]),dotsKey=JSON.stringify([chapter?.id,p.episodeId,[...completed]]);
   if(dotsKey!==this.contextDotsKey){this.contextDotsKey=dotsKey;this.context.querySelector('[data-story-context-dots]').innerHTML=(chapter?.episodes||[]).map(item=>'<i class="'+(completed.has(item.id)?'is-complete ':'')+(item.id===p.episodeId?'is-current':'')+'" aria-label="'+esc(item.title)+(completed.has(item.id)?'、読了':'')+(item.id===p.episodeId?'、今読んでいる話':'')+'"></i>').join('');}
  }
  setPaintedText(this.toolbar.querySelector('[data-story-heading]'),chapterLabel,{background:'#fbf7eb',lines:1,immutableImage:true});
  setPaintedText(this.toolbar.querySelector('[data-story-episode-title]'),episode?.title||p.title||'物語',{background:'#fbf7eb',lines:1,immutableImage:true});
  const count=Math.max(1,Number(p.sceneCount)||episode?.scenes?.length||1),current=Math.min(count,Math.max(1,(Number(p.sceneIndex)||0)+1));
  setPaintedText(this.toolbar.querySelector('[data-story-position]'),current+' / '+count,{background:'#fbf7eb',lines:1,align:'right',immutableImage:true});
  const pause=this.toolbar.querySelector('[data-story-pause]'),pauseState=String(Boolean(p.paused));pause.setAttribute('aria-label',p.paused?'物語を再開':'物語を一時停止');if(pause.getAttribute('aria-pressed')!==pauseState){pause.setAttribute('aria-pressed',pauseState);pause.innerHTML=icon(p.paused?'play':'pause');}pause.disabled=p.mode==='complete';
  this.renderActions();
 }
 renderActions(){
  const p=this.playback,key=JSON.stringify([p.mode,p.paused,p.replay,p.prompt,p.choices,p.nextEpisodeId,p.episodeId,p.objective,p.objectiveRoomReached,p.objectiveTalking]);if(key===this.lastPanelKey)return;this.lastPanelKey=key;
  this.panel.dataset.storyActionMode=p.mode||'read';
  const heading=(eyebrow,title)=>'<header class="story-actions__heading"><span>'+esc(eyebrow)+'</span><h2>'+esc(title)+'</h2></header>';
  if(p.paused){this.panel.innerHTML=heading('ここまで、しおりを挟んで','ひとやすみ')+'<div class="story-actions__body"><p>お好きなときに、続きをどうぞ。</p><button type="button" class="story-action-button" data-story-resume>'+icon('play')+'<span>続きを読む</span></button></div>';return;}
  if(p.mode==='objective'||p.mode==='explore'){
   const objective=p.objective||{},reached=Boolean(p.objectiveRoomReached),talking=Boolean(p.objectiveTalking),room=objective.roomLabel||'指定の部屋',person=objective.staffLabel||'指定の人';
   this.panel.innerHTML=heading('物語の目的',objective.title||'ご挨拶に行こう')+'<div class="story-objective" aria-label="今回の行き先"><dl class="story-objective__destination"><div><dt>行き先</dt><dd>'+esc(room)+'</dd></div><div><dt>話す人</dt><dd>'+esc(person)+'</dd></div></dl><ol class="story-objective__steps" aria-label="挨拶までの手順"><li'+(reached?' class="is-complete"':' class="is-current"')+'><span aria-hidden="true">'+(reached?'✓':'1')+'</span>地図で部屋へ移動</li><li'+(reached?' class="is-current"':'')+'><span aria-hidden="true">2</span>左の会員ボタンから挨拶</li></ol><p class="story-objective__hint" role="status">'+(talking?'お話を聞いています。':reached?'左の会員ボタンから、話しかけてみよう。':'2Dマップを開いて、行き先を選ぼう。')+'</p><button type="button" class="story-action-button story-objective__map" data-story-map aria-label="2Dマップを開く"'+(talking?' disabled':'')+'>'+icon('map')+'<span><span class="story-objective__map-label">2Dマップを開く</span><span class="story-objective__map-short" aria-hidden="true">地図を開く</span></span>'+icon('next')+'</button></div>';return;
  }
  if(p.mode==='choice'){
   const choices=Array.isArray(p.choices)?p.choices:[];this.panel.innerHTML=heading('あなたから',p.prompt||'どう伝える？')+'<nav class="story-choice-list" aria-label="あなたの言葉">'+choices.map((choice,index)=>'<button type="button" class="story-choice" data-story-choice="'+index+'"><span>'+esc(typeof choice==='string'?choice:choice.label)+'</span>'+icon('next')+'</button>').join('')+'</nav>';return;
  }
  if(p.mode==='complete'){
   this.panel.innerHTML=heading(p.replay?'読み返しを終えて':'物語をひとつ、読んだ','この先へ')+'<nav class="story-complete-actions" aria-label="読み終えた後の行き先">'+(p.nextEpisodeId?'<button type="button" class="story-action-button story-action-button--next" data-story-next="'+esc(p.nextEpisodeId)+'">'+icon('book')+'<span>次の話へ</span>'+icon('next')+'</button>':'<p class="story-chapter-finished">ここからは、おこていゆと一緒に。</p>')+'<button type="button" class="story-action-button" data-story-finish>'+icon('home')+'<span>ホームへ</span></button></nav>';return;
  }
  const automatic=p.mode==='auto';this.panel.innerHTML=heading(p.replay?'ふたりの、これまで':'ふたりの、はじまり',automatic?'場面を見守る':'物語を読む')+'<div class="story-reading-note" aria-live="polite"><span class="story-reading-note__symbol" aria-hidden="true">'+(automatic?'<i></i><i></i><i></i>':icon('book'))+'</span><p>'+(automatic?'演出に合わせて、<br>メッセージが進みます。':'ビューをタップして、<br>続きを読みましょう。')+'</p>'+(automatic?'<small>一時停止もできます。</small>':'')+'</div>';
 }
 destroy(){
  if(this.dialog.open)this.dialog.close();releaseModal(this.dialog);this.resizeObserver.disconnect();releasePaintedLabels(this.toolbar);releasePaintedLabels(this.context);this.trigger.remove();this.toolbar.remove();this.panel.remove();this.context?.remove();this.dialog.remove();
  if(this.playback.active){this.homeElement.hidden=Boolean(this.homeWasHidden);if(this.contextElement)this.contextElement.hidden=Boolean(this.contextWasHidden);}delete this.view.element.dataset.storyActive;delete this.view.element.dataset.storyMode;delete this.game.dataset.storyExploring;
 }
}
