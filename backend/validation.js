export const sources = new Set(['bandcamp', 'beatport', 'soundcloud', 'traxsource', 'boomkat']);
const versions = new Set(['', 'extended mix', 'remix', 'instrumental', 'acapella']);
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml' };
export class RequestError extends Error { constructor(status, message) { super(message); this.status = status; } }
function validateSearch(s) {
  if (!s || typeof s.query !== 'string' || !s.query.trim() || s.query.length > 180 || !Array.isArray(s.sources) || !s.sources.length || s.sources.length > 5 || s.sources.some(x => !sources.has(x)) || !versions.has(s.version || '') || (s.free !== undefined && typeof s.free !== 'boolean')) throw new RequestError(400, 'Invalid search.');
  return { query:s.query.trim(), sources:[...new Set(s.sources)], version:s.version || '', free:!!s.free };
}
function validateTrack(t) {
  let url;
  try { url = new URL(t?.url); } catch { throw new RequestError(400, 'Use a valid track URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || t.url.length > 2048 || typeof t.title !== 'string' || !t.title.trim() || t.title.length > 180 || typeof t.artist !== 'string' || t.artist.length > 180 || typeof t.notes !== 'string' || t.notes.length > 2000 || !['want','bought','owned'].includes(t.status)) throw new RequestError(400, 'Invalid track.');
  return {url:url.href,title:t.title.trim(),artist:t.artist.trim(),status:t.status,notes:t.notes};
}
export function validateCrates(input) {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw new RequestError(400, 'Use between 1 and 100 crates.');
  return input.map(c => {
    if (!c || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 60 || !Array.isArray(c.searches) || c.searches.length > 1000) throw new RequestError(400, 'Invalid crate.');
    if (c.tracks !== undefined && (!Array.isArray(c.tracks) || c.tracks.length > 1000)) throw new RequestError(400, 'Invalid tracks.');
    return { name:c.name.trim(), searches:c.searches.map(validateSearch), tracks:(c.tracks || []).map(validateTrack) };
  });
}
export function validateHistory(input) {
  if (!Array.isArray(input) || input.length > 20) throw new RequestError(400, 'History supports up to 20 searches.');
  return input.map(validateSearch);
}
