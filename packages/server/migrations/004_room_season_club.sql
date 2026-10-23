-- Salles : le club d'une saison est fixé par le premier membre qui la commence.
--
-- Chaque membre joue sa saison de son côté. Un transfert voté en cours de route (un
-- événement a déplacé un coéquipier) pouvait donc faire jouer la MÊME saison dans deux
-- clubs différents : l'un l'avait déjà commencée dans l'ancien, l'autre attendait le vote
-- et la jouait dans le nouveau. Le premier à commencer la saison en fixe le club ; les
-- autres s'y alignent pour cette saison, et le transfert vaut pour la suivante.
alter table rooms add column season_club_year integer, add column season_club_id text;

create or replace function room_claim_season_club(p_room_id uuid, p_year integer, p_club_id text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_year integer;
  v_club text;
begin
  if not exists (
    select 1 from room_members where room_id = p_room_id and user_id = app_user_id() and status = 'joined'
  ) then
    raise exception 'not a joined member';
  end if;
  select season_club_year, season_club_id into v_year, v_club from rooms where id = p_room_id for update;
  if v_year = p_year and v_club is not null then
    return v_club;
  end if;
  update rooms set season_club_year = p_year, season_club_id = p_club_id where id = p_room_id;
  return p_club_id;
end;
$function$;
