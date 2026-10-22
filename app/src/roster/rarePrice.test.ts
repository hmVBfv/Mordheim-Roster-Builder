/* How a rare item's price is written (wish #24): always with its unit, a dice price with what it comes to on average. */
import { describe, expect, it } from 'vitest';
import { priceAverage, priceRange, priceText } from './rarePrice.ts';

describe('priceText', () => {
  it('says gc for a fixed price and for a dice price alike', () => {
    expect(priceText(35)).toBe('35 gc');
    expect(priceText('20+1D6')).toBe('20+1D6 gc');
    expect(priceText('100+D6×10')).toBe('100+D6×10 gc');
  });
  it('leaves another unit alone and says so when there is no price', () => {
    expect(priceText('25 warp tokens')).toBe('25 warp tokens');
    expect(priceText('')).toBe('—');
  });
  it('writes a pair and a multiple of the weapon\'s price in words', () => {
    expect(priceText('30 (Paar 60)')).toBe('30 gc (pair 60 gc)');
    expect(priceText('25+1D6 (Paar 46+2D6)')).toBe('25+1D6 gc (pair 46+2D6 gc)');
    expect(priceText('4× Preis')).toBe('4 × price');
    expect(priceText('+15/+20')).toBe('+15 / +20 gc');
  });
});

describe('priceAverage', () => {
  it('is the base plus what the dice come to on average', () => {
    expect(priceAverage('20+1D6')).toBe(23.5);
    expect(priceAverage('50+2D6')).toBe(57);
    expect(priceAverage('100+D6×10')).toBe(135);
    expect(priceAverage('25+1D6 (Paar 46+2D6)')).toBe(28.5);
  });
  it('is nothing for a fixed price or one that is not dice', () => {
    expect(priceAverage(35)).toBeNull();
    expect(priceAverage('30 (Paar 60)')).toBeNull();
    expect(priceAverage('4× Preis')).toBeNull();
    expect(priceAverage('+15/+20')).toBeNull();
  });
});

describe('priceRange', () => {
  it('runs from the lowest to the highest the dice allow (wish #29)', () => {
    expect(priceRange('20+1D6')).toEqual([21, 26]);
    expect(priceRange('50+2D6')).toEqual([52, 62]);
    expect(priceRange('100+D6×10')).toEqual([110, 160]);
    expect(priceRange('25+1D6 (Paar 46+2D6)')).toEqual([26, 31]);
  });
  it('is nothing for a fixed price or one that is not dice', () => {
    expect(priceRange(35)).toBeNull();
    expect(priceRange('4× Preis')).toBeNull();
    expect(priceRange('+15/+20')).toBeNull();
  });
});
