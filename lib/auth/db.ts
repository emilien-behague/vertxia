/**
 * Postgres client singleton (Neon).
 *
 * On utilise le client `postgres` (postgres-js) en mode pooled — la string Neon
 * pointe deja vers le pooler (ep-xxx-pooler).
 *
 * Pour les serverless edge runtime futurs : envisager @neondatabase/serverless.
 * Pour V0.8 (Node.js runtime), postgres-js suffit largement.
 */

import postgres from "postgres";

const globalForDb = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };

function getSql() {
  if (globalForDb.__sql) return globalForDb.__sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL absent de l'environnement");
  const client = postgres(url, {
    prepare: false, // Neon pooler n'aime pas les prepared statements en pooled mode
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  globalForDb.__sql = client;
  return client;
}

export const sql = new Proxy({} as ReturnType<typeof postgres>, {
  get(_target, prop) {
    const client = getSql();
    return Reflect.get(client, prop);
  },
  apply(_target, _thisArg, args) {
    const client = getSql();
    // Allow tagged template usage : sql`SELECT ...`
    // @ts-expect-error proxy bridge
    return client(...args);
  },
});

// Tagged template helper qui force le passage par le proxy
export function db(strings: TemplateStringsArray, ...values: unknown[]) {
  const client = getSql();
  // @ts-expect-error postgres-js tagged template
  return client(strings, ...values);
}

/* =========================================================
 *  Types domaine
 * ========================================================= */

export type User = {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  created_at: Date;
  last_login_at: Date | null;
};

export type MagicLink = {
  id: number;
  email: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
};
