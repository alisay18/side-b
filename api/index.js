import {randomUUID} from 'node:crypto';
import {createClient} from '@libsql/client';
import {createAvailabilityChecker} from '../backend/availability.js';
import {sources,RequestError,validateCrates,validateHistory} from '../backend/validation.js';
const check=createAvailabilityChecker();
let client,ready;
async function database(){
 if(!process.env.TURSO_DATABASE_URL||!process.env.TURSO_AUTH_TOKEN)throw new RequestError(503,'The hosted database is not configured yet.');
 client ||= createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
 ready ||= client.execute(`CREATE TABLE IF NOT EXISTS b_side_sessions (id TEXT PRIMARY KEY, imported INTEGER NOT NULL DEFAULT 0, crates TEXT NOT NULL DEFAULT '[{"name":"My crate","searches":[],"tracks":[]}]', history TEXT NOT NULL DEFAULT '[]')`).catch(e=>{ready=null;throw e;});
 await ready;return client;
}
async function body(req){
 if(!req.headers['content-type']?.startsWith('application/json'))throw new RequestError(415,'Send JSON.');
 if(req.body!==undefined){if(Buffer.byteLength(JSON.stringify(req.body))>524288)throw new RequestError(413,'Request too large.');try{return typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{throw new RequestError(400,'Invalid JSON.');}}
 let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>524288)throw new RequestError(413,'Request too large.');}try{return JSON.parse(text);}catch{throw new RequestError(400,'Invalid JSON.');}
}
export default async function handler(req,res){
 const json=(status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try{
  const origin=req.headers.origin;if(origin&&origin!==`https://${req.headers.host}`&&origin!==`http://${req.headers.host}`)throw new RequestError(403,'Cross-origin requests are not allowed.');
  const url=new URL(req.url,'https://localhost'),route=req.query?.route||url.searchParams.get('route')||url.pathname.replace(/^\/api\//,'');
  if(route==='availability'&&req.method==='POST'){
   const input=await body(req);if(!input||!sources.has(input.source)||typeof input.title!=='string'||!input.title.trim()||input.title.length>180||typeof input.artist!=='string'||input.artist.length>180)throw new RequestError(400,'Enter a track title.');
   return json(200,await check(input.source,{title:input.title.trim(),artist:input.artist.trim()}));
  }
  const db=await database();
  const execute=(sql,args=[])=>db.execute({sql,args});
  let id=/(?:^|;\s*)side_b_session=([a-f0-9-]{36})(?:;|$)/.exec(req.headers.cookie||'')?.[1];
  let row=id?(await execute('SELECT * FROM b_side_sessions WHERE id=?',[id])).rows[0]:null;
  if(!row){id=randomUUID();await execute('INSERT INTO b_side_sessions(id) VALUES (?)',[id]);row=(await execute('SELECT * FROM b_side_sessions WHERE id=?',[id])).rows[0];res.setHeader('Set-Cookie',`side_b_session=${id}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`);}
  const state=r=>({imported:!!r.imported,crates:JSON.parse(r.crates),history:JSON.parse(r.history)});
  if(route==='state'&&req.method==='GET')return json(200,state(row));
  if(route==='import'&&req.method==='POST'){
   const input=await body(req),crates=validateCrates(input.crates),history=validateHistory(input.history);
   await execute('UPDATE b_side_sessions SET crates=?,history=?,imported=1 WHERE id=? AND imported=0',[JSON.stringify(crates),JSON.stringify(history),id]);return json(200,state((await execute('SELECT * FROM b_side_sessions WHERE id=?',[id])).rows[0]));
  }
  if(route==='crates'&&req.method==='PUT'){const value=validateCrates(await body(req));await execute('UPDATE b_side_sessions SET crates=? WHERE id=?',[JSON.stringify(value),id]);return json(200,{ok:true});}
  if(route==='history'&&req.method==='PUT'){const value=validateHistory(await body(req));await execute('UPDATE b_side_sessions SET history=? WHERE id=?',[JSON.stringify(value),id]);return json(200,{ok:true});}
  return json(404,{error:'API endpoint not found.'});
 }catch(e){return json(e.status||500,{error:e.status?e.message:'Server error.'});}
}
