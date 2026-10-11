async function main(){
const $ = s => document.querySelector(s);
const definitions = {
 bandcamp:{name:'Bandcamp',url:q=>'https://bandcamp.com/search?q='+encodeURIComponent(q)},
 beatport:{name:'Beatport',url:q=>'https://www.beatport.com/search?q='+encodeURIComponent(q)},
 soundcloud:{name:'SoundCloud',url:q=>'https://soundcloud.com/search/sounds?q='+encodeURIComponent(q)},
 traxsource:{name:'Traxsource',url:q=>'https://www.traxsource.com/search?term='+encodeURIComponent(q)},
 boomkat:{name:'Boomkat',url:q=>'https://boomkat.com/search/format_download?q='+encodeURIComponent(q)+'&view=list'}
};
const versions={'':'Any version','extended mix':'Extended mix',remix:'Remix',instrumental:'Instrumental',acapella:'Acapella'};
let crates=[{name:'My crate',searches:[]}],active=0,current=null;
const validSearch=x=>x&&typeof x.query==='string'&&Array.isArray(x.sources);
try {
 const stored=JSON.parse(localStorage.getItem('side-b-crates')||'null');
 if(Array.isArray(stored)&&stored.length){crates=stored.filter(c=>c&&typeof c.name==='string'&&Array.isArray(c.searches)).map(c=>({name:c.name,searches:c.searches.filter(validSearch)}));}
 else {const old=JSON.parse(localStorage.getItem('needle-crate')||'[]');if(Array.isArray(old))crates[0].searches=old.filter(validSearch);}
 if(!crates.length)crates=[{name:'My crate',searches:[]}];
} catch {}
function node(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
function key(x){return JSON.stringify([x.query.toLowerCase(),[...x.sources].sort(),!!x.free,x.version||'']);}
function persist(){queueWrite('/api/crates',crates);updateCount();}
function updateCount(){$('#count').textContent=crates.reduce((sum,c)=>sum+c.searches.length,0);}
function refreshCrateSelect(){const select=$('#crateSelect');select.replaceChildren();crates.forEach((c,i)=>{const option=node('option',c.name+' ('+c.searches.length+')');option.value=i;select.append(option);});select.value=active;}
function updateSave(){const b=$('#saveSearch');if(b)b.textContent=crates[active].searches.some(x=>key(x)===key(current))?'Saved ✓':'＋ Save to '+crates[active].name;}
function save(){if(!current)return;const list=crates[active].searches;if(!list.some(x=>key(x)===key(current)))list.unshift({...current,sources:[...current.sources]});persist();refreshCrateSelect();updateSave();if(!$('#crate').hidden)showCrate();}
let recent=[];
try{const stored=JSON.parse(localStorage.getItem('side-b-history')||'[]');if(Array.isArray(stored))recent=stored.filter(validSearch).slice(0,20);}catch{}
const loaded=await request('/api/state');
const initial=loaded.imported?loaded:await request('/api/import','POST',{crates,history:recent});
crates=initial.crates;recent=initial.history;
$('#dataStatus').textContent='';$('#storageStatus').textContent='Saved to the database for this browser.';
let writeQueue=Promise.resolve(),failed=false;
function queueWrite(path,value){const snapshot=JSON.parse(JSON.stringify(value));writeQueue=writeQueue.then(async()=>{try{await request(path,'PUT',snapshot);if(!failed)$('#dataStatus').textContent='';}catch(e){failed=true;$('#dataStatus').textContent='Changes could not be saved. Keep this tab open and retry.';$('#retrySave').hidden=false;}});}
$('#retrySave').onclick=async()=>{await writeQueue;try{await request('/api/crates','PUT',crates);await request('/api/history','PUT',recent);failed=false;$('#dataStatus').textContent='Saved.';$('#retrySave').hidden=true;}catch{$('#dataStatus').textContent='Still unable to save. Check that the server is running.';}};
const historySection=node('section',null,'search-history');historySection.id='history';
const historyHead=node('div',null,'history-head'),clearHistory=node('button','Clear history','remove'),historyList=node('div');historyList.id='historyList';historyHead.append(node('h2','Recent searches'),clearHistory);historySection.append(historyHead,historyList);$('#results').before(historySection);
function renderHistory(){historyList.replaceChildren();historySection.hidden=!recent.length;recent.forEach((s,i)=>{const row=node('div',null,'history-row'),open=node('button',null,'history-search');open.append(node('span',s.query),node('small',[versions[s.version||'']||'Any version',s.free?'Free-download keywords':'',s.sources.filter(id=>definitions[id]).map(id=>definitions[id].name).join(', ')].filter(Boolean).join(' · ')));open.onclick=()=>{$('#query').value=s.query;$('#version').value=Object.hasOwn(versions,s.version||'')?s.version||'':'';$('#freeOnly').checked=!!s.free;document.querySelectorAll('[name=source]').forEach(c=>c.checked=s.sources.includes(c.value));run();};const remove=node('button','×','history-remove');remove.setAttribute('aria-label','Remove recent search for '+s.query);remove.onclick=()=>{recent.splice(i,1);persistHistory();};row.append(open,remove);historyList.append(row);});}
function persistHistory(){queueWrite('/api/history',recent);renderHistory();}
clearHistory.onclick=()=>{recent=[];persistHistory();$('#query').focus();};renderHistory();
function run(){
 const q=$('#query').value.trim(),out=$('#results');if(!q){$('#query').focus();return;}
 const sources=[...document.querySelectorAll('[name=source]:checked')].map(x=>x.value);out.replaceChildren();current=null;
 if(!sources.length){out.append(node('p','Choose at least one source to search.','result-note'));return;}
 const free=$('#freeOnly').checked,version=$('#version').value;current={query:q,sources,free,version};recent=recent.filter(s=>key(s)!==key(current));recent.unshift({...current,sources:[...sources]});recent=recent.slice(0,20);persistHistory();
 const search=q+(version&&!q.toLowerCase().includes(version)?' '+version:'');
 $('#discovery').hidden=true;
 const head=node('div',null,'result-head');head.append(node('h3','Search links for “'+q+'”'));
 const controls=node('div',null,'save-controls'),label=node('label','Crate');label.htmlFor='crateSelect';const select=node('select');select.id='crateSelect';select.onchange=()=>{active=Number(select.value);updateSave();if(!$('#crate').hidden)showCrate();};
 const saveButton=node('button',null,'save');saveButton.id='saveSearch';saveButton.onclick=save;
 controls.append(label,select,saveButton);head.append(controls);out.append(head);refreshCrateSelect();updateSave();
 const cards=node('div',null,'store-results');
 sources.forEach(id=>{const d=definitions[id],card=node('article',null,'store-result'),heading=node('h4',null,'source-heading'),logo=node('img');logo.src='logos/'+id+'.svg';logo.alt='';logo.width=25;logo.height=25;heading.append(logo,node('span',d.name));card.append(heading,node('p',search,'search-term'));
 let term=search;if(free&&['bandcamp','soundcloud'].includes(id))term+=' free download';
 const link=node('a','View tracks on '+d.name+' ↗','store-link');link.href=d.url(term);link.target='_blank';link.rel='noopener noreferrer';card.append(link,node('small','Opens '+d.name+' in a new tab','link-hint'));cards.append(card);});
 out.append(cards,node('p',(version?'Version shortcuts add words to your search; check the mix on the source. ':'')+(free?'Free-download keywords apply to Bandcamp and SoundCloud only; availability is confirmed on the source.':'Availability and pricing are confirmed on each source.'),'result-note'));
 history.replaceState(null,'','#dig');
}
$('#searchForm').onsubmit=e=>{e.preventDefault();run();};
$('#version').onchange=()=>{if(current)run();};
document.querySelectorAll('[data-term]').forEach(b=>b.onclick=()=>{$('#query').value=b.dataset.term;run();});
function showCrate(){
 const tabs=$('#crateTabs'),list=$('#crateList');tabs.replaceChildren();list.replaceChildren();
 crates.forEach((c,i)=>{const b=node('button',c.name+' ('+c.searches.length+')','crate-tab');b.setAttribute('aria-pressed',i===active);b.onclick=()=>{active=i;showCrate();if(current){refreshCrateSelect();updateSave();}};tabs.append(b);});
 if(!crates[active].searches.length)list.append(node('p','No saved searches in this crate yet. Search above, then save here.','crate-note'));
 crates[active].searches.forEach((s,i)=>{const row=node('div',null,'crate-item'),details=node('div'),open=node('button',s.query,'saved-query');open.onclick=()=>{$('#query').value=s.query;$('#version').value=s.version||'';$('#freeOnly').checked=!!s.free;document.querySelectorAll('[name=source]').forEach(c=>c.checked=s.sources.includes(c.value));run();$('#dig').scrollIntoView({behavior:'smooth'});};
 details.append(open,node('p',[versions[s.version||''],s.free?'Free-download keywords':'',s.sources.filter(id=>definitions[id]).map(id=>definitions[id].name).join(', ')].filter(Boolean).join(' · '),'crate-note'));
 const remove=node('button','Remove','remove');remove.setAttribute('aria-label','Remove saved search for '+s.query);remove.onclick=()=>{crates[active].searches.splice(i,1);persist();showCrate();if(current){refreshCrateSelect();updateSave();}};row.append(details,remove);list.append(row);});
 $('#crate').hidden=false;
}
$('#newCrateForm').onsubmit=e=>{e.preventDefault();const input=$('#crateName'),name=input.value.trim(),status=$('#crateStatus');if(!name)return;const existing=crates.findIndex(c=>c.name.toLowerCase()===name.toLowerCase());if(existing>=0){active=existing;status.textContent='Opened existing crate.';}else{crates.push({name,searches:[]});active=crates.length-1;persist();status.textContent='Created '+name+'.';}input.value='';showCrate();if(current){refreshCrateSelect();updateSave();}};
$('#savedButton').onclick=()=>{showCrate();$('#crate').scrollIntoView({behavior:'smooth'});};
$('#closeCrate').onclick=()=>{$('#crate').hidden=true;$('#savedButton').focus();};
updateCount();

}
async function request(path,method="GET",value){const res=await fetch(path,{method,headers:value===undefined?{}:{"Content-Type":"application/json"},body:value===undefined?undefined:JSON.stringify(value)});const data=await res.json();if(!res.ok)throw new Error(data.error||"Request failed");return data;}
main().catch(()=>{document.querySelector("#dataStatus").textContent="Unable to connect to the database. Restart the server and reload this page.";});
