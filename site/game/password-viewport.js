/** Keep the game layout stable while a save password or name keyboard is open. */
export function installPasswordViewportGuard(){
 const body=document.body,meta=document.querySelector('meta[name=viewport]');let held=null,timer;
 const fields='input[type=password],input[data-game-text-input]';
 const enter=event=>{if(!event.target.matches?.(fields))return;clearTimeout(timer);if(held)return;
  held={field:event.target,viewport:meta?.content,height:body.style.getPropertyValue('--game-height'),cap:body.style.getPropertyValue('--game-width-cap')};
  const height=body.getBoundingClientRect().height;body.style.setProperty('--game-height',height+'px');body.style.setProperty('--game-width-cap',(height*7/12)+'px');body.dataset.passwordKeyboard='true';
  body.style.setProperty('--password-visible-height',(window.visualViewport?.height||window.innerHeight)+'px');
  if(meta)meta.content=meta.content.replace(/,?\s*maximum-scale\s*=\s*[^,]+/g,'')+',maximum-scale=1';
 };
 const restore=()=>{if(!held)return;const old=held;held=null;if(meta)meta.content=old.viewport;
  for(const [key,value]of [['--game-height',old.height],['--game-width-cap',old.cap]])if(value)body.style.setProperty(key,value);else body.style.removeProperty(key);
  body.style.removeProperty('--password-visible-height');delete body.dataset.passwordKeyboard;
 };
 document.addEventListener('pointerdown',enter,true);document.addEventListener('focusin',enter,true);
 document.addEventListener('focusout',event=>{if(event.target.matches?.(fields))timer=setTimeout(()=>{if(!document.activeElement?.matches?.(fields))restore();},300);},true);
 document.addEventListener('close',()=>{timer=setTimeout(()=>{if(!document.activeElement?.matches?.(fields)||!document.activeElement.closest('dialog[open]'))restore();},300);},true);
 window.visualViewport?.addEventListener('resize',()=>{if(held)body.style.setProperty('--password-visible-height',window.visualViewport.height+'px');});
 new MutationObserver(()=>{if(held&&!held.field.isConnected)restore();}).observe(body,{childList:true,subtree:true});
 return restore;
}
