import { escapeLike } from './products.service';

describe('escapeLike', () => {
  it.each([
    ['100%', '100\\%'],
    ['C_12', 'C\\_12'],
    ['a\\b', 'a\\\\b'],
    ['plain text', 'plain text'],
  ])('escapes %p', (input, expected) => {
    expect(escapeLike(input)).toBe(expected);
  });
});
