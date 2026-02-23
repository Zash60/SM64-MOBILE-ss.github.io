create or replace function public.is_moderator(uid text default auth.uid()::text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.moderators m
    where m.user_id = coalesce(uid, auth.uid()::text)
  );
$$;

grant execute on function public.is_moderator(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.moderators enable row level security;
alter table public.hacks enable row level security;
alter table public.categories enable row level security;
alter table public.levels enable row level security;
alter table public.variables enable row level security;
alter table public.options enable row level security;
alter table public.stars enable row level security;
alter table public.runs enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists moderators_select_own on public.moderators;
drop policy if exists moderators_manage on public.moderators;
drop policy if exists hacks_public_read on public.hacks;
drop policy if exists categories_public_read on public.categories;
drop policy if exists levels_public_read on public.levels;
drop policy if exists variables_public_read on public.variables;
drop policy if exists options_public_read on public.options;
drop policy if exists stars_public_read on public.stars;
drop policy if exists hacks_moderator_manage on public.hacks;
drop policy if exists categories_moderator_manage on public.categories;
drop policy if exists levels_moderator_manage on public.levels;
drop policy if exists variables_moderator_manage on public.variables;
drop policy if exists options_moderator_manage on public.options;
drop policy if exists stars_moderator_manage on public.stars;
drop policy if exists runs_public_read_approved on public.runs;
drop policy if exists runs_moderator_read_all on public.runs;
drop policy if exists runs_insert_anonymous_pending on public.runs;
drop policy if exists runs_insert_authenticated_pending on public.runs;
drop policy if exists runs_update_own_pending on public.runs;
drop policy if exists runs_moderator_update on public.runs;
drop policy if exists runs_moderator_delete on public.runs;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy moderators_select_own
on public.moderators
for select
to authenticated
using (user_id = auth.uid()::text or public.is_moderator());

create policy moderators_manage
on public.moderators
for all
to authenticated
using (public.is_moderator())
with check (public.is_moderator());

create policy hacks_public_read
on public.hacks
for select
to anon, authenticated
using (true);

create policy categories_public_read
on public.categories
for select
to anon, authenticated
using (true);

create policy levels_public_read
on public.levels
for select
to anon, authenticated
using (true);

create policy variables_public_read
on public.variables
for select
to anon, authenticated
using (true);

create policy options_public_read
on public.options
for select
to anon, authenticated
using (true);

create policy stars_public_read
on public.stars
for select
to anon, authenticated
using (true);

create policy hacks_moderator_manage
on public.hacks
for all
to authenticated
using (public.is_moderator())
with check (public.is_moderator());

create policy categories_moderator_manage
on public.categories
for all
to authenticated
using (public.is_moderator())
with check (public.is_moderator());

create policy levels_moderator_manage
on public.levels
for all
to authenticated
using (public.is_moderator())
with check (public.is_moderator());

create policy variables_moderator_manage
on public.variables
for all
to authenticated
using (public.is_moderator())
with check (public.is_moderator());

create policy options_moderator_manage
on public.options
for all
to authenticated
using (public.is_moderator())
with check (public.is_moderator());

create policy stars_moderator_manage
on public.stars
for all
to authenticated
using (public.is_moderator())
with check (public.is_moderator());

create policy runs_public_read_approved
on public.runs
for select
to anon, authenticated
using (status = 'approved');

create policy runs_moderator_read_all
on public.runs
for select
to authenticated
using (public.is_moderator());

create policy runs_insert_anonymous_pending
on public.runs
for insert
to anon
with check (
  status = 'pending'
  and user_id = 'anonymous'
);

create policy runs_insert_authenticated_pending
on public.runs
for insert
to authenticated
with check (
  (
    status = 'pending'
    and user_id = auth.uid()::text
  )
  or public.is_moderator()
);

create policy runs_update_own_pending
on public.runs
for update
to authenticated
using (user_id = auth.uid()::text and status = 'pending')
with check (user_id = auth.uid()::text and status = 'pending');

create policy runs_moderator_update
on public.runs
for update
to authenticated
using (public.is_moderator())
with check (public.is_moderator());

create policy runs_moderator_delete
on public.runs
for delete
to authenticated
using (public.is_moderator());
