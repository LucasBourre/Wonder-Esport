// Centre de notifications : cloche 🔔 de l'accueil, liste des notifications avec leurs
// actions (rejoindre une salle, accepter un ami…), bandeau en direct quand l'une arrive
// — même en pleine partie — et compteur dans le titre de l'onglet.
//
// Le serveur garde les notifications (table notifications) et prévient en direct par le
// canal personnel (/api/live sans salle). Un sondage lent prend le relais si la connexion
// en direct tombe. Le texte est composé ici, à partir du type et des données reçues :
// tout ce qui vient du serveur (pseudos…) est échappé.
(function () {
  const acc = window.OpenElevenAccount;
  if (!acc) return;
  const api = acc.getClient();
  const T = (tpl, vars?) => (window.I18N ? window.I18N.t(tpl, vars) : (vars
    ? Object.keys(vars).reduce((s, k) => s.split("{" + k + "}").join(String(vars[k])), tpl) : tpl));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (id) => document.getElementById(id);

  // --- Bouton cloche (rangée du haut de l'accueil, à côté du compte) ---------------
  const fab = document.createElement("button");
  fab.className = "account-fab notif-fab";
  fab.id = "btn-notifs";
  fab.setAttribute("aria-label", "Notifications");
  fab.title = "Notifications";
  fab.textContent = "🔔";
  fab.style.display = "none";
  const account = $("btn-account");
  if (account && account.parentNode) account.parentNode.insertBefore(fab, account);

  const overlay = document.createElement("div");
  overlay.className = "acc-overlay";
  overlay.innerHTML = '<div class="lb-box notif-box" role="dialog" aria-modal="true"></div>';
  document.body.appendChild(overlay);
  const box = overlay.querySelector(".notif-box");
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.remove("on"); });

  const toasts = document.createElement("div");
  toasts.className = "notif-toasts";
  toasts.setAttribute("aria-live", "polite");
  document.body.appendChild(toasts);

  let items = [], unread = 0, lastSeenId = null;

  // --- Texte et actions de chaque type -------------------------------------------------
  function describe(n) {
    const p = n.payload || {};
    const who = "<strong>" + esc(p.from || "?") + "</strong>";
    switch (n.kind) {
      case "friend_request": return { icon: "👋", html: T("{p} veut devenir ton ami.", { p: who }), actions: [["accept_friend", T("Accepter")], ["decline_friend", T("Refuser")]] };
      case "friend_accepted": return { icon: "🤝", html: T("{p} a accepté ta demande d'ami.", { p: who }), actions: [["open_friends", T("Voir mes amis")]] };
      case "duel_received": return { icon: "⚔️", html: T("{p} te lance un défi.", { p: who }), actions: [["open_duels", T("Relever le défi")]] };
      case "duel_result": {
        const res = p.result === "win" ? T("victoire") : p.result === "loss" ? T("défaite") : T("égalité");
        return { icon: p.result === "win" ? "🏆" : p.result === "loss" ? "😤" : "🤝", html: T("Duel contre {p} : {res} ({a} – {b}).", { p: who, res: esc(res), a: esc(p.mine ?? "?"), b: esc(p.theirs ?? "?") }), actions: [["open_history", T("Voir")]] };
      }
      case "room_invite": return { icon: "🏟️", html: T("{p} t'invite dans sa salle.", { p: who }), actions: [["join_room", T("Rejoindre")], ["decline_room", T("Refuser")]] };
      case "room_joined": return { icon: "🏟️", html: T("{p} a rejoint ta salle.", { p: who }), actions: [["open_room", T("Voir la salle")]] };
      case "room_declined": return { icon: "🚪", html: T("{p} a décliné ton invitation.", { p: who }), actions: [] };
      case "room_launched": return { icon: "🚀", html: T("{p} a lancé la salle : la carrière commune commence !", { p: who }), actions: [["open_room", T("Jouer")]] };
      case "room_vote": return {
        icon: "🗳️",
        html: p.kick ? T("Vote d'exclusion ouvert dans ta salle (par {p}).", { p: who }) : T("Vote de transfert ouvert dans ta salle (par {p}).", { p: who }),
        actions: [["open_room", T("Voter")]],
      };
      default: return { icon: "🔔", html: esc(n.kind), actions: [] };
    }
  }

  async function act(action, n) {
    const p = n.payload || {};
    const room = window.OpenElevenRoom;
    switch (action) {
      case "accept_friend": return result(await api.rpc("friend_accept", { from_id: p.fromId }), T("Vous êtes maintenant amis ✔"));
      case "decline_friend": return result(await api.rpc("friend_remove", { friend_id: p.fromId }), T("Demande refusée."));
      case "join_room": {
        const r = await api.rpc("room_join", { p_room_id: p.roomId });
        if (!r.error && room) { overlay.classList.remove("on"); room.open(); }
        return result(r, T("Tu as rejoint la salle ✔"));
      }
      case "decline_room": return result(await api.rpc("room_decline", { p_room_id: p.roomId }), T("Invitation refusée."));
      case "open_room": overlay.classList.remove("on"); if (room) room.open(); return null;
      case "open_friends": overlay.classList.remove("on"); acc.openSocial("friends"); return null;
      case "open_duels": overlay.classList.remove("on"); acc.openSocial("incoming"); return null;
      case "open_history": overlay.classList.remove("on"); acc.openSocial("history"); return null;
    }
    return null;
  }
  function result(r, okText) {
    if (acc.refreshNotifs) acc.refreshNotifs();
    return r && r.error ? { text: T("Impossible : {msg}", { msg: r.error.message }), cls: "err" } : { text: okText, cls: "ok" };
  }

  const ago = (iso) => {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return T("à l'instant");
    if (s < 3600) return T("il y a {n} min", { n: Math.floor(s / 60) });
    if (s < 86400) return T("il y a {n} h", { n: Math.floor(s / 3600) });
    return T("il y a {n} j", { n: Math.floor(s / 86400) });
  };

  function itemHtml(n, i) {
    const d = describe(n);
    // Déjà traitée (acceptée, refusée, rejointe…) : plus de boutons, juste le constat.
    if (n.payload && n.payload.done && /^(friend_request|room_invite)$/.test(n.kind)) d.actions = [];
    return '<li class="notif-item' + (n.read ? "" : " unread") + '" data-i="' + i + '">' +
      '<span class="notif-icon">' + d.icon + "</span>" +
      '<span class="notif-body"><span class="notif-text">' + d.html + '</span><span class="notif-time">' + esc(ago(n.at)) + "</span>" +
      (n.payload && n.payload.done ? '<span class="notif-msg ok">' + esc(T("Déjà traité ✔")) + "</span>" : "") +
      (d.actions.length ? '<span class="notif-actions">' + d.actions.map(([a, label]) => '<button class="acc-btn soft notif-act" data-a="' + a + '">' + esc(label) + "</button>").join("") + "</span>" : "") +
      '<span class="notif-msg"></span></span></li>';
  }

  function wireActions(root) {
    root.querySelectorAll(".notif-act").forEach((b) => (b.onclick = async () => {
      const li = b.closest(".notif-item");
      const n = items[Number(li.dataset.i)];
      li.querySelectorAll(".notif-act").forEach((x) => (x.disabled = true));
      const msg = await act(b.dataset.a, n);
      if (msg) {
        const m = li.querySelector(".notif-msg");
        m.textContent = msg.text;
        m.className = "notif-msg " + msg.cls;
      }
    }));
  }

  function renderPanel() {
    box.innerHTML = '<button class="acc-x" aria-label="Fermer">×</button><h3>🔔 ' + esc(T("Notifications")) + "</h3>" +
      (items.length ? '<ul class="notif-list">' + items.map(itemHtml).join("") + "</ul>"
        : '<p class="lb-empty">' + esc(T("Rien de neuf pour l'instant.")) + "</p>");
    box.querySelector(".acc-x").onclick = () => overlay.classList.remove("on");
    wireActions(box);
  }

  async function openPanel() {
    toasts.innerHTML = ""; // la liste montre tout : les bandeaux n'ont plus lieu d'être
    await refresh(false);
    renderPanel();
    overlay.classList.add("on");
    if (unread) {
      api.rpc("notifications_read").catch(() => {});
      unread = 0;
      paintCount();
    }
  }
  fab.addEventListener("click", openPanel);

  // --- Compteurs : cloche et titre de l'onglet ------------------------------------------
  const baseTitle = document.title.replace(/^\(\d+\+?\) /, "");
  function paintCount() {
    let badge = fab.querySelector(".online-badge");
    if (!unread) { if (badge) badge.remove(); }
    else {
      if (!badge) { badge = document.createElement("span"); badge.className = "online-badge"; fab.appendChild(badge); }
      badge.textContent = unread > 99 ? "99+" : String(unread);
    }
    document.title = (unread ? "(" + (unread > 99 ? "99+" : unread) + ") " : "") + baseTitle;
  }

  // --- Bandeau en direct --------------------------------------------------------------
  function toast(n) {
    const d = describe(n);
    // En pleine partie de salle, un vote de CETTE salle s'affiche déjà dans le jeu.
    const g = window.OE && window.OE.G ? window.OE.G() : null;
    const screen = document.querySelector(".screen.active");
    if (n.kind === "room_vote" && g && g.room && g.room.id === (n.payload || {}).roomId && screen && screen.id === "screen-game") return;
    const el = document.createElement("div");
    el.className = "notif-toast";
    el.innerHTML = '<span class="notif-icon">' + d.icon + '</span><span class="notif-text">' + d.html + '</span><button class="notif-toast-open">' + esc(T("Voir")) + '</button><button class="notif-toast-x" aria-label="Fermer">×</button>';
    el.querySelector(".notif-toast-open").onclick = () => { el.remove(); openPanel(); };
    el.querySelector(".notif-toast-x").onclick = () => el.remove();
    toasts.appendChild(el);
    while (toasts.children.length > 3) toasts.firstChild.remove();
    setTimeout(() => el.classList.add("out"), 7000);
    setTimeout(() => el.remove(), 7600);
  }

  // --- Lecture ------------------------------------------------------------------------
  let busy = false;
  async function refresh(announce = true) {
    if (!acc.getSession() || busy) return;
    busy = true;
    try {
      const { data } = await api.rpc("notifications_list");
      if (!data) return;
      items = data.items || [];
      unread = data.unread || 0;
      const newest = items.length ? items[0].id : 0;
      // Au premier chargement, on n'annonce rien : seulement ce qui arrive ensuite.
      if (announce && lastSeenId !== null) {
        items.filter((n) => n.id > lastSeenId && !n.read).reverse().forEach(toast);
      }
      lastSeenId = Math.max(lastSeenId || 0, newest);
      paintCount();
      if (overlay.classList.contains("on")) renderPanel();
      // Les pastilles des boutons Amis & Duels et Salle suivent.
      if (acc.refreshNotifs) acc.refreshNotifs();
      if (window.OpenElevenRoom && window.OpenElevenRoom.refreshBadge) window.OpenElevenRoom.refreshBadge();
    } catch (_) { /* réseau : le prochain signal ou sondage réessaiera */ } finally { busy = false; }
  }

  // --- Connexion en direct, selon la session --------------------------------------------
  let stopLive = null;
  function onSession() {
    const on = !!acc.getSession();
    fab.style.display = on ? "" : "none";
    if (stopLive) { stopLive(); stopLive = null; }
    if (!on) { items = []; unread = 0; lastSeenId = null; paintCount(); return; }
    stopLive = api.watchMe(() => refresh(true));
    refresh(false);
  }
  api.auth.onChange(() => onSession());
  onSession();
  // Filet de sécurité si le direct est coupé : léger, et seulement onglet visible.
  setInterval(() => { if (document.visibilityState === "visible" && acc.getSession()) refresh(true); }, 60000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refresh(true); });

  window.OpenElevenNotifs = { open: openPanel, refresh };
})();
