import { useEffect, useRef } from 'react';
import { getDistrict } from '../../lib/districtData';
import { MAX_SCORE, POINTS, ROUND_SIZE, feedbackText, totalScore } from '../../lib/quiz';

// The prompt and the round result sit on the same solid green bar as the passport cover.
const BAR = 'cover rounded-[var(--radius-surface)] px-5 py-5 sm:px-6';
// Colour repeats what the words say (points, "Correct", "That is"), so it is never the only cue.
const pointsTone = points => (points === 0 ? 'text-stamp' : points === POINTS[0] ? 'text-success' : 'text-ink-2');

function RoundSummary({ round, best, onPlayAgain, onExplore, onClearBest }) {
  const headingRef = useRef(null);
  // The Next button that ended the round is gone, so focus moves to the result.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby="quiz-title">
      <div className={BAR}>
        <p className="text-eyebrow uppercase">
          Round complete{' '}
          <span lang="bn" className="tracking-normal normal-case">
            রাউন্ড শেষ
          </span>
        </p>
        <h2 id="quiz-title" ref={headingRef} tabIndex={-1} className="mt-3 text-h3 font-medium">
          <span className="block">You scored</span>{' '}
          <span className="text-display tabular-nums">{totalScore(round)}</span> <span>out of {MAX_SCORE}</span>
        </h2>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 text-ink-2">
        {best === null ? 'No best score saved.' : `Best score: ${best} out of ${MAX_SCORE}`}
        <button type="button" className="btn min-h-11 px-0 text-[0.85rem] underline underline-offset-4" onClick={onClearBest}>
          Clear best score
        </button>
      </p>
      <ol className="quiz-results mt-2 border-t border-rule">
        {round.targets.map((id, i) => {
          const d = getDistrict(id);
          return (
            <li key={id} className="flex items-baseline justify-between gap-3 border-b border-rule py-1.5">
              <span>
                {d.name}{' '}
                <span lang="bn" className="text-ink-3">
                  {d.bn}
                </span>
              </span>
              <span className={`flex shrink-0 items-center gap-2 text-[0.9rem] font-medium tabular-nums ${pointsTone(round.points[i])}`}>
                <span aria-hidden="true" className="size-2.5 rounded-full bg-current" />
                {round.points[i]} points
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className="btn btn-solid" onClick={onPlayAgain}>
          Play again
        </button>
        <button type="button" className="btn btn-quiet" onClick={onExplore}>
          Back to explore
        </button>
      </div>
    </section>
  );
}

// The quiz side panel: the prompt and feedback during a round, the summary after it.
export default function QuizPanel({ round, best, onNext, onPlayAgain, onExplore, onClearBest }) {
  if (round.index === ROUND_SIZE) {
    return <RoundSummary round={round} best={best} onPlayAgain={onPlayAgain} onExplore={onExplore} onClearBest={onClearBest} />;
  }
  const target = getDistrict(round.targets[round.index]);
  const feedback = feedbackText(round);
  const found = round.done && round.points.at(-1) > 0;

  return (
    <section className="quiz" aria-labelledby="quiz-title">
      <div className={BAR}>
        <p className="quiz-progress flex justify-between gap-3 text-[0.9rem] font-medium tabular-nums">
          <span>
            Question {round.index + 1} of {ROUND_SIZE}
          </span>
          <span>Score {totalScore(round)}</span>
        </p>
        <h2 id="quiz-title" className="mt-4 flex flex-wrap items-baseline gap-x-3">
          <span className="basis-full text-[1rem] font-medium">Find</span>{' '}
          <span className="text-h1">{target.name}</span>{' '}
          <span lang="bn" className="text-[clamp(1.4rem,1rem+1.25vw,2rem)] leading-[1.3] font-medium">
            {target.bn}
          </span>
        </h2>
      </div>
      {/* a fixed slot under the bar: the rules until the first guess, then the feedback; the map never jumps */}
      <div className="mt-3 flex min-h-[4.75rem] items-start justify-between gap-4">
        {feedback ? (
          <p className={`quiz-feedback pt-2 font-medium ${found ? 'text-success' : 'text-stamp'}`}>{feedback}</p>
        ) : (
          <p className="pt-2 text-[0.95rem] text-ink-2">Choose it on the map. 10 points on the first try, 5 on the second, 2 on the third.</p>
        )}
        {round.done && (
          <button type="button" className="btn btn-solid shrink-0" onClick={onNext}>
            Next
          </button>
        )}
      </div>
    </section>
  );
}
