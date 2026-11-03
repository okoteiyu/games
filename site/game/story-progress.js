import {INITIAL_STORY_CHAPTER} from './initial-state.js';

export const STORY_PROGRESS_VERSION=1;
export const DEFAULT_STORY_ARC_ID='hero';
export const PROLOGUE_REVISION=2;
export const PROLOGUE_EPISODE_IDS=Object.freeze(['ch0-01']);
export const LEGACY_PROLOGUE_EPISODE_IDS=Object.freeze(['ch0-01','ch0-02','ch0-03']);
export const DEFAULT_STORY_CATALOG=Object.freeze([
 Object.freeze({id:'chapter-0',arcId:DEFAULT_STORY_ARC_ID,number:0,nextChapter:1,episodeIds:PROLOGUE_EPISODE_IDS}),
 Object.freeze({id:'chapter-1',arcId:DEFAULT_STORY_ARC_ID,number:1,nextChapter:1,episodeIds:Object.freeze(['ch1-01','ch1-02'])})
]);
const own=(value,key)=>Object.hasOwn(value??{},key);
const record=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value)));
const integer=(value,label,min=0)=>{if(!Number.isSafeInteger(value)||value<min)throw new TypeError('Invalid '+label+'.');return value;};
const identifier=value=>{if(typeof value!=='string'||!value.length||!/^[A-Za-z0-9][A-Za-z0-9:_-]*$/.test(value))throw new TypeError('Invalid story identifier.');return value;};
function identifiers(value,label){if(!Array.isArray(value)||new Set(value).size!==value.length)throw new TypeError('Invalid '+label+'.');return value.map(identifier);}
const chapterArc=chapter=>chapter.arcId??DEFAULT_STORY_ARC_ID;
function chapterEpisodes(chapter){return chapter.episodeIds??chapter.episodes?.map(episode=>episode.id)??[];}
function findChapter(chapterOrId,catalog){
 if(catalog.includes(chapterOrId))return chapterOrId;
 const id=record(chapterOrId)?chapterOrId.id:chapterOrId;
 return typeof id==='string'?catalog.find(chapter=>chapter.id===id)??null:null;
}
function arcChapters(saved,currentChapter){
 if(saved===undefined)return {};
 if(!record(saved))throw new TypeError('Invalid story arc chapters.');
 const result={};
 for(const [arcId,value]of Object.entries(saved)){
  identifier(arcId);integer(value,'story arc chapter');
  // The legacy hero field remains its sole authority, so it cannot drift from
  // an independently stored duplicate. Unknown future arc IDs are preserved.
  if(arcId===DEFAULT_STORY_ARC_ID){if(value!==currentChapter)throw new TypeError('Conflicting hero story chapter.');continue;}
  result[arcId]=value;
 }
 return result;
}
function findEpisode(id,catalog){
 identifier(id);
 for(const chapter of catalog){const ids=chapterEpisodes(chapter),index=ids.indexOf(id);if(index>=0)return {chapter,index,ids};}
 return null;
}

