// La traduction anglaise suit le contenu : un texte ajouté ou modifié sans être
// retraduit fait échouer ces tests, au lieu de s'afficher en français pour le joueur.
// (Détail et remèdes : node packages/web/scripts/i18n.js)
import assert from "node:assert/strict";
import test from "node:test";
import { audit } from "../scripts/i18n.js";

const a = audit();

test("tout texte traduisible du contenu a sa traduction anglaise", () => {
  assert.deepEqual(a.missing.slice(0, 10), [], a.missing.length + " texte(s) sans traduction — voir « node packages/web/scripts/i18n.js --missing »");
});

test("aucune entrée du pack n'est vide", () => {
  assert.deepEqual(a.empty, []);
});

test("aucune clé n'est écrite deux fois (la seconde écraserait la première en silence)", () => {
  assert.deepEqual(a.packDuplicates, [], "pack de traduction du contenu");
  assert.deepEqual(a.dictDuplicates, [], "dictionnaire de l'interface (i18n.js)");
});

test("le pack ne garde pas d'entrées orphelines", () => {
  // Quand on réécrit un texte français, l'ancienne entrée ne sert plus à rien :
  // « node packages/web/scripts/i18n.js --prune » la retire.
  assert.deepEqual(a.unused.slice(0, 10), [], a.unused.length + " entrée(s) orpheline(s)");
});

test("les textes d'accord de pays (marques {nat?a|ont}) sont traduits sans marque", () => {
  // En anglais le pays n'a pas de pluriel grammatical : la traduction ne doit contenir aucune marque.
  for (const [fr, en] of Object.entries(a.entries)) {
    if (/\{\w+\?[^{}]*\}/.test(fr)) assert.ok(!/\{\w+\?[^{}]*\}/.test(en), "marque d'accord dans la traduction de : " + fr.slice(0, 60));
  }
});
