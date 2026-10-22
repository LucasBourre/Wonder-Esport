// Reprise des données du projet Supabase d'origine : comptes, profils,
// sauvegardes, amis, scores, duels, salles.
//
//   SUPABASE_DB_URL=postgres://…   base Supabase (lue, jamais modifiée)
//   DATABASE_URL=postgres://…      base d'Open Eleven (schéma déjà créé : le
//                                  serveur l'installe à son premier démarrage)
//   node packages/server/scripts/import-supabase.js
//
// Les mots de passe sont repris tels quels (empreintes bcrypt) : chacun se
// connecte avec le sien, sans rien avoir à refaire. Un compte sans mot de
// passe (connexion par un fournisseur externe) est repris aussi, et devra
// passer par « Mot de passe oublié ».
//
// Tout se fait dans UNE transaction : en cas d'erreur, la base de destination
// reste telle qu'elle était. La destination doit être vide de comptes — pour
// rejouer l'import, repartir d'une base neuve.
import pg from "pg";

const sourceUrl = process.env.SUPABASE_DB_URL;
const targetUrl = process.env.DATABASE_URL;
if (!sourceUrl || !targetUrl) {
  console.error("SUPABASE_DB_URL et DATABASE_URL sont requis.");
  process.exit(1);
}

// Dans l'ordre des dépendances (une table après celles qu'elle référence).
// rate_limits n'est pas reprise : ce sont des compteurs du jour.
const TABLES = ["profiles", "saves", "friends", "daily_scores", "duels", "stats_totaux", "rooms", "room_members", "room_votes", "room_ballots", "room_progress"];
const BATCH = 200;

const source = new pg.Client({ connectionString: sourceUrl });
const target = new pg.Client({ connectionString: targetUrl });
await source.connect();
await target.connect();

async function insertRows(table, columns, jsonColumns, rows) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values = [];
    const tuples = chunk.map((row) => "(" + columns.map((c) => {
      // pg enverrait un tableau JS comme un tableau Postgres : le JSON part en texte.
      values.push(jsonColumns.has(c) && row[c] !== null ? JSON.stringify(row[c]) : row[c]);
      return "$" + values.length + (jsonColumns.has(c) ? "::jsonb" : "");
    }).join(", ") + ")");
    await target.query("insert into " + table + " (" + columns.join(", ") + ") values " + tuples.join(", "), values);
  }
}

try {
  await target.query("begin");
  const existing = (await target.query("select count(*)::int as n from users")).rows[0].n;
  if (existing) throw new Error("la base de destination contient déjà " + existing + " compte(s) : repartir d'une base neuve.");

  // --- Comptes ---------------------------------------------------------------
  const users = (await source.query(
    "select id, email, encrypted_password, email_confirmed_at, created_at from auth.users where email is not null and deleted_at is null order by created_at")).rows;
  const withoutPassword = users.filter((u) => !u.encrypted_password).length;
  await insertRows("users", ["id", "email", "password_hash", "email_confirmed_at", "created_at"], new Set(),
    // « ! » n'est l'empreinte d'aucun mot de passe : connexion impossible tant
    // qu'un nouveau n'a pas été choisi.
    users.map((u) => ({ id: u.id, email: u.email, password_hash: u.encrypted_password || "!", email_confirmed_at: u.email_confirmed_at, created_at: u.created_at })));
  console.log("comptes".padEnd(16), String(users.length).padStart(7), withoutPassword ? "(dont " + withoutPassword + " sans mot de passe)" : "");
  const known = new Set(users.map((u) => u.id));

  // --- Tables du jeu ---------------------------------------------------------
  for (const table of TABLES) {
    const cols = (await target.query(
      "select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position", [table])).rows;
    const columns = cols.map((c) => c.column_name);
    const jsonColumns = new Set(cols.filter((c) => c.data_type === "jsonb").map((c) => c.column_name));
    let rows;
    try {
      rows = (await source.query("select " + columns.join(", ") + " from public." + table)).rows;
    } catch (err) {
      if (err.code === "42P01") { console.log(table.padEnd(16), "absente de la source, ignorée"); continue; }
      throw err;
    }
    // Lignes orphelines (compte supprimé ou non repris) : elles violeraient
    // les clés étrangères, et n'appartiennent plus à personne.
    const userColumns = columns.filter((c) => ["user_id", "friend_id", "from_user", "created_by"].includes(c));
    const kept = rows.filter((r) => userColumns.every((c) => r[c] === null || known.has(r[c])));
    for (const r of kept) for (const c of ["to_user", "invited_by"]) if (c in r && r[c] !== null && !known.has(r[c])) r[c] = null;
    await insertRows(table, columns, jsonColumns, kept);
    console.log(table.padEnd(16), String(kept.length).padStart(7), kept.length < rows.length ? "(" + (rows.length - kept.length) + " orpheline(s) écartée(s))" : "");
  }
  await target.query("commit");
  console.log("Import terminé.");
} catch (err) {
  await target.query("rollback").catch(() => {});
  console.error("Import annulé, rien n'a été écrit :", err.message);
  process.exitCode = 1;
} finally {
  await source.end();
  await target.end();
}
