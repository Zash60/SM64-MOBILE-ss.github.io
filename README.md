# SM64 Mobile Records

React + Vite site for SM64 Mobile records, using Supabase for auth and storage.

## Features

- Courses table with WR per star
- Timeline of verified runs
- Star detail page with history and video
- Run submission modal
- Moderator queue for approve/reject/edit/delete
- One-click moderator setup for courses and stars in Supabase

## Stack

- React 19
- Vite 7
- React Router
- `@supabase/supabase-js`

## Setup

1. Apply `supabase/schema.sql` and `supabase/rls.sql`.
2. Configure Supabase credentials in `public/config.js`.
3. Install dependencies: `npm install`.
4. Run local dev: `npm run dev`.
5. Build: `npm run build`.

## Notes

- Go to **Mod Queue** and click **Initialize Site** once to create the hack/category/levels/stars structure.
- GitHub Pages deploy is configured in `.github/workflows/deploy-pages.yml`.
