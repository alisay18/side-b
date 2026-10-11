import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = new Set(['bandcamp', 'beatport', 'soundcloud', 'traxsource', 'boomkat']);
const versions = new Set(['', 'extended mix', 'remix', 'instrumental', 'acapella']);
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml' };
class RequestError extends Error { constructor(status, message) { super(message); this.status = status; } }
function validateSearch(s) {
  if (!s || typeof s.query !== 'string' || !s.query.trim() || s.query.length > 180 || !Array.isArray(s.sources) || !s.sources.length || s.sources.length > 5 || s.sources.some(x => !sources.has(x)) || !versions.has(s.version || '') || (s.free !== undefined && typeof s.free !== 'boolean')) throw new RequestError(400, 'Invalid search.');
  return { query:s.query.trim(), sources:[...new Set(s.sources)], version:s.version || '', free:!!s.free };
}
function validateCrates(input) {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw new RequestError(400, 'Use between 1 and 100 crates.');
  return input.map(c => {
    if (!c || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 60 || !Array.isArray(c.searches) || c.searches.length > 1000) throw new RequestError(400, 'Invalid crate.');
    return { name:c.name.trim(), searches:c.searches.map(validateSearch) };
  });
}
function validateHistory(input) {
  if (!Array.isArray(input) || input.length > 20) throw new RequestError(400, 'History supports up to 20 searches.');
  return input.map(validateSearch);
}
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new RequestError(415, 'Send JSON.');
  let data = '';
  for await (const chunk of req) { data += chunk; if (Buffer.byteLength(data) > 512 * 1024) throw new RequestError(413, 'Request is too large.'); }
  try { return JSON.parse(data); } catch { throw new RequestError(400, 'Invalid JSON.'); }
}
export function createApplication({ dbPath = resolve(root, 'data/side-b.sqlite') } = {}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive:true });
  const db = new DatabaseSync(dbPath);
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  db.exec('PRAGMA journal_mode=WAL;');
  const insertSearch = db.prepare('INSERT INTO searches(session_id,crate_id,position,query,sources,version,free) VALUES (?,?,?,?,?,?,?)');
  function transaction(fn) { db.exec('BEGIN'); try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } }
  function saveCrates(id, crates) {
    db.prepare('DELETE FROM crates WHERE session_id=?').run(id);
    crates.forEach((c,i) => {
      const result = db.prepare('INSERT INTO crates(session_id,position,name) VALUES (?,?,?)').run(id,i,c.name);
      c.searches.forEach((s,j) => insertSearch.run(id,result.lastInsertRowid,j,s.query,JSON.stringify(s.sources),s.version,Number(s.free)));
    });
  }
  function saveHistory(id, history) {
    db.prepare('DELETE FROM searches WHERE session_id=? AND crate_id IS NULL').run(id);
    history.forEach((s,i) => insertSearch.run(id,null,i,s.query,JSON.stringify(s.sources),s.version,Number(s.free)));
  }
  const decode = s => ({ query:s.query, sources:JSON.parse(s.sources), version:s.version, free:!!s.free });
  function state(id) {
    return {
      imported:!!db.prepare('SELECT imported FROM sessions WHERE id=?').get(id).imported,
      crates:db.prepare('SELECT id,name FROM crates WHERE session_id=? ORDER BY position').all(id).map(c => ({ name:c.name, searches:db.prepare('SELECT * FROM searches WHERE session_id=? AND crate_id=? ORDER BY position').all(id,c.id).map(decode) })),
      history:db.prepare('SELECT * FROM searches WHERE session_id=? AND crate_id IS NULL ORDER BY position').all(id).map(decode)
    };
  }
  const server = createServer(async (req,res) => {
    const json = (status,value) => { res.writeHead(status, {'Content-Type':'application/json', 'Cache-Control':'no-store'}); res.end(JSON.stringify(value)); };
    res.setHeader('X-Content-Type-Options','nosniff');
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) throw new RequestError(403,'Cross-origin requests are not allowed.');
        let id = /(?:^|;\s*)side_b_session=([a-f0-9-]{36})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
        if (!id || !db.prepare('SELECT id FROM sessions WHERE id=?').get(id)) {
          id=randomUUID();
          db.prepare('INSERT INTO sessions(id) VALUES (?)').run(id);
          saveCrates(id,[{name:'My crate',searches:[]}]);
          res.setHeader('Set-Cookie', `side_b_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`);
        }
        if (req.method === 'GET' && url.pathname === '/api/state') return json(200,state(id));
        if (req.method === 'POST' && url.pathname === '/api/import') {
          const input = await body(req), crates=validateCrates(input.crates), history=validateHistory(input.history);
          transaction(() => {
            if (!state(id).imported) { saveCrates(id,crates); saveHistory(id,history); db.prepare('UPDATE sessions SET imported=1 WHERE id=?').run(id); }
          });
          return json(200,state(id));
        }
        if (req.method === 'PUT' && url.pathname === '/api/crates') { const value=validateCrates(await body(req));transaction(()=>saveCrates(id,value));return json(200,{ok:true}); }
        if (req.method === 'PUT' && url.pathname === '/api/history') { const value=validateHistory(await body(req));transaction(()=>saveHistory(id,value));return json(200,{ok:true}); }
        return json(404,{error:'API endpoint not found.'});
      }
      if (!['GET','HEAD'].includes(req.method)) throw new RequestError(405,'Method not allowed.');
      const frontend=resolve(root,'frontend'), path=resolve(frontend,'.'+decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!path.startsWith(frontend+sep) || !mime[extname(path)]) throw new RequestError(404,'File not found.');
      const data=await readFile(path);
      res.writeHead(200,{'Content-Type':mime[extname(path)], 'Cache-Control':'no-cache'});res.end(req.method === 'HEAD' ? undefined : data);
    } catch(e) { const status=e.status || (e.code === 'ENOENT' ? 404 : 500);if(status===500)console.error('Request failed:',e.message);json(status,{error:status===500?'Server error.':e.message}); }
  });
  return {server, close:()=>db.close()};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {server}=createApplication({dbPath:process.env.DB_PATH ? resolve(process.env.DB_PATH) : undefined});
  const port=Number(process.env.PORT || 4175), host=process.env.HOST || '127.0.0.1';
  server.listen(port,host,()=>console.log(`Side B: http://${host}:${server.address().port}`));
}
