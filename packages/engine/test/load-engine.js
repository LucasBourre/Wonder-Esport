// Charge le moteur depuis ses sources TypeScript, contenu compris : esbuild
// assemble @open-eleven/engine et @open-eleven/content en un module CommonJS,
// en mémoire, évalué tel quel. Aucun fichier généré n'est écrit.
const path = require("path");
const esbuild = require("esbuild");

const ROOT = path.resolve(__dirname, "..", "..", "..");

function bundle(entry) {
  return esbuild.buildSync({
    entryPoints: [entry],
    bundle: true,
    format: "cjs",
    platform: "neutral",
    target: "es2020",
    charset: "utf8",
    write: false,
    logLevel: "warning",
  }).outputFiles[0].text;
}

function evaluate(entry) {
  const mod = { exports: {} };
  // Ni `window`, ni `document`, ni `require` : le moteur doit s'en passer.
  new Function("module", "exports", "window", "document", "require", bundle(entry))(mod, mod.exports, undefined, undefined, undefined);
  return mod.exports;
}

function loadEngine() {
  return evaluate(path.join(ROOT, "packages", "engine", "src", "index.ts")).Engine;
}
function loadContent() {
  return evaluate(path.join(ROOT, "packages", "content", "src", "index.ts"));
}

module.exports = { loadEngine, loadContent, ROOT };
