import type { Organization } from '@rally/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  allocatedSum,
  evenSplitQuantities,
  poolRowKey,
  type WizardPoolRow,
  type WizardState,
} from './types';
import { ToggleSwitch } from './ToggleSwitch';

type Props = {
  organizations: Organization[];
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
};

function sortedOrgs(organizations: Organization[]): Organization[] {
  return [...organizations].sort((a, b) => a.name.localeCompare(b.name));
}

function buildPoolsFromSelection(
  selectedOrgIds: Set<string>,
  includePublic: boolean,
  organizations: Organization[],
  existingPools: WizardPoolRow[],
): WizardPoolRow[] {
  const byKey = new Map(existingPools.map((pool) => [poolRowKey(pool), pool]));
  const pools: WizardPoolRow[] = [];

  for (const org of sortedOrgs(organizations)) {
    if (!selectedOrgIds.has(org.id)) continue;
    const key = org.id;
    pools.push(
      byKey.get(key) ?? {
        organizationId: org.id,
        orgName: org.name,
        quantity: 0,
        priceUsd: '',
      },
    );
  }

  if (includePublic) {
    pools.push(
      byKey.get('public') ?? {
        organizationId: null,
        orgName: 'Public',
        quantity: 0,
        priceUsd: '',
      },
    );
  }

  return pools;
}

export function AllocateStep({ organizations, state, onChange }: Props) {
  const selectedOrgIds = new Set(
    state.pools
      .filter((pool) => pool.organizationId != null)
      .map((pool) => pool.organizationId as string),
  );
  const includePublic = state.pools.some((pool) => pool.organizationId == null);
  const sum = allocatedSum(state.pools);
  const remainder = state.capacity - sum;

  function updateSelection(nextOrgIds: Set<string>, nextPublic: boolean) {
    onChange({
      pools: buildPoolsFromSelection(nextOrgIds, nextPublic, organizations, state.pools),
    });
  }

  function applyEvenSplit() {
    if (state.pools.length === 0) return;
    const quantities = evenSplitQuantities(state.capacity, state.pools.length);
    onChange({
      pools: state.pools.map((pool, index) => ({
        ...pool,
        quantity: quantities[index] ?? 0,
      })),
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Participating organizations</Label>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-[var(--radius-md)] border border-border-subtle bg-white/[0.025] p-3">
          {sortedOrgs(organizations).map((org) => (
            <ToggleSwitch
              key={org.id}
              id={`wizard-org-${org.id}`}
              label={org.name}
              checked={selectedOrgIds.has(org.id)}
              onCheckedChange={(checked) => {
                const next = new Set(selectedOrgIds);
                if (checked) {
                  next.add(org.id);
                } else {
                  next.delete(org.id);
                }
                updateSelection(next, includePublic);
              }}
            />
          ))}
          {organizations.length === 0 ? (
            <p className="text-sm text-ink-500">No organizations found.</p>
          ) : null}
        </div>
        <ToggleSwitch
          id="wizard-public-pool"
          label="Include public pool"
          checked={includePublic}
          onCheckedChange={(checked) => updateSelection(selectedOrgIds, checked)}
        />
      </div>

      {state.pools.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Pool quantities</Label>
            <Button type="button" size="sm" variant="outline" onClick={applyEvenSplit}>
              Even split capacity
            </Button>
          </div>
          <ul className="divide-y divide-border-subtle rounded-[var(--radius-md)] border border-border-subtle bg-white/[0.025]">
            {state.pools.map((pool) => (
              <li
                key={poolRowKey(pool)}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="text-sm font-medium text-ink-100">{pool.orgName}</span>
                <div className="space-y-1">
                  <Label htmlFor={`wizard-qty-${poolRowKey(pool)}`} className="text-xs">
                    Quantity
                  </Label>
                  <Input
                    id={`wizard-qty-${poolRowKey(pool)}`}
                    type="number"
                    min={0}
                    value={pool.quantity > 0 ? String(pool.quantity) : ''}
                    onChange={(e) => {
                      const parsed = Number(e.target.value);
                      const quantity = Number.isFinite(parsed) ? parsed : 0;
                      onChange({
                        pools: state.pools.map((row) =>
                          poolRowKey(row) === poolRowKey(pool) ? { ...row, quantity } : row,
                        ),
                      });
                    }}
                    className="min-h-9 w-28"
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-ink-500">
          Select at least one organization or enable the public pool.
        </p>
      )}

      <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface-raised p-4 text-sm text-ink-300">
        <p>
          Allocated:{' '}
          <span className="num font-medium text-ink-100">
            {sum} / {state.capacity}
          </span>
        </p>
        <p>
          Remainder:{' '}
          <span
            className={`num ${
              remainder < 0 ? 'font-medium text-[color:var(--error)]' : 'font-medium text-ink-100'
            }`}
          >
            {remainder}
          </span>
        </p>
        {sum > state.capacity ? (
          <p className="mt-2 text-[color:var(--error)]">
            Total pool quantity exceeds capacity. Reduce quantities to continue.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function validateAllocateStep(state: WizardState): string | null {
  if (state.pools.length === 0) {
    return 'Select at least one pool.';
  }
  const hasPositive = state.pools.some((pool) => pool.quantity > 0);
  if (!hasPositive) {
    return 'Set a positive quantity for at least one pool.';
  }
  if (allocatedSum(state.pools) > state.capacity) {
    return 'Pool quantities cannot exceed total capacity.';
  }
  return null;
}
