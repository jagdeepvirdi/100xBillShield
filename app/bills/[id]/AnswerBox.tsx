import { answerLine } from "./actions";

export type Question = { lineId: string; text: string };
export type Answered = { lineId: string; label: string; answer: "expected" | "dispute" };

function AnswerForm({ billId, lineId, answer, children, secondary }: { billId: string; lineId: string; answer: string; children: string; secondary?: boolean }) {
  return (
    <form action={answerLine}>
      <input type="hidden" name="bill_id" value={billId} />
      <input type="hidden" name="line_item_id" value={lineId} />
      <input type="hidden" name="answer" value={answer} />
      <button type="submit" className={secondary ? "secondary small" : undefined}>
        {children}
      </button>
    </form>
  );
}

// Asks about each new or changed charge, and lists earlier answers with a way to change them.
export default function AnswerBox({ billId, questions, answered }: { billId: string; questions: Question[]; answered: Answered[] }) {
  return (
    <section>
      <h2>{questions.length > 0 ? "Needs your answer" : "Your answers"}</h2>
      {questions.map((question) => (
        <div key={question.lineId} className="question">
          <p>{question.text}</p>
          <div className="actions">
            <AnswerForm billId={billId} lineId={question.lineId} answer="expected">
              Yes, I expected it
            </AnswerForm>
            <AnswerForm billId={billId} lineId={question.lineId} answer="dispute" secondary>
              No, dispute it
            </AnswerForm>
          </div>
        </div>
      ))}
      {answered.length > 0 && (
        <ul className="plain">
          {answered.map((item) => (
            <li key={item.lineId} className="question">
              <div>
                {item.label}: you said {item.answer === "expected" ? "you expected this" : "you dispute this"}.
              </div>
              <AnswerForm billId={billId} lineId={item.lineId} answer={item.answer === "expected" ? "dispute" : "expected"} secondary>
                {item.answer === "expected" ? "Dispute it instead" : "I expected it after all"}
              </AnswerForm>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
