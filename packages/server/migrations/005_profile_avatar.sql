-- Profil : avatar choisi par le joueur parmi ceux du jeu (identifiant « clair-01 »…,
-- vérifié par le serveur). Absent = avatar par défaut.
alter table profiles add column avatar text;

-- La fiche publique renvoie l'avatar : nouveau type de retour, d'où la recréation.
drop function public_profile(text);
create function public_profile(p_pseudo text)
 returns table(pseudo text, stats jsonb, total bigint, days bigint, rank bigint, avatar text)
 language sql
 stable
as $function$
  with me as (select user_id, pseudo, stats, avatar from profiles where pseudo = p_pseudo limit 1),
  agg as (select user_id, sum(score)::bigint total, count(*)::bigint days
          from daily_scores group by user_id),
  ranked as (select user_id, total, days, row_number() over (order by total desc) rank from agg)
  select m.pseudo, m.stats, coalesce(r.total,0), coalesce(r.days,0), r.rank, m.avatar
  from me m left join ranked r on r.user_id = m.user_id;
$function$;
