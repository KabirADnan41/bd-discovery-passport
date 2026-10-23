// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validate } from '../../scripts/validate-map-data.mjs';

const json = p => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));
const inputs = () => ({
  generated: json('src/generated/districtPaths.generated.json'),
  enriched: json('src/data/districts.enriched.json'),
  sourceDistricts: json('data/source/bd-districts.json').districts,
  sourceDivisions: json('data/source/bd-divisions.json').divisions,
  places: json('src/data/places.json'),
});
/** A complete, valid category map for the given inputs. */
const allCategories = places => Object.fromEntries(Object.values(places).flat().map(p => [p.category, 'বিভাগ']));
/** Inputs where place 1[0] has the given English note and Bengali note. */
const withNote = (note, noteBn) => {
  const bad = inputs();
  bad.places['1'][0] = { ...bad.places['1'][0], note, noteBn };
  return validate(bad).join('\n');
};

describe('Bengali note (noteBn) rules', () => {
  it('accepts a faithful note, with ASCII or Bengali digits', () => {
    expect(withNote('Built in 1840 by 13 masons.', 'আদি দুর্গ ১৮৪০ সালে ১৩ জন রাজমিস্ত্রী বানিয়েছিলেন।')).toBe('');
    expect(withNote('Built in 1840.', 'দুর্গটি 1840 সালে তৈরি।')).toBe('');
  });
  it('rejects an empty or non-string note', () => {
    expect(withNote('Old fort.', '  ')).toMatch(/places 1\[0\]\.noteBn: empty text/);
    expect(withNote('Old fort.', 5)).toMatch(/places 1\[0\]\.noteBn: empty text/);
  });
  it('rejects markup and en/em dashes', () => {
    expect(withNote('Old fort.', '<b>পুরনো দুর্গ</b>')).toMatch(/noteBn: markup-like/);
    expect(withNote('Old fort.', 'পুরনো \u2014 দুর্গ')).toMatch(/places 1\[0\]: noteBn: use a hyphen/);
  });
  it('rejects text with no Bengali letters', () => {
    expect(withNote('Old fort.', 'Old fort')).toMatch(/places 1\[0\]: noteBn must contain Bengali letters/);
  });
  it('rejects a note over 280 characters', () => {
    expect(withNote('Old fort.', 'ক'.repeat(281))).toMatch(/places 1\[0\]: noteBn is over 280 characters/);
  });
  it('requires every English number to appear in the Bengali note', () => {
    expect(withNote('Built in 1840 by 13 masons.', 'দুর্গটি ১৮৪০ সালে তৈরি।')).toMatch(/noteBn is missing the number 13/);
  });
  it('rejects a number that the English note does not have', () => {
    expect(withNote('Old fort.', 'পুরনো দুর্গ ২০০ বছরের।')).toMatch(/noteBn has a number not in the English note: 200/);
  });
  it('reads a thousands comma as part of the number, in either note', () => {
    expect(withNote('A library of 6,000 books.', '৬০০০ বইয়ের একটি গ্রন্থাগার।')).toBe('');
    expect(withNote('A 1020-foot hill.', '১,০২০ ফুট উঁচু একটি পাহাড়।')).toBe('');
    expect(withNote('A library of 6,000 books.', '৬০০ বইয়ের একটি গ্রন্থাগার।')).toMatch(/noteBn is missing the number 6000/);
  });
  it('rejects Latin or Devanagari letters left in the Bengali note', () => {
    expect(withNote('A mosque attributed to a sultan.', 'সুলতানের বলে atribu করা একটি মসজিদ।')).toMatch(/noteBn: only Bengali script/);
    expect(withNote('An eco park.', 'একটি ইকোपार्क।')).toMatch(/noteBn: only Bengali script/);
  });
});

describe('Bengali category labels (categoriesBn)', () => {
  it('is optional', () => {
    expect(validate(inputs())).toEqual([]);
  });
  it('accepts a complete map', () => {
    const i = inputs();
    expect(validate({ ...i, categoriesBn: allCategories(i.places) })).toEqual([]);
  });
  it('rejects a non-object', () => {
    expect(validate({ ...inputs(), categoriesBn: ['x'] }).join('\n')).toMatch(/categoriesBn: must be a plain object/);
  });
  it('rejects a missing category and an unused key', () => {
    const i = inputs();
    const map = allCategories(i.places);
    const [first] = Object.keys(map);
    delete map[first];
    map['Not a used category'] = 'বিভাগ';
    const errors = validate({ ...i, categoriesBn: map }).join('\n');
    expect(errors).toContain(`categoriesBn: missing a label for "${first}"`);
    expect(errors).toMatch(/categoriesBn: "Not a used category" is not a category used by any place/);
  });
  it('rejects empty, markup, and non-Bengali values', () => {
    const i = inputs();
    const [a, b, c] = Object.keys(allCategories(i.places));
    const map = { ...allCategories(i.places), [a]: '', [b]: '<i>বিভাগ</i>', [c]: 'Latin only' };
    const errors = validate({ ...i, categoriesBn: map }).join('\n');
    expect(errors).toContain(`categoriesBn["${a}"]: empty text`);
    expect(errors).toContain(`categoriesBn["${b}"]: markup-like`);
    expect(errors).toContain(`categoriesBn["${c}"]: must contain Bengali letters`);
  });
  it('rejects Latin or Devanagari letters mixed into a label', () => {
    const i = inputs();
    const [a, b] = Object.keys(allCategories(i.places));
    const map = { ...allCategories(i.places), [a]: 'ম্যানগ্রোভ ইকোपार्क', [b]: 'সীমান্ত করিডor' };
    const errors = validate({ ...i, categoriesBn: map }).join('\n');
    expect(errors).toContain(`categoriesBn["${a}"]: only Bengali script`);
    expect(errors).toContain(`categoriesBn["${b}"]: only Bengali script`);
  });
});
