// Cohérence du contenu : ce que le contrôle de types ne voit pas (identifiants
// en double, renvois vers une table voisine qui ne mènent nulle part).
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadContent } = require("../../engine/test/load-engine");

const C = loadContent();
const duplicates = (list) => {
  const seen = new Set();
  return list.map((x) => x.id).filter((id) => seen.has(id) || !seen.add(id));
};

test("aucun identifiant en double dans une table", () => {
  for (const [name, table] of Object.entries(C)) {
    if (!Array.isArray(table) || !table.length || typeof table[0] !== "object" || !("id" in table[0])) continue;
    assert.deepEqual(duplicates(table), [], name);
  }
});

test("événements et micro-événements : identifiants uniques, y compris entre les deux tables", () => {
  const ids = [...C.EVENTS, ...C.MICRO_EVENTS].map((e) => e.id);
  assert.deepEqual(duplicates([...C.EVENTS, ...C.MICRO_EVENTS]), [], "identifiant partagé entre deux événements");
  assert.ok(ids.every((id) => typeof id === "string" && id.length > 0), "événement sans identifiant");
  // Les options d'un même événement se distinguent aussi (le journal de choix s'y réfère par rang).
  for (const e of [...C.EVENTS, ...C.MICRO_EVENTS]) {
    const optionIds = (e.options || []).map((o) => o.id).filter(Boolean);
    assert.equal(new Set(optionIds).size, optionIds.length, "options d'id dupliqué dans " + e.id);
  }
});

test("chaque club et chaque nation renvoie à un pays existant", () => {
  const countries = new Set(C.COUNTRIES.map((c) => c.id));
  assert.deepEqual(C.CLUBS.filter((c) => !countries.has(c.countryId)).map((c) => c.id), []);
  assert.deepEqual(C.NATIONALITIES.filter((n) => !countries.has(n.homeCountryId) || (n.clubCountryId && !countries.has(n.clubCountryId))).map((n) => n.id), []);
});

test("chaque club est rangé dans un palier connu", () => {
  assert.deepEqual(C.CLUBS.filter((c) => !C.LEVELS[c.level]).map((c) => c.id), []);
  assert.equal(Object.values(C.CLUBS_BY_LEVEL).reduce((n, l) => n + l.length, 0), C.CLUBS.length);
});

test("Coupe arabe et Jeux régionaux : nations, continents et étapes cohérents", () => {
  const nationIds = new Set(C.NATIONALITIES.map((n) => n.id));
  assert.deepEqual(C.ARAB_NATION_IDS.filter((id) => !nationIds.has(id)), [], "nation arabe absente du jeu");
  assert.equal(new Set(C.ARAB_NATION_IDS).size, C.ARAB_NATION_IDS.length, "doublon dans les nations arabes");
  const continents = new Set(C.COUNTRIES.map((c) => c.continent));
  for (const [continent, g] of Object.entries(C.REGIONAL_GAMES)) {
    assert.ok(continents.has(continent), "continent inconnu : " + continent);
    assert.notEqual(continent, "eu", "pas de Jeux régionaux pour l'Europe");
    assert.ok([0, 1, 2, 3].includes(g.yearMod), g.name + " : année du cycle invalide");
    assert.ok(g.name && g.icon);
  }
  // Les étapes se classent par indice : même ordre que le Mondial, du plus modeste au sacre.
  for (const table of [C.ARAB_CUP_STAGES, C.GAMES_STAGES]) {
    assert.deepEqual(table.map((s) => s.id), ["groups", "quarter", "semi", "final", "champion"]);
    for (const s of table) assert.ok(s.label && s.text && s.baseW > 0 && s.games >= 3, s.id);
  }
  // Un texte d'historique ou d'étape manquant ne se verrait qu'en jeu.
  for (const key of ["arabWinner", "arabFinalist", "arabSemi", "gamesGold", "gamesSilver", "gamesBronze", "gamesBronzeText", "gamesFourthText", "arabWinnerLabel", "arabThirdText", "arabFourthText"]) {
    assert.ok(C.ENGINE_TEXT[key], "ENGINE_TEXT." + key + " manquant");
  }
  assert.ok(C.AWARDS.arab_top_scorer && C.AWARDS.games_top_scorer);
  assert.ok(C.BADGES.some((b) => b.id === "arab_cup") && C.BADGES.some((b) => b.id === "regional_gold"));
});

test("un événement programmé par un autre existe bien", () => {
  const ids = new Set(C.EVENTS.map((e) => e.id));
  const unknown = [];
  for (const e of C.EVENTS) for (const o of e.options) for (const out of o.outcomes || []) {
    if (out.fx && out.fx.sched && !ids.has(out.fx.sched.id)) unknown.push(e.id + " → " + out.fx.sched.id);
  }
  assert.deepEqual(unknown, []);
});
