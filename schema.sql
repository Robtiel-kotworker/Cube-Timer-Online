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

-- ============================================================================
-- Admin-Funktionen
-- ----------------------------------------------------------------------------
-- Tabelle für gesperrte Benutzernamen. Ein gebannter Name kann keine neue Zeit
-- mehr einreichen, bis er (bewusst) wieder aus dieser Tabelle entfernt wird.
-- ============================================================================
create table if not exists public.banned_usernames (
  username   text primary key,
  banned_at  timestamptz not null default now()
);

alter table public.banned_usernames enable row level security;
-- Bewusst keine SELECT/INSERT/DELETE-Policies für anon/authenticated: der Zugriff
-- läuft ausschließlich über die unten stehenden SECURITY DEFINER Funktionen.
revoke all on public.banned_usernames from anon, authenticated;

-- Funktion: nimmt eine neue Zeit entgegen und speichert sie nur, wenn sie besser ist
-- als die bisherige Zeit des Nutzers (oder wenn noch kein Eintrag existiert).
-- Gebannte Benutzernamen werden abgelehnt.
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
  if exists (select 1 from public.banned_usernames where username = trim(p_username)) then
    raise exception 'Dieser Benutzername ist gesperrt';
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

-- Funktion: entfernt den eigenen Eintrag aus der Bestenliste (z. B. wenn der
-- Nutzer im Client seine lokale Bestzeit löscht). Es wird bewusst NUR anhand
-- des Benutzernamens gelöscht, ohne Admin-Schlüssel — analog zu submit_score,
-- das ebenfalls ohne echtes Auth-System nur den Benutzernamen als Identität
-- verwendet. Ein gesperrter Benutzername darf trotzdem seinen eigenen (bereits
-- vorhandenen) Eintrag entfernen.
create or replace function public.remove_own_score(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_username is null or char_length(trim(p_username)) = 0 then
    raise exception 'Ungültiger Benutzername';
  end if;

  delete from public.leaderboard where username = trim(p_username);
end;
$$;

-- Admin-Passphrase, die im Client beim Login als "Adminregelt" eingegeben wird.
-- WICHTIG: Da diese App komplett ohne Backend/echtes Auth-System läuft, ist dieser
-- Wert Teil des öffentlich einsehbaren Frontend-Codes (app.js) und dient nur als
-- einfache Hürde gegen zufällige Nutzer – kein echter Schutz gegen jemanden, der
-- gezielt den Quelltext ausliest. Das entspricht dem bewussten "kein Passwort-
-- System"-Ansatz des restlichen Projekts.
create or replace function public.admin_remove_entry(p_admin_key text, p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_admin_key is distinct from 'Adminregelt' then
    raise exception 'Nicht autorisiert';
  end if;
  delete from public.leaderboard where username = trim(p_username);
end;
$$;

create or replace function public.admin_reset_leaderboard(p_admin_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_admin_key is distinct from 'Adminregelt' then
    raise exception 'Nicht autorisiert';
  end if;
  delete from public.leaderboard;
end;
$$;

create or replace function public.admin_ban_username(p_admin_key text, p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_admin_key is distinct from 'Adminregelt' then
    raise exception 'Nicht autorisiert';
  end if;
  insert into public.banned_usernames (username) values (trim(p_username))
  on conflict (username) do nothing;
  delete from public.leaderboard where username = trim(p_username);
end;
$$;

-- Anonyme Nutzer (anon key) dürfen die Funktionen ausführen, aber nicht direkt
-- in die Tabellen schreiben oder lesen (bis auf die öffentliche Bestenliste).
revoke all on public.leaderboard from anon, authenticated;
grant select on public.leaderboard to anon, authenticated;
grant execute on function public.submit_score(text, text, integer) to anon, authenticated;
grant execute on function public.remove_own_score(text) to anon, authenticated;
grant execute on function public.admin_remove_entry(text, text) to anon, authenticated;
grant execute on function public.admin_reset_leaderboard(text) to anon, authenticated;
grant execute on function public.admin_ban_username(text, text) to anon, authenticated;

-- Index für schnelle Sortierung nach Bestzeit.
create index if not exists leaderboard_best_ms_idx on public.leaderboard (best_ms asc);
