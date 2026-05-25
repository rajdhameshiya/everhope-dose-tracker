# everhope-dose-tracker

Everhope Companion Demo

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

## Prompt File

find the Prompt file in Docs > Conversation-log.md or just [click here](https://github.com/rajdhameshiya/everhope-dose-tracker/tree/main/docs)

## Roadmap for 4 week & 12 week

You can find it in Docs > Everhopw Roadmap.pdf (docs) or just [click here](https://github.com/rajdhameshiya/everhope-dose-tracker/tree/main/docs)


