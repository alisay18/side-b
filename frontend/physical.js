export function physicalSearchLinks(query,artist=''){
 const term=[artist.trim(),query.trim()].filter(Boolean).join(' ');
 return ['Vinyl','CD'].flatMap(format=>[
  {source:'Discogs',format,url:'https://www.discogs.com/sell/list?q='+encodeURIComponent(term)+'&format='+format},
  {source:'eBay',format,url:'https://www.ebay.com/sch/i.html?_nkw='+encodeURIComponent(term+' '+format)}
 ]);
}
export function shouldSuggestPhysical(statuses){
 return statuses.length>0&&statuses.every(status=>status==='not_found');
}
