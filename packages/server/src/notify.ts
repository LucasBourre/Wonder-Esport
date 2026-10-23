// Notifications : enregistrées en base (le joueur les retrouve à sa prochaine visite) et
// signalées en direct à ceux qui sont connectés (canal joueur de live.ts).
//
// Toujours APRÈS l'action réussie, hors de sa transaction, et sans jamais la faire échouer :
// une notification perdue ne doit pas annuler une invitation.
import { pool } from "./db";
import { notifyUsers } from "./live";

export type NotificationKind =
  | "friend_request" | "friend_accepted"
  | "duel_received" | "duel_result"
  | "room_invite" | "room_joined" | "room_declined" | "room_launched" | "room_vote";

export async function pseudoOf(userId: string): Promise<string> {
  const { rows } = await pool.query("select pseudo from profiles where user_id = $1", [userId]);
  return rows[0]?.pseudo ? String(rows[0].pseudo).slice(0, 24) : "Joueur";
}

/** Membres d'une salle encore en jeu, sauf `except` (celui qui vient d'agir). */
export async function roomMembersExcept(roomId: string, except: string): Promise<string[]> {
  const { rows } = await pool.query(
    "select user_id from room_members where room_id = $1 and status = 'joined' and not career_ended and user_id <> $2", [roomId, except]);
  return rows.map((r) => r.user_id as string);
}

export async function notify(userIds: (string | null | undefined)[], kind: NotificationKind, payload: Record<string, unknown>): Promise<void> {
  const ids = [...new Set(userIds.filter((x): x is string => typeof x === "string" && x.length > 0))];
  if (!ids.length) return;
  try {
    await pool.query(
      "insert into notifications (user_id, kind, payload) select unnest($1::uuid[]), $2, $3::jsonb", [ids, kind, JSON.stringify(payload)]);
    notifyUsers(ids);
  } catch (_) { /* best-effort */ }
}
