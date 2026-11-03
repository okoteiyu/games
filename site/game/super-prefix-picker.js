import {SUPER_CONFIGURATIONS,availableSuperConfigurationIds,superConfigurationLevel} from './super-prefix-rules.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sparkle='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z"/><path d="m19 2 .8 2.2L22 5"/></svg>';
const level=(player,id)=>'Lv.'+superConfigurationLevel(player,id)+' / '+SUPER_CONFIGURATIONS[id].maxLevel;

/** A list in the dialog's scroll flow also works on small iOS web views. */
export function superPrefixPickerMarkup(player,{disabled=false}={}){
 const selected=player.superConfiguration||'none',configuration=SUPER_CONFIGURATIONS[selected];
 return '<div class="super-prefix-picker" data-super-picker><span class="super-prefix-picker__label" id="superPrefixLabel">接頭辞オプション</span>'+
  '<button type="button" class="super-prefix-picker__trigger" id="superPrefixTrigger" data-super-configuration value="'+esc(selected)+'" aria-haspopup="listbox" aria-expanded="false" aria-controls="superPrefixList" aria-labelledby="superPrefixLabel superPrefixValue" aria-describedby="superPrefixLevel"'+(disabled?' disabled':'')+'>'+
  '<span class="super-prefix-picker__symbol">'+sparkle+'</span><span class="super-prefix-picker__selection"><strong id="superPrefixValue">'+esc(configuration.label)+'</strong><small id="superPrefixLevel">'+level(player,selected)+'</small></span><span class="super-prefix-picker__chevron" aria-hidden="true"></span></button>'+
  '<div class="super-prefix-picker__list" id="superPrefixList" role="listbox" aria-labelledby="superPrefixLabel" hidden>'+availableSuperConfigurationIds(player).map(id=>{
   const c=SUPER_CONFIGURATIONS[id],active=id===selected;
   return '<div class="super-prefix-picker__option" role="option" tabindex="-1" data-super-option="'+esc(id)+'" aria-selected="'+active+'"><span class="super-prefix-picker__option-copy"><strong>'+esc(c.label)+'</strong><small>'+esc(id==='none'?'基本のスーパーおこていゆ状態':c.prefix+'スーパーおこていゆ状態')+'</small></span><span class="super-prefix-picker__level">'+level(player,id)+'</span><span class="super-prefix-picker__check" aria-hidden="true">'+(active?'✓':'')+'</span></div>';
  }).join('')+'</div></div>';
}

