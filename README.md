# SM64 Hack Roms Speedrun Mobile

React + Vite leaderboard app for SM64 hack speedruns, using Supabase for auth and data.

## Features

- Home dashboard with hack catalog and recent activity
- Hack detail page with leaderboard filters
- Run submission modal
- User profile with PB and WR stats
- Moderator panel for run review and hack creation
- Supabase auth (register, login, logout)

## Stack

- React 19
- Vite 7
- React Router
- `@supabase/supabase-js`

## Setup

1. Prepare Supabase backend (schema, auth, RLS policies).
2. Run SQL files in `supabase/schema.sql` and `supabase/rls.sql`.
3. Configure Supabase credentials:
   - Option A (runtime config): edit `public/config.js` (or copy `public/config.example.js`)
   - Option B: use `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - Optional: set moderator fallback with `window.MODERATOR_USER_ID` or `VITE_MODERATOR_USER_ID`
4. Install dependencies:
   - `npm install`
5. Start development:
   - `npm run dev`
6. Build production bundle:
   - `npm run build`

## Deploy

- A workflow at `.github/workflows/deploy-pages.yml` builds and deploys `dist` to GitHub Pages on every push to `main`.
- In repository settings, set Pages source to **GitHub Actions** if it is not already enabled.

## Project Structure

- `src/App.jsx`: app shell and route wiring
- `src/pages/`: Home, Hack, Profile, Moderator pages
- `src/components/`: modal and shared UI components
- `src/context/`: auth and toast providers
- `src/lib/`: Supabase client and utility mappers
- `supabase/`: SQL schema and policies
