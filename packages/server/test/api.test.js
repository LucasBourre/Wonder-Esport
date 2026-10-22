// Tests de bout en bout du serveur : de vraies requêtes HTTP sur un serveur
// lancé contre une base Postgres vide.
//
//   TEST_SERVER_URL=http://localhost:3000 npm test
//
// Sans TEST_SERVER_URL, ces tests sont ignorés (ils demandent une base).
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadEngine } = require("../../engine/test/load-engine");

const BASE = process.env.TEST_SERVER_URL;
const ORIGIN = process.env.TEST_ORIGIN || "http://localhost:5173";
const skip = BASE ? false : "TEST_SERVER_URL absent";
const E = loadEngine();
const tag = Date.now().toString(36);

/** Un joueur : garde son cookie de session d'une requête à l'autre. */
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
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    return { status: res.status, json };
  };
  return {
    get: (path) => call("GET", path),
    post: (path, body) => call("POST", path, body ?? {}),
    rpc: async (name, args) => { const r = await call("POST", "/api/rpc/" + name, args ?? {}); return { status: r.status, ...(r.json || {}) }; },
    get cookie() { return cookie; },
  };
}
async function player(name) {
  const c = client();
  const email = name + "-" + tag + "@exemple.test";
  const up = await c.post("/api/auth/signup", { email, password: "motdepasse-" + name });
  assert.equal(up.status, 200, JSON.stringify(up.json));
  c.id = up.json.session.user.id;
  c.email = email;
  c.pseudo = (name + tag).slice(0, 24);
  const set = await c.rpc("profile_set_pseudo", { pseudo: c.pseudo });
  assert.equal(set.status, 200, JSON.stringify(set));
  return c;
}
const today = () => new Date().toISOString().slice(0, 10);
const choices = (n) => Array.from({ length: 300 }, (_, k) => ((n * 7 + k * 3) % 5) - 1);

test("santé : le serveur et le moteur répondent", { skip }, async () => {
  const r = await client().get("/api/health");
  assert.equal(r.status, 200);
  assert.equal(r.json.engine, E.ENGINE_VERSION);
});

test("compte : inscription, session, déconnexion, connexion", { skip }, async () => {
  const c = client();
  const email = "compte-" + tag + "@exemple.test";
  assert.equal((await c.get("/api/auth/session")).json.session, null);
  assert.equal((await c.post("/api/auth/signup", { email: "pas-un-email", password: "motdepasse" })).status, 400);
  assert.equal((await c.post("/api/auth/signup", { email, password: "court" })).status, 400);
  const up = await c.post("/api/auth/signup", { email, password: "motdepasse1" });
  assert.equal(up.json.session.user.email, email);
  assert.match(c.cookie, /^oe_session=/);
  assert.equal((await c.get("/api/auth/session")).json.session.user.id, up.json.session.user.id);
  // Même adresse, casse différente : refusée.
  const dup = await client().post("/api/auth/signup", { email: email.toUpperCase(), password: "motdepasse1" });
  assert.equal(dup.status, 409);
  assert.match(dup.json.error.message, /already registered/);

  await c.post("/api/auth/logout");
  assert.equal((await c.get("/api/auth/session")).json.session, null);
  const bad = await c.post("/api/auth/login", { email, password: "mauvais-mot" });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error.message, /Invalid login credentials/);
  assert.equal((await c.post("/api/auth/login", { email, password: "motdepasse1" })).status, 200);

  // Changement de mot de passe : l'ancien est exigé, puis ne marche plus.
  assert.equal((await c.post("/api/auth/password", { current: "faux", password: "nouveau-mot-2" })).status, 400);
  assert.equal((await c.post("/api/auth/password", { current: "motdepasse1", password: "nouveau-mot-2" })).status, 200);
  assert.ok((await c.get("/api/auth/session")).json.session, "la session survit au changement");
  const d = client();
  assert.equal((await d.post("/api/auth/login", { email, password: "motdepasse1" })).status, 400);
  assert.equal((await d.post("/api/auth/login", { email, password: "nouveau-mot-2" })).status, 200);
});

