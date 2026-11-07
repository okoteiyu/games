/** Stable authored landmarks on the existing route graph; no gameplay RNG. */
export const CAMP_DANGER_ZONE_LOCATIONS=Object.freeze([
 Object.freeze({level:15,nodeId:'wild-562'}),
 Object.freeze({level:20,nodeId:'wild-629'}),
 Object.freeze({level:25,nodeId:'wild-674'}),
 Object.freeze({level:30,nodeId:'wild-265'}),
 Object.freeze({level:35,nodeId:'wild-348'}),
 Object.freeze({level:40,nodeId:'wild-176'}),
 Object.freeze({level:45,nodeId:'wild-789'}),
 Object.freeze({level:50,nodeId:'wild-833'}),
 Object.freeze({level:55,nodeId:'wild-884'}),
 Object.freeze({level:60,nodeId:'wild-1364'}),
 Object.freeze({level:65,nodeId:'wild-1455'}),
 Object.freeze({level:70,nodeId:'wild-1487'}),
 Object.freeze({level:75,nodeId:'wild-1751'}),
 Object.freeze({level:80,nodeId:'wild-1779'}),
 Object.freeze({level:85,nodeId:'wild-1969'}),
 Object.freeze({level:95,nodeId:'wild-2142'}),
 Object.freeze({level:100,nodeId:'wild-2129'})
]);

/** A fixed unique guardian lives in the lower sacred forest. This registered
 * landmark remains reserved, so a camp base cannot occupy this site. */
export const CAMP_HOLY_DRAGON_LOCATION=Object.freeze({
 id:'holy_dragon_lair',name:'聖天の棲家',nodeId:'wild-1510',
 guardianSpeciesId:'holy_white_dragon_pegasus',fixedLevel:65,discoverySupplyId:'sacred_scripture',
 description:'神聖な森の下部にある、聖天龍が棲む場所。'
});

/** The throne replaces the former danger-zone landmark on exactly the same
 * registered vertex, preserving all geography and actual visit history. */
export const CAMP_BEAST_LORD_LOCATION=Object.freeze({
 id:'designated_zone_z_throne',name:'指定区域Z(玉座)',nodeId:'wild-1991',
 guardianSpeciesId:'great_beast_lord',fixedLevel:80,hideUntilVisited:true,
 description:'大獣主が待ち構える玉座のある区域。'
});
