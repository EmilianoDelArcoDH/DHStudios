import { NextResponse } from "next/server";
import type { Report } from "@/types";
import { db, ensureDatabaseSchema, hasDatabaseConnection } from "@/lib/db";

type StoredReportRow = {
  project_id: string;
  editor_key: string;
  name: string;
  is_public: boolean;
  report: Report;
};

async function readStoredReport(projectId: string) {
  await ensureDatabaseSchema();
  const sql = db();
  const rows = await sql<StoredReportRow[]>`
    select project_id, editor_key, name, is_public, report
    from app_reports
    where project_id = ${projectId}
    limit 1
  `;
  return rows[0];
}

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!hasDatabaseConnection()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 500 });
  }

  const { projectId } = await context.params;
  const url = new URL(request.url);
  const publicOnly = url.searchParams.get("public") === "1";
  const editorKey = request.headers.get("x-editor-key");
  const stored = await readStoredReport(projectId);

  if (!stored) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (publicOnly) {
    if (!stored.is_public) return NextResponse.json({ error: "Report not public." }, { status: 403 });
  } else if (!editorKey || editorKey !== stored.editor_key) {
    return NextResponse.json({ error: "Invalid editor key." }, { status: 403 });
  }

  return NextResponse.json({ report: stored.report });
}

export async function PUT(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!hasDatabaseConnection()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 500 });
  }

  const { projectId } = await context.params;
  const editorKey = request.headers.get("x-editor-key");
  const payload = await request.json().catch(() => null) as { report?: Report } | null;
  const report = payload?.report;

  if (!report?.pages || !report?.datasets) {
    return NextResponse.json({ error: "Invalid report payload." }, { status: 400 });
  }

  const stored = await readStoredReport(projectId);
  const nextEditorKey = stored?.editor_key ?? editorKey ?? crypto.randomUUID();

  if (stored && editorKey !== stored.editor_key) {
    return NextResponse.json({ error: "Invalid editor key." }, { status: 403 });
  }

  const now = new Date().toISOString();
  const normalizedReport: Report = {
    ...report,
    projectId,
    isPublic: Boolean(report.isPublic),
    updatedAt: now,
    createdAt: stored?.report.createdAt ?? report.createdAt ?? now,
  };

  await ensureDatabaseSchema();
  const sql = db();
  await sql`
    insert into app_reports (project_id, editor_key, name, is_public, report, created_at, updated_at)
    values (
      ${projectId},
      ${nextEditorKey},
      ${normalizedReport.name},
      ${normalizedReport.isPublic},
      ${sql.json(normalizedReport)},
      ${normalizedReport.createdAt},
      ${normalizedReport.updatedAt}
    )
    on conflict (project_id) do update set
      name = excluded.name,
      is_public = excluded.is_public,
      report = excluded.report,
      updated_at = excluded.updated_at
  `;

  return NextResponse.json({ report: normalizedReport, editorKey: nextEditorKey });
}
