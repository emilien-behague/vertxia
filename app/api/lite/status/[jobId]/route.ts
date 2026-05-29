/**
 * GET /api/lite/status/[jobId]
 *
 * Retourne le statut d'un job Vertxia Lite.
 * V0.1 PHASE 1 (mock) : derive le progress de Date.now - startedAt via deriveMockProgress.
 * V0.1 PHASE 2 (real) : retourne directement le job file ecrit par le wrapper Python.
 */

import { NextRequest, NextResponse } from "next/server";
import { isValidJobId, readJob, deriveMockProgress } from "@/lib/jobs";

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

  // PHASE 1 mock : derive le progress. En PHASE 2, on retournera juste `job`.
  const progressed = deriveMockProgress(job);

  return NextResponse.json(progressed, {
    status: 200,
    headers: {
      // Pas de cache : le statut change a chaque poll
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
