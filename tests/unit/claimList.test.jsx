import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ClaimList } from '../../src/components/district/DistrictCard';

afterEach(cleanup);

const LABELS = { 'Historic lake': 'ঐতিহাসিক লেক' };
const place = (extra = {}) => ({
  id: '30-test-lake',
  name: { en: 'Test Lake', bn: 'টেস্ট লেক' },
  category: 'Historic lake',
  note: 'Watch migratory birds at an old lake.',
  sources: [{ url: 'https://example.org/lake', label: 'Example' }],
  ...extra,
});
const kindLabel = item => item.category;
const kindLabelBn = item => LABELS[item.category];
const bengaliTexts = container => [...container.querySelectorAll('[lang="bn"]')].map(el => el.textContent);

describe('ClaimList Bengali text', () => {
  it('shows the Bengali note under the English note, marked as Bengali', () => {
    render(<ClaimList items={[place({ noteBn: 'পুরোনো দিঘিতে পরিযায়ী পাখি দেখুন।' })]} kindLabel={kindLabel} kindLabelBn={kindLabelBn} />);
    expect(screen.getByText('Watch migratory birds at an old lake.')).toBeTruthy();
    expect(screen.getByText('পুরোনো দিঘিতে পরিযায়ী পাখি দেখুন।').getAttribute('lang')).toBe('bn');
  });

  it('shows the Bengali category label in the same chip as the English one', () => {
    render(<ClaimList items={[place()]} kindLabel={kindLabel} kindLabelBn={kindLabelBn} />);
    const label = screen.getByText('ঐতিহাসিক লেক');
    expect(label.getAttribute('lang')).toBe('bn');
    expect(label.parentElement.textContent).toContain('Historic lake');
  });

  it('falls back to English only when the note or the category has no Bengali', () => {
    const { container } = render(<ClaimList items={[place({ category: 'Unlabelled kind' })]} kindLabel={kindLabel} kindLabelBn={kindLabelBn} />);
    expect(screen.getByText('Watch migratory birds at an old lake.')).toBeTruthy();
    expect(screen.getByText('Unlabelled kind')).toBeTruthy();
    expect(bengaliTexts(container)).toEqual(['টেস্ট লেক']);
  });

  it('keeps landmark and culture chips English when no Bengali label is asked for', () => {
    const { container } = render(<ClaimList items={[place()]} kindLabel={kindLabel} />);
    expect(screen.getByText('Historic lake')).toBeTruthy();
    expect(bengaliTexts(container)).toEqual(['টেস্ট লেক']);
  });
});
