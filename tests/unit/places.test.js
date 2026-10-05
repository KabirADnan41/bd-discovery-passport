// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { directionsUrl } from '../../src/lib/places';

const PREFIX = 'https://www.google.com/maps/dir/?api=1&destination=';

describe('directionsUrl', () => {
  it('builds a no-key Google Maps directions link to the name and address', () => {
    expect(directionsUrl('Lalbagh Fort', 'Lalbagh, Old Dhaka, Dhaka')).toBe(
      `${PREFIX}Lalbagh%20Fort%2C%20Lalbagh%2C%20Old%20Dhaka%2C%20Dhaka%2C%20Bangladesh`,
    );
  });

  it('encodes apostrophes, ampersands and other reserved characters so the query cannot break', () => {
    const url = directionsUrl("St. Martin's Island & Chera Dwip", "Teknaf, Cox's Bazar");
    expect(url.startsWith(PREFIX)).toBe(true);
    const destination = url.slice(PREFIX.length);
    expect(destination).not.toMatch(/[&#?= ]/);
    expect(new URL(url).searchParams.get('destination')).toBe("St. Martin's Island & Chera Dwip, Teknaf, Cox's Bazar, Bangladesh");
    expect(new URL(url).searchParams.get('api')).toBe('1');
  });
});
