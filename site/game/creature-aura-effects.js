import * as THREE from './vendor/three/three.module.js';

export const CREATURE_AURA_COUNTS=Object.freeze({mist:24,ribbons:24,sparks:48});
const MAX_PALETTE=8;
const positiveModulo=(n,m)=>((n%m)+m)%m;

/** Soft acquired-aura presentation. Three instanced batches share one clock;
 * all color and motion is deterministic and has no effect on game state. */
export class CreatureAuraEffects{
 constructor(height,{density=1,strength=1}={}){
  this.height=height;this.density=density;this.intensity=strength;this.counts=Object.fromEntries(Object.entries(CREATURE_AURA_COUNTS).map(([key,count])=>[key,Math.ceil(count*density)]));this.root=new THREE.Group();this.root.name='Battle.CreatureAura';this.root.visible=false;
  this.uniforms={time:{value:0},height:{value:height},strength:{value:1},dark:{value:0},monochromeBlack:{value:0},paletteCount:{value:1},palette:{value:Array.from({length:MAX_PALETTE},()=>new THREE.Color(0xffffff))}};
  this.mist=this.makeLayer(this.counts.mist,0);this.ribbons=this.makeLayer(this.counts.ribbons,1);this.sparks=this.makeLayer(this.counts.sparks,2);this.root.add(this.mist,this.ribbons,this.sparks);this.style=null;this.active=false;
 }
 makeLayer(count,kind){
  const plane=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();geometry.index=plane.index;geometry.setAttribute('position',plane.attributes.position);geometry.setAttribute('uv',plane.attributes.uv);geometry.instanceCount=count;
  const phase=new Float32Array(count),side=new Float32Array(count),depth=new Float32Array(count),speed=new Float32Array(count),width=new Float32Array(count),length=new Float32Array(count);
  for(let i=0;i<count;i++){
   phase[i]=positiveModulo(i*.61803398875+kind*.271,1);speed[i]=.22+positiveModulo(i*.317+kind*.113,1)*.25;
   // Wide side plumes and a few rear plumes keep the eyes, cheeks and mouth clear.
   side[i]=i%6===0?Math.sin(i*1.9)*.22:(i%2?1:-1)*(.43+positiveModulo(i*.239,1)*.25);
   depth[i]=i%6===0?-.27:-.04-Math.sin(i*2.1)*.09;
   width[i]=kind===2?.014+positiveModulo(i*.413,1)*.014:kind===1?.19+positiveModulo(i*.347,1)*.14:.35+positiveModulo(i*.293,1)*.20;
   length[i]=kind===2?.036+positiveModulo(i*.271,1)*.06:kind===1?.49+positiveModulo(i*.173,1)*.32:.48+positiveModulo(i*.197,1)*.33;
  }
  for(const [name,array]of [['aPhase',phase],['aSide',side],['aDepth',depth],['aSpeed',speed],['aWidth',width],['aLength',length]])geometry.setAttribute(name,new THREE.InstancedBufferAttribute(array,1));
  const material=new THREE.ShaderMaterial({uniforms:{...this.uniforms,kind:{value:kind}},transparent:true,depthWrite:false,blending:kind===0?THREE.NormalBlending:THREE.AdditiveBlending,toneMapped:false,
   vertexShader:`
    uniform float time;uniform float height;uniform float kind;
    attribute float aPhase;attribute float aSide;attribute float aDepth;attribute float aSpeed;attribute float aWidth;attribute float aLength;
    varying vec2 vUv;varying float vLife;varying float vSeed;varying float vHeight;
    void main(){
     float age=fract(time*aSpeed+aPhase),spark=step(1.5,kind);
     float sway=sin(time*1.4+aPhase*19.+age*3.)*.055;
     vec3 center=vec3(aSide*(1.+age*.16)+sway,.04+age*(1.19+spark*.25),aDepth)*height;
     vec4 view=modelViewMatrix*vec4(center,1.);
     float width=aWidth*(.78+sin(age*3.14159265)*.28)*height;
     float length=aLength*(.78+age*.33)*height;
     view.xy+=position.xy*vec2(width,length);
     gl_Position=projectionMatrix*view;vUv=uv;vLife=pow(max(0.,sin(age*3.14159265)),.85);vSeed=aPhase;vHeight=center.y+position.y*length;
    }`,
   fragmentShader:`
    uniform float time;uniform float height;uniform float strength;uniform float dark;uniform float monochromeBlack;uniform float kind;uniform int paletteCount;uniform vec3 palette[8];
    varying vec2 vUv;varying float vLife;varying float vSeed;varying float vHeight;
    void main(){
     float spark=step(1.5,kind),ribbon=step(.5,kind)*(1.-spark);
     float bend=sin(vUv.y*6.-time*2.4+vSeed*21.)*.10*ribbon;
     vec2 p=vec2((vUv.x-.5+bend)*2.,(vUv.y-.5)*2.);
     float shape=exp(-p.x*p.x*mix(4.5,6.5,spark))*pow(max(0.,sin(vUv.y*3.14159265)),1.9);
     float edgeFade=smoothstep(-height*.05,height*.08,vHeight);
     float grain=.82+.18*sin(vUv.y*13.-time*3.2+vSeed*29.);
     float alpha=shape*vLife*edgeFade*strength*mix(.23,mix(.19,.72,spark),step(.5,kind))*mix(grain,1.,spark);
     int index=int(floor(vSeed*float(paletteCount)));vec3 base=palette[index];
     vec3 bright=mix(base,vec3(1.),.13+spark*.13);
     // Black auras retain a dark smoke body, with a restrained slate rim so
     // their movement stays visible in a dark field without becoming white.
     float channel=max(base.r,max(base.g,base.b));
     // An explicit all-black palette remains achromatic. Legacy unpaletted
     // black auras retain their authored slate edge.
     vec3 blackRim=mix(vec3(.13,.16,.23),vec3(.16),monochromeBlack);
     vec3 rim=channel>.0008?base*(max(.18,channel)/channel):blackRim;
     vec3 color=mix(bright,rim,dark);
     if(kind<.5){color=mix(base*.75,base,dark);alpha*=mix(.77,1.55,dark);}
     else if(kind<1.5){color=mix(color,mix(base,vec3(1.),.23),exp(-p.x*p.x*18.)*.22*(1.-dark));}
     gl_FragColor=vec4(color,alpha);
     #include <colorspace_fragment>
    }`});
  const mesh=new THREE.Mesh(geometry,material);mesh.name=kind===0?'CreatureAura.SoftMist':kind===1?'CreatureAura.RisingGlow':'CreatureAura.DriftingSparks';mesh.frustumCulled=false;plane.dispose();return mesh;
 }
 configure(style){
  if(this.style===style)return;this.style=style;
  const colors=(style.palette?.length?style.palette:[style.color]).slice(0,MAX_PALETTE);for(let i=0;i<MAX_PALETTE;i++)this.uniforms.palette.value[i].set(colors[i%colors.length]);
  this.uniforms.paletteCount.value=colors.length;
  this.uniforms.monochromeBlack.value=style.palette?.length&&colors.every(color=>new THREE.Color(color).getHex()===0)?1:0;
  this.uniforms.dark.value=Math.max(...colors.map(color=>{const c=new THREE.Color(color);return Math.max(c.r,c.g,c.b);} ))<.12?1:0;
 }
 sample(elapsed,active,style,{superActive=false}={}){
  this.active=Boolean(active);this.root.visible=this.active;if(!this.active)return;
  this.configure(style);this.uniforms.time.value=Math.max(0,Number(elapsed)||0);
  this.uniforms.strength.value=this.intensity*(style.strength||1)*(style.emphasis?1.12:1)*(superActive?.62:1);
 }
 getDiagnostics(){return {active:this.active,time:this.uniforms.time.value,strength:this.uniforms.strength.value,dark:this.uniforms.dark.value,palette:this.uniforms.palette.value.slice(0,this.uniforms.paletteCount.value).map(c=>'#'+c.getHexString()),counts:{...this.counts},drawCalls:3};}
 dispose(){for(const mesh of[this.mist,this.ribbons,this.sparks]){mesh.geometry.dispose();mesh.material.dispose();}this.root.removeFromParent();}
}
