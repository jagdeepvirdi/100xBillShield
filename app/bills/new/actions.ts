"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BILL_TYPES } from "@/lib/billTypes";
import { redactText } from "@/lib/redact";
import { createClient } from "@/lib/supabase/server";

// Vercel rejects request bodies over 4.5 MB, and the file travels through this server action.
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};


// "auto" means the reader picks the type; until it has read the bill the row is stored as "other".
const billSchema = z.object({
  bill_type: z.enum(["auto", ...BILL_TYPES]).transform((v) => (v === "auto" ? "other" : v)),
  provider: z.string().trim().max(120).transform((v) => redactText(v) || null),
});

function fail(message: string): never {
  redirect(`/bills/new?error=${encodeURIComponent(message)}`);
}

export async function uploadBill(formData: FormData) {
  const parsed = billSchema.safeParse({
    bill_type: formData.get("bill_type"),
    provider: formData.get("provider") ?? "",
  });
  if (!parsed.success) fail("Check the bill type and company name.");
  const { bill_type, provider } = parsed.data;

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) fail("Choose a photo or PDF of the bill.");
  const ext = EXTENSIONS[photo.type];
  if (!ext) fail("The file must be a JPG, PNG or WebP image, or a PDF.");
  if (photo.size > MAX_PHOTO_BYTES) fail("The file is larger than 4 MB. Choose a smaller photo or PDF.");

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
    .insert({ bill_type, provider, image_link: path });
  if (insertError) {
    // Do not leave an orphan photo behind.
    await supabase.storage.from("bill-images").remove([path]);
    fail(`Could not save the bill: ${insertError.message}`);
  }

  redirect("/bills");
}
