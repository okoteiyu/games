/** Screen-space story accents use the same clock as the rigid 3D actors.
 * No timers, video resources or second rendering context survive a pause. */
export class StoryStageEffects {
 constructor(container){
  this.container=container;this.black=document.createElement('div');this.black.className='story-stage-black';this.black.setAttribute('aria-hidden','true');Object.assign(this.black.style,{position:'absolute',inset:'0',background:'#000',pointerEvents:'none',zIndex:'3',opacity:'0'});
  const ns='http://www.w3.org/2000/svg';this.lines=document.createElementNS(ns,'svg');this.lines.classList.add('story-stage-speed-lines');this.lines.setAttribute('viewBox','0 0 1000 1000');this.lines.setAttribute('preserveAspectRatio','none');this.lines.setAttribute('aria-hidden','true');Object.assign(this.lines.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'2',opacity:'0'});
  this.rays=[];
  for(let i=0;i<44;i++){const polygon=document.createElementNS(ns,'polygon');polygon.setAttribute('fill',i%4?'#fffdf1':'#493e39');polygon.setAttribute('fill-opacity',i%4?'.91':'.53');this.lines.append(polygon);this.rays.push(polygon);}
  container.append(this.lines,this.black);this.alpha=0;this.fade=null;
 }
 fadeTo(alpha,duration){this.fade={from:this.alpha,to:alpha,duration:Math.max(.001,duration),elapsed:0};this.paint();}
 setBlack(alpha){this.alpha=Math.min(1,Math.max(0,alpha));this.fade=null;this.paint();}
 advance(dt){if(this.fade){const fade=this.fade;fade.elapsed+=dt;const linear=Math.min(1,fade.elapsed/fade.duration),mix=linear*linear*(3-2*linear);this.alpha=fade.from+(fade.to-fade.from)*mix;if(linear===1)this.fade=null;this.paint();}}
 paint(){this.black.style.opacity=String(this.alpha);}
 impact(elapsed,center={x:.5,y:.5}){
  const strength=elapsed<1.25?Math.min(1,elapsed/.09)*Math.min(1,Math.max(0,1-(elapsed-.8)/.45)):0;this.lines.style.opacity=String(Math.max(0,strength));if(strength<=0)return;
  const cx=Math.min(760,Math.max(240,center.x*1000)),cy=Math.min(740,Math.max(260,center.y*1000));
  this.rays.forEach((ray,i)=>{const angle=i*Math.PI*2/this.rays.length,half=.005+(i%3)*.0018,radius=850,inner=205+(i*37%110),point=(r,a)=>`${(cx+Math.cos(a)*r).toFixed(1)},${(cy+Math.sin(a)*r).toFixed(1)}`;ray.setAttribute('points',[point(radius,angle-half),point(inner,angle),point(radius,angle+half)].join(' '));});
 }
 clearImpact(){this.lines.style.opacity='0';}
 diagnostics(){return {blackOpacity:this.alpha,fadePending:Boolean(this.fade),speedLinesOpacity:Number(this.lines.style.opacity)};}
 destroy(){this.black.remove();this.lines.remove();this.rays=[];}
}
