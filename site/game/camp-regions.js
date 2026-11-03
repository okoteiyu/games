/** Region boundaries stay in world coordinates when the atlas grows later. */
export const CAMP_REGION_BOUNDS=Object.freeze({minX:-3550.511,minY:-8668.067,maxX:6546.239,maxY:3957.573});
const {minX,minY,maxX,maxY}=CAMP_REGION_BOUNDS,width=(maxX-minX)/3,height=(maxY-minY)/3;
const bounds=(left,top,right,bottom)=>Object.freeze({minX:left,minY:top,maxX:right,maxY:bottom});
const region=(id,name,order,area,palette,landmark)=>Object.freeze({id,name,order,bounds:area,labelPoint:Object.freeze({x:(area.minX+area.maxX)/2,y:(area.minY+area.maxY)/2}),palette:Object.freeze(palette),...(landmark?{landmark}: {})});
const meteorBounds=bounds(minX+width,minY,minX+width*2,minY+height);
export const CAMP_REGIONS=Object.freeze({
 wilds:region('wilds','未開の地',0,bounds(minX,minY+height*2,maxX,maxY),{background:'#233c2b',land:'#365b3b',accent:'#8ca765',ink:'#f0ead7'}),
 volcano:region('volcano','険しい火山',1,bounds(minX,minY+height,maxX,minY+height*2),{background:'#8a322b',land:'#6b332d',accent:'#f48448',ink:'#f8e8d5'}),
 sacred_forest:region('sacred_forest','神聖な森',2,bounds(minX,minY,minX+width,minY+height),{background:'#dce9bb',land:'#74a770',accent:'#fff0a8',ink:'#315348'}),
 meteor_crater:region('meteor_crater','隕石跡地',3,meteorBounds,{background:'#30283f',land:'#796883',accent:'#c7a9dd',ink:'#eee4f5'},Object.freeze({type:'crater',center:Object.freeze({x:(meteorBounds.minX+meteorBounds.maxX)/2,y:meteorBounds.minY+height*.52}),radiusX:width*.38,radiusY:height*.22})),
 dark_domain:region('dark_domain','暗黒域',4,bounds(minX+width*2,minY,maxX,minY+height),{background:'#44464c',land:'#34363b',accent:'#91949c',ink:'#eeeeee'})
});
export function getCampRegion(id){return typeof id==='string'&&Object.hasOwn(CAMP_REGIONS,id)?CAMP_REGIONS[id]:null;}
/** Lower/southern bands win their shared horizontal boundary. */
export function getCampRegionAt(pointOrX,y){
 const x=typeof pointOrX==='object'&&pointOrX!==null?pointOrX.x:pointOrX;
 if(typeof pointOrX==='object'&&pointOrX!==null)y=pointOrX.y;
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<minX||x>maxX||y<minY||y>maxY)return null;
 if(y>=minY+height*2)return CAMP_REGIONS.wilds;
 if(y>=minY+height)return CAMP_REGIONS.volcano;
 return x<minX+width?CAMP_REGIONS.sacred_forest:x<minX+width*2?CAMP_REGIONS.meteor_crater:CAMP_REGIONS.dark_domain;
}
