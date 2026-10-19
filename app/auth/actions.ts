"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function credentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials(formData));
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/bills");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(credentials(formData));
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  if (!data.session) {
    // Email confirmation is switched on in Supabase: no session until the link is clicked.
    redirect(`/login?message=${encodeURIComponent("Check your email to confirm, then log in.")}`);
  }
  redirect("/bills");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
