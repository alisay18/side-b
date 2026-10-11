PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  imported INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS crates (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS searches (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  crate_id INTEGER REFERENCES crates(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  query TEXT NOT NULL,
  sources TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '',
  free INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS crates_session ON crates(session_id, position);
CREATE INDEX IF NOT EXISTS searches_session ON searches(session_id, crate_id, position);

CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY,
  crate_id INTEGER NOT NULL REFERENCES crates(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'want' CHECK(status IN ('want','bought','owned')),
  notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS tracks_crate ON tracks(crate_id, position);
