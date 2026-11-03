import {INITIAL_STORY_CHAPTER} from './initial-state.js';

export const STORY_PROGRESS_VERSION=1;
export const DEFAULT_STORY_ARC_ID='hero';
export const PROLOGUE_EPISODE_IDS=Object.freeze(['ch0-01','ch0-02','ch0-03']);
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

/** Progress contains stable content IDs rather than a script or render state. */
export function createStoryProgress({currentChapter=INITIAL_STORY_CHAPTER,legacyCompleted=false,arcChapters:arcs}={}){
 return {version:STORY_PROGRESS_VERSION,currentChapter:integer(currentChapter,'story chapter'),arcChapters:arcChapters(arcs,currentChapter),completedEpisodes:legacyCompleted?[...PROLOGUE_EPISODE_IDS]:[],activeEpisode:null,completedBattles:[]};
}

/** Missing fields are migrated without running story events or awarding rewards.
 * Only an untouched unnamed legacy seed is treated as a new prologue save. */
export function normalizeStoryProgress(saved,{legacyInitial=false}={}){
 if(saved===undefined)return createStoryProgress({currentChapter:legacyInitial?0:1,legacyCompleted:!legacyInitial});
 if(!record(saved))throw new TypeError('Invalid story progress.');
 const currentChapter=integer(saved.currentChapter,'story chapter');
 if(!own(saved,'version'))return createStoryProgress({currentChapter,legacyCompleted:currentChapter>=1});
 if(saved.version!==STORY_PROGRESS_VERSION)throw new TypeError('Unsupported story progress version.');
 const completedEpisodes=identifiers(saved.completedEpisodes,'completed story episodes'),completedBattles=identifiers(saved.completedBattles,'completed story battles');
 let activeEpisode=null;
 if(saved.activeEpisode!==null){
  if(!record(saved.activeEpisode))throw new TypeError('Invalid story checkpoint.');
  activeEpisode={episodeId:identifier(saved.activeEpisode.episodeId),sceneId:saved.activeEpisode.sceneId===null?null:identifier(saved.activeEpisode.sceneId),sceneIndex:integer(saved.activeEpisode.sceneIndex,'story scene index')};
 }
 return {version:STORY_PROGRESS_VERSION,currentChapter,arcChapters:arcChapters(saved.arcChapters,currentChapter),completedEpisodes,activeEpisode,completedBattles};
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
