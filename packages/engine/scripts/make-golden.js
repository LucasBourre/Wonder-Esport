// Régénère test/golden.json à partir des sources du moteur et du contenu.
// À lancer UNIQUEMENT après un changement de règle VOULU (et un nouveau
// ENGINE_VERSION) : pour une refonte interne, ce fichier ne doit pas bouger.
const fs = require("fs");
const path = require("path");
const { loadEngine } = require("../test/load-engine");
const { computeGolden } = require("../test/golden");

const E = loadEngine();
const cases = computeGolden(E);
const file = path.join(__dirname, "..", "test", "golden.json");
fs.writeFileSync(file, JSON.stringify({ engineVersion: E.ENGINE_VERSION, cases }, null, 1) + "\n");
const seasons = cases.map((c) => c.seasons);
console.log("golden.json :", cases.length, "carrières, moteur", E.ENGINE_VERSION, "| saisons min/max :", Math.min(...seasons), "/", Math.max(...seasons), "| carrières vides :", seasons.filter((n) => !n).length);
