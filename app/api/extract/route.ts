import { NextResponse } from "next/server";
import { z } from "zod";
import { readBill } from "@/lib/extract";
import { redactLabel, redactText } from "@/lib/redact";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({ billId: z.uuid() });

export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // RLS means a bill that is not the caller's comes back as no row.
  const { data: bill } = await supabase
    .from("bill")
    .select("image_link")
    .eq("id", body.data.billId)
    .maybeSingle();
  if (!bill?.image_link) return NextResponse.json({ error: "Bill not found." }, { status: 404 });

  const { data: signed, error: signError } = await supabase.storage
    .from("bill-images")
    .createSignedUrl(bill.image_link, 120);
  if (signError || !signed) {
    return NextResponse.json({ error: "Could not open the bill file." }, { status: 500 });
  }

  try {
    const { info, lines, details } = await readBill(signed.signedUrl, bill.image_link);
    const clean = <T extends { label: string }>(line: T) => ({ ...line, label: redactLabel(line.label) });
    return NextResponse.json({
      info: { ...info, provider: info.provider ? redactText(info.provider) || null : null },
      lines: lines.map(clean),
      details: details.map((detail) => ({ ...detail, name: redactLabel(detail.name), items: detail.items.map(clean) })),
    });
  } catch (error) {
    console.error("extract failed", error);
    return NextResponse.json(
      { error: "Could not read the bill. Try again, or add the lines by hand." },
      { status: 502 },
    );
  }
}
