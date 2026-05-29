/**
 * GET /api/lite/status/[jobId]
 *
 * Retourne le statut d'un job Vertxia Lite.
 * V0.5 : retourne directement le job file ecrit par runPipeline a chaque etape.
 */

import { NextRequest, NextResponse } from "next/server";
import { isValidJobId, readJob } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (!isValidJobId(jobId)) {
    return NextResponse.json(
      { error: "jobId invalide" },
      { status: 400 }
    );
  }

  const job = await readJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job introuvable" }, { status: 404 });
  }

  return NextResponse.json(job, {
    status: 200,
    headers: {
      // Pas de cache : le statut change a chaque poll
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
