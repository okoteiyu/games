import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/addons/loaders/GLTFLoader.js';
import {loadAssetJson,loadGLTFAsset} from './asset-store.js';

const mat=(color,roughness=.85,extra={})=>new THREE.MeshStandardMaterial({color,roughness,...extra});
const find=(root,name)=>root.getObjectByName(name)||root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
function box(root,size,position,material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.set(...position);root.add(mesh);return mesh;}
function sphere(root,r,position,material){const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),material);mesh.position.set(...position);root.add(mesh);return mesh;}

/** A local expression for this cloned sleeper only. Keep the shipped face and
 * every other scene unchanged, including the original brows, cheeks and mouth. */
function makeSleepingFace(body){
 const originalMaterial=body?.material,originalMap=originalMaterial?.map,image=originalMap?.image;
 if(!body||Array.isArray(originalMaterial)||!image)return null;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const ctx=canvas.getContext('2d');
 if(!ctx)return null;ctx.drawImage(image,0,0,1024,1024);
 ctx.fillStyle='#ffe2cd';ctx.fillRect(405,349,80,90);ctx.fillRect(540,349,80,90);
 ctx.strokeStyle='#554b4a';ctx.lineWidth=5.5;ctx.lineCap='round';
 for(const x of[445,579]){ctx.beginPath();ctx.moveTo(x-30,379);ctx.quadraticCurveTo(x,400,x+30,379);ctx.stroke();}
 const texture=new THREE.CanvasTexture(canvas);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;
 const material=originalMaterial.clone();material.map=texture;material.needsUpdate=true;body.material=material;
 return {originalMaterial,originalMap,texture,closedEyes:true};
}

