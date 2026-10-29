import * as THREE from './vendor/three/three.module.js';

/** Soft upward streams and sparks; all animation follows the battle/view clock. */
export class SuperRisingAura{
 constructor(height){
  this.root=new THREE.Group();this.root.name='Battle.SuperRisingAura';this.root.visible=false;
  let seed=97104;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  this.uniforms={time:{value:0},height:{value:height},strength:{value:1},edgeColor:{value:new THREE.Color('#d6ed43')},coreColor:{value:new THREE.Color('#fff6b1')}};
  this.streams=this.makeLayer(42,false,random);this.sparks=this.makeLayer(120,true,random);this.root.add(this.streams,this.sparks);
 }
 makeLayer(count,sparks,random){
  const plane=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();geometry.index=plane.index;geometry.setAttribute('position',plane.attributes.position);geometry.setAttribute('uv',plane.attributes.uv);geometry.instanceCount=count;
  const phases=new Float32Array(count),speeds=new Float32Array(count),sides=new Float32Array(count),depths=new Float32Array(count),widths=new Float32Array(count),lengths=new Float32Array(count);
  for(let i=0;i<count;i++){
   phases[i]=random();speeds[i]=sparks?.65+random()*.8:.50+random()*.55;
   // Side streams frame the face; the remaining streams rise behind the body.
   sides[i]=i%5===0?(random()-.5)*.75:(i%2?-1:1)*(.47+random()*.22);
   depths[i]=i%5===0?-.35-random()*.12:(random()-.5)*.18;
   widths[i]=sparks?.010+random()*.015:.17+random()*.18;
   lengths[i]=sparks?.07+random()*.13:.72+random()*.48;
  }
  for(const [name,array]of [['aPhase',phases],['aSpeed',speeds],['aSide',sides],['aDepth',depths],['aWidth',widths],['aLength',lengths]])geometry.setAttribute(name,new THREE.InstancedBufferAttribute(array,1));
  const material=new THREE.ShaderMaterial({uniforms:{...this.uniforms,sparks:{value:sparks?1:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
   vertexShader:`
    uniform float time;uniform float height;uniform float sparks;
    attribute float aPhase;attribute float aSpeed;attribute float aSide;attribute float aDepth;attribute float aWidth;attribute float aLength;
    varying vec2 vUv;varying float vLife;varying float vSeed;varying float vHeight;
    void main(){
     float age=fract(time*aSpeed+aPhase);float sway=sin(time*2.6+aPhase*19.+age*3.);
     float spread=1.+age*.18;
     vec3 center=vec3(aSide*spread+sway*.035,.04+age*(1.28+sparks*.38),aDepth)*height;
     vec4 view=modelViewMatrix*vec4(center,1.);
     float width=aWidth*(.65+sin(age*3.14159265)*.55)*height;
     float length=aLength*(.65+age*.5)*height;
     view.xy+=position.xy*vec2(width,length);
     gl_Position=projectionMatrix*view;vUv=uv;vLife=pow(sin(age*3.14159265),.75);vSeed=aPhase*27.;vHeight=center.y+position.y*length;
    }`,
   fragmentShader:`
    uniform float time;uniform float height;uniform float strength;uniform float sparks;uniform vec3 edgeColor;uniform vec3 coreColor;
    varying vec2 vUv;varying float vLife;varying float vSeed;varying float vHeight;
    void main(){
     float bend=sin(vUv.y*8.-time*5.+vSeed)*.13*(1.-sparks);
     float x=(vUv.x-.5+bend)*2.;
     float sides=exp(-x*x*(4.5+sparks*2.));
     float ends=pow(max(0.,sin(vUv.y*3.14159265)),1.6);
     float wisps=.68+.32*sin(vUv.y*16.-time*7.+vSeed+x*2.);
     float ground=smoothstep(-height*.025,height*.06,vHeight);
     float alpha=sides*ends*vLife*ground*strength*mix(.23,.85,sparks)*mix(wisps,1.,sparks);
     vec3 color=mix(edgeColor,coreColor,exp(-x*x*12.)*.75+sparks*.25);
     gl_FragColor=vec4(color,alpha);
     #include <colorspace_fragment>
    }`});
  const mesh=new THREE.Mesh(geometry,material);mesh.name=sparks?'SuperAura.UpwardSparks':'SuperAura.SoftRisingStreams';mesh.frustumCulled=false;return mesh;
 }
 sample(elapsed,active){
  this.root.visible=Boolean(active);if(!active)return;
  this.uniforms.time.value=Math.max(0,elapsed);
  const t=THREE.MathUtils.clamp(elapsed/.28,0,1);this.uniforms.strength.value=.55+.45*t*t*(3-2*t);
 }
}
