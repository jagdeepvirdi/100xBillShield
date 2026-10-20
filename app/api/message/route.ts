import { NextResponse } from "next/server";
import { z } from "zod";
import { isDetailRule, latestRun } from "@/lib/detailChecks";
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
  const { data: rows } = await supabase
    .from("check_result")
    .select("rule, expected, actual, verdict, line_item_id, created_at")
    .eq("bill_id", billId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (!rows?.length) return NextResponse.json({ error: "Run the checks first." }, { status: 409 });

  // The newest run counts, plus the detail checks saved when the lines were confirmed.
  const issue = mostImportant([
    ...latestRun(rows.filter((row) => !isDetailRule(row.rule))),
    ...latestRun(rows.filter((row) => isDetailRule(row.rule))),
  ]);
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
