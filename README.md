# Side B

A simple music search workspace for DJs. Search Bandcamp, Beatport, SoundCloud, Traxsource, and Boomkat; select mix-version keywords; save searches and individual track links into named crates; and revisit recent searches.

## Run locally

Requires Node.js 22.13 or newer, with built-in `node:sqlite` support. There are no external package dependencies.

```sh
npm start
```

Open http://127.0.0.1:4175. The frontend and API run on the same server.

```sh
npm run check
npm test
```

Optional environment variables: `PORT`, `HOST`, `DB_PATH` (defaults to `data/side-b.sqlite`). The `.env.example` file documents these; `.env` files are not loaded automatically.

## Project layout

- `frontend/`: HTML, CSS, JavaScript, and bundled source logos.
- `backend/server.js`: Node HTTP server, validation, API, and SQLite persistence.
- `backend/schema.sql`: SQL tables and indexes for browser sessions, crates, searches, and tracks.
- `test/`: API tests, including persistence across a server restart.

## Storage

Crates, individual tracks, and the most recent 20 searches are stored in SQLite. Track entries include a URL, title, optional artist, Want/Bought/Owned status, and optional notes. Tracks can be edited or removed; status can be changed directly in the crate. Titles and artists are entered manually; links are not scraped. Existing databases gain the tracks table automatically on startup without changing saved searches. An HTTP-only browser cookie selects the browser's records. On the first visit, any existing Side B browser storage on the same origin is imported once. Changing ports creates a different localStorage origin; use the previous port for migration. Clearing cookies starts a new session. There are no user accounts or cross-device syncing yet.

Writes are transactional and validated; database files are excluded from Git. Multiple tabs use last-write-wins for each collection. Back up the database before moving or deleting it.

This is a local MVP, bound to loopback by default. Add authenticated accounts, HTTPS, and production deployment controls before exposing it publicly. Node 22 labels its SQLite module experimental.

## API

- `GET /api/state`: crates, history, and browser-import status.
- `POST /api/import`: imports browser data once per session.
- `PUT /api/crates`: replaces this browser session's crates.
- `PUT /api/history`: replaces this browser session's recent searches.

The app opens external store search pages. It does not fetch live catalog listings, verify mix versions/free downloads, compare prices, or complete purchases. SoundCloud remains a discovery source.

## Logos

Bandcamp, Beatport, and SoundCloud icons are from Simple Icons. Traxsource and Boomkat assets come from their websites. Logos belong to their respective owners; Side B is not affiliated with these services.
