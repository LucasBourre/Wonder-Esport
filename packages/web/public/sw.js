/* ============================================================
   Service worker — Open Eleven (PWA : installable + hors-ligne).
   Stratégie SANS piège de version périmée :
   • HTML (navigation) → network-first : toujours la dernière version
     en ligne, repli sur le cache uniquement hors-ligne.
   • Autres fichiers (JS/CSS/images) → cache-first : sûr car l'application
     assemblée porte une empreinte dans son nom, et les scripts de public/
     un ?v= — une nouvelle version = nouvelle URL = nouveau téléchargement.

   CACHE et CORE sont remplis à l'assemblage (vite.config.js) : le nom du
   cache est l'empreinte de tout ce qui est publié, la liste est établie
   d'après les fichiers réellement écrits. Rien à tenir à jour à la main.
   ============================================================ */
const CACHE = "open-eleven-__BUILD__";
const CORE = ["__CORE__"];

// Précache TOLÉRANT : addAll() rejette en bloc dès qu'UNE seule URL répond autre
// chose que 2xx, ce qui fait échouer l'install et jeter le worker — donc plus de
// hors-ligne, plus d'installation PWA, et plus de purge des anciens caches. C'est
// exactement ce qui s'est produit avec une entrée de CORE pointant un fichier
// absent. On met donc chaque asset en cache indépendamment : un asset manquant
// dégrade le hors-ligne pour LUI SEUL au lieu de tout casser silencieusement.
//
// PAS de skipWaiting() ici : un nouveau worker reste en attente au lieu de
// prendre la main tout seul. C'est VOULU — le cache servait parfois d'anciens
// fichiers sans que le joueur s'en rende compte. On laisse plutôt sw-register.js
// détecter cette attente, afficher « une mise à jour est disponible », et
// n'activer la nouvelle version que quand le joueur clique (message SKIP_WAITING
// ci-dessous). Repli automatique : sans clic, elle s'appliquera à la prochaine
// fermeture complète de l'appli, comportement standard d'un worker en attente.
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {}))))
      // Si CacheStorage est indisponible (quota plein, navigation privée stricte,
      // certains environnements), caches.open() rejette. Sans ce catch, TOUTE
      // l'install échoue et le worker devient « redundant » : plus de hors-ligne,
      // ET plus de mécanisme de mise à jour. On tolère donc l'échec du précache —
      // le worker s'installe quand même, quitte à ne pas servir hors-ligne.
      .catch(() => {})
  );
});

// Le bouton « Mettre à jour » de la page demande au worker en attente de prendre
// la main immédiatement. Il s'active alors, réclame les clients (clients.claim
// ci-dessous), ce qui déclenche `controllerchange` côté page → rechargement.
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      // Même prudence qu'à l'install : si la purge échoue, on réclame quand même
      // les clients — sinon `controllerchange` ne se déclenche pas et la mise à
      // jour acceptée ne s'applique jamais.
      .catch(() => {})
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // laisser passer GA & tiers
  // Le serveur du jeu (session, classements, salles) : jamais de cache, sinon
  // on resservirait la session ou le classement d'hier.
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r; })
        .catch(() => caches.match(req).then((m) => m || caches.match("./index.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((m) => m || fetch(req).then((r) => {
      const cp = r.clone();
      caches.open(CACHE).then((c) => c.put(req, cp));
      return r;
    }))
  );
});
