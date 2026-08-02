import { StripeConnectBanner } from '@/components/ticketing/StripeConnectBanner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { poolRowKey, type WizardState } from './types';

type Props = {
  state: WizardState;
  hostOrgId: string | undefined;
  chargesEnabled: boolean;
  canManageHostPayments: boolean;
  onChange: (patch: Partial<WizardState>) => void;
};

export function PriceStep({
  state,
  hostOrgId,
  chargesEnabled,
  canManageHostPayments,
  onChange,
}: Props) {
  const hasPaidPrice = state.pools.some(
    (pool) => pool.priceUsd.trim() !== '' && Number(pool.priceUsd) > 0,
  );
  const showStripeBanner = Boolean(hostOrgId) && !chargesEnabled && hasPaidPrice;

  return (
    <div className="space-y-6">
      {showStripeBanner && hostOrgId ? (
        <StripeConnectBanner organizationId={hostOrgId} canManagePayments={canManageHostPayments} />
      ) : null}

      <p className="text-sm text-ink-500">
        Set a USD price per pool. Leave blank for free tickets. Prices are fixed at creation.
      </p>

      <ul className="divide-y divide-border-subtle rounded-[var(--radius-md)] border border-border-subtle bg-white/[0.025]">
        {state.pools.map((pool) => (
          <li
            key={poolRowKey(pool)}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-ink-100">{pool.orgName}</p>
              <p className="text-xs text-ink-500">
                <span className="num">{pool.quantity}</span> tickets
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`wizard-price-${poolRowKey(pool)}`} className="text-xs">
                Price (USD)
              </Label>
              <Input
                id={`wizard-price-${poolRowKey(pool)}`}
                type="number"
                min={0}
                step="0.01"
                placeholder="Free"
                value={pool.priceUsd}
                onChange={(e) => {
                  onChange({
                    pools: state.pools.map((row) =>
                      poolRowKey(row) === poolRowKey(pool)
                        ? { ...row, priceUsd: e.target.value }
                        : row,
                    ),
                  });
                }}
                className="min-h-9 w-32"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function validatePriceStep(state: WizardState): string | null {
  for (const pool of state.pools) {
    const trimmed = pool.priceUsd.trim();
    if (!trimmed) continue;
    const price = Number(trimmed);
    if (!Number.isFinite(price) || price < 0) {
      return `Enter a valid price for ${pool.orgName}.`;
    }
  }
  return null;
}
