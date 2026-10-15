import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import handler from '../api/index.js';
test('Vercel API persists SQL records, isolates sessions, and validates writes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'b-side-hosted-'));process.env.TURSO_DATABASE_URL='file:'+join(dir,'database.sqlite');process.env.TURSO_AUTH_TOKEN='test-only';
 const server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{
 let response=await fetch(url+'/api/state');assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0];assert.ok(response.headers.get('set-cookie').includes('Secure'));assert.equal((await response.json()).crates[0].name,'My crate');
 const request=(path,method,value)=>fetch(url+'/api/'+path,{method,headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(value)});
 const crates=[{name:'Friday',searches:[],tracks:[{title:'Track',artist:'Artist',url:'https://example.com/track',status:'want',notes:'Warm up'}]}];
 assert.equal((await request('import','POST',{crates,history:[]})).status,200);
 assert.equal((await request('import','POST',{crates:[{name:'Ignored',searches:[]}],history:[]})).status,200);
 assert.deepEqual((await(await fetch(url+'/api/state',{headers:{cookie}})).json()).crates,crates);
 assert.equal((await(await fetch(url+'/api/state')).json()).crates[0].name,'My crate');
 crates[0].tracks[0].status='owned';assert.equal((await request('crates','PUT',crates)).status,200);
 assert.equal((await request('crates','PUT',[])).status,400);
 assert.deepEqual((await(await fetch(url+'/api/state',{headers:{cookie}})).json()).crates,crates);
 assert.equal((await fetch(url+'/api/history',{method:'PUT',headers:{cookie,Origin:'https://unrelated.example','Content-Type':'application/json'},body:'[]'})).status,403);
 }finally{await new Promise(r=>server.close(r));delete process.env.TURSO_DATABASE_URL;delete process.env.TURSO_AUTH_TOKEN;rmSync(dir,{recursive:true,force:true});}
});
