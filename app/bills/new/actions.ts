"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const optionalText = z.string().trim().transform((v) => v || null);
const optionalDate = z.union([z.literal("").transform(() => null), z.iso.date()]);

const billSchema = z.object({
  bill_type: z.enum(["lpg", "electricity", "broadband", "phone", "other"]),
  provider: optionalText,
  period_start: optionalDate,
  period_end: optionalDate,
});

function fail(message: string): never {
  redirect(`/bills/new?error=${encodeURIComponent(message)}`);
}

export async function uploadBill(formData: FormData) {
  const parsed = billSchema.safeParse({
    bill_type: formData.get("bill_type"),
    provider: formData.get("provider") ?? "",
    period_start: formData.get("period_start") ?? "",
    period_end: formData.get("period_end") ?? "",
  });
  if (!parsed.success) fail("Check the bill type and dates.");
  const { bill_type, provider, period_start, period_end } = parsed.data;
  if (period_start && period_end && period_end < period_start) {
    fail("Period end is before period start.");
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) fail("Choose a photo or PDF of the bill.");
  const ext = EXTENSIONS[photo.type];
  if (!ext) fail("The file must be a JPG, PNG or WebP image, or a PDF.");
  if (photo.size > MAX_PHOTO_BYTES) fail("The file is larger than 8 MB.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const path = `${user.id}/${randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("bill-images")
    .upload(path, photo, { contentType: photo.type });
  if (uploadError) fail(`Upload failed: ${uploadError.message}`);

  const { error: insertError } = await supabase
    .from("bill")
    .insert({ bill_type, provider, period_start, period_end, image_link: path });
  if (insertError) {
    // Do not leave an orphan photo behind.
    await supabase.storage.from("bill-images").remove([path]);
    fail(`Could not save the bill: ${insertError.message}`);
  }

  redirect("/bills");
}
