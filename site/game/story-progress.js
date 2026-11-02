import {INITIAL_STORY_CHAPTER} from './initial-state.js';

export const STORY_PROGRESS_VERSION=1;
export const PROLOGUE_EPISODE_IDS=Object.freeze(['ch0-01','ch0-02','ch0-03']);
export const DEFAULT_STORY_CATALOG=Object.freeze([
 Object.freeze({number:0,nextChapter:1,episodeIds:PROLOGUE_EPISODE_IDS}),
 Object.freeze({number:1,nextChapter:1,episodeIds:Object.freeze(['ch1-01','ch1-02'])})
]);
const own=(value,key)=>Object.hasOwn(value??{},key);
const record=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value)));
const integer=(value,label,min=0)=>{if(!Number.isSafeInteger(value)||value<min)throw new TypeError('Invalid '+label+'.');return value;};
const identifier=value=>{if(typeof value!=='string'||!value.length||!/^[A-Za-z0-9][A-Za-z0-9:_-]*$/.test(value))throw new TypeError('Invalid story identifier.');return value;};
function identifiers(value,label){if(!Array.isArray(value)||new Set(value).size!==value.length)throw new TypeError('Invalid '+label+'.');return value.map(identifier);}
function chapterEpisodes(chapter){return chapter.episodeIds??chapter.episodes?.map(episode=>episode.id)??[];}
function findEpisode(id,catalog){
 identifier(id);
 for(const chapter of catalog){const ids=chapterEpisodes(chapter),index=ids.indexOf(id);if(index>=0)return {chapter,index,ids};}
 return null;
}

/** Progress contains stable content IDs rather than a script or render state. */
export function createStoryProgress({currentChapter=INITIAL_STORY_CHAPTER,legacyCompleted=false}={}){
 return {version:STORY_PROGRESS_VERSION,currentChapter:integer(currentChapter,'story chapter'),completedEpisodes:legacyCompleted?[...PROLOGUE_EPISODE_IDS]:[],activeEpisode:null,completedBattles:[]};
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
 return {version:STORY_PROGRESS_VERSION,currentChapter,completedEpisodes,activeEpisode,completedBattles};
}

/** Catalogues may supply either episodeIds or authored episode objects. */
export function isStoryEpisodeAvailable(story,episodeId,catalog=DEFAULT_STORY_CATALOG){
 const entry=findEpisode(episodeId,catalog);if(!entry)return false;
 if(story.completedEpisodes.includes(episodeId)||story.currentChapter>entry.chapter.number)return true;
 return story.currentChapter===entry.chapter.number&&entry.ids.slice(0,entry.index).every(id=>story.completedEpisodes.includes(id));
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
 if(entry.ids.every(id=>story.completedEpisodes.includes(id)))story.currentChapter=Math.max(story.currentChapter,entry.chapter.nextChapter??entry.chapter.number+1);
 return story;
}

export function hasStoryBattleReward(story,battleId){return story.completedBattles.includes(identifier(battleId));}
/** The caller saves this ledger atomically with the battle settlement. */
export function markStoryBattleReward(story,battleId){
 identifier(battleId);if(hasStoryBattleReward(story,battleId))return false;
 story.completedBattles.push(battleId);return true;
}
