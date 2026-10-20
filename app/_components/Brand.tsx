import Link from "next/link";
import styles from "./Brand.module.css";

export default function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className={styles.brand}>
      <svg className={styles.mark} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.6 7.5 10 4.4-1.4 7.5-5.4 7.5-10v-6L12 2.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M8.5 9.5h7M8.5 15.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8.5 12.5h7" stroke="#ffe35a" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      BillShield
    </Link>
  );
}
