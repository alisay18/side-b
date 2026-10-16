import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalSearchLinks} from '../frontend/physical.js';
test('physical links preserve artist, title and media selection with safely encoded queries',()=>{
 const links=physicalSearchLinks('Soul & Love','An Artist');assert.equal(links.length,4);
 for(const link of links){const url=new URL(link.url);assert.equal(url.protocol,'https:');const q=url.searchParams.get('q')||url.searchParams.get('_nkw');assert.ok(q.includes('An Artist Soul & Love'));if(link.source==='Discogs')assert.equal(url.searchParams.get('format'),link.format);else assert.ok(q.endsWith(link.format));}
});