test("une écriture venue d'un autre site est refusée", { skip }, async () => {
  const res = await fetch(BASE + "/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://ailleurs.exemple" }, body: "{}" });
  assert.equal(res.status, 403);
});

test("procédures : inconnue, réservée au serveur, sans connexion", { skip }, async () => {
  const c = client();
  assert.equal((await c.rpc("nexiste_pas")).status, 404);
  // Fonctions SQL internes : jamais appelables de l'extérieur.
  for (const name of ["rate_take", "record_daily_score", "room_maybe_advance_season", "app_user_id", "constructor", "__proto__"]) {
    assert.equal((await c.rpc(name, {})).status, 404, name);
  }
  assert.equal((await c.rpc("save_get")).status, 401);
  assert.equal((await c.rpc("room_create")).status, 401);
  assert.equal((await c.rpc("daily_top", { d: today(), lim: 5, intrus: 1 })).status, 400);
  assert.deepEqual((await c.rpc("daily_top", { d: "1999-01-01", lim: 5 })).data, []);
});

test("pseudo : unicité sans tenir compte de la casse, mots interdits", { skip }, async () => {
  const a = await player("pseudoa");
  const b = await player("pseudob");
  const taken = await b.rpc("profile_set_pseudo", { pseudo: a.pseudo.toUpperCase() });
  assert.equal(taken.status, 409);
  assert.equal((await b.rpc("profile_set_pseudo", { pseudo: "x" })).status, 400);
  assert.equal((await b.rpc("profile_set_pseudo", { pseudo: "Le Nazi" })).error.code, "pseudo_forbidden");
  assert.equal((await b.rpc("profile_me")).data.pseudo, b.pseudo, "un refus ne change rien");
  assert.equal((await client().rpc("profile_find", { pseudo: a.pseudo.toUpperCase() })).data.user_id, a.id);
  assert.equal((await client().rpc("profile_find", { pseudo: "%" })).data, null, "% n'est pas un joker");
});

test("sauvegarde : écriture, relecture, conflit entre deux appareils", { skip }, async () => {
  const a = await player("save");
  assert.equal((await a.rpc("save_get")).data, null);
  const first = await a.rpc("save_put", { data: { openEleven_current: "v1" }, expected: null });
  assert.equal(first.data.ok, true);
  const got = await a.rpc("save_get");
  assert.deepEqual(got.data.data, { openEleven_current: "v1" });
  assert.equal(got.data.updated_at, first.data.updated_at);
  // Un second appareil, resté sur une version plus ancienne, est refusé…
  const stale = await a.rpc("save_put", { data: { openEleven_current: "périmé" }, expected: "2020-01-01T00:00:00.000Z" });
  assert.equal(stale.data.conflict, true);
  assert.equal(stale.data.serverStamp, first.data.updated_at);
  assert.deepEqual((await a.rpc("save_get")).data.data, { openEleven_current: "v1" });
  // …sauf s'il connaît la bonne version, ou s'il force.
  const next = await a.rpc("save_put", { data: { openEleven_current: "v2" }, expected: first.data.updated_at });
  assert.equal(next.data.ok, true);
  assert.equal((await a.rpc("save_put", { data: { openEleven_current: "v3" }, expected: null, force: true })).data.ok, true);
  assert.equal((await a.rpc("save_put", { data: "pas un objet" })).status, 400);
  // La sauvegarde d'un joueur n'est lisible que par lui.
  const b = await player("save2");
  assert.equal((await b.rpc("save_get")).data, null);
});

