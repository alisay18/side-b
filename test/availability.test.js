import test from 'node:test';
import assert from 'node:assert/strict';
import {createAvailabilityChecker,parseAvailability} from '../backend/availability.js';
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
