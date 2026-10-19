import { logout } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function BillsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main>
      <h1>Your bills</h1>
      <p>Signed in as {user?.email}</p>
      <form action={logout}>
        <button type="submit">Log out</button>
      </form>
    </main>
  );
}
