// Notifications en direct : une demande d'ami puis une invitation de salle arrivent chez
// l'autre joueur sans recharger (bandeau, cloche, titre de l'onglet), et se traitent
// depuis la liste. Demande la pile complète (E2E_URL).
import { flat, signUp, wait } from "./lib.js";

export const meta = { title: "Notifications en direct", needs: ["stack"] };

const tag = Date.now().toString(36);

export async function run({ browser, stackUrl, mailpit, report }) {
  const players = [];
  for (const name of ["noa", "noe"]) {
    const page = await browser.newPage(stackUrl + "/", { name });
    await wait(1500);
    page.email = `${name}-${tag}@exemple.test`;
    report.check(`${name} : compte créé`, await signUp(page, { email: page.email, password: `mot-de-passe-long-${name}`, mailpit }));
    const set = await page.rpc("profile_set_pseudo", { pseudo: `${name}${tag}`.slice(0, 20) });
    if (set.error) throw new Error("pseudo : " + set.error.message);
    page.id = await page.js("window.OpenElevenAccount.getSession().user.id");
    await page.goto(stackUrl + "/");
    await page.js("document.querySelectorAll('.acc-overlay.on').forEach(o => o.classList.remove('on'))");
    players.push(page);
  }
  const [a, b] = players;
  report.check("la cloche est visible une fois connecté", await b.js("getComputedStyle(document.getElementById('btn-notifs')).display !== 'none'"));

  report.section("Demande d'ami");
  await a.rpc("friend_request", { friend_id: b.id });
  report.check("un bandeau arrive chez l'autre, sans recharger", await b.until("!!document.querySelector('.notif-toast')", 8000), "aucun bandeau");
  report.check("il nomme qui et quoi", /veut devenir ton ami/.test(flat(await b.text(".notif-toast"))), flat(await b.text(".notif-toast")));
  report.check("la cloche compte 1", flat(await b.text("#btn-notifs .online-badge")) === "1");
  report.check("le titre de l'onglet aussi", /^\(1\) /.test(await b.js("document.title")), await b.js("document.title"));
  await b.click("#btn-notifs");
  await b.until("!!document.querySelector('.notif-item .notif-act')", 5000);
  await b.click(".notif-item .notif-act[data-a='accept_friend']");
  report.check("« Accepter » depuis la liste", await b.until("/maintenant amis/.test(document.querySelector('.notif-list').textContent)", 5000));
  const friends = await b.rpc("friends_list");
  report.check("l'amitié est bien enregistrée", (friends.data.friends || []).some((f) => f.friend_id === a.id));
  report.check("la cloche est remise à zéro à l'ouverture", !(await b.js("!!document.querySelector('#btn-notifs .online-badge')")));
  report.check("l'autre apprend que c'est accepté", await a.until("/a accepté ta demande/.test((document.querySelector('.notif-toast') || { textContent: '' }).textContent)", 8000));
  await b.js("document.querySelectorAll('.acc-overlay.on').forEach(o => o.classList.remove('on'))");

  report.section("Invitation de salle");
  const roomId = (await a.rpc("room_create")).data;
  await a.rpc("room_invite", { p_room_id: roomId, p_friend_id: b.id });
  report.check("bandeau d'invitation", await b.until("/t'invite dans sa salle/.test(Array.from(document.querySelectorAll('.notif-toast')).map(t => t.textContent).join(' '))", 8000));
  await b.click("#btn-notifs");
  await b.until("!!document.querySelector(\".notif-act[data-a='join_room']\")", 5000);
  await b.click(".notif-act[data-a='join_room']");
  await wait(1500);
  const st = await a.rpc("room_state", { room_id: roomId });
  report.check("« Rejoindre » fait entrer dans la salle", (st.data.members || []).some((m) => m.user_id === b.id && m.status === "joined"));
  report.check("l'hôte est prévenu de l'arrivée", await a.until("/a rejoint ta salle/.test(Array.from(document.querySelectorAll('.notif-toast')).map(t => t.textContent).join(' '))", 8000));
  report.noErrors(a, b);
  for (const p of players) await p.close();
}
