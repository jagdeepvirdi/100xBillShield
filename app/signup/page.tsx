import Link from "next/link";
import { signup } from "@/app/auth/actions";
import Centered from "@/app/_components/Centered";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <Centered
      title="Create your account"
      subtitle="Upload a bill and find out whether every line adds up."
      footer={
        <>
          Already have an account? <Link href="/login">Log in</Link>
        </>
      }
    >
      {error && <p role="alert">{error}</p>}
      <form action={signup}>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password (at least 6 characters)
          <input name="password" type="password" autoComplete="new-password" minLength={6} required />
        </label>
        <button type="submit">Create account</button>
      </form>
    </Centered>
  );
}
