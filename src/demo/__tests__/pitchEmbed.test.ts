import { describe, expect, it } from 'vitest';
import { readPitchEmbed } from '../pitchEmbed';

describe('pitch embed flag', () => {
  it('is on only for pitch=1', () => {
    expect(readPitchEmbed('?pitch=1')).toBe(true);
    expect(readPitchEmbed('?scene=home&view=3d&pitch=1')).toBe(true);
    expect(readPitchEmbed('?pitch=1&panel=materials')).toBe(true);
    expect(readPitchEmbed('')).toBe(false);
    expect(readPitchEmbed('?pitch=0')).toBe(false);
    expect(readPitchEmbed('?client=1')).toBe(false);
    expect(readPitchEmbed('?view=3d')).toBe(false);
  });
});
