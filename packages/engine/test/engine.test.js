// Tests du moteur, lancés par « npm test » (node --test, aucune dépendance).
// Ils portent sur les sources TypeScript, assemblées en mémoire avec le contenu.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { loadEngine } = require("./load-engine");
const { computeGolden } = require("./golden");

const E = loadEngine();
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, "golden.json"), "utf8"));

test("le moteur se charge sans navigateur et expose son API", () => {
  for (const fn of ["newCareer", "playSeason", "advanceYear", "transferWindow", "replayDaily", "replayDuel", "scoreDaily", "scoreDuel", "computeCareerScore"]) {
    assert.equal(typeof E[fn], "function", fn + " manquant");
  }
  assert.match(E.ENGINE_VERSION, /^\d+\.\d+$/);
});

test("les carrières de référence se rejouent à l'identique", () => {
  // Une refonte interne ne doit RIEN changer ici. Si une règle change
  // volontairement : avancer ENGINE_VERSION puis régénérer golden.json
  // (node packages/engine/scripts/make-golden.js).
  assert.equal(E.ENGINE_VERSION, golden.engineVersion, "ENGINE_VERSION a changé : régénérer golden.json");
  const now = computeGolden(E);
  assert.equal(now.length, golden.cases.length);
  const diff = now.filter((c, i) => c.print !== golden.cases[i].print || c.score !== golden.cases[i].score);
  assert.equal(diff.length, 0, diff.length + " carrière(s) divergent, la première : " + JSON.stringify(diff[0]));
});

test("un même journal de choix donne deux fois la même carrière", () => {
  const choices = Array.from({ length: 300 }, (_, i) => (i * 5) % 4 - 1);
  const a = JSON.stringify(E.replayDaily("2031-05-17", choices));
  const b = JSON.stringify(E.replayDaily("2031-05-17", choices));
  assert.equal(a, b);
  assert.notEqual(a, JSON.stringify(E.replayDaily("2031-05-18", choices)), "deux dates différentes devraient diverger");
});

test("Coupe arabe et Jeux régionaux : réservés aux bonnes nations, aux bonnes années", () => {
  const { loadContent } = require("./load-engine");
  const C = loadContent();
  const continentOf = new Map(C.COUNTRIES.map((c) => [c.id, c.continent]));
  const natOf = new Map(C.NATIONALITIES.map((n) => [n.id, n]));
  let arab = 0, games = 0, europeanWithGames = 0;
  for (let i = 0; i < 600; i++) {
    const choices = Array.from({ length: 400 }, (_, k) => ((i * 13 + k * 5) % 5) - 1);
    const s = E.replayDuel(70000 + i * 211, choices);
    const runs = s.natRuns || [];
    for (const r of runs.filter((x) => x.comp === "arab")) {
      arab++;
      assert.equal(r.year % 4, 1, "Coupe arabe jouée une année hors cycle : " + r.year);
    }
    for (const r of runs.filter((x) => x.comp === "games")) {
      games++;
      // Un binational qui a changé de sélection (flags.natSwitched) a pu jouer ces
      // Jeux sous son ancienne nationalité : on ne contrôle le continent que si elle est restée la même.
      const def = C.REGIONAL_GAMES[continentOf.get(natOf.get(s.nationality.id).homeCountryId)];
      if (!s.flags.natSwitched && !def) europeanWithGames++;
      assert.ok(r.year % 4 === 2 || r.year % 4 === 3, "Jeux régionaux hors cycle : " + r.year);
      // Jamais deux grands tournois la même année : les Jeux n'accueillent que les non-retenus.
      assert.ok(!runs.some((x) => x.year === r.year && (x.comp === "wc" || x.comp === "olympic")), "Jeux et grand tournoi la même année (" + r.year + ")");
    }
    // Compteurs d'état toujours cohérents avec les médailles.
    const m = s.gamesMedals || { gold: 0, silver: 0, bronze: 0 };
    assert.equal(s.trophies.games || 0, m.gold, "titres des Jeux ≠ médailles d'or");
    assert.ok(runs.filter((x) => x.comp === "games").length >= m.gold + m.silver + m.bronze);
    if (!C.ARAB_NATION_IDS.includes(s.nationality.id) && !s.flags.natSwitched) assert.equal(runs.filter((x) => x.comp === "arab").length, 0, "Coupe arabe jouée par une nation non arabe : " + s.nationality.id);
  }
  assert.ok(arab > 20 && games > 100, "tournois trop rares : " + arab + " Coupes arabes, " + games + " Jeux");
  assert.equal(europeanWithGames, 0, "des Européens ont disputé des Jeux régionaux");
});

