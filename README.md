# Everhope Companion Demo

A mobile-first prototype for `store.everhope.care` patients to follow supplement schedules, track doses, review progress, and know when to reorder.

## Run locally

```bash
npm install
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000) and the API runs at [http://localhost:3002](http://localhost:3002).

## Structure

- `client` - React + Vite frontend
- `server` - Express API and SQLite seed data
- `server/db.js` - schema, exact product and patient seeds, adherence and refill calculations

The demo has no authentication. Selecting a patient stores their ID in `localStorage`.
