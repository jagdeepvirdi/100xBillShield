import Link from "next/link";
import Brand from "@/app/_components/Brand";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

const STEPS = [
  {
    title: "Upload the bill",
    text: "Take a photo or choose a PDF. BillShield reads the lines into a table. Fix anything it got wrong, then confirm.",
  },
  {
    title: "Say what you were promised",
    text: "Enter the plan price, whether tax is included, and any discount. The bill is checked against this.",
  },
  {
    title: "Run the checks",
    text: "Every amount is checked by code. You see what was expected, what was billed and the difference.",
  },
  {
    title: "Send the message",
    text: "If a line is wrong or unexplained, BillShield writes a short message about the most important one. Copy it, change it if you like, and send it to the company.",
  },
];

const CHECKS = [
  "The lines add up to the total",
  "Tax is the right percentage of the right amount, including prices that already include tax",
  "The discount you were promised was applied",
  "Rounding is a few paise, not more than a rupee",
  "Meter readings multiplied by the rate match the charge",
  "Opening balance plus charges minus payments matches what you owe",
  "Charges that are new or changed since your last bill from the same company",
];

function Tick({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="m6 10.3 2.7 2.7L14 7.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cta = user ? (
    <Link href="/bills" className={`${styles.btn} ${styles.btnPrimary}`}>
      Go to your bills
    </Link>
  ) : (
    <>
      <Link href="/signup" className={`${styles.btn} ${styles.btnPrimary}`}>
        Create an account
      </Link>
      <Link href="/login" className={`${styles.btn} ${styles.btnSecondary}`}>
        Log in
      </Link>
    </>
  );

  return (
    <div className={styles.page}>
      <header className={`${styles.nav} ${styles.wrap}`}>
        <div className={styles.navInner}>
          <Brand />
          <nav className={styles.navActions} aria-label="Account">
            {user ? (
              <Link href="/bills" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}>
                Your bills
              </Link>
            ) : (
              <>
                <Link href="/login" className={styles.navLink}>
                  Log in
                </Link>
                <Link href="/signup" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}>
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <div role="main">
        <section className={`${styles.hero} ${styles.wrap}`}>
          <div className={styles.heroGrid}>
            <div>
              <h1 className={styles.title}>Find the line on your bill that doesn&rsquo;t add up</h1>
              <p className={styles.lead}>
                Upload a bill, say what you were promised, and BillShield checks every amount. If something is wrong,
                you get one message to send to the company. If everything is right, you get the maths showing why.
              </p>
              <div className={styles.actions}>{cta}</div>
              <p className={styles.note}>
                Works with LPG, electricity, broadband and phone bills. Upload a photo or a PDF, up to 4 MB.
              </p>
            </div>

            <div className={styles.demo}>
              <div className={styles.receiptWrap}>
                <div className={styles.receipt} role="img" aria-label="A sample bill where the GST line is highlighted. GST is billed at 76.35 but should be 64.70, a difference of 11.65.">
                  <div className={styles.receiptHead}>
                    <span className={styles.receiptTitle}>Broadband bill</span>
                    <span className={styles.tag}>Example</span>
                  </div>
                  <p className={styles.promised}>Promised: plan of 499, tax included, 15% discount</p>
                  <ul className={styles.lines}>
                    <li className={styles.line}>
                      <span>Plan charge</span>
                      <span className={styles.leader} />
                      <span className={styles.amount}>499.00</span>
                    </li>
                    <li className={styles.line}>
                      <span>Discount</span>
                      <span className={styles.leader} />
                      <span className={styles.amount}>-74.85</span>
                    </li>
                    <li>
                      <div className={`${styles.line} ${styles.flagged}`}>
                        <span>GST @ 18%</span>
                        <span className={styles.leader} />
                        <span className={styles.amount}>76.35</span>
                      </div>
                      <div className={styles.working}>
                        <span>Expected 64.70</span>
                        <span>Billed 76.35</span>
                        <span>Difference 11.65</span>
                      </div>
                    </li>
                  </ul>
                  <div className={`${styles.line} ${styles.total}`}>
                    <span>Total amount due</span>
                    <span className={styles.leader} />
                    <span className={styles.amount}>500.50</span>
                  </div>
                </div>
                <div className={styles.edge} />
              </div>

              <div className={styles.message}>
                <p className={styles.messageLabel}>The message BillShield writes for you</p>
                <p>Hello,</p>
                <p>
                  I am writing about the charge &ldquo;GST @ 18%&rdquo; on my latest bill. The bill shows 76.35 but it
                  should be 64.70, a difference of 11.65. Please check it and send me a corrected bill or an
                  explanation.
                </p>
                <p>Thank you</p>
              </div>
              <p className={styles.demoNote}>An example only. Your results come from your own bill.</p>
            </div>
          </div>
        </section>

        <section className={`${styles.band} ${styles.bandSurface}`} aria-labelledby="how">
          <div className={styles.wrap}>
            <h2 id="how" className={styles.sectionTitle}>
              What you do
            </h2>
            <p className={styles.sectionLead}>Four steps, and you only need your bill and what the company promised you.</p>
            <ol className={styles.steps}>
              {STEPS.map((step) => (
                <li key={step.title} className={styles.step}>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
            <p className={styles.afterSteps}>
              Not sure anything is wrong? If every line checks out, BillShield says so and shows its working. There is
              nothing to send.
            </p>
          </div>
        </section>

        <section className={`${styles.band} ${styles.wrap}`} aria-labelledby="checks">
          <div className={styles.twoCol}>
            <div>
              <h2 id="checks" className={styles.sectionTitle}>
                What gets checked
              </h2>
              <p className={styles.sectionLead}>
                Each check compares a number on your bill with the number it should be, and shows both.
              </p>
            </div>
            <ul className={styles.checkList}>
              {CHECKS.map((check) => (
                <li key={check}>
                  <Tick className={styles.tick} />
                  <span>{check}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={`${styles.band} ${styles.bandSurface}`} aria-labelledby="trust">
          <div className={`${styles.wrap} ${styles.twoCol}`}>
            <h2 id="trust" className={styles.sectionTitle}>
              How your bill is handled
            </h2>
            <div className={styles.facts}>
              <div>
                <h3>The numbers come from code, not AI</h3>
                <p>
                  The AI reads your bill and words the message. All the arithmetic is done by code, and every amount in
                  your message is checked against the results before you see it.
                </p>
              </div>
              <div>
                <h3>No invented problems</h3>
                <p>If your bill is correct, BillShield tells you every line checks out.</p>
              </div>
              <div>
                <h3>Your details stay private</h3>
                <p>
                  Account numbers, phone numbers and addresses are removed from the text BillShield saves. Your bill
                  file is kept in a private folder that only you can open.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.final} aria-labelledby="start">
          <div className={styles.wrap}>
            <h2 id="start" className={styles.sectionTitle}>
              Check your next bill
            </h2>
            <p>Create an account, upload a bill and see whether every line adds up.</p>
            <div className={styles.actions}>
              {user ? (
                <Link href="/bills" className={`${styles.btn} ${styles.btnInverse}`}>
                  Go to your bills
                </Link>
              ) : (
                <>
                  <Link href="/signup" className={`${styles.btn} ${styles.btnInverse}`}>
                    Create an account
                  </Link>
                  <Link href="/login" className={`${styles.btn} ${styles.btnOutlineInverse}`}>
                    Log in
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      <footer className={`${styles.footer} ${styles.wrap}`}>BillShield checks your bill. You decide what to send.</footer>
    </div>
  );
}