test("amis : invitation, acceptation, invitations croisées, retrait", { skip }, async () => {
  const a = await player("amia"), b = await player("amib"), c = await player("amic");
  assert.equal((await a.rpc("friend_request", { friend_id: a.id })).status, 400);
  assert.equal((await a.rpc("friend_request", { friend_id: b.id })).data.accepted, false);
  assert.equal((await a.rpc("friend_request", { friend_id: b.id })).error.code, "duplicate");
  let lb = (await b.rpc("friends_list")).data;
  assert.equal(lb.incoming.length, 1);
  assert.equal(lb.incoming[0].from_pseudo, a.pseudo);
  assert.equal(lb.friends.length, 0, "une invitation n'est pas encore une amitié");
  assert.equal((await a.rpc("friends_list")).data.outgoing.length, 1);
  // Tant que B n'a pas accepté, A ne voit pas son profil complet.
  assert.deepEqual((await a.rpc("friend_profile", { p_pseudo: b.pseudo })).data, []);
  assert.equal((await c.rpc("friend_accept", { from_id: a.id })).status, 404, "C n'a reçu aucune invitation");
  assert.equal((await b.rpc("friend_accept", { from_id: a.id })).status, 200);
  assert.equal((await a.rpc("friends_list")).data.friends[0].friend_id, b.id);
  assert.equal((await b.rpc("friends_list")).data.friends[0].friend_id, a.id);
  assert.equal((await a.rpc("friend_profile", { p_pseudo: b.pseudo })).data[0].pseudo, b.pseudo);
  assert.deepEqual((await c.rpc("friend_profile", { p_pseudo: b.pseudo })).data, []);
  // Invitations croisées : la seconde vaut acceptation.
  await a.rpc("friend_request", { friend_id: c.id });
  assert.equal((await c.rpc("friend_request", { friend_id: a.id })).data.accepted, true);
  assert.equal((await a.rpc("friends_list")).data.friends.length, 2);
  await a.rpc("friend_remove", { friend_id: b.id });
  assert.equal((await b.rpc("friends_list")).data.friends.length, 0);
});

test("défi du jour : le score est recalculé par le serveur", { skip }, async () => {
  const a = await player("daily");
  const date = today(), ch = choices(3);
  const expected = Math.round(E.scoreDaily(date, ch));
  assert.equal((await client().post("/api/scores/daily", { date, choices: ch })).status, 401);
  assert.equal((await a.post("/api/scores/daily", { date: "2020-01-01", choices: ch })).status, 400);
  assert.equal((await a.post("/api/scores/daily", { date, choices: [99] })).status, 400);
  assert.equal((await a.post("/api/scores/daily", { date, choices: ch, v: "0.1" })).status, 409);
  // Un score annoncé par le client est ignoré : seul le rejeu compte.
  const r = await a.post("/api/scores/daily", { date, choices: ch, v: E.ENGINE_VERSION, score: 999 });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.score, expected);
  assert.equal(r.json.pseudo, a.pseudo);
  assert.equal((await a.post("/api/scores/daily", { date, choices: ch })).status, 429, "pas deux envois coup sur coup");
  const top = (await client().rpc("daily_top", { d: date, lim: 100 })).data;
  const mine = top.find((row) => row.user_id === a.id);
  assert.equal(mine.score, expected);
  assert.equal(typeof mine.rank, "number");
  const rank = (await client().rpc("daily_rank", { d: date, sc: expected })).data[0];
  assert.ok(rank.rank >= 1 && rank.players >= 1);
  assert.ok((await client().rpc("range_top", { since: "", lim: 100 })).data.some((row) => row.user_id === a.id));
  assert.equal((await a.rpc("friends_daily", { d: date, lim: 10 })).data[0].is_me, true);
});

