// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ROUND_SIZE, createRound, direction, distanceKm, feedbackText, guess, next, quizMarks, totalScore } from '../../src/lib/quiz';
import { QUIZ_BEST_KEY, clearQuizBest, loadQuizBest, saveQuizBest } from '../../src/lib/discoveryStorage';
import { DISTRICT_IDS, getDistrict } from '../../src/lib/districtData';

// A fixed round: Sylhet (54), then Dhaka (1), then eight more.
const round = () => ({ ...createRound(DISTRICT_IDS, () => 0), targets: ['54', '1', '2', '3', '4', '5', '6', '7', '8', '9'] });
const play = (r, ...ids) => ids.reduce(guess, r);

describe('quiz rounds', () => {
  it('picks 10 different real districts', () => {
    for (const random of [Math.random, () => 0, () => 0.999999]) {
      const { targets } = createRound(DISTRICT_IDS, random);
      expect(targets).toHaveLength(ROUND_SIZE);
      expect(new Set(targets).size).toBe(ROUND_SIZE);
      expect(targets.every(id => DISTRICT_IDS.has(id))).toBe(true);
    }
    expect(createRound(DISTRICT_IDS, () => 0).targets).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']); // the injected random is used
  });

  it('scores 10, 5 and 2 for a find on the first, second and third try', () => {
    expect(play(round(), '54').points).toEqual([10]);
    expect(play(round(), '1', '54').points).toEqual([5]);
    expect(play(round(), '1', '2', '54').points).toEqual([2]);
  });

  it('reveals the answer for 0 after three misses', () => {
    const r = play(round(), '1', '2', '3');
    expect(r.done).toBe(true);
    expect(r.points).toEqual([0]);
    expect(quizMarks(r)).toEqual({ 1: 'wrong', 2: 'wrong', 3: 'wrong', 54: 'answer' });
    expect(feedbackText(r)).toBe('That is Gazipur. Sylhet is now marked on the map. 0 points.');
  });

  it('ignores a repeated wrong guess and any guess once the prompt is settled', () => {
    const once = play(round(), '1');
    expect(guess(once, '1')).toBe(once);
    const found = play(round(), '54');
    expect(guess(found, '1')).toBe(found);
    expect(quizMarks(found)).toEqual({ 54: 'correct' });
    expect(feedbackText(found)).toBe('Correct, that is Sylhet. 10 points.');
  });

  it('next moves on only after the prompt is settled, and clears the marks', () => {
    const r = round();
    expect(next(r)).toBe(r);
    const moved = next(play(r, '54'));
    expect(moved.index).toBe(1);
    expect(quizMarks(moved)).toEqual({});
    expect(feedbackText(moved)).toBe('');
  });

  it('a perfect round scores 100 and ends at index 10', () => {
    let r = round();
    for (const id of r.targets) r = next(guess(r, id));
    expect(r.index).toBe(ROUND_SIZE);
    expect(totalScore(r)).toBe(100);
  });

  it('a guess on a finished round changes nothing', () => {
    let r = round();
    for (const id of r.targets) r = next(guess(r, id));
    expect(guess(r, '1')).toBe(r);
  });
});

describe('quiz hints', () => {
  const dhaka = getDistrict('1');
  const sylhet = getDistrict('54');

  it('Sylhet is about 200 km north-east of Dhaka', () => {
    expect(direction(dhaka, sylhet)).toBe('north-east');
    expect(direction(sylhet, dhaka)).toBe('south-west');
    expect(distanceKm(dhaka, sylhet)).toBe(200);
  });

  it('uses the 8 compass words', () => {
    const at = (lat, lon) => ({ lat, lon });
    expect(direction(at(23, 90), at(24, 90))).toBe('north');
    expect(direction(at(23, 90), at(23, 91))).toBe('east');
    expect(direction(at(23, 90), at(22, 89))).toBe('south-west');
    expect(direction(at(23, 90), at(24, 89))).toBe('north-west');
  });

  it('a wrong guess names the guessed district and points to the answer', () => {
    expect(feedbackText(play(round(), '1'))).toBe('That is Dhaka. Sylhet is 200 km north-east of there.');
  });
});

describe('quiz best score storage', () => {
  const memoryStorage = (initial = {}) => {
    const data = { ...initial };
    return { getItem: k => data[k] ?? null, setItem: (k, v) => (data[k] = String(v)), removeItem: k => delete data[k], data };
  };

  it('round-trips and clears the best score under its own key', () => {
    const storage = memoryStorage();
    expect(loadQuizBest(storage)).toBe(0);
    saveQuizBest(70, storage);
    expect(storage.data[QUIZ_BEST_KEY]).toBe('70');
    expect(loadQuizBest(storage)).toBe(70);
    clearQuizBest(storage);
    expect(QUIZ_BEST_KEY in storage.data).toBe(false);
    expect(loadQuizBest(storage)).toBe(0);
  });

  it('treats junk as no score, and survives missing or throwing storage', () => {
    for (const junk of ['abc', '101', '-5', '7.5']) expect(loadQuizBest(memoryStorage({ [QUIZ_BEST_KEY]: junk }))).toBe(0);
    const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadQuizBest(throwing)).toBe(0);
    expect(() => saveQuizBest(50, throwing)).not.toThrow();
    expect(() => clearQuizBest({ removeItem: () => { throw new Error('blocked'); } })).not.toThrow();
    expect(loadQuizBest(null)).toBe(0);
    expect(() => saveQuizBest(50, null)).not.toThrow();
    expect(() => clearQuizBest(null)).not.toThrow();
  });
});