/** Delegation survives live game-state refreshes and does not create a new modal. */
export class SuperPrefixPicker {
 constructor({root,onSelect,canOpen=()=>true}){
  this.root=root;this.onSelect=onSelect;this.canOpen=canOpen;this.dismissedTriggerPointer=false;this.pointerInList=false;this.dismissalSerial=0;this.destroyed=false;this.cleanups=[];
  const listen=(target,type,callback,options)=>{target.addEventListener(type,callback,options);this.cleanups.push(()=>target.removeEventListener(type,callback,options));};
  listen(root,'click',event=>{
   if(!this.root.open)return;
   const trigger=event.target.closest('[data-super-configuration]');
   if(trigger){if(this.dismissedTriggerPointer){this.dismissedTriggerPointer=false;return;}if(!trigger.disabled){if(this.isOpen)this.close();else this.open();}return;}
   const option=event.target.closest('[data-super-option]');if(option&&this.isOpen)this.select(option);
  });
  listen(root,'keydown',event=>{
   if(!event.target.closest('[data-super-picker]'))return;
   const keys=['ArrowDown','ArrowUp','Home','End','Escape','Tab','Enter',' '];if(!keys.includes(event.key))return;this.dismissedTriggerPointer=false;this.pointerInList=false;
   if(event.key==='Tab'){if(this.isOpen)this.close({focus:true});return;}
   if(event.key==='Escape'){if(this.isOpen){event.preventDefault();event.stopPropagation();this.close({focus:true});}return;}
   if(['Enter',' '].includes(event.key)){
    const option=event.target.closest('[data-super-option]');if(option&&this.isOpen){event.preventDefault();this.select(option);}return;
   }
   event.preventDefault();
   if(!this.isOpen){this.open(event.key==='Home'?'first':event.key==='End'?'last':'selected');return;}
   const options=this.options,index=options.indexOf(document.activeElement),last=options.length-1;
   const next=event.key==='Home'?0:event.key==='End'?last:event.key==='ArrowDown'?Math.min(last,index+1):Math.max(0,index-1);
   this.focusOption(options[next]);
  });
  listen(root,'cancel',event=>{if(this.isOpen){event.preventDefault();this.close({focus:true});}});
  listen(root,'focusout',event=>{if(this.isOpen&&!this.pointerInList&&event.relatedTarget&&!this.picker?.contains(event.relatedTarget))this.close();});
  // The trigger is outside the list too. Remember its dismissing press so
  // the following native click cannot immediately open the same list again.
  listen(document,'pointerdown',event=>{
   this.dismissedTriggerPointer=false;this.pointerInList=Boolean(this.isOpen&&this.list?.contains(event.target));
   if(this.isOpen&&!this.pointerInList){
    this.dismissedTriggerPointer=Boolean(this.trigger?.contains(event.target));this.close();
   }
  },true);
  // Touch compatibility focus changes can happen after pointerup; retain
  // the inside-list flag through that sequence and clear it at click.
  listen(document,'click',event=>{if(this.isOpen&&!this.list?.contains(event.target)&&!this.trigger?.contains(event.target))this.close();this.pointerInList=false;},true);
  listen(document,'pointercancel',()=>{this.dismissedTriggerPointer=false;this.pointerInList=false;},true);
  listen(window,'blur',()=>{this.dismissedTriggerPointer=false;this.pointerInList=false;});
  listen(root,'close',()=>{this.close();this.dismissedTriggerPointer=false;this.pointerInList=false;});
 }
 get picker(){return this.root.querySelector('[data-super-picker]');}
 get trigger(){return this.picker?.querySelector('[data-super-configuration]');}
 get list(){return this.picker?.querySelector('[role="listbox"]');}
 get options(){return [...(this.list?.querySelectorAll('[data-super-option]')||[])];}
 get isOpen(){return this.trigger?.getAttribute('aria-expanded')==='true';}
 focusOption(option){option?.focus({preventScroll:true});option?.scrollIntoView({block:'nearest',inline:'nearest'});}
 open(position='selected'){
  if(this.destroyed||!this.root.open||!this.trigger||this.trigger.disabled||!this.canOpen())return;
  this.trigger.setAttribute('aria-expanded','true');this.list.hidden=false;
  this.list.scrollIntoView({block:'nearest',inline:'nearest'});
  const options=this.options;this.focusOption(position==='first'?options[0]:position==='last'?options.at(-1):options.find(o=>o.getAttribute('aria-selected')==='true')||options[0]);
 }
 close({focus=false}={}){
  if(!this.trigger)return;
  if(this.isOpen)this.dismissalSerial++;this.trigger.setAttribute('aria-expanded','false');this.list.hidden=true;
  if(focus)this.trigger.focus({preventScroll:true});
 }
 select(option){
  if(!this.isOpen||this.trigger.disabled||!this.canOpen())return;
  const value=option.dataset.superOption;if(!this.options.includes(option))return;
  const changed=this.trigger.value!==value;this.close({focus:true});if(changed)this.onSelect(value);
 }
 snapshot(){return this.isOpen?{active:document.activeElement?.dataset.superOption,serial:this.dismissalSerial}:null;}
 restore(state){if(state&&(state.serial===undefined||state.serial===this.dismissalSerial)){this.open();this.focusOption(this.options.find(o=>o.dataset.superOption===state.active));}}
 destroy(){this.close();this.destroyed=true;this.dismissedTriggerPointer=false;this.pointerInList=false;for(const stop of this.cleanups.splice(0))stop();}
}
