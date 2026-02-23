#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Error: SUPABASE_DB_URL is required."
  echo "Use the Postgres connection string from Supabase > Project Settings > Database."
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql was not found. Install PostgreSQL client tools and retry."
  exit 1
fi

echo "Applying schema..."
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/supabase/schema.sql"

echo "Applying RLS policies..."
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/supabase/rls.sql"

if [ -n "${MODERATOR_USER_ID:-}" ]; then
  echo "Ensuring moderator user exists..."
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "insert into public.moderators (user_id) values ('${MODERATOR_USER_ID}') on conflict (user_id) do nothing;"
fi

if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_ANON_KEY:-}" ]; then
  echo "Writing config.js files..."
  mkdir -p "$ROOT_DIR/public"
  cat > "$ROOT_DIR/config.js" <<CFG
window.SUPABASE_URL = "${SUPABASE_URL}";
window.SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}";
${MODERATOR_USER_ID:+window.MODERATOR_USER_ID = "${MODERATOR_USER_ID}";}
CFG
  cat > "$ROOT_DIR/public/config.js" <<CFG
window.SUPABASE_URL = "${SUPABASE_URL}";
window.SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}";
${MODERATOR_USER_ID:+window.MODERATOR_USER_ID = "${MODERATOR_USER_ID}";}
CFG
fi

echo "Supabase setup finished."
