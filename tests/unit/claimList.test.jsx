import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ClaimList } from '../../src/components/district/DistrictCard';

afterEach(cleanup);

const LABELS = { 'Historic lake': 'ঐতিহাসিক লেক' };
const place = (extra = {}) => ({
  id: '30-test-lake',
  name: { en: 'Test Lake', bn: 'টেস্ট লেক' },
  category: 'Historic lake',
  address: 'Dhobadanga, Nilphamari',
  note: 'Watch migratory birds at an old lake.',
  sources: [{ url: 'https://example.org/lake', label: 'Example' }],
  ...extra,
});
const kindLabel = item => item.category;
const kindLabelBn = item => LABELS[item.category];
const bengaliTexts = container => [...container.querySelectorAll('[lang="bn"]')].map(el => el.textContent);

describe('ClaimList Bengali text in the Living Atlas place row', () => {
  it('puts the Bengali note directly under the English note, marked as Bengali', () => {
    render(<ClaimList items={[place({ noteBn: 'পুরোনো দিঘিতে পরিযায়ী পাখি দেখুন।' })]} kindLabel={kindLabel} kindLabelBn={kindLabelBn} />);
    const english = screen.getByText('Watch migratory birds at an old lake.');
    const bengali = screen.getByText('পুরোনো দিঘিতে পরিযায়ী পাখি দেখুন।');
    expect(bengali.getAttribute('lang')).toBe('bn');
    expect(english.nextElementSibling).toBe(bengali);
  });

  it('keeps the brass mark English and puts the Bengali kind right after it, before the address', () => {
    const { container } = render(<ClaimList items={[place()]} kindLabel={kindLabel} kindLabelBn={kindLabelBn} />);
    const kind = container.querySelector('.kind');
    expect(kind.textContent).toBe('Historic lake');
    const kindBn = kind.nextElementSibling;
    expect(kindBn.getAttribute('lang')).toBe('bn');
    expect(kindBn.textContent).toBe('ঐতিহাসিক লেক');
    expect(kindBn.classList.contains('text-brass')).toBe(true);
    expect(kind.parentElement.textContent).toBe('Historic lakeঐতিহাসিক লেক·Dhobadanga, Nilphamari');
  });

  it('falls back to English only when the note or the kind has no Bengali', () => {
    const { container } = render(<ClaimList items={[place({ category: 'Unlabelled kind' })]} kindLabel={kindLabel} kindLabelBn={kindLabelBn} />);
    expect(screen.getByText('Watch migratory birds at an old lake.')).toBeTruthy();
    expect(container.querySelector('.kind').nextElementSibling.textContent).toBe('·');
    expect(bengaliTexts(container)).toEqual(['টেস্ট লেক']);
  });

  it('keeps landmark and culture kinds English when no Bengali label is asked for', () => {
    const { container } = render(<ClaimList items={[place()]} kindLabel={kindLabel} />);
    expect(container.querySelector('.kind').textContent).toBe('Historic lake');
    expect(bengaliTexts(container)).toEqual(['টেস্ট লেক']);
  });
});
