// Carrière commune : deux joueurs jouent plusieurs saisons dans la même salle, avec
// la barrière de fin de saison, les votes de transfert et les trophées partagés.
// Demande la pile complète (E2E_URL). Avec E2E_MAILPIT, l'inscription et le mot de
// passe oublié passent par de vrais e-mails (serveur lancé avec SMTP_URL).
import { CARD, accountBox as BOX, flat, mailLink, signUp, wait } from "./lib.js";

export const meta = { title: "Carrière commune à deux en salle", needs: ["stack"] };

const tag = Date.now().toString(36);
const SEASONS = Number(process.env.E2E_SEASONS || 6);

export async function run({ browser, stackUrl, mailpit, report }) {
  report.section("Inscription" + (mailpit ? " par e-mail" : ""));
  const players = [];
  for (const name of ["ana", "ben"]) {
    const page = await browser.newPage(stackUrl + "/", { name });
    await wait(1500);
    page.email = `${name}-${tag}@exemple.test`;
    page.pseudo = `${name}${tag}`.slice(0, 20);
    report.check(`${name} : compte créé`, await signUp(page, { email: page.email, password: `motdepasse-${name}`, mailpit }));
    const set = await page.rpc("profile_set_pseudo", { pseudo: page.pseudo });
    if (set.error) throw new Error("pseudo : " + set.error.message);
    page.id = await page.js("window.OpenElevenAccount.getSession().user.id");
    await page.goto(stackUrl + "/"); // l'interface relit le pseudo
    players.push(page);
  }
  const [a, b] = players;

  if (mailpit) {
    report.section("Mot de passe oublié (Ben, depuis un autre appareil)");
    const other = await browser.newPage(stackUrl + "/", { name: "ben-2" });
    await wait(1500);
    await other.js("document.getElementById('btn-account').click()");
    await other.js(`${BOX}.querySelector('#acc-email').value = '${b.email}'; ${BOX}.querySelector('#acc-forgot').click()`);
    report.check("message neutre", await other.until(`/lien de réinitialisation/.test(${BOX}.textContent)`));
    await other.goto(await mailLink(mailpit, b.email, /https?:\/\/\S+#type=recovery&token=[\w-]+/));
    report.check("le lien ouvre « Nouveau mot de passe »", await other.until(`/Nouveau mot de passe/.test((${BOX} || { textContent: '' }).textContent)`));
    report.check("le jeton a quitté la barre d'adresse", (await other.js("location.hash")) === "");
    await other.js(`${BOX}.querySelector('#acc-np').value = 'tout-nouveau-9'; ${BOX}.querySelector('#acc-np2').value = 'tout-nouveau-9'; ${BOX}.querySelector('#acc-np-save').click()`);
    report.check("nouveau mot de passe enregistré, connecté", await other.until(`!!(${BOX} && ${BOX}.querySelector('#acc-signout'))`));
    await b.goto(stackUrl + "/");
    report.check("l'ancien appareil de Ben est déconnecté", (await b.js("window.OpenElevenAccount.getSession()")) === null);
    await b.js("document.getElementById('btn-account').click()");
    await b.js(`${BOX}.querySelector('#acc-email').value = '${b.email}'; ${BOX}.querySelector('#acc-pass').value = 'tout-nouveau-9'; ${BOX}.querySelector('#acc-login').click()`);
    report.check("Ben se reconnecte avec le nouveau mot de passe", await b.until("!!window.OpenElevenAccount.getSession()"));
    await wait(1200);
    await b.js("document.querySelectorAll('.acc-overlay.on').forEach(o => o.classList.remove('on'))");
    await other.close();
  }

  report.section("Salle");
  await a.rpc("friend_request", { friend_id: b.id });
  await b.rpc("friend_accept", { from_id: a.id });
  const roomId = (await a.rpc("room_create")).data;
  await a.rpc("room_invite", { p_room_id: roomId, p_friend_id: b.id });
  await b.rpc("room_join", { p_room_id: roomId });
  const state = async (p = a) => (await p.rpc("room_state", { room_id: roomId })).data;

  // Création du joueur : chacun passe ses écrans ; au choix du club, la salle décide.
  for (const p of players) await p.js(`window.OE.startRoomCareer('${roomId}')`);
  await wait(500);
  for (let i = 0; i < 40; i++) {
    let allIn = true;
    for (const p of players) {
      const screen = await p.screen();
      if (screen === "screen-game") continue;
      allIn = false;
      if (screen === "screen-academy") await p.click(".rm-offer-pick:not([disabled])");
      else await p.click(".creation-random-all");
    }
    if (allIn) break;
    await wait(500);
  }
  report.check("les deux joueurs entrent en jeu", (await a.screen()) === "screen-game" && (await b.screen()) === "screen-game");
  const start = await state();
  const startClubs = [await a.js("window.OE.G().club.id"), await b.js("window.OE.G().club.id")];
  report.check("même club de départ, celui de la salle", startClubs[0] === startClubs[1] && startClubs[0] === start.room.club_id, startClubs.join(" / ") + " · salle " + start.room.club_id);

  report.section("Carrière commune");
  const startAge = await a.js("window.OE.G().age");
  const target = startAge + SEASONS;
  const seen = { waits: 0, votes: 0, maxGap: 0, maxCandidates: 0 };
  let stuck = 0, lastSignature = "";
  for (let step = 0; step < 1100; step++) {
    const ages = [];
    for (const p of players) {
      if ((await p.screen()) !== "screen-game") { ages.push(99); continue; }
      ages.push(await p.js("window.OE.G().age"));
      const card = flat(await p.js(CARD));
      if (/En attente des autres membres/.test(card)) { seen.waits++; continue; } // à l'autre d'avancer
      if (await p.js("!!document.querySelector('#game-card .rm-tv-opt')")) {
        if (await p.js("!!document.querySelector('#game-card .rm-tv-opt:not([disabled])')")) {
          seen.votes++;
          seen.maxCandidates = Math.max(seen.maxCandidates, await p.js("document.querySelectorAll('#game-card .rm-tv-opt').length"));
          await p.click("#game-card .rm-tv-opt:not([disabled])"); // tout le monde vote pour la 1ʳᵉ proposition
        }
        continue;
      }
      await p.click("#game-card button:not([disabled])");
    }
    // Invariant : personne ne prend plus d'une saison d'avance sur l'autre.
    if (ages.every((x) => x < 99)) seen.maxGap = Math.max(seen.maxGap, Math.abs(ages[0] - ages[1]));
    if (ages.every((x) => x >= target)) break;
    const signature = JSON.stringify([ages, await a.js("window.OE.G().club.id"), await b.js("window.OE.G().club.id"), flat(await a.js(CARD)).slice(0, 60), flat(await b.js(CARD)).slice(0, 60)]);
    stuck = signature === lastSignature ? stuck + 1 : 0;
    lastSignature = signature;
    if (stuck > 60) { report.check("la carrière commune n'est jamais bloquée", false, "Ana : " + flat(await a.js(CARD)).slice(0, 200) + " ‖ Ben : " + flat(await b.js(CARD)).slice(0, 200) + " ‖ salle : " + JSON.stringify(await state()).slice(0, 500)); break; }
    await wait(260);
  }
  const final = await state();
  const summary = async (p) => JSON.parse(await p.js("JSON.stringify({ age: window.OE.G().age, club: window.OE.G().club.id, league: window.OE.G().trophies.league, cup: window.OE.G().trophies.cup })"));
  const [ga, gb] = [await summary(a), await summary(b)];
  report.note(`Ana ${JSON.stringify(ga)} · Ben ${JSON.stringify(gb)}`);
  report.note(`salle : phase ${final.room.phase}, saison ${final.room.season_year}, club ${final.room.club_id} · attentes ${seen.waits} · bulletins ${seen.votes} · candidats au plus ${seen.maxCandidates}`);
  report.check(`les deux ont joué ${SEASONS} saisons`, ga.age >= target && gb.age >= target, `${ga.age} / ${gb.age}`);
  report.check("la barrière de fin de saison a fait attendre", seen.waits > 0);
  report.check("personne n'a pris plus d'une saison d'avance", seen.maxGap <= 1, "écart maximal : " + seen.maxGap);
  report.check("l'année de la salle suit les saisons jouées", final.room.season_year >= SEASONS - 1 && final.room.season_year <= SEASONS + 1, "saison " + final.room.season_year);
  report.check("un vote de transfert propose peu de candidats", seen.maxCandidates <= 5, "candidats : " + seen.maxCandidates);
  report.check("toujours dans le même club, celui de la salle", ga.club === gb.club && ga.club === final.room.club_id, `${ga.club} / ${gb.club} / ${final.room.club_id}`);
  report.check("trophées de club identiques", ga.league === gb.league && ga.cup === gb.cup, JSON.stringify([ga, gb]));
  report.check("statistiques en direct publiées", final.members.every((m) => m.live_stats && typeof m.live_stats === "object"));
  report.noErrors(a, b);
  for (const p of players) await p.close();
}
