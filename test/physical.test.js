import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalSearchLinks,shouldSuggestPhysical} from '../frontend/physical.js';
test('physical fallback requires completed negative results, never unknown or pending checks',()=>{
 assert.equal(shouldSuggestPhysical([]),false);
 assert.equal(shouldSuggestPhysical(['not_found','unknown']),false);
 assert.equal(shouldSuggestPhysical(['not_found','pending']),false);
 assert.equal(shouldSuggestPhysical(['not_found','available']),false);
 assert.equal(shouldSuggestPhysical(['not_found','not_found']),true);
});
test('physical links preserve artist, title and media selection with safely encoded queries',()=>{
 const links=physicalSearchLinks('Soul & Love','An Artist');assert.equal(links.length,4);
 for(const link of links){const url=new URL(link.url);assert.equal(url.protocol,'https:');const q=url.searchParams.get('q')||url.searchParams.get('_nkw');assert.ok(q.includes('An Artist Soul & Love'));if(link.source==='Discogs')assert.equal(url.searchParams.get('format'),link.format);else assert.ok(q.endsWith(link.format));}
});
