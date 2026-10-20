import Link from "next/link";
import Centered from "@/app/_components/Centered";

export default function NotFound() {
  return (
    <Centered title="Page not found" subtitle="That page doesn't exist, or the link is out of date.">
      <Link href="/" className="btn">
        Back to the home page
      </Link>
    </Centered>
  );
}
