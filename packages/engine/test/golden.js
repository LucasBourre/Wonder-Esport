// Carrières de référence : un jeu fixe de (mode, graine/date, journal de
// choix) rejoué par le moteur, dont on ne garde qu'une empreinte par carrière.
// Deux moteurs qui produisent les mêmes empreintes ont joué EXACTEMENT les
// mêmes carrières, à l'octet près — c'est le filet du découpage en modules et
// de toute refonte « sans changer une règle ».
const crypto = require("crypto");

const CASES = 240;

// Journal de choix déterministe et varié : options 0..3 et -1 (« rester »).
function choicesFor(i) {
  const out = [];
  for (let k = 0; k < 400; k++) out.push(((i * 7 + k * 3 + (k % 5) * i) % 5) - 1);
  return out;
}
function dateFor(i) {
  return "20" + String(26 + (i % 6)).padStart(2, "0") + "-" + String(1 + (i % 12)).padStart(2, "0") + "-" + String(1 + ((i * 5) % 28)).padStart(2, "0");
}
// Empreinte de l'état COMPLET de fin de carrière (historique, saisons,
// palmarès, drapeaux…) : la moindre divergence la change.
function fingerprint(state) {
  return crypto.createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 24);
}

function computeGolden(E) {
  const out = [];
  for (let i = 1; i <= CASES; i++) {
    const choices = choicesFor(i);
    if (i % 3 === 0) {
      const seed = 1000 + i * 7919;
      const s = E.replayDuel(seed, choices);
      out.push({ mode: "duel", key: seed, print: fingerprint(s), score: E.scoreDuel(seed, choices), seasons: s.seasons.length });
    } else {
      const date = dateFor(i);
      const s = E.replayDaily(date, choices);
      out.push({ mode: "daily", key: date, print: fingerprint(s), score: E.scoreDaily(date, choices), seasons: s.seasons.length });
    }
  }
  return out;
}

module.exports = { computeGolden, CASES };
