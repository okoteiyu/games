/** Keep the full action label readable when zoom or larger text crowds the bonus badge. */
export function installBonusButtonLayout(button){
 if(!button)return ()=>{};
 let frame=0;
 const update=()=>{
  frame=0;
  if(button.dataset.bonus!=='true'){delete button.dataset.bonusCompact;return;}
  if(!button.isConnected||button.offsetWidth===0||button.offsetHeight===0)return;
  // Measure the full presentation independently of the currently compact one.
  // This lets the badge return when space grows, without alternating layouts.
  const probe=button.cloneNode(true),style=getComputedStyle(button);
  delete probe.dataset.bonusCompact;probe.removeAttribute('id');probe.setAttribute('aria-hidden','true');probe.tabIndex=-1;
  Object.assign(probe.style,{position:'absolute',visibility:'hidden',pointerEvents:'none',boxSizing:style.boxSizing,inlineSize:style.width,blockSize:style.height,margin:'0',inset:'0 auto auto 0',transform:'none'});
  button.parentElement.append(probe);
  try{
   const rect=probe.getBoundingClientRect(),border=getComputedStyle(probe),scaleX=rect.width/probe.offsetWidth,scaleY=rect.height/probe.offsetHeight;
   const bounds={left:rect.left+parseFloat(border.borderLeftWidth)*scaleX,right:rect.right-parseFloat(border.borderRightWidth)*scaleX,top:rect.top+parseFloat(border.borderTopWidth)*scaleY,bottom:rect.bottom-parseFloat(border.borderBottomWidth)*scaleY};
   const outside=r=>r.left<bounds.left-1||r.right>bounds.right+1||r.top<bounds.top-1||r.bottom>bounds.bottom+1;
   const crowded=probe.scrollWidth>probe.clientWidth+1||probe.scrollHeight>probe.clientHeight+1||[...probe.querySelectorAll('.home-choice__label,.home-choice__bonus')].some(el=>{
    if(getComputedStyle(el).display==='none')return false;
    const range=document.createRange();range.selectNodeContents(el);return outside(el.getBoundingClientRect())||[...range.getClientRects()].some(outside);
   });
   if(button.dataset.bonusCompact!==String(crowded))button.dataset.bonusCompact=String(crowded);
  }finally{probe.remove();}
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
 const resize=new ResizeObserver(schedule);resize.observe(button);
 for(const el of button.querySelectorAll('.home-choice__label,.home-choice__bonus'))resize.observe(el);
 const mutation=new MutationObserver(schedule);mutation.observe(button,{attributes:true,attributeFilter:['data-bonus','hidden'],subtree:true,characterData:true,childList:true});
 window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);document.fonts?.addEventListener('loadingdone',schedule);schedule();
 return ()=>{if(frame)cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);document.fonts?.removeEventListener('loadingdone',schedule);};
}