test("duel : création, réponse, vainqueur décidé par le rejeu", { skip }, async () => {
  const a = await player("duela"), b = await player("duelb"), c = await player("duelc");
  const seed = 424242, ca = choices(1), cb = choices(2);
  const sa = Math.round(E.scoreDuel(seed, ca)), sb = Math.round(E.scoreDuel(seed, cb));
  assert.equal((await a.post("/api/scores/duel", { action: "create", seed, choices: ca, toPseudo: a.pseudo })).status, 400);
  const created = await a.post("/api/scores/duel", { action: "create", seed, choices: ca, toPseudo: b.pseudo.toUpperCase(), v: E.ENGINE_VERSION });
  assert.equal(created.status, 200, JSON.stringify(created.json));
  assert.equal(created.json.from_score, sa);
  const incoming = (await b.rpc("duels_incoming")).data;
  assert.equal(incoming.length, 1);
  assert.equal(incoming[0].seed, seed);
  assert.deepEqual(incoming[0].from_choices, ca);
  assert.equal((await a.rpc("duels_outgoing")).data.length, 1);
  assert.equal((await c.post("/api/scores/duel", { action: "respond", id: created.json.id, choices: cb })).status, 403);
  assert.equal((await a.post("/api/scores/duel", { action: "respond", id: created.json.id, choices: cb })).status, 400);
  const done = await b.post("/api/scores/duel", { action: "respond", id: created.json.id, choices: cb });
  assert.equal(done.status, 200, JSON.stringify(done.json));
  assert.equal(done.json.to_score, sb);
  assert.equal(done.json.winner, sb > sa ? "to" : sa > sb ? "from" : "tie");
  const hist = (await a.rpc("duels_history")).data;
  assert.equal(hist[0].i_am, "from");
  assert.equal((await b.rpc("duels_incoming")).data.length, 0);
  // Annulation d'un défi en attente : seulement par son auteur.
  await new Promise((r) => setTimeout(r, 6200)); // délai imposé entre deux créations
  const second = await a.post("/api/scores/duel", { action: "create", seed, choices: ca, toPseudo: c.pseudo });
  assert.equal(second.status, 200, JSON.stringify(second.json));
  assert.equal((await b.rpc("duel_cancel", { p_id: second.json.id })).data, false);
  assert.equal((await a.rpc("duel_cancel", { p_id: second.json.id })).data, true);
});

