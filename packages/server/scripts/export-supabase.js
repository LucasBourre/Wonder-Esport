// Sauvegarde du projet Supabase d'origine dans un fichier .sql, à garder chez soi.
//
//   SUPABASE_DB_URL=postgres://…   base Supabase (lue, jamais modifiée)
//   node packages/server/scripts/export-supabase.js
//
// Le fichier est écrit dans sauvegardes/ (ignoré par git et par Docker). Il contient
// le schéma « public » (structure + données) et la table des comptes auth.users :
// adresses e-mail et empreintes de mots de passe comprises. Le garder privé.
//
// Rien à installer : pg_dump tourne dans un conteneur Docker (image postgres:17-alpine,
// à changer avec PG_IMAGE si la base Supabase est plus récente que la 17).
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL est requis (l'adresse de connexion Postgres de Supabase).");
  process.exit(1);
}
const image = process.env.PG_IMAGE || "postgres:17-alpine";

const jour = new Date().toISOString().slice(0, 10);
mkdirSync("sauvegardes", { recursive: true });
const fichier = join("sauvegardes", `supabase-${jour}.sql`);
const sortie = createWriteStream(fichier);

// L'adresse passe par l'environnement du conteneur, jamais par la ligne de commande
// (elle apparaîtrait dans la liste des processus).
const commande = [
  'echo "-- Open Eleven : sauvegarde Supabase du ' + jour + '"',
  'pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges',
  'echo "-- Comptes (auth.users) : données seules"',
  'pg_dump "$SUPABASE_DB_URL" --table=auth.users --data-only --no-owner --no-privileges',
].join(" && ");

const docker = spawn("docker", ["run", "--rm", "-e", "SUPABASE_DB_URL", image, "sh", "-c", commande], {
  env: process.env,
  stdio: ["ignore", "pipe", "inherit"],
});
docker.stdout.pipe(sortie);

docker.on("error", (e) => {
  console.error("Impossible de lancer Docker :", e.message);
  process.exit(1);
});
docker.on("close", (code) => {
  sortie.end(() => {
    if (code !== 0) {
      try { unlinkSync(fichier); } catch { /* déjà absent */ }
      console.error(`pg_dump a échoué (code ${code}) ; aucun fichier conservé.`);
      process.exit(code || 1);
    }
    const ko = Math.round(statSync(fichier).size / 1024);
    console.log(`Sauvegarde écrite : ${fichier} (${ko} Ko). Contient e-mails et mots de passe hachés : à garder privée.`);
  });
});
