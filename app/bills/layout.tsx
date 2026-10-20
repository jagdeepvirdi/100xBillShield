import type { ReactNode } from "react";
import Link from "next/link";
import Brand from "@/app/_components/Brand";
import { logout } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import styles from "./layout.module.css";

// The shell shared by every page after login: logo, main links, who is signed in, log out.
export default async function BillsLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Brand href="/bills" />
          <nav className={styles.nav} aria-label="Main">
            <Link href="/bills" className={styles.navLink}>
              Your bills
            </Link>
            <Link href="/bills/new" className="btn small">
              Upload a bill
            </Link>
            {user?.email && <span className={styles.email}>{user.email}</span>}
            <form action={logout}>
              <button type="submit" className="secondary small">
                Log out
              </button>
            </form>
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}
