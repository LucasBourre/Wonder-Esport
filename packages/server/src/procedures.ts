// Procédures écrites ici, en TypeScript : sauvegarde, profil, amis, lecture
// des salles. Chacune remplace un accès direct de l'interface à une table —
// c'est donc ici que se décide qui a le droit de lire ou d'écrire quoi.
import type { Db } from "./db";
import { isAvatarId } from "@open-eleven/content";
import { pseudoForbidden } from "./pseudo";

export class ProcedureError extends Error {
  constructor(message: string, readonly status = 400, readonly code?: string) { super(message); }
}

type Args = Record<string, unknown>;
export interface Procedure {
  /** Sans connexion, la procédure est refusée (401). */
  auth: boolean;
  run: (db: Db, userId: string | null, args: Args) => Promise<unknown>;
}

const MAX_SAVE_BYTES = 6 * 1024 * 1024;
const MAX_STATS_BYTES = 200 * 1024;
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const uuidArg = (args: Args, name: string): string => {
  if (!isUuid(args[name])) throw new ProcedureError("Identifiant invalide : " + name);
  return args[name] as string;
};
const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
const isDuplicate = (err: unknown): boolean => (err as { code?: string }).code === "23505";

async function pseudoOf(db: Db, userId: string): Promise<string | null> {
  const { rows } = await db.query("select pseudo from profiles where user_id = $1", [userId]);
  return rows[0]?.pseudo ?? null;
}

