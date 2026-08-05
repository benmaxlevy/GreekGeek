import { computePurchaseAmounts, computeGreekGeekFee } from '@greekgeek/contracts';

describe('computePurchaseAmounts / computeGreekGeekFee', () => {
  it('computes ten percent on whole dollar (qty 1)', () => {
    expect(computeGreekGeekFee(1000, 10)).toEqual({
      feeCents: 100,
      amountCents: 1100,
      netCents: 1000,
    });
  });

  it('half-up at .5 boundary (1005 * 10% = 100.5 → 101)', () => {
    expect(computeGreekGeekFee(1005, 10)).toEqual({
      feeCents: 101,
      amountCents: 1106,
      netCents: 1005,
    });
  });

  it('half-up below .5 boundary (1004 * 10% = 100.4 → 100)', () => {
    expect(computeGreekGeekFee(1004, 10)).toEqual({
      feeCents: 100,
      amountCents: 1104,
      netCents: 1004,
    });
  });

  it('ten percent fee on two-ticket subtotal', () => {
    expect(computePurchaseAmounts(2, 1000, 10)).toEqual({
      subtotalCents: 2000,
      feeCents: 200,
      amountCents: 2200,
      netCents: 2000,
    });
  });

  it('fee on subtotal not per-ticket then summed (2×1005 → fee 201 not 202)', () => {
    expect(computePurchaseAmounts(2, 1005, 10)).toEqual({
      subtotalCents: 2010,
      feeCents: 201,
      amountCents: 2211,
      netCents: 2010,
    });
    const perTicketSum =
      computeGreekGeekFee(1005, 10).feeCents + computeGreekGeekFee(1005, 10).feeCents;
    expect(perTicketSum).toBe(202);
    expect(computePurchaseAmounts(2, 1005, 10).feeCents).not.toBe(perTicketSum);
  });
});
