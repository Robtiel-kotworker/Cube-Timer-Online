-- ============================================================================
-- Cube Timer – Supabase Schema
-- Kopiere den GESAMTEN Inhalt dieser Datei in den Supabase SQL-Editor
-- (Projekt → SQL Editor → New query → Run). Funktioniert vollständig im
-- Browser, es ist kein Computer und kein Terminal nötig.
-- ============================================================================

-- Tabelle für die öffentliche, dauerhafte Top-10-Bestenliste.
-- Pro Benutzername existiert genau ein Eintrag: die persönliche Bestzeit.
create table if not exists public.leaderboard (
  username    text primary key check (char_length(username) between 1 and 20),
  name_style  text not null default 'ice',
  best_ms     integer not null check (best_ms > 0),
  updated_at  timestamptz not null default now()
);

-- Row Level Security aktivieren.
alter table public.leaderboard enable row level security;

-- Jeder (auch nicht eingeloggte Besucher) darf die Bestenliste lesen.
drop policy if exists "Bestenliste ist öffentlich lesbar" on public.leaderboard;
create policy "Bestenliste ist öffentlich lesbar"
  on public.leaderboard
  for select
  using (true);

-- Direktes Schreiben über die Tabelle ist NICHT erlaubt – ausschließlich über die
-- untenstehende RPC-Funktion, die serverseitig prüft, ob die neue Zeit besser ist.
-- (Es gibt bewusst kein Passwort/Auth-System — daher schützt die Funktion die Integrität der Daten.)

-- Funktion: nimmt eine neue Zeit entgegen und speichert sie nur, wenn sie besser ist
-- als die bisherige Zeit des Nutzers (oder wenn noch kein Eintrag existiert).
create or replace function public.submit_score(
  p_username text,
  p_style text,
  p_ms integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_username is null or char_length(trim(p_username)) = 0 then
    raise exception 'Ungültiger Benutzername';
  end if;
  if p_ms is null or p_ms <= 0 then
    raise exception 'Ungültige Zeit';
  end if;

  insert into public.leaderboard (username, name_style, best_ms, updated_at)
  values (trim(p_username), coalesce(p_style, 'ice'), p_ms, now())
  on conflict (username)
  do update set
    best_ms = excluded.best_ms,
    name_style = excluded.name_style,
    updated_at = now()
  where public.leaderboard.best_ms > excluded.best_ms;
end;
$$;

-- Anonyme Nutzer (anon key) dürfen die Funktion ausführen, aber nicht direkt in die Tabelle schreiben.
revoke all on public.leaderboard from anon, authenticated;
grant select on public.leaderboard to anon, authenticated;
grant execute on function public.submit_score(text, text, integer) to anon, authenticated;

-- Index für schnelle Sortierung nach Bestzeit.
create index if not exists leaderboard_best_ms_idx on public.leaderboard (best_ms asc);