test("offres de transfert : nombre selon l'entourage, pays variés, peu d'Afrique hors Afrique", () => {
  const { loadContent } = require("./load-engine");
  const C = loadContent();
  const continentOf = new Map(C.COUNTRIES.map((c) => [c.id, c.continent]));
  // Des joueurs réels de tous les continents, dont on rejoue le mercato à volonté.
  const players = [];
  for (let i = 0; i < 60 && players.length < 40; i++) {
    const choices = Array.from({ length: 400 }, (_, k) => ((i * 7 + k * 3 + (k % 5) * i) % 5) - 1);
    const s = E.replayDuel(51000 + i * 389, choices);
    if (!s.flags.natSwitched) players.push(s);
  }
  const levels = ["regional", "d4", "d3", "d2", "d1", "elite"];
  const sizeFor = (entourage) => {
    let offers = 0, windows = 0;
    for (const p of players) {
      const s = JSON.parse(JSON.stringify(p));
      s.entourage = { id: entourage }; s.flags = {};
      for (const lvl of levels) for (let r = 0; r < 8; r++) {
        const o = E.offersFor(s, { toLevel: lvl });
        if (!o.length) continue;
        windows++; offers += o.length;
        assert.equal(new Set(o.map((x) => x.club.countryId)).size, o.length, "deux offres du même pays");
        assert.ok(o.length <= C.BALANCE.offerCountMax);
      }
    }
    return offers / windows;
  };
  const family = sizeFor("family"), crew = sizeFor("crew"), shark = sizeFor("shark");
  assert.ok(family < crew - 0.6 && crew < shark - 0.6, "famille < bande < agent attendu : " + [family, crew, shark].map((x) => x.toFixed(2)).join(" / "));
  assert.ok(crew > 3, "trop peu d'offres en moyenne : " + crew.toFixed(2));
  // Hors Afrique, l'Afrique ne fournit qu'une petite part des clubs proposés.
  let africa = 0, total = 0;
  for (const p of players) {
    if (continentOf.get(p.nationality.homeCountryId) === "af") continue;
    const s = JSON.parse(JSON.stringify(p)); s.entourage = { id: "crew" }; s.flags = {};
    for (const lvl of levels) for (let r = 0; r < 10; r++) for (const o of E.offersFor(s, { toLevel: lvl })) {
      total++; if (continentOf.get(o.club.countryId) === "af") africa++;
    }
  }
  assert.ok(africa / total < 0.12, "trop de clubs africains proposés à des non-Africains : " + (100 * africa / total).toFixed(1) + " %");
});

test("accord du verbe avec un pays pluriel (« les Pays-Bas ne vous ont… »)", () => {
  const { loadContent } = require("./load-engine");
  const C = loadContent();
  const nat = (id) => C.NATIONALITIES.find((n) => n.id === id);
  const base = E.replayDuel(51000, Array.from({ length: 400 }, (_, k) => (k % 5) - 1));
  const render = (text, over) => E.renderText({ ...base, ...over }, text);
  const t = "{nat} ne vous {nat?a|ont} toujours pas appelé. {altNat} {altNat?revient|reviennent} à la charge.";
  assert.equal(render(t, { nationality: nat("nl"), dualNat: "fr", dualNatAlt: "fr" }), "Les Pays-Bas ne vous ont toujours pas appelé. La France revient à la charge.");
  assert.equal(render(t, { nationality: nat("fr"), dualNat: "nl", dualNatAlt: "nl" }), "La France ne vous a toujours pas appelé. Les Pays-Bas reviennent à la charge.");
  // Aucune marque ne doit survivre à un rendu, quel que soit le pays.
  for (const n of C.NATIONALITIES.slice(0, 80)) assert.ok(!/[{}]/.test(render("{nat} ne vous {nat?a|ont} pas appelé.", { nationality: n })), n.id);
  // Les marques du contenu sont bien formées et ne visent qu'un nom de pays connu.
  const marks = [];
  (function walk(x) {
    if (typeof x === "string") { for (const m of x.matchAll(/\{(\w+)\?([^{}]*)\}/g)) marks.push(m); return; }
    if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") Object.values(x).forEach(walk);
  })({ E: C.EVENTS, T: C.ENGINE_TEXT, M: C.MICRO_EVENTS });
  assert.ok(marks.length >= 6, "marques d'accord attendues dans le contenu : " + marks.length);
  for (const m of marks) {
    assert.ok(["nat", "dualNat", "altNat", "country"].includes(m[1]), "marque sur une variable inconnue : " + m[0]);
    assert.equal(m[2].split("|").length, 2, "forme singulier|pluriel attendue : " + m[0]);
  }
});

