-- Schéma initial d'Open Eleven.
--
-- Repris du projet Supabase d'origine : mêmes tables, mêmes colonnes, mêmes
-- fonctions. Ce qui change :
--   • les comptes vivent ici (users, sessions, email_tokens) au lieu du schéma
--     auth de Supabase ;
--   • l'utilisateur courant n'est plus lu dans un jeton : le serveur l'annonce
--     à chaque transaction (réglage app.user_id), et les fonctions le lisent
--     par app_user_id() ;
--   • plus de règles RLS : le serveur est le seul client de la base, c'est lui
--     qui vérifie qui a le droit de lire quoi.

set check_function_bodies = off;

-- --- Comptes -----------------------------------------------------------------

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index users_email_lower on users (lower(email));

-- Le jeton lui-même n'est jamais stocké : seulement son empreinte.
create table sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  -- Ouverte par un lien « mot de passe oublié » : autorise à choisir un
  -- nouveau mot de passe sans redonner l'ancien.
  recovery boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index sessions_user on sessions (user_id);

create table email_tokens (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('confirm', 'recovery')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Qui agit dans la transaction en cours (null hors connexion).
create function app_user_id() returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

-- --- Tables du jeu -----------------------------------------------------------

create table daily_scores (
  user_id uuid not null,
  date text not null,
  score integer not null,
  choices jsonb,
  pseudo text,
  created_at timestamp with time zone not null default now()
);

create table duels (
  id uuid not null default gen_random_uuid(),
  seed bigint not null,
  from_user uuid not null,
  from_pseudo text not null,
  from_label text,
  from_choices jsonb not null,
  from_score integer not null,
  to_pseudo text not null,
  to_user uuid,
  to_label text,
  to_choices jsonb,
  to_score integer,
  winner text,
  status text not null default 'pending'::text,
  created_at timestamp with time zone not null default now(),
  answered_at timestamp with time zone
);

create table friends (
  user_id uuid not null,
  friend_id uuid not null,
  friend_pseudo text,
  created_at timestamp with time zone not null default now(),
  status text not null default 'pending'::text
);

create table profiles (
  user_id uuid not null,
  pseudo text not null,
  created_at timestamp with time zone not null default now(),
  stats jsonb
);

create table rate_limits (
  user_id uuid not null,
  bucket text not null,
  day text not null,
  count integer not null default 0,
  last_at timestamp with time zone not null default now()
);

create table room_ballots (
  vote_id uuid not null,
  user_id uuid not null,
  choice text not null,
  cast_at timestamp with time zone not null default now()
);

create table room_members (
  room_id uuid not null,
  user_id uuid not null,
  pseudo text not null,
  status text not null default 'invited'::text,
  invited_by uuid,
  position_id text,
  nationality_id text,
  joined_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  starting_offers jsonb,
  career_ended boolean not null default false,
  final_score numeric,
  final_summary jsonb,
  live_stats jsonb
);

create table room_progress (
  room_id uuid not null,
  user_id uuid not null,
  ready boolean not null default false,
  pending_offer jsonb,
  updated_at timestamp with time zone not null default now(),
  club_trophies jsonb
);

create table room_votes (
  id uuid not null default gen_random_uuid(),
  room_id uuid not null,
  kind text not null,
  candidates jsonb not null,
  status text not null default 'open'::text,
  result jsonb,
  opened_at timestamp with time zone not null default now(),
  closed_at timestamp with time zone
);

create table rooms (
  id uuid not null default gen_random_uuid(),
  status text not null default 'lobby'::text,
  phase text not null default 'profile_setup'::text,
  created_by uuid not null,
  max_members smallint not null default 4,
  club_id text,
  season_year integer,
  created_at timestamp with time zone not null default now(),
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  season_trophies jsonb
);

create table saves (
  user_id uuid not null,
  data jsonb not null,
  updated_at timestamp with time zone not null default now()
);

create table stats_totaux (
  nom text not null,
  valeur bigint not null default 0,
  maj timestamp with time zone not null default now()
);

-- --- Contraintes ---------------------------------------------------------------

alter table daily_scores add constraint daily_scores_pkey PRIMARY KEY (user_id, date);
alter table duels add constraint duels_pkey PRIMARY KEY (id);
alter table friends add constraint friends_pkey PRIMARY KEY (user_id, friend_id);
alter table profiles add constraint profiles_pkey PRIMARY KEY (user_id);
alter table rate_limits add constraint rate_limits_pkey PRIMARY KEY (user_id, bucket, day);
alter table room_ballots add constraint room_ballots_pkey PRIMARY KEY (vote_id, user_id);
alter table room_members add constraint room_members_pkey PRIMARY KEY (room_id, user_id);
alter table room_progress add constraint room_progress_pkey PRIMARY KEY (room_id, user_id);
alter table room_votes add constraint room_votes_pkey PRIMARY KEY (id);
alter table rooms add constraint rooms_pkey PRIMARY KEY (id);
alter table saves add constraint saves_pkey PRIMARY KEY (user_id);
alter table stats_totaux add constraint stats_totaux_pkey PRIMARY KEY (nom);
alter table friends add constraint friends_status_chk CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text])));
alter table room_members add constraint room_members_status_chk CHECK ((status = ANY (ARRAY['invited'::text, 'joined'::text, 'left'::text, 'excluded'::text])));
alter table room_votes add constraint room_votes_kind_chk CHECK ((kind = ANY (ARRAY['starting_club'::text, 'transfer'::text, 'follow_relocation'::text, 'kick'::text])));
alter table room_votes add constraint room_votes_status_chk CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])));
alter table rooms add constraint rooms_max_members_chk CHECK (((max_members >= 2) AND (max_members <= 4)));
alter table rooms add constraint rooms_phase_chk CHECK ((phase = ANY (ARRAY['profile_setup'::text, 'starting_vote'::text, 'in_season'::text, 'season_vote'::text, 'ended'::text])));
alter table rooms add constraint rooms_status_chk CHECK ((status = ANY (ARRAY['lobby'::text, 'active'::text, 'ended'::text])));
alter table daily_scores add constraint daily_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table duels add constraint duels_from_user_fkey FOREIGN KEY (from_user) REFERENCES users(id) ON DELETE CASCADE;
alter table duels add constraint duels_to_user_fkey FOREIGN KEY (to_user) REFERENCES users(id) ON DELETE SET NULL;
alter table friends add constraint friends_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE;
alter table friends add constraint friends_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table profiles add constraint profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table rate_limits add constraint rate_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
alter table room_ballots add constraint room_ballots_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
alter table room_ballots add constraint room_ballots_vote_id_fkey FOREIGN KEY (vote_id) REFERENCES room_votes(id) ON DELETE CASCADE;
alter table room_members add constraint room_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES users(id);
alter table room_members add constraint room_members_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
alter table room_members add constraint room_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
alter table room_progress add constraint room_progress_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
alter table room_progress add constraint room_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
alter table room_votes add constraint room_votes_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
alter table rooms add constraint rooms_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
alter table saves add constraint saves_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- --- Index ---------------------------------------------------------------------

