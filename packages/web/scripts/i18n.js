// Audit et maintenance de la traduction anglaise.
//
// Le pack (public/i18n-data.js) associe un texte FRANÇAIS exact du contenu à sa traduction.
// Il ne se génère pas : on y ajoute des entrées à mesure que le contenu grandit. Cet outil
// garantit qu'on n'en oublie aucune et que le pack reste propre.
//
//   node packages/web/scripts/i18n.js                 audit (échoue s'il manque une traduction)
//   node packages/web/scripts/i18n.js --missing       liste les textes à traduire, en JSON à remplir
//   node packages/web/scripts/i18n.js --add fichier   fusionne un JSON { "français": "english" } dans le pack
//   node packages/web/scripts/i18n.js --prune         retire du pack les entrées qui ne servent plus
//
// Le même parcours que dans le navigateur (content/translatable.ts) décide de ce qui est
// traduisible : l'audit et le jeu ne peuvent pas diverger.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import loader from "../../engine/test/load-engine.js";

const here = dirname(fileURLToPath(import.meta.url));
const PACK = join(here, "..", "public", "i18n-data.js");
const DICT = join(here, "..", "src", "i18n.ts");

/** Lit le pack : ses entrées, et l'en-tête qui précède pour pouvoir le réécrire à l'identique. */
export function readPack() {
  const source = readFileSync(PACK, "utf8").replace(/\r\n/g, "\n");
  const start = source.indexOf("window.I18N_DATA = { en: {");
  if (start < 0) throw new Error("pack illisible : « window.I18N_DATA = { en: { » introuvable");
  const sandbox = { I18N_DATA: undefined };
  new Function("window", source)(sandbox);
  return { header: source.slice(0, start), entries: sandbox.I18N_DATA.en, source };
}

/** Réécrit le pack : l'en-tête d'origine, puis une entrée par ligne. */
export function writePack(header, entries) {
  const lines = Object.entries(entries).map(([k, v]) => " " + JSON.stringify(k) + ": " + JSON.stringify(v));
  writeFileSync(PACK, header + "window.I18N_DATA = { en: {\n" + lines.join(",\n") + "\n} };\n");
}

/** Clés écrites deux fois dans un même fichier (la seconde écraserait la première en silence). */
export function duplicateKeys(source, indent) {
  const re = new RegExp("^" + indent + '("(?:[^"\\\\]|\\\\.)*"):\\s', "gm");
  const seen = new Map();
  for (const m of source.replace(/\r\n/g, "\n").matchAll(re)) {
    const key = JSON.parse(m[1]);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen].filter(([, n]) => n > 1).map(([k]) => k);
}

export function audit() {
  const content = loader.loadContent();
  const texts = content.collectTranslatableTexts();
  const { header, entries, source } = readPack();
  // Un manque ne compte que pour un texte de vrais mots (« D1 » ou « 🥇 » restent tels quels).
  const missing = [...texts].filter((t) => content.hasWords(t) && !Object.prototype.hasOwnProperty.call(entries, t));
  const unused = Object.keys(entries).filter((k) => !texts.has(k));
  const packDuplicates = duplicateKeys(source, " ");
  const dictDuplicates = duplicateKeys(readFileSync(DICT, "utf8"), "    ");
  const empty = Object.entries(entries).filter(([, v]) => typeof v !== "string" || !v.trim()).map(([k]) => k);
  return { texts, header, entries, missing, unused, packDuplicates, dictDuplicates, empty };
}

function main() {
  const args = process.argv.slice(2);
  const a = audit();

  if (args.includes("--missing")) {
    console.log(JSON.stringify(Object.fromEntries(a.missing.map((t) => [t, ""])), null, 1));
    return 0;
  }
  if (args.includes("--add")) {
    const file = args[args.indexOf("--add") + 1];
    const add = JSON.parse(readFileSync(file, "utf8"));
    const entries = { ...a.entries };
    let added = 0;
    for (const [fr, en] of Object.entries(add)) {
      if (typeof en !== "string" || !en.trim()) throw new Error("traduction vide pour : " + fr.slice(0, 70));
      if (Object.prototype.hasOwnProperty.call(entries, fr) && entries[fr] !== en) throw new Error("déjà traduit autrement : " + fr.slice(0, 70));
      if (!Object.prototype.hasOwnProperty.call(entries, fr)) { entries[fr] = en; added++; }
    }
    writePack(a.header, entries);
    console.log(added + " entrée(s) ajoutée(s).");
    return 0;
  }
  if (args.includes("--prune")) {
    const entries = Object.fromEntries(Object.entries(a.entries).filter(([k]) => a.texts.has(k)));
    writePack(a.header, entries);
    console.log(a.unused.length + " entrée(s) retirée(s).");
    return 0;
  }

  const show = (title, list) => { if (list.length) { console.log("\n" + title); list.slice(0, 25).forEach((t) => console.log("  - " + t.slice(0, 110))); if (list.length > 25) console.log("  … et " + (list.length - 25) + " autres"); } };
  console.log(`${a.texts.size} textes traduisibles · ${Object.keys(a.entries).length} entrées dans le pack`);
  show("MANQUENT au pack (le joueur les verrait en français) :", a.missing);
  show("Entrées du pack sans traduction :", a.empty);
  show("Clés écrites deux fois dans le pack :", a.packDuplicates);
  show("Clés écrites deux fois dans le dictionnaire de l'interface (i18n.js) :", a.dictDuplicates);
  if (a.unused.length) console.log(`\n${a.unused.length} entrée(s) du pack ne correspondent plus à aucun texte (retirables avec --prune).`);
  const failed = a.missing.length || a.empty.length || a.packDuplicates.length || a.dictDuplicates.length;
  console.log(failed ? "\nÉchec." : "\nTout est traduit.");
  return failed ? 1 : 0;
}

if (process.argv[1] && process.argv[1].endsWith("i18n.js")) process.exit(main());
