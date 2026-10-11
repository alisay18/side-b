import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApplication } from '../backend/server.js';
const search={query:'Deep house',sources:['beatport','traxsource'],version:'extended mix',free:false};
async function launch(dbPath){const app=createApplication({dbPath});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return {...app,url:`http://127.0.0.1:${app.server.address().port}`,stop:async()=>{await new Promise(r=>app.server.close(r));app.close();}};}
test('SQLite persists crates and history, isolates sessions, and validates writes',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'side-b-test-')),dbPath=join(directory,'test.sqlite');let app=await launch(dbPath);
 try{
 let response=await fetch(app.url+'/api/state');const cookie=response.headers.get('set-cookie').split(';')[0];assert.equal((await response.json()).crates[0].name,'My crate');
 const request=(path,method,value)=>fetch(app.url+path,{method,headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(value)});
 const track={url:'https://bandcamp.com/track/example',title:'Night drive',artist:'Example artist',status:'want',notes:'Opening set'};
 const crates=[{name:'Friday',searches:[search],tracks:[track]}];assert.equal((await request('/api/import','POST',{crates,history:[search]})).status,200);
 assert.equal((await request('/api/import','POST',{crates:[{name:'Ignore duplicate import',searches:[]}],history:[]})).status,200);
 let state=await (await fetch(app.url+'/api/state',{headers:{cookie}})).json();assert.deepEqual(state.crates,crates);assert.deepEqual(state.history,[search]);
 const stranger=await (await fetch(app.url+'/api/state')).json();assert.equal(stranger.crates[0].name,'My crate');assert.deepEqual(stranger.history,[]);
 assert.equal((await request('/api/crates','PUT',[{name:'Invalid',searches:[{...search,sources:['unknown']}]}])).status,400);
 assert.equal((await request('/api/history','PUT',Array(21).fill(search))).status,400);
 for(const bad of [{...track,url:'javascript:alert(1)'},{...track,status:'invalid'},{...track,notes:'x'.repeat(2001)}])assert.equal((await request('/api/crates','PUT',[{name:'Friday',searches:[],tracks:[bad]}])).status,400);

 assert.equal((await fetch(app.url+'/api/history',{method:'PUT',headers:{cookie,Origin:'https://unrelated.example','Content-Type':'application/json'},body:'[]'})).status,403);
 await app.stop();app=await launch(dbPath);state=await(await fetch(app.url+'/api/state',{headers:{cookie}})).json();assert.deepEqual(state.crates,crates);assert.deepEqual(state.history,[search]);
 assert.equal((await request('/api/history','PUT',[])).status,200);state=await(await fetch(app.url+'/api/state',{headers:{cookie}})).json();assert.deepEqual(state.history,[]);assert.deepEqual(state.crates,crates);
 crates[0].tracks[0]={...track,status:'owned',notes:'Bought the WAV'};
 assert.equal((await request('/api/crates','PUT',crates)).status,200);
 state=await(await fetch(app.url+'/api/state',{headers:{cookie}})).json();assert.deepEqual(state.crates,crates);
 crates[0].tracks=[];assert.equal((await request('/api/crates','PUT',crates)).status,200);
 state=await(await fetch(app.url+'/api/state',{headers:{cookie}})).json();assert.deepEqual(state.crates,crates);
 assert.equal((await request('/api/crates','PUT',[{name:'Legacy crate',searches:[search]}])).status,200);
 state=await(await fetch(app.url+'/api/state',{headers:{cookie}})).json();assert.deepEqual(state.crates[0].tracks,[]);
 assert.equal((await fetch(app.url+'/')).status,200);assert.equal((await fetch(app.url+'/backend/schema.sql')).status,404);
 }finally{await app.stop();rmSync(directory,{recursive:true,force:true});}
});
