// PROTOTYPE - NOT FOR PRODUCTION
// Question: Can two remote players quickly join and enjoy a real-time dodgeball match?
// Date: 2026-10-28
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { WebSocket, WebSocketServer } from "ws";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4175);
const HOST = process.env.HOST || "0.0.0.0";
const W = 960, H = 540, EDGE = 34, PLAYER_R = 22, BALL_R = 11;
const rooms = new Map();

function createRoom() {
  let code;
  do { code = randomBytes(3).toString("hex").toUpperCase(); } while (rooms.has(code));
  const players = [
    { x: 190, y: H / 2, angle: 0, score: 0, held: true, input: { up: false, down: false, left: false, right: false }, socket: null },
    { x: W - 190, y: H / 2, angle: Math.PI, score: 0, held: false, input: { up: false, down: false, left: false, right: false }, socket: null },
  ];
  const room = {
    code, players, winner: null, pause: 0, notice: "En attente d’un adversaire…", noticeUntil: 0,
    ball: { x: 218, y: H / 2, vx: 0, vy: 0, owner: 0, thrower: 0 },
    lastTick: performance.now(), cleanup: null,
  };
  rooms.set(code, room);
  return room;
}

function connected(room) { return room.players.map((player) => Boolean(player.socket && player.socket.readyState === WebSocket.OPEN)); }

function send(socket, value) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
}

function snapshot(room) {
  return {
    type: "state",
    room: room.code,
    connected: connected(room),
    players: room.players.map(({ x, y, angle, score, held }) => ({ x, y, angle, score, held })),
    ball: { x: room.ball.x, y: room.ball.y, owner: room.ball.owner },
    winner: room.winner,
    notice: room.notice,
    pause: room.pause,
  };
}

function broadcast(room) {
  const data = JSON.stringify(snapshot(room));
  for (const player of room.players) {
    if (player.socket && player.socket.readyState === WebSocket.OPEN) player.socket.send(data);
  }
}

function resetRally(room, receiver) {
  room.players[0].x = 190; room.players[0].y = H / 2; room.players[0].angle = 0;
  room.players[1].x = W - 190; room.players[1].y = H / 2; room.players[1].angle = Math.PI;
  room.players[0].held = receiver === 0;
  room.players[1].held = receiver === 1;
  room.ball.owner = receiver;
  room.ball.thrower = receiver;
  room.pause = 0.75;
}

function performAction(room, index, action) {
  if (!connected(room).every(Boolean)) return;
  const player = room.players[index];
  if (action === "restart" && room.winner !== null) {
    room.players[0].score = 0; room.players[1].score = 0;
    room.winner = null;
    room.notice = "";
    resetRally(room, 0);
    return;
  }
  if (room.winner !== null || room.pause > 0) return;
  if (action === "throw" && player.held) {
    player.held = false;
    room.ball.owner = -1;
    room.ball.thrower = index;
    room.ball.vx = Math.cos(player.angle) * 520;
    room.ball.vy = Math.sin(player.angle) * 520;
  } else if (action === "catch" && !player.held && room.ball.owner === -1) {
    if (Math.hypot(room.ball.x - player.x, room.ball.y - player.y) < 58) {
      room.players[1 - index].held = false;
      player.held = true;
      room.ball.owner = index;
      room.ball.thrower = index;
      room.ball.vx = 0; room.ball.vy = 0;
      room.notice = `Joueur ${index + 1} attrape la balle !`;
      room.noticeUntil = performance.now() + 1200;
    }
  }
}