/** A short presentation-only night. The expedition controller owns day changes. */
export class CampNightView{
 constructor({container,isPaused=()=>false,onComplete=()=>{},onError=()=>{}}={}){
  if(!container)throw new TypeError('キャンプの表示先がありません。');Object.assign(this,{host:container,isPaused,onComplete,onError});
  this.root=document.createElement('div');this.root.className='camp-night-view';Object.assign(this.root.style,{position:'absolute',inset:'0',zIndex:'4',background:'#172331',overflow:'hidden'});this.root.hidden=true;container.append(this.root);
  this.caption=document.createElement('div');this.caption.textContent='夜は、ふたりでひと休み。';Object.assign(this.caption.style,{position:'absolute',left:'14px',bottom:'16px',right:'14px',textAlign:'center',color:'#f5efd7',fontSize:'clamp(13px,3.5vw,18px)',letterSpacing:'.04em',textShadow:'0 2px 5px #142132'});this.root.append(this.caption);
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#172b3b');this.scene.fog=new THREE.Fog('#172b3b',3,8);this.camera=new THREE.PerspectiveCamera(38,1,.01,20);this.camera.position.set(1.38,1.36,1.88);this.camera.lookAt(0,.20,-.12);this.scene.add(new THREE.HemisphereLight(0xb3d7ed,0x26352c,1.7));const moonlight=new THREE.DirectionalLight(0xb9d4f0,2.0);moonlight.position.set(-2,5,2);this.scene.add(moonlight);this.loader=new GLTFLoader();this.elapsed=0;this.ready=false;this.active=false;this.generation=0;this.renderFrames=0;this.makeSet();
 }
 makeSet(){
  const s=this.scene,ground=mat('#354d3b'),trunk=mat('#5a5141'),pine=mat('#2b5144'),tent=mat('#b7b595'),lining=mat('#344a41'),sleeping=mat('#9aa98a'),metal=mat('#807d6c',.45,{metalness:.4});
  const floor=new THREE.Mesh(new THREE.CircleGeometry(4,48),ground);floor.rotation.x=-Math.PI/2;floor.position.y=-.015;s.add(floor);
  box(s,[.78,.055,.75],[0,.028,-.06],sleeping);const contact=sphere(s,1,[0,.057,-.08],mat('#71816a'));contact.scale.set(.22,.002,.20);
  // The tent is open at the front; no poles cross the sleeping character.
  const vertices=[-.58,0,-.90,.58,0,-.90,0,.87,-.90,-.58,0,-.06,.58,0,-.06,0,.87,-.06];const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex([0,2,5,0,5,3,2,1,4,2,4,5,0,1,2]);g.computeVertexNormals();const roof=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:'#8b9d85',roughness:.9,side:THREE.DoubleSide}));s.add(roof);box(s,[1.12,.035,.82],[0,.015,-.49],lining);
  for(const [x,z,scale]of[[-1.3,-1.1,1],[-.85,-1.9,.92],[1.2,-1.45,1.1],[1.8,-.8,.85],[-1.65,-.4,.8]]){const t=new THREE.Mesh(new THREE.CylinderGeometry(.035,.055,1.2*scale,8),trunk);t.position.set(x,.6*scale,z);s.add(t);for(let j=0;j<3;j++){const c=new THREE.Mesh(new THREE.ConeGeometry((.42-j*.065)*scale,.8*scale,9),pine);c.position.set(x,(.80+j*.28)*scale,z);s.add(c);}}
  const lantern=new THREE.Group();lantern.position.set(.56,.08,.37);s.add(lantern);box(lantern,[.10,.025,.10],[0,0,0],metal);box(lantern,[.07,.15,.07],[0,.09,0],mat('#ffe5a5',.3,{emissive:'#f9bf61',emissiveIntensity:2}));box(lantern,[.11,.02,.11],[0,.18,0],metal);const light=new THREE.PointLight(0xffd598,1.5,2.4,2);light.position.set(.56,.3,.37);s.add(light);
  // Your folded pack is beside the sleeping mat; the traveller remains unseen.
  box(s,[.24,.28,.15],[-.53,.14,.18],mat('#ae9773'));box(s,[.16,.12,.03],[-.53,.12,.27],mat('#d0bb90'));
  const stars=new THREE.BufferGeometry(),p=[];for(let i=0;i<54;i++){const a=i*2.39996,r=2+(i%7)*.19;p.push(Math.sin(a)*r,1.8+(i%11)*.16,-2.6-Math.cos(a)*.7);}stars.setAttribute('position',new THREE.Float32BufferAttribute(p,3));this.stars=new THREE.Points(stars,new THREE.PointsMaterial({color:'#d7f0fc',size:.018,transparent:true,opacity:.9,sizeAttenuation:true}));s.add(this.stars);sphere(s,.13,[1.5,2.9,-3],new THREE.MeshBasicMaterial({color:'#e5f2d8'}));
 }
 createRenderer(){
  if(this.renderer)return;this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.canvas=this.renderer.domElement;Object.assign(this.canvas.style,{display:'block',width:'100%',height:'100%'});this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','夜の森のテントで、おこていゆが体を横にして眠っています。');this.root.prepend(this.canvas);
  this.lost=event=>{event.preventDefault();this.contextLost=true;};this.restored=()=>{this.contextLost=false;this.render();};this.canvas.addEventListener('webglcontextlost',this.lost);this.canvas.addEventListener('webglcontextrestored',this.restored);this.resizeObserver=new ResizeObserver(()=>this.render());this.resizeObserver.observe(this.root);
 }
 async prepareActor(){
  if(this.actor)return this.actor;if(this.actorPromise)return this.actorPromise;
  this.actorPromise=(async()=>{const manifest=await loadAssetJson(new URL('./assets/battle3d/manifest.json',import.meta.url)),definition=manifest.models.okoteiyu,url=new URL('./assets/battle3d/'+definition.url,import.meta.url);url.searchParams.set('v',definition.sha256);const gltf=await loadGLTFAsset(this.loader,url.href);if(this.destroyed)throw new Error('キャンプ表示を終了しました。');const model=gltf.scene.clone(true);model.traverse(node=>{if(/^(Aura|Super|Ray)/.test(node.name))node.visible=false;if(node.isMesh){node.castShadow=false;node.receiveShadow=false;}});const pivot=new THREE.Group();pivot.name='Camp.SleepingOkoteiyu';pivot.add(model);pivot.rotation.x=-Math.PI/2;this.scene.add(pivot);pivot.updateMatrixWorld(true);const body=find(model,'Body'),sleepFace=makeSleepingFace(body);if(body?.geometry)body.geometry.computeBoundingBox();const bounds=body?.geometry?.boundingBox?body.geometry.boundingBox.clone().applyMatrix4(body.matrixWorld):new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3());pivot.position.set(-center.x,.056-bounds.min.y,-.08-center.z);pivot.updateMatrixWorld(true);this.actor={pivot,model,sleepFace,baseY:pivot.position.y,baseZ:pivot.position.z,clips:gltf.animations};return this.actor;})();
  try{return await this.actorPromise;}finally{this.actorPromise=null;}
 }
 async start({player}={}){
  const generation=++this.generation;if(this.root.parentElement!==this.host)this.host.append(this.root);this.active=true;this.ready=false;this.elapsed=0;this.completed=false;this.root.hidden=false;this.caption.textContent='夜は、ふたりでひと休み。';try{this.createRenderer();await this.prepareActor();if(this.destroyed||generation!==this.generation)return false;this.ready=true;this.render();return true;}catch(error){if(generation===this.generation){this.onError(error);this.caption.textContent='夜の表示を準備できませんでした。タップで再試行。';this.retry=()=>{this.root.removeEventListener('click',this.retry);this.start({player});};this.root.addEventListener('click',this.retry,{once:true});}return false;}
 }
 tick(dt){
  if(!this.active||!this.ready||this.completed||this.contextLost||this.isPaused()||document.hidden)return false;this.elapsed=Math.min(2,this.elapsed+Math.max(0,Number(dt)||0));if(this.actor){const wave=Math.sin(this.elapsed*Math.PI*1.2);this.actor.pivot.position.y=this.actor.baseY+wave*.002;this.actor.pivot.rotation.z=wave*.008;}this.stars.material.opacity=.82+.12*Math.sin(this.elapsed*2);this.render();if(this.elapsed>=2){this.completed=true;this.onComplete();}return true;
 }
 render(){if(!this.renderer||!this.active||this.contextLost||this.root.hidden)return;const r=this.root.getBoundingClientRect();if(r.width<=0||r.height<=0)return;const width=Math.round(r.width),height=Math.round(r.height);if(this.width!==width||this.height!==height){this.width=width;this.height=height;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}this.renderer.render(this.scene,this.camera);this.renderFrames++;}
 hide(){this.generation++;this.active=false;this.root.hidden=true;if(this.retry)this.root.removeEventListener('click',this.retry);}
 async recoverAfterInterruption(){if(!this.active)return true;if(this.root.parentElement!==this.host)this.host.append(this.root);if(this.contextLost){return new Promise(resolve=>{let timer;const restored=()=>{clearTimeout(timer);this.canvas?.removeEventListener('webglcontextrestored',restored);this.render();resolve(true);};this.canvas?.addEventListener('webglcontextrestored',restored,{once:true});timer=setTimeout(()=>{this.canvas?.removeEventListener('webglcontextrestored',restored);resolve(false);},2500);this.renderer?.forceContextRestore?.();});}this.render();return true;}
 destroy(){if(this.destroyed)return;this.destroyed=true;this.hide();this.resizeObserver?.disconnect();if(this.canvas){this.canvas.removeEventListener('webglcontextlost',this.lost);this.canvas.removeEventListener('webglcontextrestored',this.restored);}const geoms=new Set(),mats=new Set(),textures=new Set();this.scene.traverse(o=>{if(o.geometry)geoms.add(o.geometry);for(const m of(o.material?Array.isArray(o.material)?o.material:[o.material]:[])){mats.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});for(const g of geoms)g.dispose();for(const m of mats)m.dispose();for(const t of textures)t.dispose();this.renderer?.dispose();this.root.remove();}
}
