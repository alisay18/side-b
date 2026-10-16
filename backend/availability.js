const sourceUrls = {
 bandcamp:q=>'https://bandcamp.com/search?q='+encodeURIComponent(q),
 beatport:q=>'https://www.beatport.com/search?q='+encodeURIComponent(q),
 soundcloud:q=>'https://soundcloud.com/search/sounds?q='+encodeURIComponent(q),
 traxsource:q=>'https://www.traxsource.com/search?term='+encodeURIComponent(q),
 boomkat:q=>'https://boomkat.com/search/format_download?q='+encodeURIComponent(q)+'&view=list'
};
const normal=s=>s.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function searchTarget({artist='',title=''}){
 artist=artist.trim();title=title.trim().replace(/\s+/g,' ');
 // A spaced separator is explicit artist/title notation; hyphenated names stay intact.
 if(!artist){const parts=title.split(/\s+[-–—]\s+/);if(parts.length===2&&parts.every(Boolean)){[artist,title]=parts;}}
 return {artist,title};
}
function exactTitle(name,artist,title){
 const clean=value=>{let n=normal(value),a=normal(artist);if(a)n=n.replace(new RegExp('(^| )'+a+'(?= |$)','g'),' ').trim().replace(/\s+/g,' ');return n;};
 const n=clean(name),t=clean(title);
 if(n===t)return true;
 // Treat an unlabeled original mix and a numbered URL as the same base title.
 return n.replace(/(?: [ab][12]| \d+)$/,'').replace(/ original mix$/,'').trim()===t;
}
const contains=(s,t)=>!!normal(t)&&(' '+normal(s)+' ').includes(' '+normal(t)+' ');
function permitted(id,raw){try{const u=new URL(raw);if(u.protocol!=='https:')return false;return id==='bandcamp'?u.hostname.endsWith('.bandcamp.com')&&/^\/track\//.test(u.pathname):id==='traxsource'?u.hostname==='www.traxsource.com'&&/^\/track\//.test(u.pathname):id==='beatport'?u.hostname==='www.beatport.com'&&/^\/track\//.test(u.pathname):id==='boomkat'?u.hostname==='boomkat.com'&&u.pathname.includes('/releases/'):u.hostname==='soundcloud.com'&&/^\/[^/]+\/[^/]+$/.test(u.pathname)&&!/^\/(search|tags|you|discover|getstarted)\//.test(u.pathname);}catch{return false;}}
function matchesArtistKeywords(id,url,name,slug,line,query){
 const q=normal(query);
 const artistLabels=[...line.matchAll(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g)].filter(m=>{try{const u=new URL(m[2]);return id==='soundcloud'?u.hostname==='soundcloud.com'&&u.pathname.split('/').filter(Boolean).length===1:/\/artist[s]?\//.test(u.pathname);}catch{return false;}}).map(m=>m[1]).join(' ');
 const artistText=normal(artistLabels+' '+(id==='soundcloud'?url.pathname.split('/')[1]:''));
 const compact=s=>normal(s).replace(/^the /,'').replaceAll(' ','');
 for(const raw of [name,slug]){
  const t=normal(raw).replace(/ \d+$/,'').replace(/ original mix$/,'');
  if(!t)continue;
  const hint=q.startsWith(t+' ')?q.slice(t.length+1):q.endsWith(' '+t)?q.slice(0,-t.length-1):'';
  if(hint&&artistText&&(contains(artistText,hint)||compact(artistText)===compact(hint)||compact(artistText)===('the'+compact(hint))))return true;
 }
 return false;
}
export function parseAvailability(id,text,target){
 const {artist,title}=searchTarget(target);
 const unknown={status:'unknown',reason:'The source could not be read reliably.'};
 if(!text.includes('Markdown Content:')||/Target URL returned error|Just a moment|security verification|captcha|rate limit exceeded/i.test(text))return unknown;
 const body=text.split('Markdown Content:')[1];
 const links=[...body.matchAll(/\[([^\]\n]*)\]\((https:\/\/[^\s)]+)(?:\s+"[^\n]*?")?\)/g)].filter(m=>permitted(id,m[2]));
 for(const m of body.matchAll(/\]\((https:\/\/[^\s)]+)/g)){if(permitted(id,m[1])&&!links.some(x=>x[2]===m[1])){const item=['','',m[1]];item.index=m.index;links.push(item);}}
 links.sort((a,b)=>a.index-b.index);
 for(let i=0;i<links.length;i++){const m=links[i];
   const url=new URL(m[2]),slug=decodeURIComponent(url.pathname.split('/').filter(Boolean).slice(id==='beatport'?-2:-1).join(' '));
   // Only inspect a result's own title/URL and nearby artist metadata, never the search heading.
   const next=links.slice(i+1).find(x=>x[2]!==m[2]);
   const context=body.slice(m.index,Math.min(body.length,m.index+1000,next?.index??body.length));
   const name=m[1].startsWith('!')?slug:m[1]||slug;
   const listedTrack=id==='boomkat'&&context.split('\n').some(line=>line.trim().startsWith('*')&&contains(line,artist)&&exactTitle(line.replace(/^\s*\*\s*/,''),artist,title));
   const line=body.slice(body.lastIndexOf('\n',m.index)+1,body.indexOf('\n',m.index)<0?body.length:body.indexOf('\n',m.index));
   const keywordMatch=!artist&&matchesArtistKeywords(id,url,name,slug,line,title);
   const titleMatches=exactTitle(name,artist,title)||exactTitle(slug,artist,title)||listedTrack||keywordMatch;
   const plainContext=context.replace(/\]\([^)]*\)/g,']');
   const artistMatches=!artist||contains(name,artist)||contains(slug,artist)||contains(plainContext,artist);
   const suffix=normal(name+' '+slug).replaceAll(normal(title),'');
   // A remix/edit must be requested explicitly; a different version is not an exact match.
   const otherVersion=['remix','remaster','edit','instrumental','acapella','cover','bootleg','mashup','nightcore'].some(v=>contains(suffix,v)&&!contains(title,v));
   if(titleMatches&&artistMatches&&!otherVersion){url.search='';url.hash='';return {status:'available',url:url.href,reason:'Matching track listing found. Playback, purchase and download access are not verified.'};}
 }
 if(links.length)return {status:'not_found',reason:'No exact artist/title match in checked search results. Other releases or versions may appear; this is not a full-catalog guarantee.'};
 if(/\b(?:no results|no matching|nothing found|0 results|did not match|couldn't find|could not find)\b/i.test(body))return {status:'not_found',reason:'The source returned no matching search results.'};
 return unknown;
}
export function createAvailabilityChecker({fetcher=fetch,ttl=10*60*1000}={}){
 const cache=new Map();let running=0;
 return async function check(id,target){
  target=searchTarget(target);
  if(!Object.hasOwn(sourceUrls,id))throw new Error('Invalid source');
  const key=JSON.stringify([id,normal(target.artist),normal(target.title)]),now=Date.now();
  const cached=cache.get(key);if(cached&&cached.expires>now)return cached.value;
  if(running>=5)return {status:'unknown',reason:'Checks are busy. Try again shortly.'};
  running++;
  let value;
  const attempt=async query=>{
   try{
    const response=await fetcher('https://r.jina.ai/'+sourceUrls[id](query.toLowerCase()),{signal:AbortSignal.timeout(14000),headers:{Accept:'text/plain'}});
    if(!response.ok)throw new Error('Source unavailable');
    const reader=response.body?.getReader();let text='';
    if(reader){const decoder=new TextDecoder();while(true){const {done,value:chunk}=await reader.read();if(done)break;text+=decoder.decode(chunk,{stream:true});if(text.length>500000){await reader.cancel();throw new Error('Response too large');}}}else text=await response.text();
    return parseAvailability(id,text,target);
   }catch{return {status:'unknown',reason:'The source blocked the check, timed out, or could not be read. You can still search it directly.'};}
  };
  try{
   value=await attempt((target.artist+' '+target.title).trim());
   // Broaden the source query without loosening the artist/title verification.
   if(target.artist&&value.status!=='available'){
    const fallback=await attempt(target.title);
    if(fallback.status==='available'||value.status==='unknown')value=fallback;
   }
  }finally{running--;}
  value={...value,checkedAt:new Date().toISOString()};
  if(cache.size>=200)cache.delete(cache.keys().next().value);
  cache.set(key,{expires:now+(value.status==='unknown'?30000:ttl),value});return value;
 };
}
