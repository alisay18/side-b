import test from 'node:test';
import assert from 'node:assert/strict';
import {createAvailabilityChecker,parseAvailability,searchTarget} from '../backend/availability.js';
const target={artist:'Example Artist',title:'Night drive'};
const page=body=>'Title: Search\nMarkdown Content:\n'+body;
test('only the requested title and artist count; headings, related tracks and wrong versions do not',()=>{
 const result='[Night Drive](https://www.traxsource.com/track/123/night-drive-original-mix)\nOriginal Mix\n[Example Artist](https://www.traxsource.com/artist/123/example-artist)';
 assert.equal(parseAvailability('traxsource',page(result),target).status,'available');
 assert.equal(parseAvailability('traxsource',page(result.replace('Example Artist','Different Artist')),target).status,'not_found');
 assert.equal(parseAvailability('traxsource',page(result.replace('night-drive-original-mix','night-drive-someone-remix')),target).status,'not_found');
 assert.equal(parseAvailability('traxsource',page(result.replaceAll('Night Drive','Night Drive Again').replace('night-drive-original-mix','night-drive-again')),target).status,'not_found');
 assert.equal(parseAvailability('traxsource',page('# Example Artist Night Drive'),target).status,'unknown');
});
test('all five source adapters recognize track links and reject a blocked or incomplete page',()=>{
 const urls={bandcamp:'https://example.bandcamp.com/track/night-drive',beatport:'https://www.beatport.com/track/night-drive/123',soundcloud:'https://soundcloud.com/example-artist/night-drive',traxsource:'https://www.traxsource.com/track/123/night-drive',boomkat:'https://boomkat.com/artists/example-artist/releases/123/night-drive'};
 for(const [id,url] of Object.entries(urls)){
 assert.equal(parseAvailability(id,page(`[Night Drive](${url})\nExample Artist`),target).status,'available',id);
 assert.equal(parseAvailability(id,page('No results found'),target).status,'not_found',id);
 assert.equal(parseAvailability(id,page('Just a moment: security verification'),target).status,'unknown',id);
 }
});
test('transport failures remain unknown, and successful checks are cached',async()=>{
 let calls=0;
 const checker=createAvailabilityChecker({fetcher:async()=>{calls++;return new Response(page('[Night Drive](https://example.bandcamp.com/track/night-drive)\nExample Artist'));}});
 assert.equal((await checker('bandcamp',target)).status,'available');await checker('bandcamp',target);assert.equal(calls,1);
 const failed=createAvailabilityChecker({fetcher:async()=>new Response('Forbidden',{status:403})});assert.equal((await failed('bandcamp',target)).status,'unknown');
});

test('title-only searches match the title but reject longer titles',()=>{
 const target={artist:'',title:'zz paname'};
 assert.equal(parseAvailability('bandcamp',page('[ZZ Paname](https://dko.bandcamp.com/track/zz-paname)'),target).status,'available');
 assert.equal(parseAvailability('bandcamp',page('[ZZ Paname Again](https://dko.bandcamp.com/track/zz-paname-again)'),target).status,'not_found');
});

test('case, accents, punctuation, spaces and explicit artist/title notation are flexible',()=>{
 const body=page('[ZZ Paname](https://dko.bandcamp.com/track/zz-paname)\nMézigue');
 for(const target of [{title:'zz paname',artist:''},{title:'  ZZ   PANAME! ',artist:''},{title:'Mezigue - ZZ Paname',artist:''},{title:'MÉZIGUE — zz paname',artist:''},{title:'Mezigue - ZZ Paname',artist:'Mezigue'}])assert.equal(parseAvailability('bandcamp',body,target).status,'available');
 assert.deepEqual(searchTarget({title:'DJ-test',artist:''}),{title:'DJ-test',artist:''});
});
test('a requested mix stays distinct and positive result counts are not empty results',()=>{
 const body=page('[Night Drive](https://www.traxsource.com/track/123/night-drive-dub-mix)\nExample Artist');
 assert.equal(parseAvailability('traxsource',body,{artist:'Example Artist',title:'Night Drive Dub Mix'}).status,'available');
 assert.equal(parseAvailability('bandcamp',page('10 results'),{artist:'',title:'Missing'}).status,'unknown');
 assert.equal(parseAvailability('bandcamp',page('0 results'),{artist:'',title:'Missing'}).status,'not_found');
});

test('artist searches retry a title-only query without accepting a different artist',async()=>{
 const urls=[];const checker=createAvailabilityChecker({fetcher:async url=>{urls.push(url);return new Response(urls.length===1?page('Just a moment: security verification'):page('[Night Drive](https://example.bandcamp.com/track/night-drive)\nExample Artist'));}});
 assert.equal((await checker('bandcamp',target)).status,'available');assert.equal(urls.length,2);assert.ok(urls[1].endsWith('q=night%20drive'));
});

test('Bandcamp numbered original-mix URLs match the base title',()=>{
 const body=page('* [![Image 2](https://f4.bcbits.com/cover.jpg)](https://anjunadeep.bandcamp.com/track/deep-in-my-soul-original-mix-1)TRACK\nfrom Deep In My Soul EP by 16BL');
 assert.equal(parseAvailability('bandcamp',body,{title:'16BL - Deep In My Soul',artist:''}).status,'available');
});
