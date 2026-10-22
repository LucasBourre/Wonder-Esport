// Lance les scénarios de bout en bout.
//
//   npm run build && npm run test:e2e                 les scénarios sans serveur (version assemblée)
//   E2E_URL=http://localhost:8080 npm run test:e2e    + ceux qui demandent la pile complète
//   E2E_MAILPIT=http://localhost:8025 …                 + parcours par e-mail
//   npm run test:e2e -- solo tournaments               seulement ceux-là (par nom de fichier)
//
// Un scénario qui demande ce qui manque (pile, navigateur complet) est ignoré
// avec la raison, jamais compté comme réussi en silence.
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findBrowser, launchBrowser, reporter, serveStatic } from "./lib.js";

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, "..", "dist");
const stackUrl = process.env.E2E_URL?.replace(/\/+$/, "");
const mailpit = process.env.E2E_MAILPIT?.replace(/\/+$/, "");
const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));

const files = readdirSync(here).filter((f) => f.endsWith(".e2e.js")).sort().filter((f) => !only.length || only.some((o) => f.includes(o)));
if (!findBrowser()) {
  console.error("Aucun navigateur trouvé (Chrome, Edge, Chromium). Installez-en un ou indiquez CHROME_PATH.");
  process.exit(2);
}

let server = null, browser = null, failed = 0, checks = 0;
const skipped = [];
try {
  for (const file of files) {
    const mod = await import("./" + file);
    const { title, needs } = mod.meta;
    if (needs.includes("stack") && !stackUrl) { skipped.push(`${file} (demande E2E_URL : la pile complète)`); continue; }
    if (needs.includes("static") || !needs.includes("stack")) {
      if (!existsSync(join(distDir, "index.html"))) { skipped.push(`${file} (version assemblée absente : lancez « npm run build »)`); continue; }
    }
    const report = reporter(`${title}  [${file}]`);
    // Le scénario hors-ligne gère son propre navigateur et son propre serveur.
    if (needs.includes("fullBrowser")) {
      await mod.run({ report, distDir });
    } else {
      browser ??= await launchBrowser();
      let baseUrl = stackUrl;
      if (!needs.includes("stack")) { server ??= await serveStatic(distDir); baseUrl = server.url; }
      try {
        await mod.run({ browser, report, baseUrl, stackUrl, mailpit, distDir });
      } catch (err) {
        report.check("le scénario va jusqu'au bout", false, err.stack ?? String(err));
      }
    }
    failed += report.failed; checks += report.checks;
  }
} finally {
  await browser?.close();
  await server?.close();
}
console.log(`\n${checks} vérifications, ${failed} échec(s)` + (skipped.length ? `\nIgnorés :\n  - ${skipped.join("\n  - ")}` : ""));
process.exit(failed ? 1 : 0);
