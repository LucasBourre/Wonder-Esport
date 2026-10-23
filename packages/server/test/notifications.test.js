// Notifications : ce que reçoit un joueur quand un autre l'invite, l'ajoute, rejoint sa salle…
// Demande un serveur lancé sur une base vide (ignoré sans TEST_SERVER_URL).
const test = require("node:test");
const assert = require("node:assert/strict");

const BASE = process.env.TEST_SERVER_URL;
const ORIGIN = process.env.TEST_ORIGIN || "http://localhost:5173";
const skip = BASE ? false : "TEST_SERVER_URL absent";
const tag = Date.now().toString(36);

function client() {
  let cookie = "";
  // Chaque joueur de test a sa propre adresse : les limites de débit du serveur sont par
  // adresse, et toute la suite sortirait sinon de la même (127.0.0.1).
  const ip = "10." + [1, 2, 3].map(() => Math.floor(Math.random() * 250) + 1).join(".");
  const call = async (method, path, body) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { "Content-Type": "application/json", Origin: ORIGIN, "X-Forwarded-For": ip, ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    const set = res.headers.getSetCookie();
    if (set.length) cookie = set[0].split(";")[0];
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  return {
    post: (path, body) => call("POST", path, body ?? {}),
    rpc: async (name, args) => { const r = await call("POST", "/api/rpc/" + name, args ?? {}); return { status: r.status, ...(r.json || {}) }; },
  };
}
async function player(name) {
  const c = client();
  const up = await c.post("/api/auth/signup", { email: name + "-" + tag + "@exemple.test", password: "mot-de-passe-long-" + name });
  assert.equal(up.status, 200, JSON.stringify(up.json));
  c.id = up.json.session.user.id;
  const set = await c.rpc("profile_set_pseudo", { pseudo: (name + tag).slice(0, 24) });
  assert.equal(set.status, 200, JSON.stringify(set));
  return c;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Les notifications partent juste après la réponse : on laisse au serveur le temps de les écrire.
async function inbox(p) {
  for (let i = 0; i < 20; i++) {
    const r = await p.rpc("notifications_list");
    if (r.status === 200 && r.data && r.data.items.length) return r.data;
    await wait(100);
  }
  return (await p.rpc("notifications_list")).data;
}
const kinds = (box) => box.items.map((n) => n.kind);

test("demande d'ami, ami accepté, invitation et arrivée dans une salle", { skip }, async () => {
  const a = await player("na"), b = await player("nb");
  assert.equal((await a.rpc("friend_request", { friend_id: b.id })).status, 200);
  let box = await inbox(b);
  assert.deepEqual(kinds(box), ["friend_request"]);
  assert.equal(box.unread, 1);
  assert.equal(box.items[0].payload.from, ("na" + tag).slice(0, 24));
  assert.equal(box.items[0].payload.fromId, a.id, "l'identifiant sert au bouton « Accepter »");

  assert.equal((await b.rpc("friend_accept", { from_id: box.items[0].payload.fromId })).status, 200);
  box = await inbox(a);
  assert.deepEqual(kinds(box), ["friend_accepted"]);
  await wait(200);
  assert.equal((await b.rpc("notifications_list")).data.items[0].payload.done, true, "la demande acceptée ne propose plus ses boutons");

  const roomId = (await a.rpc("room_create")).data;
  await a.rpc("room_invite", { p_room_id: roomId, p_friend_id: b.id });
  await wait(300);
  box = (await b.rpc("notifications_list")).data;
  assert.equal(box.items[0].kind, "room_invite");
  assert.equal(box.items[0].payload.roomId, roomId, "l'identifiant sert au bouton « Rejoindre »");

  await b.rpc("room_join", { p_room_id: roomId });
  await wait(300);
  box = (await a.rpc("notifications_list")).data;
  assert.equal(box.items[0].kind, "room_joined");
  assert.equal((await b.rpc("notifications_list")).data.items.find((n) => n.kind === "room_invite").payload.done, true, "l'invitation rejointe est marquée faite");
});

test("marquer comme lu, et personne d'autre ne voit mes notifications", { skip }, async () => {
  const a = await player("nc"), b = await player("nd"), c = await player("ne");
  await a.rpc("friend_request", { friend_id: b.id });
  let box = await inbox(b);
  assert.equal(box.unread, 1);
  assert.equal((await b.rpc("notifications_read")).status, 200);
  box = (await b.rpc("notifications_list")).data;
  assert.equal(box.unread, 0);
  assert.ok(box.items.every((n) => n.read));
  assert.equal((await c.rpc("notifications_list")).data.items.length, 0);
  assert.equal((await client().rpc("notifications_list")).status, 401, "sans compte, rien");
});
