// Accès à la base Postgres : connexions, migrations, transactions « au nom de ».
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { config } from "./config";

// Postgres renvoie bigint et numeric sous forme de texte pour ne perdre aucune
// précision. Ici ce sont des rangs, des compteurs et des scores : des nombres
// ordinaires, que l'interface attend comme tels.
pg.types.setTypeParser(20, (v) => Number(v)); // bigint
pg.types.setTypeParser(1700, (v) => Number(v)); // numeric

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

export type Db = pg.PoolClient;

/**
 * Exécute `fn` dans une transaction où l'utilisateur courant est annoncé à la
 * base : les fonctions SQL le lisent par app_user_id(). `null` = hors connexion.
 */
export async function withUser<T>(userId: string | null, fn: (db: Db) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("begin");
    await db.query("select set_config('app.user_id', $1, true)", [userId ?? ""]);
    const result = await fn(db);
    await db.query("commit");
    return result;
  } catch (err) {
    await db.query("rollback").catch(() => {});
    throw err;
  } finally {
    db.release();
  }
}

/** Applique, dans l'ordre, les fichiers de migrations/ qui ne l'ont pas encore été. */
export async function migrate(dir: string): Promise<string[]> {
  const db = await pool.connect();
  const applied: string[] = [];
  try {
    // Un seul serveur migre à la fois, même si plusieurs démarrent ensemble.
    await db.query("select pg_advisory_lock(4011)");
    await db.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
    const done = new Set((await db.query("select name from schema_migrations")).rows.map((r) => r.name as string));
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      if (done.has(file)) continue;
      await db.query("begin");
      try {
        await db.query(readFileSync(join(dir, file), "utf8"));
        await db.query("insert into schema_migrations (name) values ($1)", [file]);
        await db.query("commit");
      } catch (err) {
        await db.query("rollback");
        throw new Error("migration " + file + " : " + (err as Error).message);
      }
      applied.push(file);
    }
  } finally {
    await db.query("select pg_advisory_unlock(4011)").catch(() => {});
    db.release();
  }
  return applied;
}

/** Attend que la base réponde (au démarrage, elle peut encore s'initialiser). */
export async function waitForDb(attempts = 30): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await pool.query("select 1");
      return;
    } catch (err) {
      if (i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
