-- Presence-Tabelle für "Wer ist online"
create table if not exists public.presence (
  username text primary key check (char_length(username) between 1 and 20),
  last_seen timestamptz not null default now()
);

alter table public.presence enable row level security;

drop policy if exists "Presence ist öffentlich lesbar" on public.presence;
create policy "Presence ist öffentlich lesbar"
on public.presence
for select
using (true);

create or replace function public.ping_presence(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_username is null or char_length(trim(p_username)) = 0 then
    raise exception 'Ungültiger Benutzername';
  end if;

  insert into public.presence (username, last_seen)
  values (trim(p_username), now())
  on conflict (username)
  do update set last_seen = now();
end;
$$;

revoke all on public.presence from anon, authenticated;
grant select on public.presence to anon, authenticated;
grant execute on function public.ping_presence(text) to anon, authenticated;

create index if not exists presence_last_seen_idx on public.presence (last_seen desc);
