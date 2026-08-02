import { computeRallyFee } from '@rally/contracts';

describe('computeRallyFee', () => {
  it('computes ten percent on whole dollar', () => {
    expect(computeRallyFee(1000, 10)).toEqual({
      feeCents: 100,
      amountCents: 1100,
      netCents: 1000,
    });
  });

  it('half-up at .5 boundary (1005 * 10% = 100.5 → 101)', () => {
    expect(computeRallyFee(1005, 10)).toEqual({
      feeCents: 101,
      amountCents: 1106,
      netCents: 1005,
    });
  });

  it('half-up below .5 boundary (1004 * 10% = 100.4 → 100)', () => {
    expect(computeRallyFee(1004, 10)).toEqual({
      feeCents: 100,
      amountCents: 1104,
      netCents: 1004,
    });
  });
});
