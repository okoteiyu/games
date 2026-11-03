/** Presentation destinations only; no facility services, costs or save fields. */
export const INTERIOR_ROOMS=Object.freeze(Object.fromEntries([
 ['analysis-room','コンピュータ室','b1','B1','analysis','analysis-room'],
 ['player-room','あなたの部屋','2f','F2','player','player-room'],
 ['warehouse','倉庫','outdoor','屋外','warehouse','warehouse'],
 ['outdoor','拠点の屋外','outdoor','屋外','grounds','outdoor'],
 ['production-room','生産施設','b1','B1','production','production-room'],
 ['research-room','研究所','b1','B1','research','research-room'],
 ['maintenance-room','整備施設','b1','B1','maintenance','maintenance-room'],
 ['guest-lounge','休憩室','b2','B2','guest-lounge','guest-lounge'],
 ['management-room','管理室','b2','B2','control','management-room']
].map(([id,title,floorId,floorLabel,areaId,assetDirectory])=>[id,Object.freeze({id,title,floorId,floorLabel,areaId,assetDirectory})])));
export const isInteriorScene=scene=>Object.hasOwn(INTERIOR_ROOMS,scene);
export const isBuildingVisitScene=scene=>scene==='training-hall'||isInteriorScene(scene);
export const interiorForDestination=({floorId,areaId}={})=>Object.values(INTERIOR_ROOMS).find(room=>room.floorId===floorId&&room.areaId===areaId)?.id||null;
