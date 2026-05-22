import { NextRequest, NextResponse } from "next/server";
import { runFieldRoutesSync, FieldRoutesClient } from "@/lib/integrations/fieldroutes";
import { prisma } from "@/lib/prisma";

function getCfg() {
  const subdomain = process.env.FIELDROUTES_SUBDOMAIN;
  const apiKey    = process.env.FIELDROUTES_API_KEY;
  const officeIds = process.env.FIELDROUTES_OFFICE_IDS?.split(",").map(Number).filter(Boolean);
  if (!subdomain || !apiKey) throw new Error("FIELDROUTES_SUBDOMAIN and FIELDROUTES_API_KEY must be set");
  return { subdomain, apiKey, officeIds };
}

// POST /api/sync/fieldroutes  — trigger a sync
export async function POST(req: NextRequest) {
  try {
    const { mode = "incremental" } = await req.json().catch(() => ({}));
    const cfg = getCfg();
    // Run async — return immediately with log ID, let it run
    const logEntry = await prisma.syncLog.create({
      data: { source:"fieldroutes", status:"running", mode, startedAt: new Date(),
              customersCreated:0, customersUpdated:0, invoicesCreated:0, invoicesUpdated:0, paymentsCreated:0, errorCount:0 }
    });
    // Fire and forget (in production use a proper job queue like BullMQ / Trigger.dev)
    runFieldRoutesSync(cfg, mode as "full" | "incremental").then(async (result) => {
      await prisma.syncLog.update({ where: { id: logEntry.id }, data: {
        status: result.status, completedAt: result.completedAt,
        customersCreated: result.customersCreated, customersUpdated: result.customersUpdated,
        invoicesCreated: result.invoicesCreated, invoicesUpdated: result.invoicesUpdated,
        paymentsCreated: result.paymentsCreated, errorCount: result.errors.length,
        errors: result.errors.join("\n"),
      }});
    });
    return NextResponse.json({ syncId: logEntry.id, status: "running", message: "Sync started" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message.includes("must be set") ? 400 : 500 });
  }
}

// GET /api/sync/fieldroutes  — get sync history + current status
export async function GET() {
  try {
    const logs = await prisma.syncLog.findMany({
      where: { source: "fieldroutes" },
      orderBy: { startedAt: "desc" },
      take: 20,
    });
    const running = logs.find(l => l.status === "running");
    return NextResponse.json({ logs, running: running ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
