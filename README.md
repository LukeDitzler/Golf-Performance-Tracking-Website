# ⛳ Fairway Caddie

**Powered by BGM**

A personal golf performance tracker built with React, Vite, Supabase, and Vercel. Log rounds, track stats, and analyze your game over time — with a shared course library so every player in your group benefits when someone adds a new course.

Live at: [fairway-caddie.vercel.app](https://fairway-caddie.vercel.app/)

---

## Features

### Round Logging
- Full 18-hole scorecard entry with score, tee club, fairway hit, GIR, approach club, green hit, putts, up & down, and penalty strokes
- Par 3 holes automatically mirror the tee club as the approach club
- GIR logic auto-fills green hit and up & down fields where appropriate
- Rounds saved instantly to Supabase per user account

### History
- Clickable round cards showing score, GIR%, FH%, and avg putts per hole
- Full read-only scorecard view with traditional golf scoring shapes — double circle for eagle, circle for birdie, square for bogey, double square for double bogey
- Totals row showing gross score, fairways hit, GIR, total putts, and up & downs
- Edit any past round inline

### Dashboard
- **Basic / Advanced toggle** — Basic shows all current stats; Advanced is reserved for Strokes Gained and deeper analytics (coming soon)
- **Three-axis filter bar** — filter by time window (All / 3 Months / 1 Month), state, and course; filters cascade (selecting a state scopes the course list)
- Course filter only shows courses with at least one logged round
- Summary stats: avg score vs par, GIR%, FW hit%, avg putts, up & down %
- Fairway distribution (left / hit / right)
- Scoring distribution (birdie+ / par / bogey / double+)
- Club performance by GIR%
- Scoring by par type (par 3 / 4 / 5) with avg score and outcome breakdown
- Score vs GIR comparison with per-round correlation list
- Putts by GIR (hit vs missed)
- Recent rounds

### Courses
- Shared course library — any user can add a course, all users can see and use it
- Only the creator can edit or delete their own courses
- Per-hole par, yardage, and handicap entry; total yardage and par auto-sum from hole data
- Course fields: name, state (2-letter abbreviation), course rating, slope rating

### Auth
- Email + password authentication via Supabase Auth
- Each user's rounds are private and isolated
- Courses are shared across all users
- Session persists across page refreshes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Inline styles with a consistent design token system |
| Auth | Supabase Auth (email + password) |
| Database | Supabase (Postgres) |
| API | Vercel Serverless Functions (`/api/data.js`, `/api/courses.js`) |
| Hosting | Vercel (auto-deploys on push to `main`) |

---

## Project Structure

```
fairway-caddie/
├── api/
│   ├── data.js          # Serverless function — reads/writes user rounds
│   └── courses.js       # Serverless function — shared course CRUD
├── src/
│   ├── App.jsx          # Entire frontend (single-file React app)
│   ├── main.jsx
│   └── index.css
├── index.html
├── vercel.json          # Routing config for Vercel
├── vite.config.js
└── package.json
```

---

## Local Development

### Prerequisites
- Node.js 18+
- A Supabase project with the schema below
- A Vercel account (for deployment)

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/LukeDitzler/Golf-Performance-Tracking-Website.git
   cd Golf-Performance-Tracking-Website
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create `.env.local`** in the project root:
   ```
   # Browser-safe (used by React frontend)
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key

   # Server-only (used by Vercel API routes)
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   ```

4. **Run the dev server**
   ```bash
   npm run dev
   ```
   The app runs at `http://localhost:5173`. API routes are handled by Vercel's dev server — to test them locally, use `npx vercel dev` instead.

---

## Database Schema

Run the following in **Supabase → SQL Editor**:

```sql
-- User round data (private per user)
create table golf_data (
  user_id    text primary key,
  rounds     jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table golf_data enable row level security;

create policy "Users can read own data"
  on golf_data for select using (auth.uid()::text = user_id);
create policy "Users can write own data"
  on golf_data for insert with check (auth.uid()::text = user_id);
create policy "Users can update own data"
  on golf_data for update using (auth.uid()::text = user_id);

-- Shared course library
create table courses (
  id         bigserial primary key,
  name       text not null,
  par        int,
  yardage    int,
  slope      text,
  rating     text,
  state      text,
  holes      jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table courses enable row level security;

create policy "Anyone can read courses"
  on courses for select using (true);
create policy "Logged-in users can create courses"
  on courses for insert with check (auth.uid() = created_by);
create policy "Creator can update course"
  on courses for update using (auth.uid() = created_by);
create policy "Creator can delete course"
  on courses for delete using (auth.uid() = created_by);
```

---

## Deployment

The app auto-deploys to Vercel on every push to `main`. To set up from scratch:

1. Push the repo to GitHub
2. Import the project in [vercel.com](https://vercel.com)
3. Set the following environment variables in **Vercel → Settings → Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
4. Deploy — Vercel detects Vite automatically

All future deployments happen automatically on `git push`.

---

## Roadmap

- [ ] Advanced analytics — Strokes Gained (Off the Tee, Approach, Around the Green, Putting)
- [ ] Handicap index tracking
- [ ] Round comparison view
- [ ] Mobile-optimized scorecard entry
