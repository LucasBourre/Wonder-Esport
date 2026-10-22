// Limites de débit des routes de compte (cf. src/limits.ts).
// Demande un serveur lancé sur une base vide (ignoré sans TEST_SERVER_URL).
const test = require("node:test");
const assert = require("node:assert/strict");

const BASE = process.env.TEST_SERVER_URL;
const ORIGIN = process.env.TEST_ORIGIN || "http://localhost:5173";
const skip = BASE ? false : "TEST_SERVER_URL absent";
const tag = Date.now().toString(36);
const fakeIp = () => "10." + [1, 2, 3].map(() => Math.floor(Math.random() * 250) + 1).join(".");

/** Un client avec SON adresse (X-Forwarded-For) : on choisit qui partage quel réseau. */
function client(ip = fakeIp()) {
  let cookie = "";
  return {
    ip,
    async post(path, body) {
      const res = await fetch(BASE + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: ORIGIN, "X-Forwarded-For": ip, ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify(body ?? {}),
      });
      const set = res.headers.getSetCookie();
      if (set.length) cookie = set[0].split(";")[0];
      return { status: res.status, json: await res.json().catch(() => null) };
    },
  };
}
async function account(name, ip) {
  const c = client(ip);
  const email = name + "-" + tag + "@exemple.test";
  const up = await c.post("/api/auth/signup", { email, password: "bon-mot-de-passe" });
  assert.equal(up.status, 200, JSON.stringify(up.json));
  return email;
}

test("connexion : seuls les échecs comptent, par couple (adresse, compte)", { skip }, async () => {
  const shared = fakeIp(); // un réseau partagé : plusieurs joueurs derrière la même adresse
  const alice = await account("lim-alice", shared);
  const bob = await account("lim-bob", shared);

  // Des connexions RÉUSSIES en nombre ne déclenchent rien (avant : 30 appels et c'était fini).
  for (let i = 0; i < 20; i++) assert.equal((await client(shared).post("/api/auth/login", { email: alice, password: "bon-mot-de-passe" })).status, 200);

  // Huit essais ratés sur Alice : le neuvième est bloqué, même avec le bon mot de passe.
  const attacker = client(shared);
  for (let i = 0; i < 8; i++) assert.equal((await attacker.post("/api/auth/login", { email: alice, password: "faux-" + i })).status, 400);
  assert.equal((await attacker.post("/api/auth/login", { email: alice, password: "faux-8" })).status, 429);
  assert.equal((await attacker.post("/api/auth/login", { email: alice, password: "bon-mot-de-passe" })).status, 429, "bloqué aussi avec le bon mot de passe");

  // Mais ni Bob (même réseau), ni Alice depuis un autre réseau ne sont touchés.
  assert.equal((await client(shared).post("/api/auth/login", { email: bob, password: "bon-mot-de-passe" })).status, 200, "un voisin du même réseau n'est pas puni");
  assert.equal((await client().post("/api/auth/login", { email: alice, password: "bon-mot-de-passe" })).status, 200, "Alice se connecte de chez elle : on ne peut pas la verrouiller à distance");
});

test("connexion : un succès remet les échecs à zéro", { skip }, async () => {
  const ip = fakeIp();
  const email = await account("lim-reset", ip);
  const c = client(ip);
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 7; i++) assert.equal((await c.post("/api/auth/login", { email, password: "faux" })).status, 400, "tour " + round + " essai " + i);
    assert.equal((await c.post("/api/auth/login", { email, password: "bon-mot-de-passe" })).status, 200);
  }
});

test("inscriptions : plafonnées par adresse, sans toucher les autres", { skip }, async () => {
  const ip = fakeIp();
  const results = [];
  for (let i = 0; i < 14; i++) results.push((await client(ip).post("/api/auth/signup", { email: "lim-sign" + i + "-" + tag + "@exemple.test", password: "bon-mot-de-passe" })).status);
  assert.deepEqual(results.slice(0, 12), Array(12).fill(200), "les douze premiers passent");
  assert.deepEqual(results.slice(12), [429, 429], "au-delà, bloqué");
  assert.equal((await client().post("/api/auth/signup", { email: "lim-autre-" + tag + "@exemple.test", password: "bon-mot-de-passe" })).status, 200, "une autre adresse n'est pas concernée");
});

test("changement de mot de passe : deviner l'actuel est limité comme une connexion", { skip }, async () => {
  const ip = fakeIp();
  const email = await account("lim-pass", ip);
  const c = client(ip);
  assert.equal((await c.post("/api/auth/login", { email, password: "bon-mot-de-passe" })).status, 200);
  for (let i = 0; i < 8; i++) assert.equal((await c.post("/api/auth/password", { current: "faux-" + i, password: "nouveau-mot-de-passe-2" })).status, 400);
  assert.equal((await c.post("/api/auth/password", { current: "bon-mot-de-passe", password: "nouveau-mot-de-passe-2" })).status, 429);
});
