import Link from "next/link";
import { login } from "@/app/auth/actions";
import Centered from "@/app/_components/Centered";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <Centered
      title="Log in"
      subtitle="Welcome back. Log in to check a bill."
      footer={
        <>
          New to BillShield? <Link href="/signup">Create an account</Link>
        </>
      }
    >
      {error && <p role="alert">{error}</p>}
      {message && <p>{message}</p>}
      <form action={login}>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit">Log in</button>
      </form>
    </Centered>
  );
}
