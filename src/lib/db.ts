import postgres from "postgres";

let sqlInstance: postgres.Sql | null = null;
let schemaReady: Promise<void> | null = null;

function connectionString() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;
}

export function hasDatabaseConnection() {
  return Boolean(connectionString());
}

export function db() {
  if (sqlInstance) return sqlInstance;
  const url = connectionString();
  if (!url) {
    throw new Error("Falta configurar POSTGRES_URL o DATABASE_URL para usar Neon/Vercel Postgres.");
  }
  sqlInstance = postgres(url, { prepare: false, max: 1 });
  return sqlInstance;
}

export async function ensureDatabaseSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const sql = db();
    await sql`
      create table if not exists app_reports (
        project_id uuid primary key,
        editor_key text not null,
        name text not null,
        is_public boolean not null default false,
        report jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `;
    await sql`create index if not exists app_reports_public_idx on app_reports (is_public, updated_at desc)`;
  })();
  return schemaReady;
}