function tick(room, now) {
  const dt = Math.min((now - room.lastTick) / 1000, 0.05);
  room.lastTick = now;
  if (!connected(room).every(Boolean) || room.winner !== null) return;
  if (room.pause > 0) { room.pause = Math.max(0, room.pause - dt); return; }
  if (now > room.noticeUntil) room.notice = "";
  for (const player of room.players) {
    let dx = Number(player.input.right) - Number(player.input.left);
    let dy = Number(player.input.down) - Number(player.input.up);
    const length = Math.hypot(dx, dy);
    if (length) {
      dx /= length; dy /= length;
      player.x += dx * 245 * dt;
      player.y += dy * 245 * dt;
      player.angle = Math.atan2(dy, dx);
    }
    player.x = Math.max(EDGE + PLAYER_R, Math.min(W - EDGE - PLAYER_R, player.x));
    player.y = Math.max(EDGE + PLAYER_R, Math.min(H - EDGE - PLAYER_R, player.y));
  }
  if (room.ball.owner >= 0) {
    const owner = room.players[room.ball.owner];
    room.ball.x = owner.x + Math.cos(owner.angle) * 28;
    room.ball.y = owner.y + Math.sin(owner.angle) * 28;
    return;
  }

  const ball = room.ball;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt;
  const left = EDGE + BALL_R, right = W - EDGE - BALL_R;
  const top = EDGE + BALL_R, bottom = H - EDGE - BALL_R;
  if (ball.x < left) { ball.x = left; ball.vx = Math.abs(ball.vx) * 0.94; }
  if (ball.x > right) { ball.x = right; ball.vx = -Math.abs(ball.vx) * 0.94; }
  if (ball.y < top) { ball.y = top; ball.vy = Math.abs(ball.vy) * 0.94; }
  if (ball.y > bottom) { ball.y = bottom; ball.vy = -Math.abs(ball.vy) * 0.94; }
  ball.vx *= Math.pow(0.996, dt * 60);
  ball.vy *= Math.pow(0.996, dt * 60);

  const targetIndex = 1 - ball.thrower;
  const target = room.players[targetIndex];
  if (Math.hypot(ball.x - target.x, ball.y - target.y) < PLAYER_R + BALL_R) {
    const scorer = ball.thrower;
    room.players[scorer].score++;
    if (room.players[scorer].score >= 3) {
      room.winner = scorer;
      room.notice = `Joueur ${scorer + 1} remporte le match !`;
      room.noticeUntil = now + 1200;
    } else {
      room.notice = `Joueur ${scorer + 1} touche son adversaire !`;
      room.noticeUntil = now + 1200;
      resetRally(room, 1 - scorer);
    }
    return;
  }
  if (Math.abs(ball.vx) + Math.abs(ball.vy) < 70) resetRally(room, 1 - ball.thrower);
}

function fail(socket, message) {
  send(socket, { type: "error", message });
  socket.close(1008, message);
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, activeRooms: rooms.size }));
    return;
  }
  if (pathname !== "/" && pathname !== "/prototype.html") {
    response.writeHead(404); response.end("Not found"); return;
  }
  try {
    const html = await readFile(join(ROOT, "prototype.html"));
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    response.end(html);
  } catch (error) {
    console.error("Could not read prototype.html", error);
    response.writeHead(500); response.end("Prototype page unavailable");
  }
});

const sockets = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on("upgrade", (request, networkSocket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname !== "/ws") { networkSocket.destroy(); return; }
  sockets.handleUpgrade(request, networkSocket, head, (socket) => sockets.emit("connection", socket, request));
});

sockets.on("connection", (socket, request) => {
  const query = new URL(request.url, `http://${request.headers.host}`).searchParams;
  let room;
  let index;
  if (query.get("create") === "1") {
    room = createRoom();
    index = 0;
  } else {
    const code = (query.get("room") || "").toUpperCase();
    room = rooms.get(code);
    if (!room) { fail(socket, "Ce salon n’existe plus. Demande une nouvelle invitation."); return; }
    index = room.players.findIndex((player) => !player.socket || player.socket.readyState !== WebSocket.OPEN);
    if (index < 0) { fail(socket, "Ce salon est complet."); return; }
    clearTimeout(room.cleanup);
  }

  room.players[index].socket = socket;
  room.players[index].input = { up: false, down: false, left: false, right: false };
  send(socket, { type: "joined", room: room.code, slot: index, state: snapshot(room) });
  broadcast(room);

  socket.on("message", (buffer) => {
    let message;
    try { message = JSON.parse(buffer.toString()); }
    catch { fail(socket, "Message invalide."); return; }
    if (!message || typeof message !== "object") { fail(socket, "Message invalide."); return; }
    const player = room.players[index];
    if (message.type === "input" && message.input && typeof message.input === "object") {
      for (const action of ["up", "down", "left", "right"]) {
        if (typeof message.input[action] === "boolean") player.input[action] = message.input[action];
      }
    } else if (message.type === "action" && ["throw", "catch", "restart"].includes(message.action)) {
      performAction(room, index, message.action);
      broadcast(room);
    }
  });

  socket.on("close", () => {
    const player = room.players[index];
    if (player.socket === socket) {
      player.socket = null;
      player.input = { up: false, down: false, left: false, right: false };
      broadcast(room);
      room.cleanup = setTimeout(() => {
        if (room.players.every((entry) => !entry.socket)) rooms.delete(room.code);
      }, 60000);
      room.cleanup.unref();
    }
  });
});

setInterval(() => {
  const now = performance.now();
  for (const room of rooms.values()) {
    tick(room, now);
    broadcast(room);
  }
}, 50).unref();

server.listen(PORT, HOST, () => {
  console.log(`Chatball prototype: http://localhost:${PORT}`);
  console.log(`LAN address: http://<this-computer-ip>:${PORT}`);
});
