# Fairway — Golf Performance Tracker

A personal golf analytics web app built with React and Node.js. Fairway lets you log full scorecards, track shot-by-shot statistics, and visualize performance trends over time.

Built as a self-directed project to develop hands-on experience with modern frontend tooling, component-based UI design, and local full-stack architecture.

---

## Features

- **Scorecard entry** — Log 18-hole rounds with per-hole score, par, and handicap
- **Shot statistics** — Track fairways hit, greens in regulation, putts, and up-and-down conversion per hole
- **Club tracking** — Record tee club and approach club on missed GIRs to analyze iron performance over time
- **Club performance dashboard** — Aggregates GIR rate by approach club across all rounds
- **Course management** — Save courses with slope rating, course rating, yardage, and per-hole par/handicap; auto-populates scorecards on round entry
- **Persistent local storage** — Data saved to a local `data.json` file via a lightweight Express backend, fully separated from application code
- **Analytics dashboard** — Scoring distribution, average score, GIR%, fairway hit%, and recent round history

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite |
| Backend | Node.js, Express |
| Data | JSON file (local persistence) |
| Styling | Inline React styles with a custom design token system |
| Fonts | Google Fonts (DM Mono) |

---

## Project Structure

```
fairway/
├── src/
│   └── App.jsx        # All React components and UI logic
├── server.js          # Express API server (read/write data.json)
├── data.json          # Persistent data store (gitignored)
├── package.json
└── vite.config.js
```

---

## Running Locally

**Prerequisites:** Node.js 20+

```bash
# Install dependencies
npm install

# Terminal 1 — start the data server
node server.js

# Terminal 2 — start the frontend
npm run dev
```

App runs at `http://localhost:5173`. Data is saved to `data.json` in the project root.

---

## What I Learned

- Building a multi-view React SPA with component composition and shared state
- Managing form state across dynamic 18-row table inputs
- Designing a simple REST API with Express for local data persistence
- Separating application code from data so the app can be updated without data loss
- Working with Vite as a modern alternative to Create React App