test("des carrières longues et variées se rejouent sans erreur", () => {
  // Traverse sponsors, sélections de jeunes, mercato, vétérans… : tout ce
  // qu'un journal de choix quelconque peut atteindre.
  for (let i = 0; i < 60; i++) {
    const choices = Array.from({ length: 400 }, (_, k) => ((i * 11 + k * 7) % 5) - 1);
    assert.doesNotThrow(() => E.replayDuel(50000 + i * 131, choices));
  }
});

test("salle : deux joueurs du même club vivent exactement la même saison de club", () => {
  const { loadContent } = require("./load-engine");
  const C = loadContent();
  const choices = (i) => Array.from({ length: 400 }, (_, k) => ((i * 7 + k * 3 + (k % 5) * i) % 5) - 1);
  // Deux joueurs que tout oppose (poste, niveau, événements, langue du libellé de division).
  const base = [E.replayDuel(7001, choices(3)), E.replayDuel(9137, choices(11))];
  const clubs = ["elite", "d1", "d2", "d3"].map((lvl) => C.CLUBS.find((c) => c.level === lvl && c.countryId === "fr") || C.CLUBS.find((c) => c.level === lvl));
  const CLUB_KEYS = ["leaguePos", "promoted", "relegated", "playoffRun", "relegationPlayoff", "divisionTitle"];
  const clubView = (s, r) => JSON.stringify({
    ...Object.fromEntries(CLUB_KEYS.map((k) => [k, r[k] ?? null])),
    league: r.trophies.includes("league"),
    moments: r.pendingMoments.filter((m) => ["playoff", "relegation_playoff", "cup_final", "continental_final"].includes(m.type)).map((m) => m.type + ":" + m.sharedWin + ":" + (m.tier || 0)),
    next: s.lastSeason && { promoted: s.lastSeason.promoted, relegated: s.lastSeason.relegated, pos: s.lastSeason.leaguePos },
  });
  let elitePlayoffs = 0, divergences = 0, seasons = 0;
  for (const club of clubs) for (let year = 2030; year < 2070; year++) {
    const views = base.map((p) => {
      const s = JSON.parse(JSON.stringify(p));
      Object.assign(s, { club, year, clubLevels: {}, squad: "first", loan: null, careerEnded: false, retiring: false, seasonTrophies: [], seasonAwards: [], scheduled: [], injuryWeeks: 0 });
      s.roomClub = { seed: E.roomClubSeed("salle-test", year, club.id), teamRating: E.teamRatingFromOvr(72) };
      const r = E.playSeason(s);
      if (club.level === "elite" && r.playoffRun) elitePlayoffs++;
      return clubView(s, r);
    });
    seasons++;
    if (views[0] !== views[1]) divergences++;
  }
  assert.equal(divergences, 0, divergences + " saison(s) sur " + seasons + " où le club n'a pas vécu la même saison chez les deux joueurs");
  assert.equal(elitePlayoffs, 0, "un club d'élite ne joue jamais de barrage de montée");
  // Le hasard commun varie bien d'une saison à l'autre.
  const pos = new Set();
  for (let year = 2030; year < 2050; year++) {
    const s = JSON.parse(JSON.stringify(base[0]));
    Object.assign(s, { club: clubs[1], year, clubLevels: {}, squad: "first" });
    s.roomClub = { seed: E.roomClubSeed("salle-test", year, clubs[1].id), teamRating: 6.6 };
    pos.add(E.roomClubSeason(s, "d1", true).leaguePos);
  }
  assert.ok(pos.size >= 4, "classements trop uniformes : " + [...pos]);
});

test("la première place du championnat est réservée au champion", () => {
  const bad = [];
  for (let i = 0; i < 400; i++) {
    const choices = Array.from({ length: 400 }, (_, k) => ((i * 7 + k * 3 + (k % 5) * i) % 5) - 1);
    const s = E.replayDuel(70001 + i * 97, choices);
    for (const se of s.seasons) {
      const champion = (se.trophies || []).includes("league") || se.divisionTitle;
      if (se.leaguePos === 1 && !champion) bad.push(se.year + " " + se.clubName);
    }
  }
  assert.deepEqual(bad.slice(0, 5), [], bad.length + " saison(s) finie(s) 1re sans titre");
});
