import { getDistrict } from './districtData';

// District quiz: find 10 districts on the map, with up to three tries each.
export const ROUND_SIZE = 10;
export const POINTS = [10, 5, 2]; // by try; a third miss reveals the answer for 0
export const MAX_SCORE = ROUND_SIZE * POINTS[0];

/** A new round: ROUND_SIZE different ids in random order. `random` is injectable for tests. */
export function createRound(ids, random = Math.random) {
  const pool = [...ids];
  for (let i = 0; i < ROUND_SIZE; i++) {
    const j = i + Math.floor(random() * (pool.length - i)); // partial Fisher-Yates
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return { targets: pool.slice(0, ROUND_SIZE), index: 0, wrong: [], done: false, points: [] };
}

/** Score one guess. Guesses after the prompt is settled or the round is over, or repeats of a wrong guess, change nothing. */
export function guess(round, id) {
  if (round.done || round.index >= round.targets.length || round.wrong.includes(id)) return round;
  if (id === round.targets[round.index]) return { ...round, done: true, points: [...round.points, POINTS[round.wrong.length]] };
  const wrong = [...round.wrong, id];
  const done = wrong.length === POINTS.length;
  return { ...round, wrong, done, points: done ? [...round.points, 0] : round.points };
}

/** Move on once the prompt is settled. `index === ROUND_SIZE` means the round is over. */
export const next = round => (round.done ? { ...round, index: round.index + 1, wrong: [], done: false } : round);

export const totalScore = round => round.points.reduce((sum, p) => sum + p, 0);

/** Map marks for the current prompt: { [districtId]: 'wrong' | 'correct' | 'answer' }. */
export function quizMarks(round) {
  const marks = Object.fromEntries(round.wrong.map(id => [id, 'wrong']));
  if (round.done) marks[round.targets[round.index]] = round.points.at(-1) > 0 ? 'correct' : 'answer';
  return marks;
}

const toRad = deg => (deg * Math.PI) / 180;
const EARTH_RADIUS_KM = 6371;
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

/** Haversine distance between two districts' towns, rounded to the nearest 10 km. */
export function distanceKm(a, b) {
  const h = Math.sin(toRad(b.lat - a.lat) / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lon - a.lon) / 2) ** 2;
  return Math.round((2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))) / 10) * 10;
}

/** Which way b lies from a (initial great-circle bearing), as one of 8 compass words. */
export function direction(a, b) {
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLon);
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  return COMPASS[Math.round((degrees + 360) / 45) % 8];
}

export const promptText = round => `Question ${round.index + 1} of ${ROUND_SIZE}. Find ${getDistrict(round.targets[round.index]).name}.`;

/** What the last guess earned, in words; empty before the first guess of a prompt. */
export function feedbackText(round) {
  const target = getDistrict(round.targets[round.index]);
  const guessed = getDistrict(round.wrong.at(-1));
  if (round.done && round.points.at(-1) > 0) return `Correct, that is ${target.name}. ${round.points.at(-1)} points.`;
  if (round.done) return `That is ${guessed.name}. ${target.name} is now marked on the map. 0 points.`;
  if (guessed) return `That is ${guessed.name}. ${target.name} is ${distanceKm(guessed, target)} km ${direction(guessed, target)} of there.`;
  return '';
}
