create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, 'player@example.com'), '@', 1),
      'Player'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key,
  username text not null check (length(trim(username)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.moderators (
  user_id text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.hacks (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  slug text not null unique,
  year integer,
  release_date date,
  image_url text,
  src_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key default gen_random_uuid()::text,
  hack_id text not null references public.hacks(id) on delete cascade,
  name text not null,
  type text not null check (type in ('fullgame', 'level_rta', 'level_singlestar')),
  sort_order integer not null default 999,
  src_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.levels (
  id text primary key default gen_random_uuid()::text,
  hack_id text not null references public.hacks(id) on delete cascade,
  name text not null,
  sort_order integer not null default 999,
  src_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.variables (
  id text primary key default gen_random_uuid()::text,
  hack_id text not null references public.hacks(id) on delete cascade,
  category_id text references public.categories(id) on delete set null,
  name text not null,
  sort_order integer not null default 999,
  src_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.options (
  id text primary key default gen_random_uuid()::text,
  variable_id text not null references public.variables(id) on delete cascade,
  name text not null,
  sort_order integer not null default 999,
  src_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stars (
  id text primary key default gen_random_uuid()::text,
  level_id text not null references public.levels(id) on delete cascade,
  hack_id text references public.hacks(id) on delete cascade,
  name text not null,
  sort_order integer not null default 999,
  src_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.runs (
  id text primary key default gen_random_uuid()::text,
  hack_id text not null references public.hacks(id) on delete cascade,
  category_id text not null references public.categories(id) on delete cascade,
  hack_slug text not null,
  hack_name text not null,
  category_name text not null,
  player_name text not null,
  user_id text not null,
  time_in_ms integer not null check (time_in_ms >= 0),
  date_achieved date,
  video_url text,
  variables jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'obsolete')),
  pb_key text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hacks_slug on public.hacks(slug);
create index if not exists idx_categories_hack_id on public.categories(hack_id);
create index if not exists idx_levels_hack_id on public.levels(hack_id);
create index if not exists idx_variables_hack_id on public.variables(hack_id);
create index if not exists idx_variables_category_id on public.variables(category_id);
create index if not exists idx_options_variable_id on public.options(variable_id);
create index if not exists idx_stars_level_id on public.stars(level_id);
create index if not exists idx_runs_hack_id on public.runs(hack_id);
create index if not exists idx_runs_category_id on public.runs(category_id);
create index if not exists idx_runs_status on public.runs(status);
create index if not exists idx_runs_user_id on public.runs(user_id);
create index if not exists idx_runs_submitted_at on public.runs(submitted_at desc);
create index if not exists idx_runs_pb_key on public.runs(pb_key);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_hacks_updated_at on public.hacks;
create trigger set_hacks_updated_at
before update on public.hacks
for each row execute function public.set_updated_at();

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists set_levels_updated_at on public.levels;
create trigger set_levels_updated_at
before update on public.levels
for each row execute function public.set_updated_at();

drop trigger if exists set_variables_updated_at on public.variables;
create trigger set_variables_updated_at
before update on public.variables
for each row execute function public.set_updated_at();

drop trigger if exists set_options_updated_at on public.options;
create trigger set_options_updated_at
before update on public.options
for each row execute function public.set_updated_at();

drop trigger if exists set_stars_updated_at on public.stars;
create trigger set_stars_updated_at
before update on public.stars
for each row execute function public.set_updated_at();

drop trigger if exists set_runs_updated_at on public.runs;
create trigger set_runs_updated_at
before update on public.runs
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