test("salle : création, invitation, lancement, saison, vote, signal en direct", { skip }, async (t) => {
  const a = await player("salla"), b = await player("sallb"), x = await player("sallx");
  const roomId = (await a.rpc("room_create")).data;
  assert.match(roomId, /^[0-9a-f-]{36}$/);
  assert.equal((await a.rpc("room_create")).status, 400, "une seule salle active à la fois");
  assert.equal((await a.rpc("room_invite", { p_room_id: roomId, p_friend_id: b.id })).status, 400, "on n'invite que des amis");
  await a.rpc("friend_request", { friend_id: b.id });
  await b.rpc("friend_accept", { from_id: a.id });
  assert.equal((await a.rpc("room_invite", { p_room_id: roomId, p_friend_id: b.id })).status, 200);
  const mineB = (await b.rpc("rooms_mine")).data;
  assert.deepEqual(mineB.invitations, [{ roomId, fromPseudo: a.pseudo }]);
  assert.equal((await b.rpc("room_join", { p_room_id: roomId })).status, 200);
  const mineA = (await a.rpc("rooms_mine")).data;
  assert.equal(mineA.rooms[0].isCreator, true);
  assert.equal(mineA.rooms[0].members.length, 2);
  // Un joueur extérieur ne voit rien de la salle, ni par HTTP ni en direct.
  assert.equal((await x.rpc("room_state", { room_id: roomId })).status, 404);
  assert.equal((await x.rpc("room_launch", { p_room_id: roomId, p_club_id: "fr_paris" })).status, 400);

  // Signal en direct : B écoute la salle, A agit.
  const signals = [];
  const ws = new WebSocket(BASE.replace(/^http/, "ws") + "/api/live?room=" + roomId, { headers: { Cookie: b.cookie } });
  t.after(() => ws.close()); // même en cas d'échec : une connexion ouverte empêcherait le test de finir
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error("WebSocket refusé")); });
  ws.onmessage = (m) => signals.push(m.data);
  const intrus = new WebSocket(BASE.replace(/^http/, "ws") + "/api/live?room=" + roomId, { headers: { Cookie: x.cookie } });
  const closed = await new Promise((resolve) => { intrus.onclose = (e) => resolve(e.code); });
  assert.equal(closed, 4403);

  assert.equal((await a.rpc("room_launch", { p_room_id: roomId, p_club_id: "fr_paris" })).status, 200);
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(signals.length >= 1, "B est prévenu du lancement");
  let st = (await b.rpc("room_state", { room_id: roomId })).data;
  assert.equal(st.room.phase, "in_season");
  assert.equal(st.room.club_id, "fr_paris");
  assert.equal(st.me, b.id);

  // Fin de saison : A a une offre, B non → un vote de mercato s'ouvre quand
  // les deux ont rendu leur bilan, et les trophées de club sont mis en commun.
  await a.rpc("room_report_season", { p_room_id: roomId, p_pending_offer: { offers: ["es_madrid"], forced: false }, p_club_trophies: ["league"] });
  st = (await a.rpc("room_state", { room_id: roomId })).data;
  assert.equal(st.progress.ready, true);
  assert.equal(st.openVote, null);
  await b.rpc("room_report_season", { p_room_id: roomId, p_pending_offer: { offers: [] }, p_club_trophies: [] });
  st = (await b.rpc("room_state", { room_id: roomId })).data;
  assert.equal(st.room.phase, "season_vote");
  assert.deepEqual(st.room.season_trophies, ["league"]);
  assert.deepEqual(st.openVote.candidates, ["es_madrid", "stay"]);
  await a.rpc("room_cast_vote", { p_vote_id: st.openVote.id, p_choice: "es_madrid" });
  st = (await a.rpc("room_state", { room_id: roomId })).data;
  assert.equal(st.openVote.ballots.length, 1);
  await b.rpc("room_cast_vote", { p_vote_id: st.openVote.id, p_choice: "es_madrid" });
  st = (await a.rpc("room_state", { room_id: roomId })).data;
  assert.equal(st.room.phase, "in_season");
  assert.equal(st.openVote, null);
  assert.equal(st.lastClosedVote.result.choice, "es_madrid");
  assert.equal(st.room.season_year, 1);

  // Écritures simultanées : les deux bilans partent au même instant, saison
  // après saison. Sans verrou par salle, chacun compterait sans voir l'autre
  // et la saison n'avancerait jamais.
  for (let i = 0; i < 6; i++) {
    const before = (await a.rpc("room_state", { room_id: roomId })).data.room.season_year;
    const both = await Promise.all([a, b].map((p) => p.rpc("room_report_season", { p_room_id: roomId, p_pending_offer: { offers: [] }, p_club_trophies: [] })));
    assert.deepEqual(both.map((r) => r.status), [200, 200]);
    st = (await a.rpc("room_state", { room_id: roomId })).data;
    assert.equal(st.room.season_year, before + 1, "saison bloquée au tour " + i);
    assert.equal(st.progress.ready, false);
  }
  // Même chose pour un vote : les deux bulletins arrivent ensemble, il se clôt.
  await a.rpc("room_open_transfer_vote", { p_room_id: roomId, p_offers: ["it_milan"], p_forced: false });
  st = (await a.rpc("room_state", { room_id: roomId })).data;
  await Promise.all([a, b].map((p) => p.rpc("room_cast_vote", { p_vote_id: st.openVote.id, p_choice: "stay" })));
  st = (await a.rpc("room_state", { room_id: roomId })).data;
  assert.equal(st.openVote, null, "le vote reste ouvert alors que tout le monde a voté");
  assert.equal(st.lastClosedVote.result.choice, "stay");

  // Statistiques en direct et fin de carrière.
  await a.rpc("room_update_stats", { p_room_id: roomId, p_stats: { totalGoals: 12 } });
  await a.rpc("room_mark_career_ended", { p_room_id: roomId, p_score: 512.5, p_summary: { title: "Légende" } });
  await b.rpc("room_mark_career_ended", { p_room_id: roomId, p_score: 300, p_summary: {} });
  st = (await a.rpc("room_state", { room_id: roomId })).data;
  assert.equal(st.room.status, "ended");
  const me = st.members.find((m) => m.user_id === a.id);
  assert.equal(me.final_score, 512.5);
  assert.deepEqual(me.live_stats, { totalGoals: 12 });
});
