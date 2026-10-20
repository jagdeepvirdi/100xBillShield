import { NextResponse } from "next/server";
import { z } from "zod";
import { loadChecks } from "@/app/bills/loadChecks";
import { resolveChecks } from "@/lib/answers";
import { mostImportant, toFact } from "@/lib/message";
import { createClient } from "@/lib/supabase/server";
import { writeMessage } from "@/lib/writeMessage";

const bodySchema = z.object({
  billId: z.uuid(),
  tone: z.enum(["polite", "firm", "friendly"]).default("polite"),
});

export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const { billId, tone } = body.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Only the check results go to the model, never the raw bill. RLS limits rows to the caller's.
  const { run, detail, answers } = await loadChecks(supabase, billId);
  if (!run.length && !detail.length) return NextResponse.json({ error: "Run the checks first." }, { status: 409 });

  // Wrong lines and lines the user disputed count. Lines still waiting for an answer, or that the user
  // said they expected, never become a complaint.
  const issue = mostImportant(
    resolveChecks([...detail, ...run], answers).filter((row) => row.state === "wrong" || row.state === "disputed"),
  );
  if (!issue) return NextResponse.json({ message: null, reason: "Every line checks out." });

  const { data: line } = await supabase
    .from("line_item")
    .select("label")
    .eq("id", issue.line_item_id)
    .maybeSingle();
  if (!line) return NextResponse.json({ error: "The disputed line was not found." }, { status: 404 });

  const { text, source } = await writeMessage(line.label, toFact(issue), tone);

  const { error } = await supabase
    .from("message")
    .insert({ bill_id: billId, line_item_id: issue.line_item_id, draft: text });
  if (error) {
    console.error("message insert failed", error);
    return NextResponse.json({ error: "Could not save the message." }, { status: 500 });
  }
  return NextResponse.json({ message: text, source });
}
