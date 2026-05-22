import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const InvoiceSchema = z.object({
  id: z.string().min(1),
  customerId: z.string(),
  date: z.string(),
  due: z.string(),
  amount: z.number().positive(),
  paid: z.number().min(0).default(0),
  status: z.enum(["CURRENT","OVERDUE","COLLECTIONS","PAYMENT_PLAN","DISPUTED","PAID"]).default("CURRENT"),
  description: z.string().optional(),
  branch: z.string().optional(),
  serviceType: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const branch = searchParams.get("branch");
  const serviceType = searchParams.get("serviceType");
  const search = searchParams.get("search");
  const customerId = searchParams.get("customerId");

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(status && { status: status as any }),
      ...(branch && { branch }),
      ...(serviceType && { serviceType }),
      ...(customerId && { customerId }),
      ...(search && { OR: [{ id: { contains: search, mode: "insensitive" } }, { customer: { name: { contains: search, mode: "insensitive" } } }] })
    },
    include: { customer: { select: { id:true, name:true, email:true, contact:true, terms:true, rep:true } }, payments: { orderBy: { date: "desc" } } },
    orderBy: { due: "asc" }
  });
  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = InvoiceSchema.parse(body);
    const invoice = await prisma.invoice.create({ data: { ...data, date: new Date(data.date), due: new Date(data.due) }, include: { customer: true } });
    return NextResponse.json(invoice, { status: 201 });
  } catch (e) { return NextResponse.json({ error: "Invalid data" }, { status: 400 }); }
}
