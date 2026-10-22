-- Salles : la barrière de fin de saison et les votes en cours de saison ne se
-- marchent plus dessus.
--
-- Avant, un vote de transfert gagné (barrière OU décision prise en cours de
-- saison) faisait toujours la même chose : remettre à zéro le « prêt » de tous
-- les membres et avancer l'année de la salle. Un vote en cours de saison
-- libérait donc d'un coup ceux qui attendaient déjà à la barrière : ils
-- prenaient une saison d'avance. Et un bilan de fin de saison envoyé pendant
-- un vote était jeté sans trace, ce qui pouvait bloquer la salle.
--
-- Désormais :
--   • room_votes.barrier distingue le vote de fin de saison (ouvert par
--     room_maybe_advance_season) des votes en cours de saison ;
--   • seul le vote de barrière remet les bilans à zéro et fait avancer l'année ;
--   • un vote en cours de saison rend la main à la saison, puis relance la
--     vérification de la barrière (le dernier bilan a pu arriver pendant le vote) ;
--   • un bilan envoyé pendant un vote en cours de saison est conservé ;
--   • rooms.club_id suit le club de l'équipe à chaque vote de transfert gagné :
--     un membre en retard (ou qui a voté depuis l'écran Salle) sait où aller.

alter table room_votes add column barrier boolean not null default false;
-- Année de la salle à l'ouverture d'un vote de barrière : permet de retrouver
-- le vote de CETTE barrière, et non le dernier vote clos.
alter table room_votes add column season_year integer;

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
  v_season       integer;
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

  select coalesce(season_year, 0) into v_season from rooms where id = p_room_id;
  insert into room_votes (room_id, kind, candidates, barrier, season_year)
    values (p_room_id, 'transfer', v_candidates, true, v_season);
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
  v_barrier        boolean;
  v_target         uuid;
  v_eligible_count int;
  v_ballot_count   int;
  v_winner         text;
begin
  select room_id, kind, barrier into v_room_id, v_kind, v_barrier from room_votes where id = p_vote_id and status = 'open';
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
    -- Le club de l'équipe suit chaque décision de départ.
    if v_winner is not null and v_winner <> 'stay' then
      update rooms set club_id = v_winner where id = v_room_id;
    end if;
    if v_barrier then
      -- Vote de fin de saison : la barrière est franchie pour tout le monde.
      update room_progress set ready = false, pending_offer = null where room_id = v_room_id;
      update rooms set phase = 'in_season', season_year = coalesce(season_year, 0) + 1 where id = v_room_id;
    else
      -- Décision prise EN COURS de saison : la saison reprend, sans toucher aux
      -- bilans déjà rendus ni à l'année. Le dernier bilan manquant a pu arriver
      -- pendant le vote : on relance la vérification de la barrière.
      update rooms set phase = 'in_season' where id = v_room_id;
      perform room_maybe_advance_season(v_room_id);
    end if;
  elsif v_kind = 'kick' then
    if v_winner = 'kick' then
      update room_members set status = 'excluded' where room_id = v_room_id and user_id = v_target;
    end if;
    update rooms set phase = 'in_season' where id = v_room_id;
    perform room_maybe_advance_season(v_room_id);
  end if;
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
  -- Un bilan arrive aussi pendant un vote EN COURS de saison : il est conservé
  -- (la barrière sera évaluée à la clôture du vote). Seul un vote de barrière
  -- ouvert l'écarte — il n'ouvre que lorsque tout le monde a déjà rendu son bilan.
  if not exists (select 1 from rooms where id = p_room_id and phase in ('in_season', 'season_vote')) then
    return;
  end if;
  if exists (select 1 from room_votes where room_id = p_room_id and status = 'open' and barrier) then
    return;
  end if;

  insert into room_progress (room_id, user_id, ready, pending_offer, club_trophies, updated_at)
    values (p_room_id, app_user_id(), true, p_pending_offer, coalesce(p_club_trophies, '[]'::jsonb), now())
  on conflict (room_id, user_id) do update
    set ready = true, pending_offer = excluded.pending_offer, club_trophies = excluded.club_trophies, updated_at = now();

  perform room_maybe_advance_season(p_room_id);
end;
$function$;
