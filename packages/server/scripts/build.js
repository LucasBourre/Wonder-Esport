// Assemble le serveur en un fichier : dist/server.js. Le moteur et le contenu
// (paquets voisins, en TypeScript) y sont inclus ; les dépendances npm restent
// dans node_modules.
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

await build({
  entryPoints: [join(root, "src", "index.ts")],
  outfile: join(root, "dist", "server.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  charset: "utf8",
  external: Object.keys(pkg.dependencies).filter((d) => !d.startsWith("@open-eleven/")),
  logLevel: "info",
});