// Stable scene IDs, rather than a stale numeric position, reconnect a legacy
// three-part prologue to the single authored episode. The old order is retained
// only for checkpoints whose original renderer did not save a scene ID.
const legacyPrologueScenes={
 'ch0-01':Array.from({length:18},(_,index)=>'ch0-01-'+String(index+1).padStart(2,'0')),
 'ch0-02':['ch0-02-01','ch0-02-call','ch0-02-02','ch0-02-03','ch0-02-04','first-punim','ch0-02-05','ch0-02-06','ch0-02-check','ch0-02-07','ch0-02-08','ch0-02-09','ch0-02-10','ch0-02-11','ch0-02-12','ch0-02-walk','ch0-02-13','ch0-02-14'],
 'ch0-03':['ch0-03-01','ch0-03-02','ch0-03-03','ch0-03-04','ch0-03-05','ch0-03-07','ch0-03-08','ch0-03-09','ch0-03-10','ch0-03-11','ch0-03-12','ch0-03-13','ch0-03-14','ch0-03-15','ch0-03-16','ch0-03-17','ch0-03-home','ch0-03-18','ch0-03-19','ch0-03-20','ch0-03-21','ch0-03-22']
};
const legacyPrologueSceneMap={
 'ch0-01-01':'ch0-01-01','ch0-01-02':'ch0-01-02','ch0-01-03':'ch0-01-02',
 ...Object.fromEntries(['04','05','06','07','08','09','10'].map(index=>['ch0-01-'+index,'ch0-01-05'])),
 'ch0-01-11':'ch0-01-11',...Object.fromEntries(['12','13','14'].map(index=>['ch0-01-'+index,'ch0-01-12'])),
 ...Object.fromEntries(['15','16','17'].map(index=>['ch0-01-'+index,'ch0-01-16'])),'ch0-01-18':'ch0-02-call',
 'ch0-02-01':'ch0-02-call','ch0-02-call':'ch0-02-call','ch0-02-02':'ch0-02-call-turn','ch0-02-03':'ch0-02-call-turn','ch0-02-04':'first-punim','first-punim':'first-punim',
 'ch0-02-05':'ch0-02-05','ch0-02-06':'ch0-02-05','ch0-02-check':'ch0-02-05','ch0-02-07':'ch0-02-07-record','ch0-02-08':'ch0-02-07-record','ch0-02-09':'ch0-02-07-pause',
 ...Object.fromEntries(['10','11','12'].map(index=>['ch0-02-'+index,'ch0-02-07-map'])),
 'ch0-02-walk':'ch0-02-11','ch0-02-13':'ch0-02-11','ch0-02-14':'ch0-02-11',
 'ch0-03-01':'ch0-03-01','ch0-03-02':'ch0-03-02','ch0-03-03':'ch0-03-02','ch0-03-04':'ch0-03-04','ch0-03-05':'ch0-03-05','ch0-03-07':'ch0-03-05','ch0-03-08':'ch0-03-09-tour',
 ...Object.fromEntries(['09','10','11','12'].map(index=>['ch0-03-'+index,'ch0-03-09-rest'])),'ch0-03-13':'ch0-03-09-pause',
 ...Object.fromEntries(['14','15','16','17'].map(index=>['ch0-03-'+index,'ch0-03-home'])),'ch0-03-home':'ch0-03-home',
 'ch0-03-18':'ch0-03-10','ch0-03-19':'ch0-03-10',...Object.fromEntries(['20','21','22'].map(index=>['ch0-03-'+index,'ch0-03-22']))
};
function migrateLegacyPrologue(progress){
 const legacyCompleted=progress.completedEpisodes,finished=progress.currentChapter>=1||LEGACY_PROLOGUE_EPISODE_IDS.every(id=>legacyCompleted.includes(id));
 progress.completedEpisodes=legacyCompleted.filter(id=>!LEGACY_PROLOGUE_EPISODE_IDS.includes(id));
 if(finished){progress.completedEpisodes.unshift('ch0-01');progress.currentChapter=Math.max(1,progress.currentChapter);}
 const active=progress.activeEpisode;
 if(active&&LEGACY_PROLOGUE_EPISODE_IDS.includes(active.episodeId)){
  if(finished)progress.activeEpisode=null;
  else{
   const order=legacyPrologueScenes[active.episodeId],fallback=order[Math.min(active.sceneIndex,order.length-1)],sceneId=legacyPrologueSceneMap[active.sceneId]||legacyPrologueSceneMap[fallback];
   progress.activeEpisode={episodeId:'ch0-01',sceneId,sceneIndex:0};
  }
 }else if(!finished&&!active){
  const next=legacyCompleted.includes('ch0-03')?'ch0-03-22':legacyCompleted.includes('ch0-02')?'ch0-03-01':legacyCompleted.includes('ch0-01')?'ch0-02-call':null;
  if(next)progress.activeEpisode={episodeId:'ch0-01',sceneId:next,sceneIndex:0};
 }
 return progress;
}

/** Progress contains stable content IDs rather than a script or render state. */
export function createStoryProgress({currentChapter=INITIAL_STORY_CHAPTER,legacyCompleted=false,arcChapters:arcs}={}){
 return {version:STORY_PROGRESS_VERSION,prologueRevision:PROLOGUE_REVISION,currentChapter:integer(currentChapter,'story chapter'),arcChapters:arcChapters(arcs,currentChapter),completedEpisodes:legacyCompleted?[...PROLOGUE_EPISODE_IDS]:[],activeEpisode:null,completedBattles:[]};
}

/** Missing fields are migrated without running story events or awarding rewards.
 * Only an untouched unnamed legacy seed is treated as a new prologue save. */
export function normalizeStoryProgress(saved,{legacyInitial=false}={}){
 if(saved===undefined)return createStoryProgress({currentChapter:legacyInitial?0:1,legacyCompleted:!legacyInitial});
 if(!record(saved))throw new TypeError('Invalid story progress.');
 const currentChapter=integer(saved.currentChapter,'story chapter');
 const legacyShape=!own(saved,'version');
 if(!legacyShape&&saved.version!==STORY_PROGRESS_VERSION)throw new TypeError('Unsupported story progress version.');
 if(saved.prologueRevision!==undefined&&saved.prologueRevision!==1&&saved.prologueRevision!==PROLOGUE_REVISION)throw new TypeError('Unsupported prologue revision.');
 // The earliest payload stored only currentChapter. Preserve any later fields
 // already present in a versionless payload, especially the reward ledger.
 const completedEpisodes=identifiers(legacyShape&&!own(saved,'completedEpisodes')?(currentChapter>=1?[...LEGACY_PROLOGUE_EPISODE_IDS]:[]):saved.completedEpisodes,'completed story episodes'),completedBattles=identifiers(legacyShape&&!own(saved,'completedBattles')?[]:saved.completedBattles,'completed story battles');
 let activeEpisode=null;
 if(saved.activeEpisode!==null&&!(legacyShape&&!own(saved,'activeEpisode'))){
  if(!record(saved.activeEpisode))throw new TypeError('Invalid story checkpoint.');
  activeEpisode={episodeId:identifier(saved.activeEpisode.episodeId),sceneId:saved.activeEpisode.sceneId===null?null:identifier(saved.activeEpisode.sceneId),sceneIndex:integer(saved.activeEpisode.sceneIndex,'story scene index')};
 }
 const progress={version:STORY_PROGRESS_VERSION,prologueRevision:PROLOGUE_REVISION,currentChapter,arcChapters:arcChapters(saved.arcChapters,currentChapter),completedEpisodes,activeEpisode,completedBattles};
 return saved.prologueRevision===PROLOGUE_REVISION?progress:migrateLegacyPrologue(progress);
}

