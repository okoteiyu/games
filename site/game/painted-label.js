/** Clear the whole text bitmap on every change, including long-to-short and empty labels.
 * Native text remains available to assistive technology; animated WebGL cannot retain
 * stale glyphs in this opaque, independently redrawn image. */
export class PaintedLabel {
 constructor(element,{lines=1,align='left',background='#f8f1e3',flow=false,fitText=false,immutableImage=false}={}){
  Object.assign(this,{element,lines,align,background,flow,fitText,immutableImage});this.text='';this.padding=flow?0:1;
  this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-hidden','true');
  this.accessible=document.createElement('span');this.accessible.className='house-label-text';
  this.image=immutableImage?document.createElement('img'):null;
  if(this.image){this.image.alt='';this.image.setAttribute('aria-hidden','true');this.image.className='painted-label-image';}
  element.replaceChildren(this.image||this.canvas,this.accessible);element.classList.add('house-painted-label');
  if(flow)element.dataset.paintedFlow='true';
  this.observer=new ResizeObserver(()=>this.paint());this.observer.observe(element);
  document.fonts?.ready.then(()=>this.paint());
 }
 set(text){text=String(text);if(text===this.text)return;this.text=text;this.accessible.textContent=text;this.paint();}
 paint(){
  const box=this.element.getBoundingClientRect();if(box.width<1||box.height<1)return;
  const dpr=Math.min(3,window.devicePixelRatio||1),width=Math.ceil(box.width*dpr),height=Math.ceil(box.height*dpr);
  this.canvas.width=width;this.canvas.height=height;const c=this.canvas.getContext('2d',{alpha:false});
  c.scale(dpr,dpr);this.paintBackground(c,box);c.fillRect(0,0,box.width+1,box.height+1);
  const style=getComputedStyle(this.element);c.font=style.fontStyle+' '+style.fontWeight+' '+style.fontSize+' '+style.fontFamily;c.fillStyle=style.color;c.textBaseline='middle';
  if('letterSpacing' in c)c.letterSpacing=style.letterSpacing==='normal'?'0px':style.letterSpacing;
  const lineHeight=parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.35,rows=[];let row='';
  const limit=box.width-this.padding*2+.5;if(this.fitText&&this.lines===1&&c.measureText(this.text).width>limit){const size=parseFloat(style.fontSize)*Math.max(.7,limit/c.measureText(this.text).width);c.font=style.fontStyle+' '+style.fontWeight+' '+size+'px '+style.fontFamily;}
  for(const character of this.text){if(row&&c.measureText(row+character).width>limit){rows.push(row);row='';}row+=character;}if(row)rows.push(row);
  const visible=rows.slice(0,this.lines);if(rows.length>this.lines){let last=visible.at(-1)||'';while(last&&c.measureText(last+'…').width>limit)last=last.slice(0,-1);visible[this.lines-1]=last+'…';}
  c.textAlign=this.align==='center'?'center':'left';const y=(box.height-visible.length*lineHeight)/2+lineHeight/2;
  if(this.align==='right')c.textAlign='right';
  visible.forEach((line,index)=>c.fillText(line,this.align==='center'?box.width/2:this.align==='right'?box.width-this.padding:this.padding,y+index*lineHeight));
  if(this.image){const image=document.createElement('img');image.alt='';image.setAttribute('aria-hidden','true');image.className='painted-label-image';image.src=this.canvas.toDataURL('image/png');this.image.replaceWith(image);this.image=image;}
 }
 paintBackground(c,box){
  const parent=this.element.closest(this.background==='rank'?'.hero-rank':'.game-header');
  if(['bronze','rank'].includes(this.background)&&parent){
   const p=parent.getBoundingClientRect(),g=c.createLinearGradient(0,p.top-box.top,0,p.bottom-box.top);
   const stops=this.background==='rank'?[[0,'#fff9e9'],[1,'#efd6a7']]:[[0,'#c99b6b'],[.07,'#a8764d'],[.24,'#895b3c'],[.46,'#744830'],[.49,'#6a412d'],[.54,'#8b5c3d'],[.82,'#794b33'],[.95,'#a6744c'],[1,'#c59868']];
   for(const [at,color]of stops)g.addColorStop(at,color);c.fillStyle=g;
  }else c.fillStyle=this.background;
 }
 destroy(){this.observer.disconnect();}
}

const labels=new WeakMap();
export function setPaintedText(element,text,options={}){
 if(!element)return null;let label=labels.get(element);
 if(!label){label=new PaintedLabel(element,{flow:true,...options});labels.set(element,label);}
 label.set(text);return label;
}
export function releasePaintedLabels(root){for(const element of root?.querySelectorAll('[data-painted-flow]')||[]){labels.get(element)?.destroy();labels.delete(element);}}
