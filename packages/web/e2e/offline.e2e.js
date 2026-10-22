// Hors-ligne : le service worker s'installe, met l'application en cache, et la page
// se recharge serveur coupé. Demande un VRAI navigateur (le « headless shell » minimal
// n'implémente pas les service workers) ; ignoré s'il n'y en a pas.
import { findBrowser, flat, launchBrowser, serveStatic, wait } from "./lib.js";

export const meta = { title: "Service worker et mode hors-ligne", needs: ["static", "fullBrowser"] };

export async function run({ report, distDir }) {
  if (!findBrowser({ full: true })) return report.check("navigateur complet disponible", true, "ignoré : aucun Chrome/Edge/Chromium complet");
  const server = await serveStatic(distDir);
  const browser = await launchBrowser({ full: true });
  try {
    const page = await browser.newPage(server.url + "/", { name: "hors-ligne" });
    await wait(1500);
    await page.reload(); // la 2ᵉ visite est contrôlée par le worker
    await wait(3000);
    const worker = JSON.parse(await page.js("navigator.serviceWorker.getRegistration().then(r => JSON.stringify(r && r.active ? { state: r.active.state, script: r.active.scriptURL } : null))"));
    report.check("le service worker est actif", worker && worker.state === "activated", JSON.stringify(worker));

    const cached = JSON.parse(await page.js("caches.keys().then(async (ks) => JSON.stringify(await Promise.all(ks.map(async (k) => [k, (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname)]))))"));
    const paths = cached.flatMap(([, list]) => list);
    report.check("le cache porte l'empreinte de la version", cached.length === 1 && /^open-eleven-[0-9a-f]{10}$/.test(cached[0][0]), cached.map((c) => c[0]).join(","));
    report.check("la page, l'application et les polices sont en cache", paths.includes("/index.html") && paths.some((p) => /^\/assets\/index-.*\.js$/.test(p)) && paths.some((p) => /oswald-600-latin\.woff2$/.test(p)), paths.slice(0, 6).join(" "));
    report.check("les requêtes /api ne sont jamais mises en cache", !paths.some((p) => p.startsWith("/api/")), paths.filter((p) => p.startsWith("/api/")).join(","));

    server.goOffline(); // le serveur ne répond plus
    await page.reload();
    await wait(2500);
    report.check("la page se recharge hors-ligne", /OPEN ELEVEN/i.test(flat(await page.js("document.title"))), await page.js("document.title"));
    report.check("le jeu démarre hors-ligne", (await page.text("#btn-start")).length > 0 && (await page.js("typeof window.OE")) === "object");
    report.noErrors(page);
  } finally {
    await browser.close();
    await server.close();
  }
}