/** Hero saves retain currentChapter; every other arc has an independent cursor.
 * Catalogues may supply either episodeIds or authored episode objects. */
export function getStoryArcChapter(story,arcId=DEFAULT_STORY_ARC_ID,catalog=DEFAULT_STORY_CATALOG){
 identifier(arcId);
 if(arcId===DEFAULT_STORY_ARC_ID)return story.currentChapter??INITIAL_STORY_CHAPTER;
 if(own(story.arcChapters,arcId))return story.arcChapters[arcId];
 const chapters=catalog.filter(chapter=>chapterArc(chapter)===arcId);
 return chapters.length?Math.min(...chapters.map(chapter=>chapter.number)):0;
}

export function isStoryChapterCompleted(story,chapterOrId,catalog=DEFAULT_STORY_CATALOG){
 const chapter=findChapter(chapterOrId,catalog);if(!chapter)return false;
 if(getStoryArcChapter(story,chapterArc(chapter),catalog)>chapter.number)return true;
 const ids=chapterEpisodes(chapter);
 return ids.length>0&&ids.every(id=>story.completedEpisodes.includes(id));
}

/** Web chapter access currently depends only on the previous chapter in the
 * same arc. Keep this boundary separate for future authored dependencies. */
export function isStoryChapterAvailable(story,chapterOrId,catalog=DEFAULT_STORY_CATALOG){
 const chapter=findChapter(chapterOrId,catalog);if(!chapter)return false;
 if(isStoryChapterCompleted(story,chapter,catalog))return true;
 const chapters=catalog.filter(entry=>chapterArc(entry)===chapterArc(chapter)).sort((a,b)=>a.number-b.number),index=chapters.indexOf(chapter);
 return index===0||isStoryChapterCompleted(story,chapters[index-1],catalog);
}

export function isStoryEpisodeAvailable(story,episodeId,catalog=DEFAULT_STORY_CATALOG){
 const entry=findEpisode(episodeId,catalog);if(!entry)return false;
 if(story.completedEpisodes.includes(episodeId)||getStoryArcChapter(story,chapterArc(entry.chapter),catalog)>entry.chapter.number)return true;
 return isStoryChapterAvailable(story,entry.chapter,catalog)&&entry.ids.slice(0,entry.index).every(id=>story.completedEpisodes.includes(id));
}

export function startStoryEpisode(story,episodeId,catalog=DEFAULT_STORY_CATALOG){
 if(!isStoryEpisodeAvailable(story,episodeId,catalog))throw new Error('This story episode is locked.');
 story.activeEpisode={episodeId,sceneId:null,sceneIndex:0};return story;
}

export function checkpointStoryScene(story,{episodeId,sceneId=null,sceneIndex=0},catalog=DEFAULT_STORY_CATALOG){
 identifier(episodeId);if(sceneId!==null)identifier(sceneId);integer(sceneIndex,'story scene index');
 if(story.activeEpisode?.episodeId!==episodeId)startStoryEpisode(story,episodeId,catalog);
 story.activeEpisode={episodeId,sceneId,sceneIndex};return story;
}

export function completeStoryEpisode(story,episodeId,catalog=DEFAULT_STORY_CATALOG){
 const entry=findEpisode(episodeId,catalog);if(!entry||!isStoryEpisodeAvailable(story,episodeId,catalog))throw new Error('This story episode is locked.');
 if(!story.completedEpisodes.includes(episodeId))story.completedEpisodes.push(episodeId);
 if(story.activeEpisode?.episodeId===episodeId)story.activeEpisode=null;
 if(entry.ids.every(id=>story.completedEpisodes.includes(id))){
  const arcId=chapterArc(entry.chapter),next=Math.max(getStoryArcChapter(story,arcId,catalog),entry.chapter.nextChapter??entry.chapter.number+1);
  if(arcId===DEFAULT_STORY_ARC_ID)story.currentChapter=next;
  else{story.arcChapters??={};story.arcChapters[arcId]=next;}
 }
 return story;
}

export function hasStoryBattleReward(story,battleId){return story.completedBattles.includes(identifier(battleId));}
/** The caller saves this ledger atomically with the battle settlement. */
export function markStoryBattleReward(story,battleId){
 identifier(battleId);if(hasStoryBattleReward(story,battleId))return false;
 story.completedBattles.push(battleId);return true;
}
