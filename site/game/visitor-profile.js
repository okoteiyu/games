import {INITIAL_PLAYER_LEVEL,INITIAL_CALM_POINTS} from './initial-state.js';

/** The visitor is separate from the character named おこていゆ. */
export function normalizeVisitorName(value){
 if(value===undefined||value===null)return null;
 if(typeof value!=='string'||/[\u0000-\u001f\u007f]/u.test(value))throw new TypeError('名前の形式が正しくありません。');
 return value.trim()||null;
}

export function isInitialProgress(session,calmPoints){
 return normalizeVisitorName(session?.visitorName)===null&&session?.player?.level===INITIAL_PLAYER_LEVEL&&calmPoints===INITIAL_CALM_POINTS;
}

export function validateVisitorProgress(session,calmPoints){
 const name=normalizeVisitorName(session?.visitorName);
 if(!name&&!isInitialProgress(session,calmPoints))throw new TypeError('名前が未登録で、初期状態ではないセーブデータは読み込めません。');
 return name;
}