CREATE INDEX daily_scores_date_score ON daily_scores USING btree (date, score DESC);
CREATE INDEX duels_parties ON duels USING btree (from_user, to_user);
CREATE INDEX duels_to_pseudo ON duels USING btree (lower(to_pseudo), status);
CREATE INDEX friends_incoming_idx ON friends USING btree (friend_id, status);
CREATE UNIQUE INDEX profiles_pseudo_lower ON profiles USING btree (lower(pseudo));
CREATE INDEX room_members_user_idx ON room_members USING btree (user_id, status);
CREATE INDEX room_votes_room_idx ON room_votes USING btree (room_id, status);

-- --- Fonctions -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION bump_stat(cle text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if cle not in ('career_created', 'career_end', 'daily_completed', 'duel_created', 'story_completed') then
    return;
  end if;
  insert into stats_totaux (nom, valeur) values (cle, 1)
  on conflict (nom) do update set valeur = stats_totaux.valeur + 1, maj = now();
end;
$function$;

CREATE OR REPLACE FUNCTION daily_rank(d text, sc integer)
 RETURNS TABLE(rank bigint, players bigint)
 LANGUAGE sql
 STABLE
AS $function$
  select (select count(*) from daily_scores where date = d and score > sc) + 1,
         (select count(*) from daily_scores where date = d);
$function$;

CREATE OR REPLACE FUNCTION daily_top(d text, lim integer DEFAULT 100)
 RETURNS TABLE(rank bigint, pseudo text, score integer, user_id uuid)
 LANGUAGE sql
 STABLE
AS $function$
  select row_number() over (order by score desc, created_at asc), coalesce(pseudo,'Joueur'), score, user_id
  from daily_scores where date = d
  order by score desc, created_at asc limit lim;
$function$;

CREATE OR REPLACE FUNCTION duel_cancel(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int;
begin
  update duels set status = 'cancelled'
   where id = p_id and from_user = app_user_id() and status = 'pending';
  get diagnostics n = row_count;
  return n > 0;
end $function$;

CREATE OR REPLACE FUNCTION duels_history()
 RETURNS TABLE(id uuid, from_pseudo text, to_pseudo text, from_score integer, to_score integer, winner text, i_am text, answered_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select d.id, d.from_pseudo, d.to_pseudo, d.from_score, d.to_score, d.winner,
         case when d.from_user = app_user_id() then 'from' else 'to' end,
         d.answered_at
  from duels d
  where d.status = 'done' and (d.from_user = app_user_id() or d.to_user = app_user_id())
  order by d.answered_at desc limit 60;
$function$;

CREATE OR REPLACE FUNCTION duels_incoming()
 RETURNS TABLE(id uuid, seed bigint, from_pseudo text, from_label text, from_choices jsonb, from_score integer, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select d.id, d.seed, d.from_pseudo, d.from_label, d.from_choices, d.from_score, d.created_at
  from duels d
  where d.status = 'pending' and d.to_user is null
    and d.created_at > now() - interval '7 days'
    and lower(d.to_pseudo) = lower((select pseudo from profiles where user_id = app_user_id()))
    and d.from_user <> app_user_id()
  order by d.created_at desc limit 50;
$function$;

CREATE OR REPLACE FUNCTION duels_outgoing()
 RETURNS TABLE(id uuid, to_pseudo text, from_score integer, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select d.id, d.to_pseudo, d.from_score, d.created_at
  from duels d
  where d.status = 'pending' and d.from_user = app_user_id()
    and d.created_at > now() - interval '7 days'
  order by d.created_at desc limit 50;
$function$;

CREATE OR REPLACE FUNCTION friend_profile(p_pseudo text)
 RETURNS TABLE(pseudo text, stats jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cible uuid;
  moi   uuid := app_user_id();
begin
  if moi is null then return; end if;               -- non connecté : rien
  select pr.user_id into cible
    from profiles pr
   where lower(pr.pseudo) = lower(p_pseudo)
   limit 1;
  if cible is null then return; end if;

  -- Soi-même, ou une amitié ACCEPTÉE dans un sens OU dans l'autre. L'amitié est
  -- réciproque à l'acceptation, mais on teste les deux sens : une base reprise
  -- d'avant les invitations pourrait n'avoir que la ligne d'un côté.
  if cible <> moi and not exists (
    select 1 from friends f
     where f.status = 'accepted'
       and ((f.user_id = moi and f.friend_id = cible)
         or (f.user_id = cible and f.friend_id = moi))
  ) then
    return;                                          -- pas ami : zéro ligne
  end if;

  return query
    select pr.pseudo, pr.stats
      from profiles pr
     where pr.user_id = cible;
end;
$function$;

CREATE OR REPLACE FUNCTION friends_daily(d text, lim integer DEFAULT 100)
 RETURNS TABLE(rank bigint, pseudo text, score integer, user_id uuid, is_me boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with fset as (
    select app_user_id() as uid
    union
    select friend_id from friends where user_id = app_user_id())
  select row_number() over (order by ds.score desc, ds.created_at asc),
         coalesce(ds.pseudo, 'Joueur'), ds.score, ds.user_id, ds.user_id = app_user_id()
  from daily_scores ds
  where ds.date = d and ds.user_id in (select uid from fset)
  order by ds.score desc, ds.created_at asc limit lim;
$function$;

CREATE OR REPLACE FUNCTION friends_range(since text, lim integer DEFAULT 100)
 RETURNS TABLE(rank bigint, pseudo text, total bigint, days bigint, user_id uuid, is_me boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with fset as (
    select app_user_id() as uid union select friend_id from friends where user_id = app_user_id()),
  agg as (
    select ds.user_id, max(ds.pseudo) as pseudo, sum(ds.score)::bigint as total, count(*)::bigint as days
    from daily_scores ds
    where ds.user_id in (select uid from fset) and (since = '' or ds.date >= since)
    group by ds.user_id)
  select row_number() over (order by total desc), coalesce(pseudo, 'Joueur'), total, days, user_id, user_id = app_user_id()
  from agg order by total desc limit lim;
$function$;

CREATE OR REPLACE FUNCTION has_active_room(p_user_id uuid DEFAULT app_user_id())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from room_members m
      join rooms r on r.id = m.room_id
     where m.user_id = p_user_id and m.status = 'joined' and r.status <> 'ended'
  );
$function$;

CREATE OR REPLACE FUNCTION is_room_member(p_room_id uuid, p_user_id uuid DEFAULT app_user_id())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from room_members where room_id = p_room_id and user_id = p_user_id
  );
$function$;

CREATE OR REPLACE FUNCTION level_rank(p_user uuid)
 RETURNS TABLE(rank bigint, level integer, players bigint)
 LANGUAGE sql
 STABLE
AS $function$
  with scored as (
    select user_id,
      greatest(1, least(9999,
        case when stats->>'level' ~ '^-?[0-9]+$' then (stats->>'level')::int else 1 end
      )) as lvl
    from profiles
    where pseudo is not null
  ), ranked as (
    select user_id, lvl, rank() over (order by lvl desc) as rank from scored
  )
  select ranked.rank, ranked.lvl as level, (select count(*) from scored) as players
  from ranked where ranked.user_id = p_user;
$function$;

CREATE OR REPLACE FUNCTION level_top(lim integer DEFAULT 10)
 RETURNS TABLE(rank bigint, user_id uuid, pseudo text, level integer)
 LANGUAGE sql
 STABLE
AS $function$
  select rank() over (order by lvl desc) as rank, user_id, pseudo, lvl as level
  from (
    select user_id, pseudo,
      greatest(1, least(9999,
        case when stats->>'level' ~ '^-?[0-9]+$' then (stats->>'level')::int else 1 end
      )) as lvl
    from profiles
    where pseudo is not null
  ) x
  order by lvl desc, user_id
  limit lim;
$function$;

CREATE OR REPLACE FUNCTION public_profile(p_pseudo text)
 RETURNS TABLE(pseudo text, stats jsonb, total bigint, days bigint, rank bigint)
 LANGUAGE sql
 STABLE
AS $function$
  with me as (select user_id, pseudo, stats from profiles where pseudo = p_pseudo limit 1),
  agg as (select user_id, sum(score)::bigint total, count(*)::bigint days
          from daily_scores group by user_id),
  ranked as (select user_id, total, days, row_number() over (order by total desc) rank from agg)
  select m.pseudo, m.stats, coalesce(r.total,0), coalesce(r.days,0), r.rank
  from me m left join ranked r on r.user_id = m.user_id;
$function$;

CREATE OR REPLACE FUNCTION random_legends(n integer DEFAULT 12)
 RETURNS TABLE(pseudo text, best jsonb)
 LANGUAGE sql
 STABLE
AS $function$
  select pseudo, stats->'best'
  from profiles
  where stats ? 'best' and coalesce(stats->'best','null'::jsonb) <> 'null'::jsonb
  order by random() limit n;
$function$;

CREATE OR REPLACE FUNCTION range_top(since text, lim integer DEFAULT 100)
 RETURNS TABLE(rank bigint, pseudo text, total bigint, days bigint, user_id uuid)
 LANGUAGE sql
 STABLE
AS $function$
  with agg as (
    select user_id, max(pseudo) as pseudo, sum(score)::bigint as total, count(*)::bigint as days
    from daily_scores where since = '' or date >= since group by user_id)
  select row_number() over (order by total desc), coalesce(pseudo,'Joueur'), total, days, user_id
  from agg order by total desc limit lim;
$function$;

CREATE OR REPLACE FUNCTION rate_take(p_user uuid, p_bucket text, p_day text, p_cap integer, p_cooldown_ms integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c int; la timestamptz;
begin
  select count, last_at into c, la from rate_limits
   where user_id = p_user and bucket = p_bucket and day = p_day;
  if c is not null then
    if p_cooldown_ms > 0 and now() - la < make_interval(secs => p_cooldown_ms::numeric / 1000) then return 'cooldown'; end if;
    if c >= p_cap then return 'cap'; end if;
  end if;
  insert into rate_limits (user_id, bucket, day, count, last_at)
  values (p_user, p_bucket, p_day, 1, now())
  on conflict (user_id, bucket, day) do update set count = rate_limits.count + 1, last_at = now();
  return 'ok';
end $function$;

CREATE OR REPLACE FUNCTION record_daily_score(p_user uuid, p_date text, p_score integer, p_choices jsonb, p_pseudo text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cur int;
begin
  insert into daily_scores (user_id, date, score, choices, pseudo)
  values (p_user, p_date, p_score, p_choices, p_pseudo)
  on conflict (user_id, date) do update set
    score      = greatest(daily_scores.score, excluded.score),
    choices    = case when excluded.score > daily_scores.score then excluded.choices else daily_scores.choices end,
    pseudo     = excluded.pseudo,
    created_at = case when excluded.score > daily_scores.score then now() else daily_scores.created_at end;
  select score into cur from daily_scores where user_id = p_user and date = p_date;
  return cur;
end $function$;

CREATE OR REPLACE FUNCTION room_cast_vote(p_vote_id uuid, p_choice text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_room_id uuid;
begin
  select room_id into v_room_id from room_votes where id = p_vote_id and status = 'open';
  if v_room_id is null then
    raise exception 'vote not open';
  end if;
  if not exists (
    select 1 from room_members where room_id = v_room_id and user_id = app_user_id() and status = 'joined'
  ) then
    raise exception 'not a joined member';
  end if;
  insert into room_ballots (vote_id, user_id, choice)
    values (p_vote_id, app_user_id(), p_choice)
  on conflict (vote_id, user_id) do update set choice = excluded.choice, cast_at = now();
  perform room_maybe_resolve_vote(p_vote_id);
end;
$function$;

CREATE OR REPLACE FUNCTION room_create()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_room_id uuid;
  v_pseudo  text;
begin
  if has_active_room(app_user_id()) then
    raise exception 'already in an active room';
  end if;
  select pseudo into v_pseudo from profiles where user_id = app_user_id();
  insert into rooms (created_by) values (app_user_id()) returning id into v_room_id;
  insert into room_members (room_id, user_id, pseudo, status, invited_by, joined_at)
    values (v_room_id, app_user_id(), coalesce(v_pseudo, 'Joueur'), 'joined', app_user_id(), now());
  return v_room_id;
end;
$function$;

CREATE OR REPLACE FUNCTION room_decline(p_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from room_members
   where room_id = p_room_id and user_id = app_user_id() and status = 'invited';
end;
$function$;

CREATE OR REPLACE FUNCTION room_invite(p_room_id uuid, p_friend_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pseudo text;
  v_taken  int;
  v_max    smallint;
begin
  if not exists (
    select 1 from room_members where room_id = p_room_id and user_id = app_user_id() and status = 'joined'
  ) then
    raise exception 'not a member of this room';
  end if;

  if not exists (
    select 1 from friends
     where status = 'accepted'
       and ((user_id = app_user_id() and friend_id = p_friend_id) or (user_id = p_friend_id and friend_id = app_user_id()))
  ) then
    raise exception 'not friends';
  end if;

  select max_members into v_max from rooms where id = p_room_id;
  select count(*) into v_taken from room_members
   where room_id = p_room_id and status in ('joined', 'invited');
  if v_taken >= v_max then
    raise exception 'room full';
  end if;

  select pseudo into v_pseudo from profiles where user_id = p_friend_id;
  insert into room_members (room_id, user_id, pseudo, status, invited_by)
    values (p_room_id, p_friend_id, coalesce(v_pseudo, 'Joueur'), 'invited', app_user_id())
  on conflict (room_id, user_id) do update
    set status = 'invited', invited_by = excluded.invited_by, pseudo = excluded.pseudo
    where room_members.status in ('left', 'excluded');
end;
$function$;

CREATE OR REPLACE FUNCTION room_join(p_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if has_active_room(app_user_id()) then
    raise exception 'already in an active room';
  end if;
  update room_members
     set status = 'joined', joined_at = now()
   where room_id = p_room_id and user_id = app_user_id() and status = 'invited';
  if not found then
    raise exception 'no pending invitation';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION room_launch(p_room_id uuid, p_club_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_creator_active boolean;
begin
  select exists (
    select 1 from room_members m
      join rooms r on r.id = m.room_id
     where m.room_id = p_room_id and m.user_id = r.created_by and m.status = 'joined'
  ) into v_creator_active;

  if v_creator_active then
    if not exists (
      select 1 from rooms where id = p_room_id and created_by = app_user_id() and phase = 'profile_setup'
    ) then
      raise exception 'only the room creator can launch, and only before it has started';
    end if;
  elsif not exists (
    select 1 from room_members where room_id = p_room_id and user_id = app_user_id() and status = 'joined'
  ) then
    raise exception 'not a joined member';
  end if;

  update rooms
     set club_id = p_club_id, status = 'active', phase = 'in_season', started_at = now()
   where id = p_room_id and phase = 'profile_setup';
  if not found then
    raise exception 'room already launched';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION room_leave(p_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_vote_id uuid;
begin
  update room_members
     set status = 'left'
   where room_id = p_room_id and user_id = app_user_id() and status = 'joined';

  -- Le départ peut être le dernier maillon manquant d'un vote ouvert ou de la
  -- barrière de saison — sans ce nudge, les membres restants qui ont déjà
  -- voté/rapporté resteraient bloqués à attendre quelqu'un qui ne reviendra
  -- plus. Sans effet si rien n'était en attente.
  select id into v_vote_id from room_votes where room_id = p_room_id and status = 'open' limit 1;
  if v_vote_id is not null then
    perform room_maybe_resolve_vote(v_vote_id);
  end if;
  perform room_maybe_advance_season(p_room_id);
end;
$function$;

CREATE OR REPLACE FUNCTION room_mark_career_ended(p_room_id uuid, p_score numeric, p_summary jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_remaining int;
begin
  update room_members
     set career_ended = true, final_score = p_score, final_summary = p_summary
   where room_id = p_room_id and user_id = app_user_id() and status = 'joined';
  if not found then
    return;
  end if;

  select count(*) into v_remaining from room_members
   where room_id = p_room_id and status = 'joined' and not career_ended;
  if v_remaining = 0 then
    update rooms set status = 'ended', phase = 'ended', ended_at = now() where id = p_room_id;
    return;
  end if;

  -- Cette carrière qui se termine peut être le dernier rapport manquant de
  -- la saison en cours pour les membres encore actifs.
  perform room_maybe_advance_season(p_room_id);
end;
$function$;

CREATE OR REPLACE FUNCTION room_maybe_advance_season(p_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_joined_count int;
  v_ready_count  int;
  v_any_offers   boolean;
  v_forced       boolean;
  v_candidates   jsonb;
  v_trophies     jsonb;
begin
  if not exists (select 1 from rooms where id = p_room_id and phase = 'in_season') then
    return;
  end if;

  select count(*) into v_joined_count from room_members
   where room_id = p_room_id and status = 'joined' and not career_ended;
  if v_joined_count = 0 then
    return; -- plus personne d'actif : rien à faire avancer ici
  end if;

  select count(*) into v_ready_count from room_progress
   where room_id = p_room_id and ready = true
     and user_id in (select user_id from room_members where room_id = p_room_id and status = 'joined' and not career_ended);
  if v_ready_count < v_joined_count then
    return; -- il manque encore un rapport
  end if;

  -- Barrière franchie : union des trophées club rapportés par les membres
  -- actifs pour la saison qui vient de se terminer, posée AVANT de
  -- réinitialiser room_progress ci-dessous (sinon plus rien à agréger).
  select coalesce(jsonb_agg(distinct trophy), '[]'::jsonb)
    into v_trophies
    from room_progress rp, jsonb_array_elements_text(coalesce(rp.club_trophies, '[]'::jsonb)) as trophy
   where rp.room_id = p_room_id
     and rp.user_id in (select user_id from room_members where room_id = p_room_id and status = 'joined' and not career_ended);
  update rooms set season_trophies = v_trophies where id = p_room_id;

  select bool_or(jsonb_array_length(coalesce(pending_offer->'offers', '[]'::jsonb)) > 0)
    into v_any_offers
    from room_progress
   where room_id = p_room_id
     and user_id in (select user_id from room_members where room_id = p_room_id and status = 'joined' and not career_ended);

  if not coalesce(v_any_offers, false) then
    update room_progress set ready = false, pending_offer = null, club_trophies = null where room_id = p_room_id;
    update rooms set season_year = coalesce(season_year, 0) + 1 where id = p_room_id;
    return;
  end if;

  select bool_or(coalesce((pending_offer->>'forced')::boolean, false)) into v_forced
    from room_progress
   where room_id = p_room_id
     and user_id in (select user_id from room_members where room_id = p_room_id and status = 'joined' and not career_ended);

  select jsonb_agg(distinct clubid) into v_candidates
    from room_progress rp, jsonb_array_elements_text(coalesce(rp.pending_offer->'offers', '[]'::jsonb)) as clubid
   where rp.room_id = p_room_id
     and rp.user_id in (select user_id from room_members where room_id = p_room_id and status = 'joined' and not career_ended);
  if not coalesce(v_forced, false) then
    v_candidates := coalesce(v_candidates, '[]'::jsonb) || to_jsonb(array['stay']);
  end if;

  update rooms set phase = 'season_vote' where id = p_room_id and phase = 'in_season';
  if not found then
    return; -- déjà ouvert entre-temps par un appel concurrent
  end if;

  insert into room_votes (room_id, kind, candidates) values (p_room_id, 'transfer', v_candidates);
end;
$function$;

CREATE OR REPLACE FUNCTION room_maybe_resolve_vote(p_vote_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_room_id        uuid;
  v_kind           text;
  v_target         uuid;
  v_eligible_count int;
  v_ballot_count   int;
  v_winner         text;
begin
  select room_id, kind into v_room_id, v_kind from room_votes where id = p_vote_id and status = 'open';
  if v_room_id is null then
    return;
  end if;

  v_target := case when v_kind = 'kick'
    then (select (candidates->>'target')::uuid from room_votes where id = p_vote_id)
    else null end;

  select count(*) into v_eligible_count from room_members
   where room_id = v_room_id and status = 'joined' and not career_ended
     and (v_target is null or user_id <> v_target);
  select count(*) into v_ballot_count
    from room_ballots b
      join room_members m on m.room_id = v_room_id and m.user_id = b.user_id
        and m.status = 'joined' and not m.career_ended
        and (v_target is null or m.user_id <> v_target)
   where b.vote_id = p_vote_id;
  if v_ballot_count < v_eligible_count then
    return;
  end if;

  select choice into v_winner from (
    select b.choice, count(*) as n
      from room_ballots b
        join room_members m on m.room_id = v_room_id and m.user_id = b.user_id
          and m.status = 'joined' and not m.career_ended
          and (v_target is null or m.user_id <> v_target)
     where b.vote_id = p_vote_id
     group by b.choice
     order by n desc, random()
     limit 1
  ) t;

  update room_votes
     set status = 'closed', result = jsonb_build_object('choice', v_winner, 'resolvedAt', now()), closed_at = now()
   where id = p_vote_id and status = 'open';
  if not found then
    return;
  end if;

  if v_kind = 'starting_club' then
    update rooms
       set club_id = v_winner, status = 'active', phase = 'in_season', started_at = now()
     where id = v_room_id;
  elsif v_kind in ('transfer', 'follow_relocation') then
    update room_progress set ready = false, pending_offer = null where room_id = v_room_id;
    update rooms set phase = 'in_season', season_year = coalesce(season_year, 0) + 1 where id = v_room_id;
  elsif v_kind = 'kick' then
    if v_winner = 'kick' then
      update room_members set status = 'excluded' where room_id = v_room_id and user_id = v_target;
    end if;
    update rooms set phase = 'in_season' where id = v_room_id;
    perform room_maybe_advance_season(v_room_id);
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION room_open_relocation_vote(p_room_id uuid, p_club_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_vote_id uuid;
begin
  if not exists (
    select 1 from room_members where room_id = p_room_id and user_id = app_user_id() and status = 'joined'
  ) then
    raise exception 'not a joined member';
  end if;

  update rooms set phase = 'season_vote' where id = p_room_id and phase = 'in_season';
  if not found then
    return null; -- un vote est déjà ouvert (mercato, un autre narratif, un kick…)
  end if;

  insert into room_votes (room_id, kind, candidates)
    values (p_room_id, 'follow_relocation', jsonb_build_array(p_club_id, 'stay'))
    returning id into v_vote_id;

  insert into room_ballots (vote_id, user_id, choice) values (v_vote_id, app_user_id(), p_club_id);
  perform room_maybe_resolve_vote(v_vote_id);
  return v_vote_id;
end;
$function$;

CREATE OR REPLACE FUNCTION room_open_starting_vote(p_room_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_missing    int;
  v_candidates jsonb;
  v_vote_id    uuid;
begin
  if not exists (
    select 1 from room_members where room_id = p_room_id and user_id = app_user_id() and status = 'joined'
  ) then
    raise exception 'not a member of this room';
  end if;

  select count(*) into v_missing from room_members
   where room_id = p_room_id and status = 'joined' and starting_offers is null;
  if v_missing > 0 then
    raise exception 'not everyone has submitted their offers yet';
  end if;

  update rooms set phase = 'starting_vote' where id = p_room_id and phase = 'profile_setup';
  if not found then
    raise exception 'vote already opened';
  end if;

  select jsonb_agg(distinct clubid) into v_candidates
    from room_members rm, jsonb_array_elements_text(rm.starting_offers) as clubid
   where rm.room_id = p_room_id and rm.status = 'joined';

  insert into room_votes (room_id, kind, candidates)
    values (p_room_id, 'starting_club', v_candidates)
    returning id into v_vote_id;

  return v_vote_id;
end;
$function$;

CREATE OR REPLACE FUNCTION room_open_transfer_vote(p_room_id uuid, p_offers jsonb, p_forced boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_candidates jsonb;
  v_vote_id    uuid;
begin
  if not exists (
    select 1 from room_members where room_id = p_room_id and user_id = app_user_id() and status = 'joined'
  ) then
    raise exception 'not a joined member';
  end if;

  update rooms set phase = 'season_vote' where id = p_room_id and phase = 'in_season';
  if not found then
    return null; -- déjà un vote ouvert (mercato ou un autre narratif) : on le rejoint plutôt
  end if;

  v_candidates := coalesce(p_offers, '[]'::jsonb);
  if not coalesce(p_forced, false) then
    v_candidates := v_candidates || to_jsonb(array['stay']);
  end if;

  insert into room_votes (room_id, kind, candidates) values (p_room_id, 'transfer', v_candidates)
    returning id into v_vote_id;
  return v_vote_id;
end;
$function$;

CREATE OR REPLACE FUNCTION room_propose_kick(p_room_id uuid, p_target_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_joined_count int;
  v_vote_id      uuid;
begin
  if app_user_id() = p_target_user_id then
    raise exception 'cannot propose to kick yourself';
  end if;
  if not exists (
    select 1 from room_members where room_id = p_room_id and user_id = app_user_id() and status = 'joined'
  ) then
    raise exception 'not a joined member';
  end if;
  if not exists (
    select 1 from room_members where room_id = p_room_id and user_id = p_target_user_id and status = 'joined'
  ) then
    raise exception 'target is not a joined member';
  end if;

  select count(*) into v_joined_count from room_members where room_id = p_room_id and status = 'joined';
  if v_joined_count < 3 then
    raise exception 'not enough members to vote a kick — leave instead';
  end if;

  update rooms set phase = 'season_vote' where id = p_room_id and phase = 'in_season';
  if not found then
    raise exception 'a vote is already in progress';
  end if;

  insert into room_votes (room_id, kind, candidates)
    values (p_room_id, 'kick', jsonb_build_object('target', p_target_user_id, 'options', jsonb_build_array('kick', 'keep')))
    returning id into v_vote_id;

  insert into room_ballots (vote_id, user_id, choice) values (v_vote_id, app_user_id(), 'kick');
  perform room_maybe_resolve_vote(v_vote_id);
  return v_vote_id;
end;
$function$;

CREATE OR REPLACE FUNCTION room_report_season(p_room_id uuid, p_pending_offer jsonb, p_club_trophies jsonb DEFAULT '[]'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1 from room_members where room_id = p_room_id and user_id = app_user_id() and status = 'joined'
  ) then
    raise exception 'not a joined member';
  end if;
  if not exists (select 1 from rooms where id = p_room_id and phase = 'in_season') then
    return;
  end if;

  insert into room_progress (room_id, user_id, ready, pending_offer, club_trophies, updated_at)
    values (p_room_id, app_user_id(), true, p_pending_offer, coalesce(p_club_trophies, '[]'::jsonb), now())
  on conflict (room_id, user_id) do update
    set ready = true, pending_offer = excluded.pending_offer, club_trophies = excluded.club_trophies, updated_at = now();

  perform room_maybe_advance_season(p_room_id);
end;
$function$;

CREATE OR REPLACE FUNCTION room_submit_starting_offers(p_room_id uuid, p_offers jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if jsonb_typeof(p_offers) <> 'array' or jsonb_array_length(p_offers) = 0 or jsonb_array_length(p_offers) > 6 then
    raise exception 'invalid offers';
  end if;
  update room_members
     set starting_offers = p_offers
   where room_id = p_room_id and user_id = app_user_id() and status = 'joined';
  if not found then
    raise exception 'not a joined member';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION room_update_stats(p_room_id uuid, p_stats jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update room_members
     set live_stats = p_stats
   where room_id = p_room_id and user_id = app_user_id() and status = 'joined';
end;
$function$;

CREATE OR REPLACE FUNCTION stats_publiques()
 RETURNS TABLE(cle text, valeur bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select s.nom as cle, s.valeur from stats_totaux s $function$;

