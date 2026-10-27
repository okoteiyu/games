for(const list of document.querySelectorAll('[role="tablist"]')){
 const tabs=[...list.querySelectorAll('[role="tab"]')];
 const choose=(tab,focus=false)=>{for(const button of tabs){const active=button===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;document.getElementById(button.getAttribute('aria-controls')).hidden=!active;}if(focus)tab.focus();history.replaceState(null,'','#'+tab.id.slice(4));};
 for(const tab of tabs){tab.addEventListener('click',()=>choose(tab));tab.addEventListener('keydown',event=>{let i=tabs.indexOf(tab);if(event.key==='ArrowRight')i=(i+1)%tabs.length;else if(event.key==='ArrowLeft')i=(i-1+tabs.length)%tabs.length;else if(event.key==='Home')i=0;else if(event.key==='End')i=tabs.length-1;else return;event.preventDefault();choose(tabs[i],true);});}
 const applyHash=()=>{const match=tabs.find(tab=>tab.id.slice(4)===location.hash.slice(1));if(match)choose(match);};applyHash();window.addEventListener('hashchange',applyHash);
}
