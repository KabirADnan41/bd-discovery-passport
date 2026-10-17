// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { moveStop } from '../../src/lib/trip';
import { dropTarget } from '../../src/lib/tripReorder';

// Three days as the planner measures them, top to bottom. Day 1 has three 100px rows under its heading (middles at 100, 200
// and 300), day 2 one row (middle 550), and day 3 is empty. The 50px gaps between the days belong to no day.
const DAYS = [
  {
    top: 0,
    bottom: 400,
    rows: [
      { top: 50, bottom: 150 },
      { top: 150, bottom: 250 },
      { top: 250, bottom: 350 },
    ],
  },
  { top: 450, bottom: 650, rows: [{ top: 500, bottom: 600 }] },
  { top: 700, bottom: 780, rows: [] },
];
const at = (day, index) => ({ day, index });

describe('dropTarget', () => {
  it('moving down a day, the stop goes after each row whose middle the pointer has passed', () => {
    expect(dropTarget(DAYS, 260, at(0, 0))).toEqual(at(0, 1));
  });

  it('moving up a day, the stop goes before the first row whose middle is below the pointer', () => {
    expect(dropTarget(DAYS, 120, at(0, 2))).toEqual(at(0, 1));
  });

  it('above the first row’s middle, the heading included, is the start of the day', () => {
    expect(dropTarget(DAYS, 60, at(0, 2))).toEqual(at(0, 0));
    expect(dropTarget(DAYS, 5, at(0, 2))).toEqual(at(0, 0));
  });

  it('below the last row’s middle is the end of the day, counted without the held stop', () => {
    expect(dropTarget(DAYS, 380, at(0, 0))).toEqual(at(0, 2));
  });

  it('in another day, every one of its rows counts', () => {
    expect(dropTarget(DAYS, 520, at(0, 1))).toEqual(at(1, 0));
    expect(dropTarget(DAYS, 620, at(0, 1))).toEqual(at(1, 1));
  });

  it('an empty day takes a drop at index 0', () => {
    expect(dropTarget(DAYS, 740, at(0, 0))).toEqual(at(2, 0));
  });

  it('off the days, between them included, there is nowhere to drop', () => {
    for (const y of [-10, 420, 690, 800]) expect(dropTarget(DAYS, y, at(0, 0))).toBeNull();
  });

  it('anywhere on its own row, a stop stays where it is', () => {
    for (const y of [160, 200, 240]) expect(dropTarget(DAYS, y, at(0, 1))).toEqual(at(0, 1));
  });

  it('gives moveStop its `to`: the stop lands between the rows on either side of the pointer', () => {
    const trip = { name: '', days: [['a', 'b', 'c'], ['d'], []] };
    const drop = (y, from) => moveStop(trip, from, dropTarget(DAYS, y, from)).days;
    expect(drop(260, at(0, 0))).toEqual([['b', 'a', 'c'], ['d'], []]); // a, between b and c
    expect(drop(120, at(0, 2))).toEqual([['a', 'c', 'b'], ['d'], []]); // c, between a and b
    expect(drop(620, at(0, 1))).toEqual([['a', 'c'], ['d', 'b'], []]); // b, below d
    expect(drop(740, at(1, 0))).toEqual([['a', 'b', 'c'], [], ['d']]); // d, into the empty day
  });
});
