-- Salles : annuler une invitation envoyée par erreur. Seuls l'hôte de la salle et
-- l'auteur de l'invitation le peuvent, et seulement tant qu'elle n'est pas acceptée.
create or replace function room_cancel_invite(p_room_id uuid, p_user_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from room_members m join rooms r on r.id = m.room_id
     where m.room_id = p_room_id and m.user_id = p_user_id and m.status = 'invited'
       and (m.invited_by = app_user_id() or r.created_by = app_user_id())
  ) then
    raise exception 'no pending invitation you can cancel';
  end if;
  delete from room_members where room_id = p_room_id and user_id = p_user_id and status = 'invited';
end;
$function$;
