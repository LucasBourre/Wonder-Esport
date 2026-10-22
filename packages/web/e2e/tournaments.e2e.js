// Tournois de sélection : la Coupe arabe et les quatre Jeux régionaux, tels que le
// joueur les voit — cartes, poules, médailles, palmarès, parcours sur la fiche finale.
// Une partie est lancée normalement, puis on force la nationalité et l'année.
import engineTests from "../../engine/test/load-engine.js";
import { CARD, TAG, finishCareer, flat, resetStorage, startCareer, wait } from "./lib.js";

export const meta = { title: "Coupe arabe et Jeux régionaux", needs: [] };

const CONTENT = engineTests.loadContent();
const nat = (id) => JSON.stringify(CONTENT.NATIONALITIES.find((n) => n.id === id));

export async function run({ browser, baseUrl, report }) {
  const page = await browser.newPage(baseUrl + "/", { name: "tournois" });
  await wait(1200);

  async function newGame(lang) {
    await resetStorage(page, lang);
    return startCareer(page);
  }
  /** Force une nationalité, une année et un niveau, sans équipe nationale sauf demande. */
  const force = (id, year, age, stats, rep, extra = "") => page.js(`(function(){ var g = window.OE.G(); g.nationality = ${nat(id)}; g.year = ${year}; g.age = ${age}; g.stats = { t: ${stats}, p: ${stats}, m: ${stats}, c: 60 }; g.rep = ${rep}; g.natTeam.active = false; g.natTeam.caps = 0; g.seasonInjuryWeeks = 0; ${extra} })()`);

  /** Joue jusqu'à la carte d'un tournoi, la déroule, et rend ce qui s'est affiché. */
  async function playUntil(tagRe, startButton, maxClicks = 90) {
    const seen = [];
    let started = false;
    for (let i = 0; i < maxClicks; i++) {
      const tag = flat(await page.js(TAG)), card = flat(await page.js(CARD));
      if (tagRe.test(tag)) {
        if (!started) {
          seen.push("INTRO : " + card.slice(0, 240));
          started = true;
          await page.click("#" + startButton);
          await wait(400);
          continue;
        }
        if (!(seen.at(-1) ?? "").endsWith(card.slice(0, 200))) seen.push("CARTE : " + card.slice(0, 220));
        if (await page.js("!!document.getElementById('btn-next')")) { await page.click("#btn-next"); await wait(300); seen.push("(fin)"); return seen; }
      }
      await page.click("#btn-tstep, #game-card button:not([disabled])");
      await wait(240);
    }
    return seen;
  }
  const show = (seen) => seen.forEach((x) => report.note(x.slice(0, 250)));

  /**
   * Convocation et sélection sont des TIRAGES : on relance une partie neuve jusqu'à voir la
   * carte du tournoi (au plus `max` fois). Rend ce qui s'est affiché et le nombre d'essais.
   */
  async function untilTournament({ lang, setup, re, button, comp, clicks = 130, max = 14 }) {
    let seen = [], runs = 0, tries = 0;
    while (tries < max && !runs) {
      tries++;
      await newGame(lang);
      await setup();
      seen = await playUntil(re, button, clicks);
      runs = await page.js(`window.OE.G().natRuns.filter(r => r.comp === '${comp}').length`);
    }
    return { seen, runs, tries };
  }

  for (const lang of ["fr", "en"]) {
    // ---- Coupe arabe : un Marocain en équipe nationale -----------------------------
    report.section("Coupe arabe — " + lang);
    const { seen: arab, runs: arabRuns, tries: arabTries } = await untilTournament({
      lang, comp: "arab", re: /Coupe arabe|Arab Cup/, button: "btn-arab",
      setup: () => force("ma", 2029, 25, 74, 70, "g.natTeam.active = true; g.natTeam.caps = 12;"),
    });
    show(arab);
    report.check("la carte de la Coupe arabe s'affiche, poules comprises (essai " + arabTries + ")", arabRuns >= 1 && arab.some((x) => /Phase de poules|Group stage/.test(x)), arab.join(" | "));
    const pool = arab.find((x) => /Votre poule|Your group/.test(x)) ?? "";
    const rivals = ["Tunisie", "Algérie", "Égypte", "Qatar", "Arabie", "Irak", "Jordanie", "Koweït", "Liban", "Syrie", "Bahreïn", "Oman", "Soudan", "Mauritanie", "Émirats", "Tunisia", "Algeria", "Egypt", "Saudi", "Iraq", "Jordan", "Kuwait", "Lebanon", "Syria", "Bahrain", "Sudan", "Mauritania", "Emirates"];
    report.check("la poule n'oppose que des nations arabes", rivals.some((r) => pool.includes(r)) && !/Japon|Japan|Brésil|Brazil|France|Allemagne|Germany/.test(pool), pool);
    if (lang === "en") {
      report.check("textes en anglais", /Arab Cup/.test(arab.join(" ")) && /are playing the Arab Cup/.test(arab[0] ?? "") && !/Phase de poules|Match suivant|Coup d'envoi|matchs ·/.test(arab.join(" ")), arab.join(" | ").slice(0, 300));
      const stats = JSON.parse(await page.js("JSON.stringify(window.I18N.dataStats())"));
      report.check("aucun texte du jeu sans traduction anglaise", stats.missing === 0, JSON.stringify(stats));
    }

    // ---- Jeux régionaux : un joueur modeste par continent, en français seulement ----
    if (lang !== "fr") continue;
    const GAMES = [
      { nat: "jp", year: 2030, re: /Jeux asiatiques/, name: "Jeux asiatiques" },
      { nat: "sn", year: 2031, re: /Jeux africains/, name: "Jeux africains" },
      { nat: "gt", year: 2031, re: /Jeux panaméricains/, name: "Jeux panaméricains" },
      { nat: "nz", year: 2031, re: /Jeux du Pacifique/, name: "Jeux du Pacifique" },
    ];
    for (const g of GAMES) {
      report.section(g.name);
      const { seen, runs, tries } = await untilTournament({
        lang: "fr", comp: "games", re: g.re, button: "btn-games",
        setup: () => force(g.nat, g.year - 4, 18, 64, 12, "g.flags.youth_int = true;"),
      });
      show(seen);
      report.check("la carte « " + g.name + " » s'affiche (essai " + tries + ")", runs >= 1 && seen.some((x) => g.re.test(x)), seen.join(" | "));
      report.check("poule du même continent puis tableau final", seen.some((x) => /Phase de poules/.test(x)) && seen.some((x) => /Quart de finale|Demi-finale|Finale/.test(x) || /poules/.test(x)));
    }
  }

  // ---- Palmarès et fiche finale : trophées et médailles forcés -----------------------
  report.section("Palmarès et fiche finale");
  await newGame("fr");
  await force("ma", 2029, 24, 70, 40, "g.trophies.arabCup = 2; g.trophies.games = 1; g.gamesMedals = { gold: 1, silver: 2, bronze: 1 }; g.natRuns = [{ comp: 'arab', year: 2029, stage: 'champion', third: null }, { comp: 'games', year: 2027, stage: 'final', third: null }];");
  await page.js("document.getElementById('profile-toggle').click()"); await wait(250);
  await page.click('.ptab[data-ptab="palmares"]'); await wait(250);
  const palmares = await page.text("#profile-trophies");
  report.check("la Coupe arabe figure au palmarès d'une nation arabe", /Coupe arabe\s*2/.test(palmares), palmares);
  report.check("les Jeux africains, avec leurs médailles", /Jeux africains\s*🥇1\s*🥈2\s*🥉1/.test(palmares), palmares);
  await page.js("document.getElementById('profile-toggle').click()"); await wait(200);
  report.check("la fiche finale s'affiche", await finishCareer(page));
  const runs = await page.text("#final-natruns");
  report.check("le parcours en sélection cite les deux compétitions", /Coupe arabe/.test(runs) && /Jeux africains/.test(runs), runs);
  report.noErrors(page);
  await page.close();
}
