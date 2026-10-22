// Solo : une carrière jouée dans le vrai navigateur, en français puis en anglais,
// puis l'export de la fiche finale en image.
import { CARD, TAG, finishCareer, flat, resetStorage, startCareer, wait } from "./lib.js";

export const meta = { title: "Carrière solo, traduction et export de la fiche", needs: [] };

export async function run({ browser, baseUrl, report }) {
  for (const lang of ["fr", "en"]) {
    report.section(lang === "fr" ? "Carrière en français" : "Carrière en anglais");
    const page = await browser.newPage(baseUrl + "/", { name: lang });
    await wait(1200);
    await resetStorage(page, lang);

    report.check("la langue demandée est active", (await page.js("window.I18N.lang")) === lang);
    report.check("le bouton d'accueil est dans la bonne langue", (lang === "en" ? /Start my career/ : /Commencer ma carrière/).test(await page.text("#btn-start")), await page.text("#btn-start"));
    report.check("la carrière démarre", await startCareer(page));

    // Joue jusqu'à 20 ans en cliquant la première option venue, en relevant ce que voit le joueur.
    const seen = { recaps: 0, squads: new Set(), sponsor: false, events: 0 };
    for (let i = 0; i < 320; i++) {
      if ((await page.screen()) !== "screen-game") break;
      const age = await page.js("window.OE.G().age");
      if (age >= 20) break;
      if (age >= 18) await page.js("(function(){ var g = window.OE.G(); if (g.rep < 60) g.rep = 60; })()");
      const tag = flat(await page.js(TAG));
      if (tag.startsWith("📊")) seen.recaps++;
      else if (tag.startsWith("🤝")) seen.sponsor = true;
      else if (tag) seen.events++;
      seen.squads.add(await page.js("window.OE.G().squad"));
      await page.click("#game-card button:not([disabled])");
      await wait(380);
    }
    report.check("des bilans de saison s'affichent", seen.recaps >= 3, "bilans : " + seen.recaps);
    report.check("des événements à choix s'affichent", seen.events >= 3, "événements : " + seen.events);
    // Un prodige démarre chez les pros d'emblée, un espoir peut rester en réserve jusqu'à 20 ans :
    // on exige seulement de ne jamais voir un effectif qui n'existe pas.
    report.check("les effectifs rencontrés existent (jeunes, réserve ou équipe première)", seen.squads.size > 0 && [...seen.squads].every((q) => ["youth", "reserve", "first"].includes(q)), [...seen.squads].join(","));
    if (lang === "en") {
      const stats = await page.js("JSON.stringify(window.I18N.dataStats())");
      report.check("aucun texte du jeu sans traduction anglaise", JSON.parse(stats).missing === 0, stats);
    }

    // Fiche finale puis export en image — cassé en silence tant que le module n'avait pas le moteur.
    report.check("la fiche finale s'affiche", await finishCareer(page));
    await page.js(`(function () {
      window.__dl = null; window.__blob = null;
      var create = URL.createObjectURL;
      URL.createObjectURL = function (b) { window.__blob = b; return create.call(URL, b); };
      HTMLAnchorElement.prototype.click = function () { window.__dl = { name: this.download }; };
      window.OE.downloadCardImage();
    })()`);
    const downloaded = await page.until("!!window.__dl", 6000);
    report.check("« Ma fiche » télécharge une image", downloaded, "aucun téléchargement : l'export a échoué en silence");
    if (downloaded) {
      const info = JSON.parse(await page.js("JSON.stringify({ name: window.__dl.name, type: window.__blob && window.__blob.type, size: window.__blob && window.__blob.size })"));
      report.check("le fichier est un PNG nommé d'après le joueur", /^open-eleven-.+\.png$/.test(info.name) && info.type === "image/png", JSON.stringify(info));
      report.check("l'image n'est pas vide", info.size > 50000, JSON.stringify(info));
    }
    report.noErrors(page);
    await page.close();
  }
}
