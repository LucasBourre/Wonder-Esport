// Nouveautés : bouton de l'accueil, pastille « Nouveau » jusqu'à la lecture, page des
// notes de mise à jour, version en pied de page — en français puis en anglais.
import { readFileSync } from "node:fs";
import { flat, resetStorage, wait } from "./lib.js";

// La version attendue est lue à la source, comme le jeu la compile.
const version = /ENGINE_VERSION = "([^"]+)"/.exec(readFileSync(new URL("../../engine/src/version.ts", import.meta.url), "utf8"))[1];

export const meta = { title: "Nouveautés et version", needs: [] };

export async function run({ browser, baseUrl, report }) {
  for (const lang of ["fr", "en"]) {
    report.section(lang === "fr" ? "En français" : "En anglais");
    const page = await browser.newPage(baseUrl + "/", { name: "news-" + lang });
    await wait(1200);
    await resetStorage(page, lang);

    const line = await page.text("#version-line");
    report.check("la version s'affiche en pied d'accueil", !!version && line.startsWith("v" + version + " · "), line);
    report.check("le bouton est dans la bonne langue", (lang === "en" ? /What's new/ : /Nouveautés/).test(await page.text("#btn-news")), await page.text("#btn-news"));
    report.check("la pastille « Nouveau » est visible avant la lecture", await page.js("!document.getElementById('news-dot').hidden"));

    await page.click("#btn-news");
    await wait(400);
    report.check("la page des nouveautés s'ouvre", (await page.screen()) === "screen-news");
    const entries = await page.js("document.querySelectorAll('#news-list .news-entry').length");
    report.check("les versions sont listées", entries >= 2, entries + " version(s)");
    const first = flat(await page.text("#news-list .news-entry .news-version"));
    report.check("la plus récente est en tête, et c'est la version du jeu", first === "v" + version, first);
    const body = await page.text("#news-list");
    report.check("catégories et textes dans la bonne langue", lang === "en" ? /✨ New/.test(body) && /Arab Cup/.test(body) && !/Coupe arabe/.test(body) : /✨ Nouveautés/.test(body) && /Coupe arabe/.test(body), body.slice(0, 160));

    await page.click("#btn-news-back");
    await wait(400);
    report.check("le retour ramène à l'accueil", (await page.screen()) === "screen-home");
    report.check("la pastille disparaît une fois les notes lues", await page.js("document.getElementById('news-dot').hidden"));
    await page.reload();
    report.check("et ne revient pas au rechargement", await page.js("document.getElementById('news-dot').hidden"));
    report.noErrors(page);
    await page.close();
  }
}
