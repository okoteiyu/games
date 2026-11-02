import {FACILITY_STAFF,getFacilityStaffInRoom} from './facility-staff.js';

const PERSON='<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="5" r="2.6"/><path d="M5 16v-3.5a5 5 0 0 1 10 0V16M7.5 12v5m5-5v5"/></svg>';
/** The employee list is an overlay, never an NPC inside the 3D scene. */
export class FacilityStaffUI {
 constructor({view,readStaff,readScene,canTalk,onTalk}={}){
  Object.assign(this,{view,readStaff,readScene,canTalk,onTalk});this.key=null;
  this.list=document.createElement('nav');this.list.className='facility-staff';this.list.hidden=true;this.list.setAttribute('aria-label','この部屋にいる従業員と話す');view.element.append(this.list);
  this.list.addEventListener('click',event=>{const button=event.target.closest('[data-facility-staff]');if(!button||!this.list.contains(button)||button.disabled||!this.canTalk())return;const staff=FACILITY_STAFF[button.dataset.facilityStaff];if(getFacilityStaffInRoom(this.readStaff(),this.readScene()).some(person=>person.id===staff?.id))this.onTalk(staff,button);});
 }
 refresh(){
  const scene=this.readScene(),staff=getFacilityStaffInRoom(this.readStaff(),scene),key=JSON.stringify([scene,staff.map(person=>person.id)]);
  if(key!==this.key){
   this.key=key;this.list.replaceChildren(...staff.map(person=>{
    const button=document.createElement('button');button.type='button';button.className='facility-staff__person';button.dataset.facilityStaff=person.id;
    button.innerHTML=PERSON;const label=document.createElement('span');label.textContent=person.label;button.append(label);button.setAttribute('aria-label',person.label+'と話す');return button;
   }));
  }
  this.list.hidden=!staff.length||this.view.element.dataset.conversationActive==='true';
  const blocked=!this.canTalk();for(const button of this.list.querySelectorAll('button'))button.disabled=blocked;
 }
 destroy(){this.list.remove();}
}

/** Only greeting copy is provisional; no story, reward or facility service is
 * unlocked by talking. Individual dialogue can be supplied by later events. */
export function staffGreeting(staff){
 return [{speaker:staff.label,text:staff.role==='manager'?'こんにちは。施設の管理を担当しています。':'こんにちは。今日も、おこていゆを応援しています。'}];
}
