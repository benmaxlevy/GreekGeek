import { StripeConnectBanner } from '@/components/ticketing/StripeConnectBanner';
import { Button } from '@/components/ui/button';
import {
  allocatedSum,
  formatUsdPrice,
  fromLocalDatetime,
  type WizardState,
} from './types';

type Props = {
  state: WizardState;
  hostOrgId: string | undefined;
  chargesEnabled: boolean;
  canManageHostPayments: boolean;
  isSubmitting: boolean;
  onFinalize: (saleStatus: 'draft' | 'on_sale') => void;
};

function formatWindow(value: string): string {
  if (!value.trim()) return '—';
  const iso = fromLocalDatetime(value);
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function VerifyStep({
  state,
  hostOrgId,
  chargesEnabled,
  canManageHostPayments,
  isSubmitting,
  onFinalize,
}: Props) {
  const sum = allocatedSum(state.pools);
  const remainder = state.capacity - sum;
  const hasPaidPrice = state.pools.some(
    (pool) => pool.priceUsd.trim() !== '' && Number(pool.priceUsd) > 0,
  );
  const showStripeBanner =
    Boolean(hostOrgId) && !chargesEnabled && hasPaidPrice;

  return (
    <div className="space-y-6">
      {showStripeBanner && hostOrgId ? (
        <StripeConnectBanner
          organizationId={hostOrgId}
          canManagePayments={canManageHostPayments}
        />
      ) : null}

      <div className="space-y-4 rounded-md border border-border-subtle p-4 text-sm">
        <div>
          <p className="font-medium text-ink-100">Capacity</p>
          <p className="text-ink-300">{state.capacity} tickets</p>
        </div>
        <div>
          <p className="font-medium text-ink-100">Sales window</p>
          <p className="text-ink-300">Open: {formatWindow(state.salesOpenAt)}</p>
          <p className="text-ink-300">Close: {formatWindow(state.salesCloseAt)}</p>
        </div>
        <div>
          <p className="font-medium text-ink-100">Pools</p>
          <ul className="mt-2 space-y-2">
            {state.pools.map((pool) => (
              <li
                key={pool.organizationId ?? 'public'}
                className="flex flex-wrap justify-between gap-2 text-ink-300"
              >
                <span>{pool.orgName}</span>
                <span>
                  {pool.quantity} × {formatUsdPrice(pool.priceUsd)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-medium text-ink-100">Allocation</p>
          <p className="text-ink-300">
            {sum} allocated · {remainder} remainder of {state.capacity}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          isLoading={isSubmitting}
          onClick={() => onFinalize('draft')}
        >
          Save as draft
        </Button>
        <Button
          type="button"
          isLoading={isSubmitting}
          onClick={() => onFinalize('on_sale')}
        >
          Enable sales
        </Button>
      </div>
    </div>
  );
}
