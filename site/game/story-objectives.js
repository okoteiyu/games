import {normalizeFacilityStaff,setFacilityStaffPlacements} from './facility-staff.js';

function episodeById(catalog,id){
 if(typeof id!=='string')return null;
 for(const chapter of catalog){
  const episode=chapter.episodes?.find(entry=>entry.id===id);
  if(episode)return episode;
 }
 return null;
}

/** Derive story attendance without storing or replacing normal assignments.
 * An unfinished episode keeps its people present even outside the reader.
 * Replays can temporarily overlay their own cast without changing that save. */
export function resolveFacilityStoryStaff(baseStaff,progress,catalog=[],{replayEpisodeId=null}={}){
 if(!Array.isArray(catalog))throw new TypeError('Invalid story catalogue.');
 let state=normalizeFacilityStaff(baseStaff);
 const activeId=progress?.activeEpisode?.episodeId;
 const activeCompleted=Array.isArray(progress?.completedEpisodes)&&progress.completedEpisodes.includes(activeId);
 const episodes=[activeCompleted?null:episodeById(catalog,activeId),episodeById(catalog,replayEpisodeId)];
 for(const episode of episodes){
  if(episode?.staffPlacements!==undefined)state=setFacilityStaffPlacements(state,episode.staffPlacements);
 }
 return state;
}
