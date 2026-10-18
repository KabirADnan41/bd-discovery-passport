import { afterEach, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import DiscoveryProgress from '../../src/components/game/DiscoveryProgress';

afterEach(cleanup);

// the tick's old number lives in data-prev on the English count
const tickFrom = container => container.querySelector('.count').getAttribute('data-prev');

it('ticks the masthead count only for a discovery, not for stamps a sign-in brings along', () => {
  const { container, rerender } = render(<DiscoveryProgress count={3} total={64} discoveryId={null} />);
  // a sync adds exactly one stamp while nothing is being discovered
  rerender(<DiscoveryProgress count={4} total={64} discoveryId={null} />);
  expect(tickFrom(container)).toBeNull();
  // a discovery
  rerender(<DiscoveryProgress count={5} total={64} discoveryId="54" />);
  expect(tickFrom(container)).toBe('4');
  // a sync adds one more while that discovery's page is still open
  rerender(<DiscoveryProgress count={6} total={64} discoveryId="54" />);
  expect(tickFrom(container)).toBeNull();
});
