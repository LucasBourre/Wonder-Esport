// Salles en direct : un WebSocket par joueur et par salle ouverte.
//
// Le serveur n'y envoie qu'un signal — « quelque chose a changé » — et
// l'interface relit alors l'état de la salle. Aucune donnée ne transite par
// ce canal : les droits de lecture restent ceux de la procédure room_state.
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { currentUser } from "./auth";
import { pool } from "./db";

const watchers = new Map<string, Set<WebSocket>>();
// Canal joueur : un signal « notif » quand une notification arrive (cf. notify.ts).
const userSockets = new Map<string, Set<WebSocket>>();

export function notifyUsers(userIds: string[]): void {
  for (const id of userIds) {
    for (const socket of userSockets.get(id) ?? []) {
      try { socket.send("notif"); } catch { /* socket en cours de fermeture */ }
    }
  }
}

function notifyRoom(roomId: string): void {
  for (const socket of watchers.get(roomId) ?? []) {
    try { socket.send("changed"); } catch { /* socket en cours de fermeture */ }
  }
}

/** Prévient les salles en cours dont ce joueur fait (ou vient de cesser de faire) partie. */
export async function notifyRoomsOf(userId: string): Promise<void> {
  if (!watchers.size) return;
  const { rows } = await pool.query(
    "select m.room_id from room_members m join rooms r on r.id = m.room_id " +
    "where m.user_id = $1 and (r.status <> 'ended' or r.ended_at > now() - interval '5 minutes')", [userId]);
  for (const r of rows) notifyRoom(r.room_id);
}

export function registerLive(app: FastifyInstance): void {
  app.get("/api/live", { websocket: true }, async (socket, req) => {
    const roomId = String((req.query as Record<string, unknown>).room ?? "");
    const user = await currentUser(req);
    // Sans salle : canal personnel du joueur connecté (notifications).
    if (!roomId) {
      if (!user) { socket.close(4403, "forbidden"); return; }
      let mine = userSockets.get(user.id);
      if (!mine) userSockets.set(user.id, (mine = new Set()));
      mine.add(socket);
      socket.on("close", () => {
        mine.delete(socket);
        if (!mine.size) userSockets.delete(user.id);
      });
      return;
    }
    const member = user && /^[0-9a-f-]{36}$/i.test(roomId)
      ? (await pool.query("select 1 from room_members where room_id = $1 and user_id = $2", [roomId, user.id])).rowCount
      : 0;
    if (!member) { socket.close(4403, "forbidden"); return; }

    let set = watchers.get(roomId);
    if (!set) watchers.set(roomId, (set = new Set()));
    set.add(socket);
    socket.on("close", () => {
      set.delete(socket);
      if (!set.size) watchers.delete(roomId);
    });
  });
}
