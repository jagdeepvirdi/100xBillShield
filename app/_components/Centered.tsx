import type { ReactNode } from "react";
import Brand from "./Brand";
import styles from "./Centered.module.css";

// A single card centred on the page: login, signup and the global 404.
export default function Centered({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <Brand />
      </header>
      <div role="main" className={styles.center}>
        <div className={styles.card}>
          <h1>{title}</h1>
          {subtitle && <p className={styles.sub}>{subtitle}</p>}
          <div className={styles.body}>{children}</div>
          {footer && <p className={styles.footer}>{footer}</p>}
        </div>
      </div>
    </div>
  );
}
