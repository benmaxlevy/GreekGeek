export const WIZARD_STEP_LABELS = ['Enable', 'Allocate', 'Price', 'Verify'] as const;

export type WizardStepIndex = 0 | 1 | 2 | 3;

export type WizardPoolRow = {
  organizationId: string | null;
  orgName: string;
  quantity: number;
  priceUsd: string;
};

export type WizardState = {
  ticketingEnabled: boolean;
  capacity: number;
  salesOpenAt: string;
  salesCloseAt: string;
  pools: WizardPoolRow[];
};

export function poolRowKey(row: WizardPoolRow): string {
  return row.organizationId ?? 'public';
}

export function toLocalDatetime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalDatetime(value: string): string | null {
  if (!value.trim()) return null;
  return new Date(value).toISOString();
}

export function allocatedSum(pools: WizardPoolRow[]): number {
  return pools.reduce((sum, pool) => sum + pool.quantity, 0);
}

/** Floor split with remainder distributed one-by-one to first pools in order. */
export function evenSplitQuantities(capacity: number, poolCount: number): number[] {
  if (poolCount <= 0) return [];
  const base = Math.floor(capacity / poolCount);
  const remainder = capacity % poolCount;
  return Array.from({ length: poolCount }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function formatUsdPrice(priceUsd: string): string {
  const trimmed = priceUsd.trim();
  if (!trimmed) return 'Free';
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return trimmed;
  return `$${n.toFixed(2)}`;
}