export const procedures: Record<string, Procedure> = {
  // --- Sauvegarde ---------------------------------------------------------------
  // Un seul bloc par joueur, remplacé en entier. `expected` est la date de la
  // version que l'appareil connaît : si le serveur en a une autre, quelqu'un
  // a écrit entre-temps (un second appareil) et l'on refuse plutôt que
  // d'écraser en silence — sauf demande explicite (`force`).
  save_get: {
    auth: true,
    async run(db, me) {
      const { rows } = await db.query("select data, updated_at from saves where user_id = $1", [me]);
      return rows[0] ? { data: rows[0].data, updated_at: iso(rows[0].updated_at) } : null;
    },
  },
  save_put: {
    auth: true,
    async run(db, me, args) {
      const json = JSON.stringify(args.data ?? {});
      if (typeof args.data !== "object" || args.data === null || Array.isArray(args.data)) throw new ProcedureError("Sauvegarde invalide");
      if (Buffer.byteLength(json) > MAX_SAVE_BYTES) throw new ProcedureError("Sauvegarde trop volumineuse", 413);
      const { rows } = await db.query("select updated_at from saves where user_id = $1 for update", [me]);
      const remote = iso(rows[0]?.updated_at);
      if (remote && !args.force && remote !== args.expected) return { ok: false, conflict: true, serverStamp: remote };
      // Horodatage à la milliseconde : c'est la précision que l'interface sait
      // relire et renvoyer telle quelle dans `expected`.
      const saved = await db.query(
        "insert into saves (user_id, data, updated_at) values ($1, $2::jsonb, date_trunc('milliseconds', now())) " +
        "on conflict (user_id) do update set data = excluded.data, updated_at = excluded.updated_at returning updated_at",
        [me, json],
      );
      return { ok: true, updated_at: iso(saved.rows[0].updated_at) };
    },
  },

  // --- Profil -------------------------------------------------------------------
  profile_me: {
    auth: true,
    async run(db, me) {
      const { rows } = await db.query("select pseudo, avatar from profiles where user_id = $1", [me]);
      return { pseudo: rows[0]?.pseudo ?? null, avatar: rows[0]?.avatar ?? null };
    },
  },
  // Avatar : un des identifiants du jeu, ou null pour revenir à l'avatar par défaut.
  // Il faut un pseudo d'abord : l'avatar vit sur la même fiche.
  profile_set_avatar: {
    auth: true,
    async run(db, me, args) {
      const avatar = args.avatar === null ? null : args.avatar;
      if (avatar !== null && !isAvatarId(avatar)) throw new ProcedureError("Avatar inconnu.");
      const r = await db.query("update profiles set avatar = $2 where user_id = $1", [me, avatar]);
      if (!r.rowCount) throw new ProcedureError("Choisis d'abord un pseudo.", 400, "no_pseudo");
      return { avatar };
    },
  },
  profile_set_pseudo: {
    auth: true,
    async run(db, me, args) {
      const pseudo = String(args.pseudo ?? "").trim().slice(0, 24);
      if (pseudo.length < 2) throw new ProcedureError("Pseudo trop court (2 caractères min).");
      if (pseudoForbidden(pseudo)) throw new ProcedureError("Pseudo non autorisé.", 400, "pseudo_forbidden");
      try {
        // L'index unique sur lower(pseudo) est la seule source de vérité.
        await db.query("insert into profiles (user_id, pseudo) values ($1, $2) on conflict (user_id) do update set pseudo = excluded.pseudo", [me, pseudo]);
      } catch (err) {
        if (isDuplicate(err)) throw new ProcedureError("Ce pseudo est déjà pris.", 409, "pseudo_taken");
        throw err;
      }
      return { pseudo };
    },
  },
  // Vitrine publique, déclarée par le joueur (non vérifiée).
  profile_set_stats: {
    auth: true,
    async run(db, me, args) {
      const json = JSON.stringify(args.stats ?? null);
      if (typeof args.stats !== "object" || args.stats === null || Array.isArray(args.stats)) throw new ProcedureError("Statistiques invalides");
      if (Buffer.byteLength(json) > MAX_STATS_BYTES) throw new ProcedureError("Statistiques trop volumineuses", 413);
      await db.query("update profiles set stats = $2::jsonb where user_id = $1", [me, json]);
      return null;
    },
  },
  profile_find: {
    auth: false,
    async run(db, _me, args) {
      const { rows } = await db.query("select user_id, pseudo from profiles where lower(pseudo) = lower($1) limit 1", [String(args.pseudo ?? "").trim()]);
      return rows[0] ?? null;
    },
  },

  // --- Amis ---------------------------------------------------------------------
  // Une amitié = deux lignes (une dans chaque sens) au statut « accepted ».
  // Une invitation = une ligne « pending », du demandeur vers la cible.
  friends_list: {
    auth: true,
    async run(db, me) {
      const cols = "f.user_id, f.friend_id, f.friend_pseudo, f.created_at, f.status";
      // L'avatar de l'autre joueur accompagne chaque ligne (null s'il n'en a pas choisi).
      const mine = await db.query("select " + cols + ", fp.avatar from friends f left join profiles fp on fp.user_id = f.friend_id where f.user_id = $1 order by f.created_at desc", [me]);
      const incoming = await db.query(
        "select " + cols + ", coalesce(p.pseudo, 'Joueur') as from_pseudo, p.avatar from friends f left join profiles p on p.user_id = f.user_id " +
        "where f.friend_id = $1 and f.status = 'pending' order by f.created_at desc", [me]);
      return {
        friends: mine.rows.filter((r) => r.status === "accepted"),
        outgoing: mine.rows.filter((r) => r.status === "pending"),
        incoming: incoming.rows,
      };
    },
  },
  friend_request: {
    auth: true,
    async run(db, me, args) {
      const friendId = uuidArg(args, "friend_id");
      if (friendId === me) throw new ProcedureError("C'est toi !");
      const pseudo = await pseudoOf(db, friendId);
      if (!pseudo) throw new ProcedureError("Aucun joueur avec ce pseudo.", 404);
      // Il nous a déjà invité : on accepte SA demande, sinon deux invitations
      // croisées resteraient en attente face à face.
      const mutual = await db.query("update friends set status = 'accepted' where user_id = $1 and friend_id = $2 and status = 'pending'", [friendId, me]);
      if (mutual.rowCount) {
        await db.query(
          "insert into friends (user_id, friend_id, friend_pseudo, status) values ($1, $2, $3, 'accepted') " +
          "on conflict (user_id, friend_id) do update set status = 'accepted', friend_pseudo = excluded.friend_pseudo", [me, friendId, pseudo]);
        return { pseudo, accepted: true };
      }
      const inserted = await db.query(
        "insert into friends (user_id, friend_id, friend_pseudo, status) values ($1, $2, $3, 'pending') on conflict (user_id, friend_id) do nothing", [me, friendId, pseudo]);
      if (!inserted.rowCount) throw new ProcedureError("Déjà ami ou déjà invité.", 409, "duplicate");
      return { pseudo, accepted: false };
    },
  },
  friend_accept: {
    auth: true,
    async run(db, me, args) {
      const fromId = uuidArg(args, "from_id");
      const accepted = await db.query("update friends set status = 'accepted' where user_id = $1 and friend_id = $2 and status = 'pending'", [fromId, me]);
      if (!accepted.rowCount) throw new ProcedureError("Aucune invitation en attente.", 404);
      await db.query(
        "insert into friends (user_id, friend_id, friend_pseudo, status) values ($1, $2, $3, 'accepted') " +
        "on conflict (user_id, friend_id) do update set status = 'accepted', friend_pseudo = excluded.friend_pseudo",
        [me, fromId, (await pseudoOf(db, fromId)) ?? "Joueur"]);
      return null;
    },
  },
  // Retirer un ami, refuser une invitation reçue, annuler une invitation
  // envoyée : dans les trois cas, le lien disparaît dans les deux sens.
  friend_remove: {
    auth: true,
    async run(db, me, args) {
      const other = uuidArg(args, "friend_id");
      await db.query("delete from friends where (user_id = $1 and friend_id = $2) or (user_id = $2 and friend_id = $1)", [me, other]);
      return null;
    },
  },

  // --- Notifications ----------------------------------------------------------------
  // Les 40 plus récentes, et le nombre de non lues (pour la cloche et le titre de l'onglet).
  notifications_list: {
    auth: true,
    async run(db, me) {
      const list = await db.query(
        "select id, kind, payload, created_at, read_at is not null as read from notifications where user_id = $1 order by created_at desc limit 40", [me]);
      const unread = await db.query("select count(*)::int as n from notifications where user_id = $1 and read_at is null", [me]);
      return { items: list.rows.map((r) => ({ id: Number(r.id), kind: r.kind, payload: r.payload, at: iso(r.created_at), read: r.read })), unread: unread.rows[0].n };
    },
  },
  notifications_read: {
    auth: true,
    async run(db, me) {
      await db.query("update notifications set read_at = now() where user_id = $1 and read_at is null", [me]);
      return null;
    },
  },

  // --- Salles (lecture) -----------------------------------------------------------
  // Les écritures passent par les fonctions SQL room_* ; ici, ce qu'un joueur
  // peut VOIR : ses invitations, ses salles, et l'état complet d'une salle
  // dont il est membre.
  rooms_mine: {
    auth: true,
    async run(db, me) {
      // Invitations reçues : l'hôte (pseudo, avatar) et qui est déjà dans la salle.
      const invitations = await db.query(
        "select m.room_id, coalesce(p.pseudo, 'Joueur') as from_pseudo, p.avatar as from_avatar from room_members m join rooms r on r.id = m.room_id " +
        "left join profiles p on p.user_id = m.invited_by where m.user_id = $1 and m.status = 'invited' and r.status <> 'ended' order by m.created_at desc", [me]);
      const rooms = await db.query(
        "select r.id, r.status, r.phase, r.created_by from room_members m join rooms r on r.id = m.room_id " +
        "where m.user_id = $1 and m.status = 'joined' order by m.created_at desc", [me]);
      const roomIds = [...rooms.rows.map((r) => r.id), ...invitations.rows.map((r) => r.room_id)];
      // Chaque membre : avatar, qui l'a invité, et si son profil de départ est prêt.
      const members = roomIds.length
        ? await db.query(
          "select m.room_id, m.user_id, m.pseudo, m.status, m.invited_by, m.career_ended, m.final_score, m.final_summary, " +
          "m.starting_offers is not null as ready, p.avatar from room_members m left join profiles p on p.user_id = m.user_id " +
          "where m.room_id = any($1::uuid[]) and m.status in ('joined', 'invited') order by m.created_at", [roomIds])
        : { rows: [] as Record<string, unknown>[] };
      return {
        invitations: invitations.rows.map((r) => ({
          roomId: r.room_id, fromPseudo: r.from_pseudo, fromAvatar: r.from_avatar,
          members: members.rows.filter((m) => m.room_id === r.room_id && m.status === "joined").map((m) => ({ pseudo: m.pseudo, avatar: m.avatar })),
        })),
        rooms: rooms.rows.map((r) => ({
          id: r.id, status: r.status, phase: r.phase, isCreator: r.created_by === me, createdBy: r.created_by,
          members: members.rows.filter((m) => m.room_id === r.id),
        })),
      };
    },
  },
  room_state: {
    auth: true,
    async run(db, me, args) {
      const roomId = uuidArg(args, "room_id");
      const member = await db.query("select 1 from room_members where room_id = $1 and user_id = $2", [roomId, me]);
      if (!member.rowCount) throw new ProcedureError("Salle introuvable.", 404);
      const room = (await db.query("select * from rooms where id = $1", [roomId])).rows[0];
      const members = (await db.query(
        "select m.room_id, m.user_id, m.pseudo, m.status, m.starting_offers, m.career_ended, m.final_score, m.final_summary, m.live_stats, p.avatar " +
        "from room_members m left join profiles p on p.user_id = m.user_id where m.room_id = $1 order by m.created_at", [roomId])).rows;
      const openVote = (await db.query("select * from room_votes where room_id = $1 and status = 'open' order by opened_at desc limit 1", [roomId])).rows[0] ?? null;
      if (openVote) openVote.ballots = (await db.query("select vote_id, user_id, choice, cast_at from room_ballots where vote_id = $1", [openVote.id])).rows;
      // Dernier vote de mercato clos : son résultat dit où part l'équipe.
      const lastClosedVote = (await db.query(
        "select * from room_votes where room_id = $1 and status = 'closed' and kind in ('transfer', 'follow_relocation') order by closed_at desc limit 1", [roomId])).rows[0] ?? null;
      const progress = (await db.query("select ready from room_progress where room_id = $1 and user_id = $2", [roomId, me])).rows[0] ?? null;
      return { room, members, openVote, lastClosedVote, progress, me };
    },
  },
};
