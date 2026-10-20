import { describe, expect, it } from 'vitest';
import { transitionLabels } from './transitionInput';

describe('finite transition editor shortcuts', () => {
  it('splits lists while preserving ranges and removing only exact duplicates', () => {
    expect(transitionLabels('[a-c], [0-1], [1-3], a, [a-c]')).toEqual([
      '[a-c]',
      '[0-1]',
      '[1-3]',
      'a',
    ]);
  });
  it('creates exactly three labels for the requested shortcut', () => {
    expect(transitionLabels('[1-9], [a-z], @')).toEqual([
      '[1-9]',
      '[a-z]',
      '@',
    ]);
    expect(transitionLabels('[3-0]')).toEqual(['[3-0]']);
  });
  it('expands bracketed symbols when there is no hyphen', () => {
    expect(transitionLabels('[abz]')).toEqual(['a', 'b', 'z']);
    expect(transitionLabels('[aabz]')).toEqual(['a', 'b', 'z']);
    expect(transitionLabels(' [abc] ')).toEqual(['a', 'b', 'c']);
    expect(transitionLabels('[1-9], [abz], [1-9]')).toEqual([
      '[1-9]',
      'a',
      'b',
      'z',
    ]);
    expect(transitionLabels('a, [z]')).toEqual(['a', 'z']);
  });
  it('preserves empty labels, strings, whitespace and a literal comma', () => {
    for (const label of ['', 'ab', ' ', ',', 'ε', 'λ'])
      expect(transitionLabels(label)).toEqual([label]);
    expect(transitionLabels('ab, cd')).toEqual(['ab', 'cd']);
  });
  it('rejects incomplete lists and malformed ranges before adding any transitions', () => {
    for (const input of [
      'a,,b',
      'a,',
      '[a-]',
      '[a-z',
      '[a-z] extra',
      '[a--z]',
      '[abz',
      '[]',
    ])
      expect(() => transitionLabels(input)).toThrow();
  });
  it('keeps a standalone range intact without expanding its characters', () => {
    expect(transitionLabels('[1-9]')).toEqual(['[1-9]']);
    expect(transitionLabels(' [a-z] ')).toEqual(['[a-z]']);
  });
});
