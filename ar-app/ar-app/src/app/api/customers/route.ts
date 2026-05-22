import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  contact: z.string().optional(),
  billingAddr: z.string().optional(),
  serviceAddr: z.string().optional(),
  status: z.enum(["ACTIVE","SUSPENDED","COLLECTIONS"]).default("ACTIVE"),
  rep: z.string().optional(),
  terms: z.string().default("Net 30"),
  notes: z.string().optional(),
  autoReminder: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const customers = await prisma.customer.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(search && { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] })
      },
      include: { invoices: { select: { id:true, amount:true, paid:true, status:true, due:true } } },
      orderBy: { name: "asc" }
    });
    return NextResponse.json(customers);
  } catch (e) { return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = CustomerSchema.parse(body);
    const customer = await prisma.customer.create({ data });
    return NextResponse.json(customer, { status: 201 });
  } catch (e) { return NextResponse.json({ error: "Invalid data" }, { status: 400 }); }
}
